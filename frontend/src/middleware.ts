/**
 * SABI — Fixed Next.js Middleware
 *
 * BUG-002 FIX: Original middleware tried to read localStorage
 * in server/edge context — impossible. Server middleware can only
 * read cookies or request headers.
 *
 * SOLUTION: This middleware does NO auth checking.
 * All auth protection is done client-side via the AuthGuard
 * component in each protected layout (see below).
 * The middleware only handles:
 *   1. Redirecting / to appropriate login
 *   2. Adding security headers
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect root to agency login
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
};
