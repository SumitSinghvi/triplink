import { DecodedPNRResult, validatePNR } from '@/lib/pnr';
import { PnrCache } from './cache';
import { scrapeConfirmTkt } from './confirmtkt';
import { scrapeEaseMyTrip } from './easemytrip';

export interface VerifyPNROptions {
  forceFresh?: boolean;
}

export type VerifyWaterfallResult =
  | { success: true; result: DecodedPNRResult; source: string }
  | { success: false; error: string; reason: string };

export async function verifyPNRWaterfall(
  pnr: string,
  options: VerifyPNROptions = {}
): Promise<VerifyWaterfallResult> {
  const cleanPnr = pnr.replace(/[\s-]/g, '');

  if (!validatePNR(cleanPnr)) {
    return {
      success: false,
      error: 'Invalid PNR',
      reason: 'PNR must be exactly 10 digits starting with 1-9',
    };
  }

  // 1. Check Cache (0 network calls)
  if (!options.forceFresh) {
    const cached = PnrCache.get(cleanPnr);
    if (cached) {
      return { success: true, result: cached.data, source: 'cache' };
    }
  }

  let lastReason = 'Ticket not found or flushed from IRCTC database';

  // 2. Try Provider 1: ConfirmTkt API
  try {
    const confirmRes = await scrapeConfirmTkt(cleanPnr);
    if (confirmRes.success && confirmRes.data) {
      PnrCache.set(cleanPnr, confirmRes.data, 'confirmtkt');
      return { success: true, result: confirmRes.data, source: 'confirmtkt' };
    }
    if (confirmRes.reason) {
      lastReason = confirmRes.reason;
    }
  } catch (err) {
    console.warn('ConfirmTkt lookup error:', err);
  }

  // 3. Try Provider 2: EaseMyTrip (as backup)
  try {
    const fromEaseMyTrip = await scrapeEaseMyTrip(cleanPnr);
    if (fromEaseMyTrip) {
      PnrCache.set(cleanPnr, fromEaseMyTrip, 'easemytrip');
      return { success: true, result: fromEaseMyTrip, source: 'easemytrip' };
    }
  } catch (err) {
    console.warn('EaseMyTrip lookup error:', err);
  }

  // NO FAKE FALLBACK DATA. If not found in live database, return clean error with exact reason.
  return {
    success: false,
    error: 'PNR not found',
    reason: lastReason,
  };
}
