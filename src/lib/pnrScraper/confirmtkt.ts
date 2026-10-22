import { DecodedPNRResult, maskPNR } from '@/lib/pnr';
import { TravelClass, BerthPreference } from '@/types';

export async function scrapeConfirmTkt(pnr: string): Promise<DecodedPNRResult | null> {
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

    if (!response.ok) return null;

    const raw = await response.json();

    if (!raw || !raw.TrainNo || raw.Error) return null;

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

    return {
      pnr,
      maskedPnr: maskPNR(pnr),
      trainNumber: String(raw.TrainNo).trim(),
      trainName: raw.TrainName || 'Express',
      travelDate: raw.Doj || new Date().toISOString().split('T')[0],
      fromCode: raw.From || raw.BoardingPoint || '',
      fromName: raw.BoardingStationName || raw.SourceName || raw.From || '',
      toCode: raw.To || raw.ReservationUpto || '',
      toName: raw.ReservationUptoName || raw.DestinationName || raw.To || '',
      travelClass: (raw.Class || 'CC') as TravelClass,
      coach,
      berthType,
      berthNumber,
      status: 'CONFIRMED',
      chartPrepared: Boolean(raw.ChartPrepared),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('ConfirmTkt API error:', err);
    return null;
  }
}
