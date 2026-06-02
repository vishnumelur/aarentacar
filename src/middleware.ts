import { NextResponse, type NextRequest } from 'next/server';
import { PORTAL_TO_SEGMENT } from '@/lib/auth/roles';
import { resolvePortalFromRequest } from '@/lib/auth/resolve-portal';

/**
 * Shared auth routes live in the root (auth) route group and must resolve
 * the same on every portal/subdomain. They must NOT be rewritten into a
 * portal segment — otherwise e.g. driver.aa-rentacar.com/login would rewrite
 * to /driver/login (which doesn't exist) and 404, breaking login for an
 * unauthenticated visitor who gets redirected to /login on a subdomain.
 */
const SHARED_AUTH_PATHS = ['/login', '/register', '/totp'];

function isSharedAuthPath(pathname: string): boolean {
  return SHARED_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Subdomain → URL segment rewrite. We do NOT use next-intl's routing
 * middleware because we want cookie-based locale (no /en or /ar URL
 * prefix); see src/i18n/request.ts.
 */
export function middleware(req: NextRequest) {
  const portal = resolvePortalFromRequest(req);
  const segment = PORTAL_TO_SEGMENT[portal];

  if (segment && !isSharedAuthPath(req.nextUrl.pathname)) {
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
