import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { PORTAL_TO_SEGMENT } from '@/lib/auth/roles';
import { resolvePortalFromRequest } from '@/lib/auth/resolve-portal';

const intlMiddleware = createIntlMiddleware(routing);

export function middleware(req: NextRequest) {
  // 1. Apply i18n first (locale routing handled by next-intl).
  const intlResponse = intlMiddleware(req);

  // 2. Portal routing: rewrite path so each subdomain renders its segment.
  const portal = resolvePortalFromRequest(req);
  const segment = PORTAL_TO_SEGMENT[portal];

  if (segment) {
    const url = req.nextUrl.clone();
    if (!url.pathname.startsWith(`/${segment}`)) {
      url.pathname = `/${segment}${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url, intlResponse);
    }
  }
  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
