import { DecodedPNRResult, maskPNR } from '@/lib/pnr';
import { TravelClass, BerthPreference } from '@/types';

export async function scrapeEaseMyTrip(pnr: string): Promise<DecodedPNRResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const url = 'https://railways.easemytrip.com/Train/PnrchkStatus';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify({ Pnr: pnr }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();

    if (!data || !data.TrainNo) return null;

    const coach = data.PassengerList?.[0]?.BookingCoachId || 'B1';
    const berthNumber = parseInt(data.PassengerList?.[0]?.BookingBerthNo || '1', 10) || 1;

    let berthType: BerthPreference = 'Lower';
    const bLower = (data.PassengerList?.[0]?.BookingBerthCode || '').toLowerCase();
    if (bLower.includes('sl') || bLower.includes('side lower')) berthType = 'Side Lower';
    else if (bLower.includes('su') || bLower.includes('side upper')) berthType = 'Side Upper';
    else if (bLower.includes('u') || bLower.includes('upper')) berthType = 'Upper';
    else if (bLower.includes('m') || bLower.includes('middle')) berthType = 'Middle';

    return {
      pnr,
      maskedPnr: maskPNR(pnr),
      trainNumber: String(data.TrainNo).trim(),
      trainName: data.TrainName || 'Express',
      travelDate: data.Doj || new Date().toISOString().split('T')[0],
      fromCode: data.BoardingStation || data.From,
      fromName: data.BoardingStationName || data.From,
      toCode: data.ReservationUpto || data.To,
      toName: data.ReservationUptoName || data.To,
      travelClass: (data.Class || '3A') as TravelClass,
      coach,
      berthType,
      berthNumber,
      status: 'CONFIRMED',
      chartPrepared: Boolean(data.ChartPrepared),
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}
