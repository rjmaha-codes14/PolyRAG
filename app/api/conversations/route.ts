import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim() || '';

  const whereClause: any = { userId: user.id };
  if (query) {
    whereClause.OR = [
      { title: { contains: query } },
      { messages: { some: { content: { contains: query } } } },
    ];
  }

  const conversations = await prisma.conversation.findMany({
    where: whereClause,
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      isPinned: true,
      detectedLanguage: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { messages: true },
      },
    },
  });

  return NextResponse.json({ conversations });
}

const createConversationSchema = z.object({
  title: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = createConversationSchema.safeParse(body);
    const title = parsed.success && parsed.data.title ? parsed.data.title : 'New Chat';

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title,
      },
    });

    return NextResponse.json({ conversation });
  } catch (err: unknown) {
    console.error('Create conversation error:', err);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}

// Delete all chats for user
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.conversation.deleteMany({
      where: { userId: user.id },
    });
    return NextResponse.json({ success: true, message: 'All conversations deleted' });
  } catch (err: unknown) {
    console.error('Delete all conversations error:', err);
    return NextResponse.json({ error: 'Failed to delete conversations' }, { status: 500 });
  }
}
