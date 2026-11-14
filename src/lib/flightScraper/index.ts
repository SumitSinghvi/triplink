import { normalizeTravelDate, todayIso } from '@/lib/travelDate';

export interface VerifiedFlight {
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  travelDate: string;
  fromCode: string;
  fromCity: string;
  fromAirport: string;
  fromTerminal?: string;
  toCode: string;
  toCity: string;
  toAirport: string;
  toTerminal?: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  status: string;
}

const CARRIERS: Record<string, string> = {
  '6E': 'IndiGo',
  AI: 'Air India',
  QP: 'Akasa Air',
  SG: 'SpiceJet',
  UK: 'Vistara',
  IX: 'Air India Express',
  I5: 'AIX Connect',
  G8: 'Go First',
  EK: 'Emirates',
  EY: 'Etihad Airways',
  QR: 'Qatar Airways',
  SQ: 'Singapore Airlines',
};

const AIRPORTS: Record<string, { city: string; name: string; defaultTerminal?: string }> = {
  AMD: { city: 'Ahmedabad', name: 'Sardar Vallabhbhai Patel Intl', defaultTerminal: 'T1' },
  BOM: { city: 'Mumbai', name: 'Chhatrapati Shivaji Maharaj Intl', defaultTerminal: 'T2' },
  DEL: { city: 'New Delhi', name: 'Indira Gandhi Intl', defaultTerminal: 'T3' },
  BLR: { city: 'Bengaluru', name: 'Kempegowda Intl', defaultTerminal: 'T1' },
  HYD: { city: 'Hyderabad', name: 'Rajiv Gandhi Intl', defaultTerminal: 'T1' },
  MAA: { city: 'Chennai', name: 'Chennai Intl', defaultTerminal: 'T1' },
  CCU: { city: 'Kolkata', name: 'Netaji Subhash Chandra Bose Intl', defaultTerminal: 'T2' },
  PNQ: { city: 'Pune', name: 'Pune Airport', defaultTerminal: 'T1' },
  GOI: { city: 'Goa (Dabolim)', name: 'Dabolim Airport', defaultTerminal: 'T1' },
  GOX: { city: 'Goa (Mopa)', name: 'Manohar Intl Airport', defaultTerminal: 'T1' },
  JAI: { city: 'Jaipur', name: 'Jaipur Intl', defaultTerminal: 'T2' },
  LKO: { city: 'Lucknow', name: 'Chaudhary Charan Singh Intl', defaultTerminal: 'T2' },
  COK: { city: 'Kochi', name: 'Cochin Intl', defaultTerminal: 'T1' },
  STV: { city: 'Surat', name: 'Surat Airport', defaultTerminal: 'T1' },
  IXC: { city: 'Chandigarh', name: 'Shaheed Bhagat Singh Intl', defaultTerminal: 'T1' },
  VNS: { city: 'Varanasi', name: 'Lal Bahadur Shastri Intl', defaultTerminal: 'T1' },
  PAT: { city: 'Patna', name: 'Jay Prakash Narayan Intl', defaultTerminal: 'T1' },
};

// Known popular corridor flights database
const FLIGHT_DATABASE: Record<
  string,
  {
    from: string;
    to: string;
    fromTerm?: string;
    toTerm?: string;
    dep: string;
    arr: string;
    duration: string;
  }
> = {
  // Ahmedabad - Mumbai corridor
  '6E-214': { from: 'AMD', to: 'BOM', fromTerm: 'T1', toTerm: 'T2', dep: '08:20', arr: '09:35', duration: '1h 15m' },
  '6E-5374': { from: 'AMD', to: 'BOM', fromTerm: 'T1', toTerm: 'T2', dep: '19:40', arr: '21:00', duration: '1h 20m' },
  'AI-614': { from: 'AMD', to: 'BOM', fromTerm: 'T2', toTerm: 'T2', dep: '09:10', arr: '10:25', duration: '1h 15m' },
  'QP-1124': { from: 'AMD', to: 'BOM', fromTerm: 'T1', toTerm: 'T1', dep: '14:30', arr: '15:45', duration: '1h 15m' },
  '6E-215': { from: 'BOM', to: 'AMD', fromTerm: 'T2', toTerm: 'T1', dep: '06:30', arr: '07:45', duration: '1h 15m' },
  'AI-613': { from: 'BOM', to: 'AMD', fromTerm: 'T2', toTerm: 'T2', dep: '18:00', arr: '19:15', duration: '1h 15m' },

  // Delhi - Mumbai corridor
  '6E-2054': { from: 'DEL', to: 'BOM', fromTerm: 'T2', toTerm: 'T2', dep: '07:00', arr: '09:15', duration: '2h 15m' },
  '6E-5001': { from: 'DEL', to: 'BOM', fromTerm: 'T3', toTerm: 'T2', dep: '17:30', arr: '19:45', duration: '2h 15m' },
  'AI-887': { from: 'DEL', to: 'BOM', fromTerm: 'T3', toTerm: 'T2', dep: '08:00', arr: '10:15', duration: '2h 15m' },
  'AI-805': { from: 'DEL', to: 'BOM', fromTerm: 'T3', toTerm: 'T2', dep: '20:00', arr: '22:15', duration: '2h 15m' },
  'QP-1354': { from: 'DEL', to: 'BOM', fromTerm: 'T2', toTerm: 'T1', dep: '11:15', arr: '13:30', duration: '2h 15m' },
  'UK-955': { from: 'DEL', to: 'BOM', fromTerm: 'T3', toTerm: 'T2', dep: '17:45', arr: '20:00', duration: '2h 15m' },

  // Delhi - Bengaluru
  '6E-2134': { from: 'DEL', to: 'BLR', fromTerm: 'T2', toTerm: 'T1', dep: '06:10', arr: '08:55', duration: '2h 45m' },
  'AI-506': { from: 'DEL', to: 'BLR', fromTerm: 'T3', toTerm: 'T2', dep: '09:45', arr: '12:30', duration: '2h 45m' },

  // Mumbai - Bengaluru
  '6E-457': { from: 'BOM', to: 'BLR', fromTerm: 'T2', toTerm: 'T1', dep: '10:15', arr: '11:55', duration: '1h 40m' },
  'QP-1102': { from: 'BOM', to: 'BLR', fromTerm: 'T1', toTerm: 'T1', dep: '15:20', arr: '17:00', duration: '1h 40m' },
};

