import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { executeDocumentAction } from '@/lib/document-intelligence';

const actionSchema = z.object({
  action: z.enum(['summarize', 'keyPoints', 'actionItems', 'explainSimply', 'translate']),
  targetLanguage: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = actionSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0]?.message || 'Invalid action' }, { status: 400 });
    }

    const { action, targetLanguage } = result.data;

    const output = await executeDocumentAction(params.id, user.id, action, targetLanguage);

    return NextResponse.json({
      success: true,
      action,
      result: output,
    });
  } catch (err: unknown) {
    console.error('Document action error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to execute document action';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
