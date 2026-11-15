// IATA Bar Coded Boarding Pass (BCBP, Resolution 792) parser: the text inside the PDF417/Aztec/QR
// code on every airline boarding pass. Pure; shared by the browser (scan) and the server (re-check).
// Only the mandatory items are read. Name and PNR stay in the caller and are never persisted.

export interface BoardingPassLeg {
  pnr: string;
  fromCode: string;
  toCode: string;
  carrier: string; // "6E"
  flightNumber: string; // "214" (leading zeros stripped, op suffix kept)
  julianDay: number; // day of year, 1-366
  seat: string;
}

export interface BoardingPass {
  passengerName: string; // "SINGH/SUMIT MR"
  legs: BoardingPassLeg[];
}

const LEG_LEN = 37; // mandatory per-leg item length, incl. the 2-char conditional-size field

export function parseBcbp(raw: string): BoardingPass | null {
  const s = raw.replace(/[\r\n]+$/, '');
  if (s[0] !== 'M' || s.length < 23 + LEG_LEN) return null;
  const legCount = Number(s[1]);
  if (!(legCount >= 1 && legCount <= 4)) return null;

  const legs: BoardingPassLeg[] = [];
  let i = 23; // after format code, leg count, 20-char name, e-ticket indicator
  for (let n = 0; n < legCount; n++) {
    const leg = s.slice(i, i + LEG_LEN);
    if (leg.length < LEG_LEN) return null;
    const condSize = parseInt(leg.slice(35, 37), 16);
    const julianDay = Number(leg.slice(21, 24));
    const fromCode = leg.slice(7, 10).trim();
    const toCode = leg.slice(10, 13).trim();
    const carrier = leg.slice(13, 16).trim();
    const flightNumber = leg.slice(16, 21).trim().replace(/^0+(?=\d)/, '');
    if (
      Number.isNaN(condSize) ||
      !(julianDay >= 1 && julianDay <= 366) ||
      !/^[A-Z]{3}$/.test(fromCode) ||
      !/^[A-Z]{3}$/.test(toCode) ||
      !/^[A-Z0-9]{2,3}$/.test(carrier) ||
      !/^\d{1,4}[A-Z]?$/.test(flightNumber)
    ) {
      return null;
    }
    legs.push({
      pnr: leg.slice(0, 7).trim(),
      fromCode,
      toCode,
      carrier,
      flightNumber,
      julianDay,
      seat: leg.slice(25, 29).trim().replace(/^0+(?=\d)/, ''),
    });
    i += LEG_LEN + condSize;
  }
  return { passengerName: s.slice(2, 22).trim(), legs };
}

// BCBP carries day-of-year only. Pick the year that puts it closest to `today` (passes are issued days before).
export function julianToIso(julianDay: number, today: string): string {
  const t = Date.parse(`${today}T00:00:00Z`);
  const year = Number(today.slice(0, 4));
  let best = '';
  let bestDiff = Infinity;
  for (const y of [year - 1, year, year + 1]) {
    const d = Date.UTC(y, 0, julianDay);
    if (new Date(d).getUTCFullYear() !== y) continue; // day 366 in a non-leap year
    const diff = Math.abs(d - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = new Date(d).toISOString().slice(0, 10);
    }
  }
  return best;
}
