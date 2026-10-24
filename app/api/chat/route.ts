import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { executeSmartRouting } from '@/lib/smart-routing';
import { getGoogleGenAI, getGeminiModelName, generateConversationTitle, checkGeminiHealth } from '@/lib/gemini';
import { getLanguageByCode } from '@/lib/languages';

export const dynamic = 'force-dynamic';

const chatInputSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1, 'Message cannot be empty'),
  attachedDocumentId: z.string().optional(),
  selectedDocumentIds: z.array(z.string()).optional(),
  manualLanguageOverride: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pre-flight check on Gemini availability
  const health = await checkGeminiHealth();
  if (!health.available) {
    return NextResponse.json(
      {
        error: `AI model unavailable: ${health.reason || 'Gemini service is unconfigured'}`,
      },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const parsed = chatInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Invalid input' }, { status: 400 });
  }

  const { message, attachedDocumentId, selectedDocumentIds, manualLanguageOverride } = parsed.data;
  let { conversationId } = parsed.data;

  try {
    // 1. Ensure conversation exists
    let conversation;
    let isNewConversation = false;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: user.id },
      });
    }

    if (!conversation) {
      isNewConversation = true;
      conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: 'New Chat',
        },
      });
      conversationId = conversation.id;
    }

    const finalConversationId = conversation.id;

    // 2. Fetch attached document details if any
    let attachmentName: string | undefined;
    let attachmentType: string | undefined;
    let attachmentPages: number | undefined;

    if (attachedDocumentId) {
      const doc = await prisma.document.findFirst({
        where: { id: attachedDocumentId, userId: user.id },
      });
      if (doc) {
        attachmentName = doc.fileName;
        attachmentType = doc.fileType;
        attachmentPages = doc.pageCount;
      }
    }

    // 3. Fetch past conversation messages for context & query rewriting
    const historyMessages = await prisma.message.findMany({
      where: { conversationId: finalConversationId },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    const history = historyMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 4. Run Smart Routing (parallel language detection + hybrid retrieval)
    const routingDecision = await executeSmartRouting({
      userId: user.id,
      conversationId: finalConversationId,
      message,
      attachedDocumentId,
      selectedDocumentIds,
      manualLanguageOverride,
      history,
    });

    // 5. Store the user's message in the database with attachment metadata
    const userMessageRecord = await prisma.message.create({
      data: {
        conversationId: finalConversationId,
        role: 'user',
        content: message,
        detectedLanguage: routingDecision.detectedLanguage,
        script: routingDecision.script,
        isRomanized: routingDecision.isRomanized,
        attachmentName,
        attachmentType,
        attachmentPages,
      },
    });

    // Format sources list for the client and DB
    const sourcesPayload = routingDecision.retrievedChunks.map((c) => ({
      documentId: c.documentId,
      documentTitle: c.documentTitle,
      pageNumber: c.pageNumber,
      snippet: c.content.slice(0, 240) + (c.content.length > 240 ? '...' : ''),
      fullContent: c.content,
      score: c.score,
    }));

    const sourcesJson = sourcesPayload.length > 0 ? JSON.stringify(sourcesPayload) : null;

    // Trigger auto-title generation in the background on first exchange
    if (isNewConversation) {
      const langInfo = getLanguageByCode(routingDecision.detectedLanguage);
      generateConversationTitle(message, langInfo?.name || 'English')
        .then(async (newTitle) => {
          if (newTitle && newTitle !== 'New Chat') {
            await prisma.conversation.update({
              where: { id: finalConversationId },
              data: { title: newTitle, detectedLanguage: routingDecision.detectedLanguage },
            });
          }
        })
        .catch((e) => console.error('Failed to auto-generate title:', e));
    }

    // 6. Handle NOT_FOUND mode directly
    if (routingDecision.mode === 'not_found') {
      const replyContent = routingDecision.notFoundMessage || "I couldn't find this in your documents.";

      const assistantMessageRecord = await prisma.message.create({
        data: {
          conversationId: finalConversationId,
          role: 'assistant',
          content: replyContent,
          detectedLanguage: routingDecision.detectedLanguage,
          script: routingDecision.script,
          isRomanized: routingDecision.isRomanized,
        },
      });

      // Stream the response with metadata
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(
              `event: meta\ndata: ${JSON.stringify({
                conversationId: finalConversationId,
                userMessageId: userMessageRecord.id,
                messageId: assistantMessageRecord.id,
                mode: 'not_found',
                detectedLanguage: routingDecision.detectedLanguage,
                script: routingDecision.script,
                isRomanized: routingDecision.isRomanized,
                sources: [],
              })}\n\n`
            )
          );

          controller.enqueue(
            encoder.encode(
              `event: chunk\ndata: ${JSON.stringify({ text: replyContent })}\n\n`
            )
          );

          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({
                messageId: assistantMessageRecord.id,
                fullText: replyContent,
              })}\n\n`
            )
          );
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    // 7. General Chat & RAG Modes: Stream from Google Gemini
    const ai = getGoogleGenAI();
    const model = ai.getGenerativeModel({
      model: getGeminiModelName(),
      systemInstruction: routingDecision.systemPrompt,
      generationConfig: {
        temperature: routingDecision.mode === 'document_rag' ? 0.2 : 0.7,
      },
    });

    // Build chat contents from history
    const contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];
    for (const h of history.slice(-6)) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const chatSession = model.startChat({
      history: contents.slice(0, -1),
    });

    const streamResult = await chatSession.sendMessageStream(message);

    // Prepare assistant record placeholder
    let accumulatedText = '';

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Send initial metadata event
        controller.enqueue(
          encoder.encode(
            `event: meta\ndata: ${JSON.stringify({
              conversationId: finalConversationId,
              userMessageId: userMessageRecord.id,
              mode: routingDecision.mode,
              detectedLanguage: routingDecision.detectedLanguage,
              script: routingDecision.script,
              isRomanized: routingDecision.isRomanized,
              sources: sourcesPayload,
              suggestedFollowUps: routingDecision.suggestedFollowUps || [],
            })}\n\n`
          )
        );

        try {
          for await (const chunk of streamResult.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              accumulatedText += chunkText;
              controller.enqueue(
                encoder.encode(
                  `event: chunk\ndata: ${JSON.stringify({ text: chunkText })}\n\n`
                )
              );
            }
          }

          // Save assistant message to DB
          const assistantMessageRecord = await prisma.message.create({
            data: {
              conversationId: finalConversationId,
              role: 'assistant',
              content: accumulatedText,
              detectedLanguage: routingDecision.detectedLanguage,
              script: routingDecision.script,
              isRomanized: routingDecision.isRomanized,
              sources: sourcesJson,
            },
          });

          // Touch conversation updatedAt
          await prisma.conversation.update({
            where: { id: finalConversationId },
            data: { updatedAt: new Date() },
          });

          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({
                messageId: assistantMessageRecord.id,
                fullText: accumulatedText,
              })}\n\n`
            )
          );
          controller.close();
        } catch (streamErr: unknown) {
          console.error('Error during LLM streaming:', streamErr);
          const errorMsg = streamErr instanceof Error ? streamErr.message : 'Error generating response';
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                error: `AI generation error: ${errorMsg}`,
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    console.error('Chat endpoint fatal error:', err);
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: `AI model unavailable: ${msg}` }, { status: 500 });
  }
}
