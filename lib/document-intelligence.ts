import prisma from './prisma';
import { extractDocumentPages, chunkDocumentPages } from './chunking';
import { batchGenerateEmbeddings, getGoogleGenAI, getGeminiModelName } from './gemini';
import { float32ArrayToBuffer } from './embeddings';
import { detectScriptFromUnicode, getLanguageByCode } from './languages';

export interface IngestDocumentParams {
  documentId: string;
  fileBuffer: Buffer;
  fileType: string;
  fileName: string;
  userId: string;
}

/**
 * Ingest document in background: extract pages, detect language,
 * chunk (~800 chars), batch generate embeddings, save chunks to PostgreSQL DB.
 */
export async function ingestDocumentInBackground(params: IngestDocumentParams): Promise<void> {
  const { documentId, fileBuffer, fileType, fileName } = params;

  try {
    // 1. Extract pages
    const pages = await extractDocumentPages(fileBuffer, fileType, fileName);
    const pageCount = pages.length > 0 ? pages.length : 1;

    // 2. Detect language from combined sample text
    const sampleText = pages
      .slice(0, 3)
      .map((p) => p.text)
      .join(' ')
      .slice(0, 1500);
    const detection = detectScriptFromUnicode(sampleText);
    const primaryLang = detection.candidateLanguages[0] || 'en';

    // 3. Create ~800 char chunks with page numbers
    const chunkData = chunkDocumentPages(pages, 800, 150);

    // 4. Batch generate embeddings with throttling and backoff
    const chunkTexts = chunkData.map((c) => c.content);
    let embeddings: number[][] = [];
    if (chunkTexts.length > 0) {
      embeddings = await batchGenerateEmbeddings(chunkTexts, 5, 250);
    }

    // 5. Store chunks in DB (using createMany for fast, pooler-safe execution)
    await prisma.documentChunk.deleteMany({ where: { documentId } });

    if (chunkData.length > 0) {
      const chunksToInsert = chunkData.map((item, i) => {
        const embVals = embeddings[i];
        return {
          documentId,
          pageNumber: item.pageNumber,
          chunkIndex: item.chunkIndex,
          content: item.content,
          embedding: embVals ? float32ArrayToBuffer(embVals) : null,
        };
      });

      await prisma.documentChunk.createMany({
        data: chunksToInsert,
      });
    }

    // Update document status to ready
    await prisma.document.update({
      where: { id: documentId },
      data: {
        pageCount,
        language: primaryLang,
        status: 'ready',
      },
    });

    console.log(`✓ Document ${documentId} (${fileName}) successfully ingested with ${chunkData.length} chunks.`);
  } catch (err: unknown) {
    console.error(`Document ingestion failed for ${documentId}:`, err);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'error' },
    });
  }
}

/**
 * Whole-document map-reduce requests (summarize, key points, action items, explain simply)
 * Processes all pages with page references and caches the result.
 */
