import { NextRequest, NextResponse } from 'next/server';
import { POPULAR_TRAINS } from '@/lib/mockData';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim().toLowerCase() || '';

  if (!q) {
    return NextResponse.json({ success: true, data: POPULAR_TRAINS });
  }

  const filtered = POPULAR_TRAINS.filter(
    (t) =>
      t.number.includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.fromStation.toLowerCase().includes(q) ||
      t.fromCode.toLowerCase().includes(q) ||
      t.toStation.toLowerCase().includes(q) ||
      t.toCode.toLowerCase().includes(q)
  );

  return NextResponse.json({ success: true, data: filtered });
}
