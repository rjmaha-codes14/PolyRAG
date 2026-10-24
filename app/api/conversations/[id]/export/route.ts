import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'md';

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  if (format === 'json') {
    return new NextResponse(JSON.stringify(conversation, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(conversation.title)}.json"`,
      },
    });
  }

  // Markdown format
  let markdown = `# ${conversation.title}\n`;
  markdown += `*Exported from PolyRAG on ${new Date().toLocaleDateString()}*\n\n---\n\n`;

  for (const m of conversation.messages) {
    const roleName = m.role === 'user' ? 'User' : 'PolyRAG';
    const langTag = m.detectedLanguage ? ` (${m.detectedLanguage.toUpperCase()})` : '';
    markdown += `### ${roleName}${langTag}\n`;
    if (m.attachmentName) {
      markdown += `*Attached document: ${m.attachmentName} (${m.attachmentPages || 1} pages)*\n\n`;
    }
    markdown += `${m.content}\n\n`;

    if (m.sources) {
      try {
        const sources = JSON.parse(m.sources);
        if (Array.isArray(sources) && sources.length > 0) {
          markdown += `#### Sources:\n`;
          sources.forEach((s: any, idx: number) => {
            markdown += `- [${idx + 1}] **${s.documentTitle}** (Page ${s.pageNumber}): ${s.snippet || ''}\n`;
          });
          markdown += `\n`;
        }
      } catch {
        // ignore parse error
      }
    }
    markdown += `---\n\n`;
  }

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(conversation.title)}.md"`,
    },
  });
}
