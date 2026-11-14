import { NextRequest, NextResponse } from 'next/server';
import { verifyFlightWaterfall } from '@/lib/flightScraper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flightNumber, date } = body;

    if (!flightNumber || typeof flightNumber !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Flight number is required (e.g. 6E 214 or AI 887)' },
        { status: 400 }
      );
    }

    const verification = await verifyFlightWaterfall(flightNumber, date);

    if (!verification.success) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Flight not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: verification.data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to verify flight';
    return NextResponse.json(
      { success: false, error: 'Internal Error', reason: message },
      { status: 500 }
    );
  }
}
