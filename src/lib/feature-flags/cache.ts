/**
 * 30-second in-process cache for feature-flag lookups (Plan #11). Kept as a
 * pure, DB-agnostic layer (loader injected) so the caching behaviour is unit
 * testable without a database. `isFeatureEnabled` in ./index.ts wires the real
 * DB loader through here.
 */

export const FEATURE_FLAG_CACHE_TTL_MS = 30_000;

interface CacheEntry {
  value: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Test-only: drop the cache between cases. */
export function __clearFeatureFlagCache(): void {
  cache.clear();
}

/** Invalidate a single flag (called after a toggle so changes show immediately). */
export function invalidateFeatureFlag(key: string): void {
  cache.delete(key);
}

export async function cachedFeatureLookup(
  key: string,
  loader: () => Promise<boolean>,
): Promise<boolean> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + FEATURE_FLAG_CACHE_TTL_MS });
  return value;
}
