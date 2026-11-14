const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Normalizes provider date strings to YYYY-MM-DD without timezone shifts.
 * Accepts: 2026-11-14, 14-11-2026, 14/11/2026, 14.11.2026, 14-Nov-2026, 14 Nov 2026, Nov 14, 2026.
 * Returns null when unparseable so callers can decide the fallback explicitly.
 */
export function normalizeTravelDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();

  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return iso(+m[3], +m[2], +m[1]);

  m = s.match(/(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-,]+(\d{4})/);
  if (m) return iso(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);

  m = s.match(/([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) return iso(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);

  return null;
}

// "Today" in India (IST, UTC+5:30, no DST); UTC would be a day behind before 05:30 IST.
export function todayIso(now = Date.now()): string {
  return new Date(now + 330 * 60 * 1000).toISOString().split('T')[0];
}
