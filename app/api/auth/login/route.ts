import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyPassword, signJwt, AUTH_COOKIE_NAME, checkLoginRateLimit, resetLoginRateLimit } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0]?.message || 'Invalid input data' },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    // Rate-limit check by email
    const rateCheck = checkLoginRateLimit(email);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many failed login attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Reset rate-limit on success
    resetLoginRateLimit(email);

    const token = await signJwt({ userId: user.id, email: user.email });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        defaultLanguage: user.defaultLanguage,
        interfaceLanguage: user.interfaceLanguage,
        theme: user.theme,
        fontSize: user.fontSize,
      },
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: unknown) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