export async function executeDocumentAction(
  documentId: string,
  userId: string,
  actionType: 'summarize' | 'keyPoints' | 'actionItems' | 'explainSimply' | 'translate',
  targetLanguage?: string
): Promise<string> {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId },
    include: {
      chunks: {
        orderBy: [{ pageNumber: 'asc' }, { chunkIndex: 'asc' }],
        take: 120, // process up to 120 chunks covering extensive multi-page documents
      },
    },
  });

  if (!doc) {
    throw new Error('Document not found or access denied');
  }

  // Check cache for standard actions
  if (actionType === 'summarize' && doc.summary && !targetLanguage) {
    return doc.summary;
  }
  if (actionType === 'keyPoints' && doc.keyPoints && !targetLanguage) {
    return doc.keyPoints;
  }
  if (actionType === 'actionItems' && doc.actionItems && !targetLanguage) {
    return doc.actionItems;
  }

  // Assemble document context grouped with page markers
  const contextByPages = doc.chunks.map((c) => `[Page ${c.pageNumber}]: ${c.content}`).join('\n\n');

  const langInfo = targetLanguage ? getLanguageByCode(targetLanguage) : null;
  const targetLangInstruction = langInfo
    ? `Respond exclusively in ${langInfo.name} (${langInfo.nativeName}).`
    : `Respond in the primary language of the document or English.`;

  let prompt = '';
  switch (actionType) {
    case 'summarize':
      prompt = `Provide a comprehensive, high-quality executive summary of this entire document: "${doc.title}".
Format with clear sections and include inline page citations [Page X] wherever key claims or data are mentioned.
${targetLangInstruction}

Document Content:
${contextByPages}`;
      break;

    case 'keyPoints':
      prompt = `Extract the most critical key points and takeaways from this document: "${doc.title}".
List them as structured bullet points with explicit page citations [Page X] for every point.
${targetLangInstruction}

Document Content:
${contextByPages}`;
      break;

    case 'actionItems':
      prompt = `Extract all actionable tasks, obligations, deliverables, deadlines, and action items found in this document: "${doc.title}".
Include who is responsible and reference the page number [Page X] for each item.
${targetLangInstruction}

Document Content:
${contextByPages}`;
      break;

    case 'explainSimply':
      prompt = `Explain the core concepts and findings of this document: "${doc.title}" in very simple, plain everyday terms (ELIF / Explain Like I'm Five).
Avoid jargon, use clear analogies, and cite the relevant pages [Page X].
${targetLangInstruction}

Document Content:
${contextByPages}`;
      break;

    case 'translate':
      prompt = `Translate the summary of this document: "${doc.title}" into ${langInfo?.name || 'the requested language'}.
Ensure the translation sounds natural and professional while preserving page references [Page X].

Document Content:
${contextByPages}`;
      break;
  }

  const ai = getGoogleGenAI();
  const model = ai.getGenerativeModel({ model: getGeminiModelName() });
  const result = await model.generateContent(prompt);
  const output = result.response.text().trim();

  // Cache back to DB if appropriate
  if (!targetLanguage) {
    if (actionType === 'summarize') {
      await prisma.document.update({ where: { id: documentId }, data: { summary: output } });
    } else if (actionType === 'keyPoints') {
      await prisma.document.update({ where: { id: documentId }, data: { keyPoints: output } });
    } else if (actionType === 'actionItems') {
      await prisma.document.update({ where: { id: documentId }, data: { actionItems: output } });
    }
  }

  return output;
}

/**
 * Compare two documents with citations to both
 */
export async function compareTwoDocuments(
  docId1: string,
  docId2: string,
  userId: string,
  userLanguage: string = 'en'
): Promise<string> {
  const [doc1, doc2] = await Promise.all([
    prisma.document.findFirst({
      where: { id: docId1, userId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } },
    }),
    prisma.document.findFirst({
      where: { id: docId2, userId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 40 } },
    }),
  ]);

  if (!doc1 || !doc2) {
    throw new Error('One or both documents not found');
  }

  const text1 = doc1.chunks.map((c) => `[${doc1.title} - Page ${c.pageNumber}]: ${c.content}`).join('\n\n');
  const text2 = doc2.chunks.map((c) => `[${doc2.title} - Page ${c.pageNumber}]: ${c.content}`).join('\n\n');

  const langInfo = getLanguageByCode(userLanguage);
  const langPrompt = langInfo ? `Respond in ${langInfo.name} (${langInfo.nativeName}).` : 'Respond in English.';

  const prompt = `Perform a side-by-side comparative analysis of these two documents:
Document 1: "${doc1.title}"
Document 2: "${doc2.title}"

Compare them across:
1. Core objectives and scope
2. Key similarities
3. Notable differences / discrepancies / contrasting clauses
4. Conclusion and takeaways

Always provide inline citations mentioning the document and page (e.g. [${doc1.title}, Page X] or [${doc2.title}, Page Y]).
${langPrompt}

--- DOCUMENT 1: ${doc1.title} ---
${text1}

--- DOCUMENT 2: ${doc2.title} ---
${text2}
`;

  const ai = getGoogleGenAI();
  const model = ai.getGenerativeModel({ model: getGeminiModelName() });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
