import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');

    console.log('Middleware - Path:', pathname);
    console.log('Middleware - Token found:', !!token);

    if (!token) {
      console.log('Middleware - No token, redirecting to login');
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Simple JWT payload extraction without verification for middleware
    // Full verification happens in API routes
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('Middleware - Token payload:', payload);
      
      if (!payload || payload.role !== 'admin') {
        console.log('Middleware - Invalid token or not admin, redirecting to login');
        return NextResponse.redirect(new URL('/login', request.url));
      }
      
      console.log('Middleware - Access granted to admin');
    } catch (error) {
      console.log('Middleware - Token parsing failed:', error);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};