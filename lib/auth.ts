import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import prisma from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'polyrag-enterprise-secure-jwt-secret-key-32chars';
const secretKey = new TextEncoder().encode(JWT_SECRET);
export const AUTH_COOKIE_NAME = 'auth_token';

// In-memory rate limiting for login attempts: 5 attempts per 15 minutes per IP/email
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record || now > record.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return { allowed: true };
  }

  if (record.count >= 5) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds: retryAfter };
  }

  record.count += 1;
  return { allowed: true };
}

export function resetLoginRateLimit(key: string) {
  loginAttempts.delete(key);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface UserSessionPayload {
  userId: string;
  email: string;
}

export async function signJwt(payload: UserSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

export async function verifyJwt(token: string): Promise<UserSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifyJwt(token);
  if (!session?.userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        defaultLanguage: true,
        interfaceLanguage: true,
        theme: true,
        fontSize: true,
      },
    });
    return user;
  } catch (error) {
    console.error('Failed to retrieve session user from DB:', error);
    return null;
  }
}
