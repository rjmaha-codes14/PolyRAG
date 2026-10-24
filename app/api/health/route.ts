import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkGeminiHealth } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error: ' + (err instanceof Error ? err.message : String(err));
  }

  const aiStatus = await checkGeminiHealth();

  const isHealthy = dbStatus === 'connected' && aiStatus.available;

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      ai: {
        available: aiStatus.available,
        model: aiStatus.model,
        embedModel: aiStatus.embedModel,
        reason: aiStatus.reason || null,
      },
    },
    { status: 200 }
  );
}
