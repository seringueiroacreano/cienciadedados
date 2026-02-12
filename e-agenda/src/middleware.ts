import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Allow shared calendar pages without auth
    if (path.startsWith('/shared/')) {
      return NextResponse.next();
    }

    // Protect admin-only routes
    if (path.startsWith('/users') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow shared calendar access without auth
        if (req.nextUrl.pathname.startsWith('/shared/')) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/calendar/:path*',
    '/events/:path*',
    '/users/:path*',
    '/settings/:path*',
    '/shared-calendars/:path*',
  ],
};
