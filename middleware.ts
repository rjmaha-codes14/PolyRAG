import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'polyrag-enterprise-secure-jwt-secret-key-32chars';
const secretKey = new TextEncoder().encode(JWT_SECRET);
const AUTH_COOKIE = 'auth_token';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE)?.value;

  // Verify JWT token
  let isValid = false;
  if (token) {
    try {
      await jwtVerify(token, secretKey);
      isValid = true;
    } catch {
      isValid = false;
    }
  }

  // Public paths that do not require authentication
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isPublicApi = pathname.startsWith('/api/auth') || pathname === '/api/health';
  const isStatic =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/test');

  if (isStatic) {
    return NextResponse.next();
  }

  // If already authenticated and trying to visit login/register, redirect to /chat
  if (isAuthPage && isValid) {
    return NextResponse.redirect(new URL('/chat', req.url));
  }

  // If public route, allow
  if (isAuthPage || isPublicApi) {
    return NextResponse.next();
  }

  // Protected API routes: return 401 JSON if unauthorized
  if (pathname.startsWith('/api/') && !isValid) {
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
  }

  // Protected Page routes (e.g. /chat, /, etc.): redirect to /login
  if (!isValid) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
