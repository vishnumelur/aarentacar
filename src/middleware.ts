import { NextResponse, type NextRequest } from 'next/server';
import { PORTAL_TO_SEGMENT } from '@/lib/auth/roles';
import { resolvePortalFromRequest } from '@/lib/auth/resolve-portal';

/**
 * Subdomain → URL segment rewrite. We do NOT use next-intl's routing
 * middleware because we want cookie-based locale (no /en or /ar URL
 * prefix); see src/i18n/request.ts.
 */
export function middleware(req: NextRequest) {
  const portal = resolvePortalFromRequest(req);
  const segment = PORTAL_TO_SEGMENT[portal];

  if (segment) {
    const url = req.nextUrl.clone();
    if (!url.pathname.startsWith(`/${segment}`)) {
      url.pathname = `/${segment}${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
