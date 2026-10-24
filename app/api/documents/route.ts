import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { ingestDocumentInBackground } from '@/lib/document-intelligence';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const documents = await prisma.document.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      pageCount: true,
      language: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { chunks: true },
      },
    },
  });

  return NextResponse.json({ documents });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name;
    const fileSize = file.size;
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Determine file extension
    const extMatch = fileName.match(/\.([0-9a-z]+)$/i);
    const fileType = extMatch ? extMatch[1].toLowerCase() : 'txt';

    // Derive readable title without extension
    const title = fileName.replace(/\.[^/.]+$/, '').trim() || 'Untitled Document';

    // Create record with processing status
    const document = await prisma.document.create({
      data: {
        userId: user.id,
        title,
        fileName,
        fileType,
        fileSize,
        status: 'processing',
      },
    });

    // Start background ingestion asynchronously
    ingestDocumentInBackground({
      documentId: document.id,
      fileBuffer,
      fileType,
      fileName,
      userId: user.id,
    }).catch((err) => {
      console.error(`Background ingestion failed for doc ${document.id}:`, err);
    });

    return NextResponse.json({
      success: true,
      document,
      message: 'Document uploaded and processing started in background',
    });
  } catch (err: unknown) {
    console.error('Document upload error:', err);
    return NextResponse.json({ error: 'Failed to process document upload' }, { status: 500 });
  }
}
