import { DecodedPNRResult, maskPNR } from '@/lib/pnr';
import { TravelClass, BerthPreference } from '@/types';

export interface ScrapeConfirmTktResult {
  success: boolean;
  data?: DecodedPNRResult;
  reason?: string;
}

export async function scrapeConfirmTkt(pnr: string): Promise<ScrapeConfirmTktResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `https://api.confirmtkt.com/api/pnr/status/${pnr}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        reason: `IRCTC gateway returned HTTP ${response.status}`,
      };
    }

    const raw = await response.json();

    if (!raw) {
      return {
        success: false,
        reason: 'Empty response received from railway gateway',
      };
    }

    if (raw.Error) {
      return {
        success: false,
        reason: raw.Error,
      };
    }

    if (raw.InformationMessage) {
      return {
        success: false,
        reason: raw.InformationMessage,
      };
    }

    if (!raw.TrainNo || !raw.TrainName) {
      return {
        success: false,
        reason: 'PNR not found or ticket has been flushed from IRCTC servers',
      };
    }

    const firstPassenger = raw.PassengerStatus?.[0] || {};
    const coach = firstPassenger.Coach || raw.Class || 'C1';
    const berthNumber = parseInt(String(firstPassenger.Berth || '1'), 10) || 1;

    let berthType: BerthPreference = 'Window';
    const bCode = (
      firstPassenger.BookingBerthCode ||
      firstPassenger.CurrentBerthCode ||
      ''
    ).toLowerCase();
    if (bCode.includes('ws') || bCode.includes('window')) berthType = 'Window';
    else if (bCode.includes('sl') || bCode.includes('side lower')) berthType = 'Side Lower';
    else if (bCode.includes('su') || bCode.includes('side upper')) berthType = 'Side Upper';
    else if (bCode.includes('l') || bCode.includes('lower')) berthType = 'Lower';
    else if (bCode.includes('m') || bCode.includes('middle')) berthType = 'Middle';
    else if (bCode.includes('u') || bCode.includes('upper')) berthType = 'Upper';
    else if (bCode.includes('a') || bCode.includes('aisle')) berthType = 'Aisle';

    const rawStatus = (firstPassenger.CurrentStatus || firstPassenger.ConfirmTktStatus || 'CNF').toUpperCase();
    let status: 'CONFIRMED' | 'RAC' | 'WL' = 'CONFIRMED';
    if (rawStatus.includes('RAC')) status = 'RAC';
    else if (rawStatus.includes('WL')) status = 'WL';

    const data: DecodedPNRResult = {
      pnr,
      maskedPnr: maskPNR(pnr),
      trainNumber: String(raw.TrainNo).trim(),
      trainName: raw.TrainName,
      travelDate: raw.Doj || new Date().toISOString().split('T')[0],
      fromCode: raw.From || raw.BoardingPoint || '',
      fromName: raw.BoardingStationName || raw.SourceName || raw.From || '',
      toCode: raw.To || raw.ReservationUpto || '',
      toName: raw.ReservationUptoName || raw.DestinationName || raw.To || '',
      travelClass: (raw.Class || 'CC') as TravelClass,
      coach,
      berthType,
      berthNumber,
      status,
      chartPrepared: Boolean(raw.ChartPrepared),
    };

    return {
      success: true,
      data,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      success: false,
      reason: isTimeout
        ? 'Railway server response timed out (8s)'
        : 'Network error connecting to railway gateway',
    };
  }
}
