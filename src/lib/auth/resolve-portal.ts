import { portalFromHost, type Portal } from './roles';

const VALID_PORTALS: ReadonlyArray<Portal> = [
  'public',
  'customer',
  'driver',
  'manager',
  'superadmin',
];

/**
 * Decide which portal a request belongs to.
 *
 * Production: host header / subdomain (manager., driver., admin.).
 * Dev: also honors `?portal=manager|driver|...` for testing without
 * configuring local subdomains.
 *
 * Extracted from middleware.ts so it can be unit-tested without
 * pulling in next-intl / next-server (which fail jsdom module
 * resolution).
 */
export function resolvePortalFromRequest(req: Request): Portal {
  const url = new URL(req.url);
  const overrideQuery = url.searchParams.get('portal');
  if (overrideQuery && (VALID_PORTALS as readonly string[]).includes(overrideQuery)) {
    return overrideQuery as Portal;
  }
  const host = req.headers.get('host') ?? url.host;
  return portalFromHost(host);
}
