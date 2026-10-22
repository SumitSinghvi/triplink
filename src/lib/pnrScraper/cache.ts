import { DecodedPNRResult } from '@/lib/pnr';

interface CacheEntry {
  data: DecodedPNRResult;
  expiresAt: number;
}

const pnrCache = new Map<string, CacheEntry>();

// 24-hour TTL in milliseconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const PnrCache = {
  get(pnr: string): DecodedPNRResult | null {
    const entry = pnrCache.get(pnr);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      pnrCache.delete(pnr);
      return null;
    }

    return entry.data;
  },

  set(pnr: string, data: DecodedPNRResult): void {
    pnrCache.set(pnr, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  },

  clear(): void {
    pnrCache.clear();
  },

  size(): number {
    return pnrCache.size;
  },
};
