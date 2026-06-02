import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __clearFeatureFlagCache,
  cachedFeatureLookup,
  FEATURE_FLAG_CACHE_TTL_MS,
} from '@/lib/feature-flags/cache';

describe('cachedFeatureLookup', () => {
  beforeEach(() => {
    __clearFeatureFlagCache();
    vi.useRealTimers();
  });

  it('calls the loader on a cold cache and returns its value', async () => {
    const loader = vi.fn().mockResolvedValue(true);
    const result = await cachedFeatureLookup('live-tracking', loader);
    expect(result).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('serves a cached value within the TTL without re-calling the loader', async () => {
    vi.useFakeTimers();
    const loader = vi.fn().mockResolvedValue(true);
    await cachedFeatureLookup('live-tracking', loader);
    vi.advanceTimersByTime(FEATURE_FLAG_CACHE_TTL_MS - 1);
    const result = await cachedFeatureLookup('live-tracking', loader);
    expect(result).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads after the TTL elapses', async () => {
    vi.useFakeTimers();
    const loader = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await cachedFeatureLookup('loyalty-points', loader)).toBe(false);
    vi.advanceTimersByTime(FEATURE_FLAG_CACHE_TTL_MS + 1);
    expect(await cachedFeatureLookup('loyalty-points', loader)).toBe(true);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('caches per-key independently', async () => {
    const a = vi.fn().mockResolvedValue(true);
    const b = vi.fn().mockResolvedValue(false);
    expect(await cachedFeatureLookup('live-tracking', a)).toBe(true);
    expect(await cachedFeatureLookup('maintenance-mode', b)).toBe(false);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('clearing the cache forces a reload', async () => {
    const loader = vi.fn().mockResolvedValue(true);
    await cachedFeatureLookup('corporate-accounts', loader);
    __clearFeatureFlagCache();
    await cachedFeatureLookup('corporate-accounts', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
