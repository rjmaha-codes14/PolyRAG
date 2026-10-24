import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

const updateConversationSchema = z.object({
  title: z.string().optional(),
  isPinned: z.boolean().optional(),
});

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor'); // message ID for pagination
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const messageQuery: any = {
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: limit,
  };

  if (cursor) {
    messageQuery.cursor = { id: cursor };
    messageQuery.skip = 1;
  }

  const messages = await prisma.message.findMany(messageQuery);

  return NextResponse.json({
    conversation,
    messages,
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = updateConversationSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: params.id, userId: user.id },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: result.data,
    });

    return NextResponse.json({ conversation: updated });
  } catch (err: unknown) {
    console.error('Update conversation error:', err);
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: params.id, userId: user.id },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    await prisma.conversation.delete({
      where: { id: conversation.id },
    });

    return NextResponse.json({ success: true, message: 'Conversation deleted' });
  } catch (err: unknown) {
    console.error('Delete conversation error:', err);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}
