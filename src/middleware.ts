import { NextRequest, NextResponse } from 'next/server';
import { secureLog } from '@/lib/secure-logger';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');

    secureLog.debug('Middleware - Path:', pathname);
    secureLog.debug('Middleware - Token found:', !!token);

    if (!token) {
      secureLog.debug('Middleware - No token, redirecting to login');
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Simple JWT payload extraction without verification for middleware
    // Full verification happens in API routes
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      secureLog.debug('Middleware - Token payload:', payload);
      
      if (!payload || !['admin', 'client', 'demo'].includes(payload.role)) {
        secureLog.debug('Middleware - Invalid token or unauthorized role, redirecting to login');
        return NextResponse.redirect(new URL('/login', request.url));
      }
      
      // Check admin-only paths
      const adminOnlyPaths = [
        '/admin/ai-models',
        '/admin/prompts', 
        '/admin/performance',
        '/admin/semantic-test',
        '/admin/users' // New user management section
      ];
      
      const isAdminOnlyPath = adminOnlyPaths.some(path => pathname.startsWith(path));
      
      if (isAdminOnlyPath && payload.role !== 'admin') {
        secureLog.warn(`Middleware - ${payload.role} attempted to access admin-only path: ${pathname}`);
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      
      // Log access granted with role
      secureLog.debug(`Middleware - Access granted to ${payload.role}`);
    } catch (error) {
      secureLog.error('Middleware - Token parsing failed:', error);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};