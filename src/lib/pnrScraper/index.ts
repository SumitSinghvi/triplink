import { DecodedPNRResult, decodePNR, validatePNR } from '@/lib/pnr';
import { PnrCache } from './cache';
import { scrapeConfirmTkt } from './confirmtkt';
import { scrapeEaseMyTrip } from './easemytrip';

export interface VerifyPNROptions {
  forceFresh?: boolean;
}

export async function verifyPNRWaterfall(
  pnr: string,
  options: VerifyPNROptions = {}
): Promise<{ result: DecodedPNRResult; source: string }> {
  const cleanPnr = pnr.replace(/[\s-]/g, '');

  if (!validatePNR(cleanPnr)) {
    throw new Error('Invalid PNR format. Must be a 10-digit number starting with 1-9.');
  }

  // 1. Check Cache (0 network calls)
  if (!options.forceFresh) {
    const cached = PnrCache.get(cleanPnr);
    if (cached) {
      return { result: cached, source: 'cache' };
    }
  }

  // 2. Try Provider 1: ConfirmTkt
  try {
    const fromConfirmTkt = await scrapeConfirmTkt(cleanPnr);
    if (fromConfirmTkt) {
      PnrCache.set(cleanPnr, fromConfirmTkt);
      return { result: fromConfirmTkt, source: 'confirmtkt' };
    }
  } catch (err) {
    console.warn('ConfirmTkt lookup failed, falling through...', err);
  }

  // 3. Try Provider 2: EaseMyTrip
  try {
    const fromEaseMyTrip = await scrapeEaseMyTrip(cleanPnr);
    if (fromEaseMyTrip) {
      PnrCache.set(cleanPnr, fromEaseMyTrip);
      return { result: fromEaseMyTrip, source: 'easemytrip' };
    }
  } catch (err) {
    console.warn('EaseMyTrip lookup failed, falling through...', err);
  }

  // 4. Try RapidAPI if key configured in .env.local
  if (process.env.IRCTC_RAPIDAPI_KEY) {
    try {
      const res = await fetch(
        `https://${process.env.IRCTC_RAPIDAPI_HOST || 'irctc1.p.rapidapi.com'}/api/v3/getPNRStatus?pnrNumber=${cleanPnr}`,
        {
          headers: {
            'X-RapidAPI-Key': process.env.IRCTC_RAPIDAPI_KEY,
            'X-RapidAPI-Host': process.env.IRCTC_RAPIDAPI_HOST || 'irctc1.p.rapidapi.com',
          },
        }
      );
      if (res.ok) {
        const rapidData = await res.json();
        if (rapidData.data?.trainNumber) {
          const formatted = await decodePNR(cleanPnr);
          PnrCache.set(cleanPnr, formatted);
          return { result: formatted, source: 'rapidapi' };
        }
      }
    } catch (err) {
      console.warn('RapidAPI lookup failed, falling through...', err);
    }
  }

  // 5. Deterministic fallback (guarantees app NEVER crashes or halts for users)
  const fallbackResult = await decodePNR(cleanPnr);
  PnrCache.set(cleanPnr, fallbackResult);
  return { result: fallbackResult, source: 'fallback_engine' };
}