export function parseFlightNumber(input: string): { code: string; num: string; key: string } | null {
  const clean = input.replace(/\s|-/g, '').toUpperCase();
  const match = clean.match(/^([A-Z0-9]{2})(\d{1,4})$/);
  if (!match) return null;
  const code = match[1];
  const num = match[2];
  return { code, num, key: `${code}-${num}` };
}

export async function verifyFlightWaterfall(
  flightQuery: string,
  travelDate?: string
): Promise<{ success: boolean; data?: VerifiedFlight; error?: string }> {
  const parsed = parseFlightNumber(flightQuery);
  if (!parsed) {
    return {
      success: false,
      error: 'Invalid flight number format. Use format like 6E 214, AI 887, or QP 1354.',
    };
  }

  const date = normalizeTravelDate(travelDate) || todayIso();
  const airlineName = CARRIERS[parsed.code] || `Airline (${parsed.code})`;
  const formattedFlight = `${parsed.code} ${parsed.num}`;

  // 1. Live lookup only when a real key is configured (AVIATIONSTACK_API_KEY, paid plan for flight_date).
  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const url =
        `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(apiKey)}` +
        `&flight_iata=${parsed.code}${parsed.num}&flight_date=${date}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const item = json?.data?.[0];
        const depIata: string | undefined = item?.departure?.iata;
        const arrIata: string | undefined = item?.arrival?.iata;
        if (depIata && arrIata) {
          const fromInfo = AIRPORTS[depIata] || { city: item.departure?.airport || depIata, name: depIata };
          const toInfo = AIRPORTS[arrIata] || { city: item.arrival?.airport || arrIata, name: arrIata };
          const dep: string | undefined = item.departure?.scheduled;
          const arr: string | undefined = item.arrival?.scheduled;
          const mins = dep && arr ? Math.round((Date.parse(arr) - Date.parse(dep)) / 60000) : NaN;

          return {
            success: true,
            data: {
              airlineCode: parsed.code,
              airlineName: item.airline?.name || airlineName,
              flightNumber: formattedFlight,
              travelDate: date,
              fromCode: depIata,
              fromCity: fromInfo.city,
              fromAirport: fromInfo.name,
              fromTerminal: item.departure?.terminal || undefined,
              toCode: arrIata,
              toCity: toInfo.city,
              toAirport: toInfo.name,
              toTerminal: item.arrival?.terminal || undefined,
              departureTime: dep?.slice(11, 16) || '',
              arrivalTime: arr?.slice(11, 16) || '',
              duration: mins > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : '',
              status: item.flight_status || 'Scheduled',
            },
          };
        }
      }
    } catch {
      // Timeout or network error: fall through to curated list
    }
  }

  // 2. High-accuracy Corridor Database Check
  const directMatch = FLIGHT_DATABASE[parsed.key];
  if (directMatch) {
    const fromInfo = AIRPORTS[directMatch.from];
    const toInfo = AIRPORTS[directMatch.to];

    return {
      success: true,
      data: {
        airlineCode: parsed.code,
        airlineName,
        flightNumber: formattedFlight,
        travelDate: date,
        fromCode: directMatch.from,
        fromCity: fromInfo.city,
        fromAirport: fromInfo.name,
        fromTerminal: directMatch.fromTerm || fromInfo.defaultTerminal,
        toCode: directMatch.to,
        toCity: toInfo.city,
        toAirport: toInfo.name,
        toTerminal: directMatch.toTerm || toInfo.defaultTerminal,
        departureTime: directMatch.dep,
        arrivalTime: directMatch.arr,
        duration: directMatch.duration,
        status: 'Scheduled',
      },
    };
  }

  // No invented routes: unknown flights are reported as not found.
  return {
    success: false,
    error: `Flight ${formattedFlight} not found for ${date}. Check the flight number and date.`,
  };
}
