import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSessionUser, hashPassword, verifyPassword, AUTH_COOKIE_NAME } from '@/lib/auth';

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  defaultLanguage: z.string().optional(),
  interfaceLanguage: z.string().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  fontSize: z.enum(['small', 'medium', 'large']).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    res.cookies.set(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    });
    return res;
  }
  return NextResponse.json({ user });
}

export async function PATCH(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = updateProfileSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const { name, defaultLanguage, interfaceLanguage, theme, fontSize, currentPassword, newPassword } = result.data;
    const updateData: Record<string, any> = {};

    if (name) updateData.name = name;
    if (defaultLanguage) updateData.defaultLanguage = defaultLanguage;
    if (interfaceLanguage) updateData.interfaceLanguage = interfaceLanguage;
    if (theme) updateData.theme = theme;
    if (fontSize) updateData.fontSize = fontSize;

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required to set a new password' }, { status: 400 });
      }
      const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const isMatch = await verifyPassword(currentPassword, user.passwordHash);
      if (!isMatch) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
      updateData.passwordHash = await hashPassword(newPassword);
    }

    const updatedUser = await prisma.user.update({
      where: { id: sessionUser.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        defaultLanguage: true,
        interfaceLanguage: true,
        theme: true,
        fontSize: true,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: unknown) {
    console.error('Update profile error:', err);
    return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}

export async function DELETE() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.user.delete({ where: { id: sessionUser.id } });
    const response = NextResponse.json({ success: true, message: 'Account deleted successfully' });
    response.cookies.set(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
    });
    return response;
  } catch (err: unknown) {
    console.error('Delete account error:', err);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
