import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

const updateMessageSchema = z.object({
  reaction: z.enum(['like', 'dislike']).nullable().optional(),
  content: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = updateMessageSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 });
    }

    const message = await prisma.message.findFirst({
      where: {
        id: params.id,
        conversation: { userId: user.id },
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const updated = await prisma.message.update({
      where: { id: params.id },
      data: result.data,
    });

    return NextResponse.json({ message: updated });
  } catch (err: unknown) {
    console.error('Update message error:', err);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}
