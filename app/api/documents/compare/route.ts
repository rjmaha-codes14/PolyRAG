import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { compareTwoDocuments } from '@/lib/document-intelligence';

const compareSchema = z.object({
  docId1: z.string().min(1),
  docId2: z.string().min(1),
  language: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = compareSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Please select two valid documents to compare' }, { status: 400 });
    }

    const { docId1, docId2, language } = result.data;
    if (docId1 === docId2) {
      return NextResponse.json({ error: 'Please select two different documents to compare' }, { status: 400 });
    }

    const comparison = await compareTwoDocuments(docId1, docId2, user.id, language || user.defaultLanguage);

    return NextResponse.json({
      success: true,
      comparison,
    });
  } catch (err: unknown) {
    console.error('Document comparison error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to compare documents';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
