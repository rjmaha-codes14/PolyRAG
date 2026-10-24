import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pageParam = searchParams.get('page');

  const doc = await prisma.document.findFirst({
    where: { id: params.id, userId: user.id },
  });

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // If a specific page is requested for the preview modal
  if (pageParam) {
    const pageNumber = parseInt(pageParam, 10);
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: params.id, pageNumber },
      orderBy: { chunkIndex: 'asc' },
      select: {
        id: true,
        pageNumber: true,
        chunkIndex: true,
        content: true,
      },
    });

    const pageText = chunks.map((c) => c.content).join('\n\n');
    return NextResponse.json({
      documentId: doc.id,
      title: doc.title,
      pageNumber,
      pageText,
      chunks,
    });
  }

  // Return document summary info and chunk counts
  const chunkCount = await prisma.documentChunk.count({
    where: { documentId: doc.id },
  });

  return NextResponse.json({
    document: {
      ...doc,
      chunkCount,
    },
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const doc = await prisma.document.findFirst({
      where: { id: params.id, userId: user.id },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    await prisma.document.delete({
      where: { id: doc.id },
    });

    return NextResponse.json({ success: true, message: 'Document deleted successfully' });
  } catch (err: unknown) {
    console.error('Delete document error:', err);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
