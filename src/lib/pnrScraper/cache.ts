import { DecodedPNRResult } from '@/lib/pnr';

interface CacheEntry {
  data: DecodedPNRResult;
  source: string;
  expiresAt: number;
}

const pnrCache = new Map<string, CacheEntry>();

// Short TTL: berth/status can change until the chart is prepared.
// ponytail: in-memory per server instance; move to Supabase/KV if lookups get rate-limited.
const CACHE_TTL_MS = 15 * 60 * 1000;

export const PnrCache = {
  get(pnr: string): { data: DecodedPNRResult; source: string } | null {
    const entry = pnrCache.get(pnr);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      pnrCache.delete(pnr);
      return null;
    }

    // Don't cache fallback/generated entries long-term so real data isn't blocked
    if (entry.source === 'fallback_engine') {
      return null;
    }

    return { data: entry.data, source: entry.source };
  },

  set(pnr: string, data: DecodedPNRResult, source: string = 'live'): void {
    // Waitlist/RAC or pre-chart tickets still change; always fetch fresh.
    if (data.status !== 'CONFIRMED' || !data.chartPrepared) return;
    pnrCache.set(pnr, {
      data,
      source,
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
