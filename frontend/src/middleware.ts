import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { ACCESS_CLIENT as ACCESS } from '@/lib/roles';

export default withAuth(
  function middleware(req) {
    const area = req.nextUrl.pathname.split('/')[1];
    const role = req.nextauth.token?.role;
    const allowed = ACCESS[area];
    if (allowed && role && !allowed.includes(role)) {
      // therapists land on the queue board; others go home
      return NextResponse.redirect(new URL(role === 'THERAPIST' ? '/queue' : '/', req.url));
    }
  },
  { callbacks: { authorized: ({ token }) => !!token } },
);

export const config = { matcher: ['/pos/:path*', '/queue/:path*', '/reports/:path*', '/receipt/:path*', '/customers/:path*', '/packages/:path*', '/inventory/:path*'] };
