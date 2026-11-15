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

// AeroDataBox (RapidAPI) response, only the fields we read.
interface AdbMovement {
  airport?: { iata?: string; name?: string; shortName?: string; municipalityName?: string };
  scheduledTime?: { utc?: string; local?: string }; // "2026-11-17 09:40+05:30"
  terminal?: string;
}
interface AdbFlight {
  status?: string;
  airline?: { name?: string };
  departure?: AdbMovement;
  arrival?: AdbMovement;
}

export function parseFlightNumber(input: string): { code: string; num: string } | null {
  const match = input.replace(/\s|-/g, '').toUpperCase().match(/^([A-Z0-9]{2})(\d{1,4})$/);
  return match ? { code: match[1], num: match[2] } : null;
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
  const formattedFlight = `${parsed.code} ${parsed.num}`;
  const notFound = {
    success: false,
    error: `Flight ${formattedFlight} not found for ${date}. Check the flight number and date.`,
  };

  // Live schedule from AeroDataBox. No key = no lookup; the UI offers manual entry on 404.
  const apiKey = process.env.AERODATABOX_API_KEY;
  if (!apiKey) return notFound;

  let flights: AdbFlight[] = [];
  try {
    const res = await fetch(
      `https://aerodatabox.p.rapidapi.com/flights/number/${parsed.code}${parsed.num}/${date}` +
        '?withAircraftImage=false&withLocation=false',
      {
        headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' },
        signal: AbortSignal.timeout(6000),
      }
    );
    // 204 = no such flight that day.
    if (res.ok && res.status !== 204) flights = await res.json();
    else if (res.status !== 204 && res.status !== 404) console.warn('AeroDataBox HTTP', res.status);
  } catch (err) {
    console.warn('AeroDataBox lookup failed:', err);
  }

  // ponytail: multi-leg flight numbers return several legs; we take the first. Add a leg picker if needed.
  const f = flights.find((x) => x.departure?.airport?.iata && x.arrival?.airport?.iata);
  if (!f) return notFound;

  const dep = f.departure!;
  const arr = f.arrival!;
  const depUtc = Date.parse(dep.scheduledTime?.utc?.replace(' ', 'T') ?? '');
  const arrUtc = Date.parse(arr.scheduledTime?.utc?.replace(' ', 'T') ?? '');
  const mins = Math.round((arrUtc - depUtc) / 60000);

  return {
    success: true,
    data: {
      airlineCode: parsed.code,
      airlineName: f.airline?.name || parsed.code,
      flightNumber: formattedFlight,
      travelDate: dep.scheduledTime?.local?.slice(0, 10) || date,
      fromCode: dep.airport!.iata!,
      fromCity: dep.airport!.municipalityName || dep.airport!.shortName || dep.airport!.iata!,
      fromAirport: dep.airport!.name || dep.airport!.iata!,
      fromTerminal: dep.terminal ? `T${dep.terminal.replace(/^T/i, '')}` : undefined,
      toCode: arr.airport!.iata!,
      toCity: arr.airport!.municipalityName || arr.airport!.shortName || arr.airport!.iata!,
      toAirport: arr.airport!.name || arr.airport!.iata!,
      toTerminal: arr.terminal ? `T${arr.terminal.replace(/^T/i, '')}` : undefined,
      departureTime: dep.scheduledTime?.local?.slice(11, 16) || '',
      arrivalTime: arr.scheduledTime?.local?.slice(11, 16) || '',
      duration: mins > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : '',
      status: f.status || 'Scheduled',
    },
  };
}
