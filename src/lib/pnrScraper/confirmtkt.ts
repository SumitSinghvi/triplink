import { DecodedPNRResult, maskPNR } from '@/lib/pnr';
import { TravelClass, BerthPreference } from '@/types';

export async function scrapeConfirmTkt(pnr: string): Promise<DecodedPNRResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://www.confirmtkt.com/pnr-status/${pnr}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();

    // Look for data object in script or raw text
    const pattern = /data\s*=\s*({[\s\S]*?});/;
    const match = html.match(pattern);

    if (!match || !match[1]) return null;

    const raw = JSON.parse(match[1]);

    // Validate minimum required fields
    if (!raw.TrainNo || !raw.From || !raw.To) return null;

    const firstPassenger = raw.PassengerStatus?.[0] || {};
    const coach = firstPassenger.Coach || raw.Class || 'B1';
    const berthNumber = parseInt(firstPassenger.Berth || '1', 10) || 1;

    // Normalize berth preference
    let berthType: BerthPreference = 'Lower';
    const bLower = (firstPassenger.BerthType || '').toLowerCase();
    if (bLower.includes('side lower')) berthType = 'Side Lower';
    else if (bLower.includes('side upper')) berthType = 'Side Upper';
    else if (bLower.includes('upper')) berthType = 'Upper';
    else if (bLower.includes('middle')) berthType = 'Middle';
    else if (bLower.includes('window')) berthType = 'Window';

    return {
      pnr,
      maskedPnr: maskPNR(pnr),
      trainNumber: String(raw.TrainNo).trim(),
      trainName: raw.TrainName || 'Express',
      travelDate: raw.Doj || new Date().toISOString().split('T')[0],
      fromCode: raw.From,
      fromName: raw.FromName || raw.From,
      toCode: raw.To,
      toName: raw.ToName || raw.To,
      travelClass: (raw.Class || '3A') as TravelClass,
      coach,
      berthType,
      berthNumber,
      status: raw.ChartPrepared ? 'CONFIRMED' : 'CONFIRMED',
      chartPrepared: Boolean(raw.ChartPrepared),
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}
