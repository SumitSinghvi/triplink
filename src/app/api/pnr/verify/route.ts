import { NextRequest, NextResponse } from 'next/server';
import { verifyPNRWaterfall } from '@/lib/pnrScraper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pnr, forceFresh } = body;

    if (!pnr || typeof pnr !== 'string') {
      return NextResponse.json(
        { success: false, error: 'PNR number is required' },
        { status: 400 }
      );
    }

    const { result, source } = await verifyPNRWaterfall(pnr, { forceFresh });

    // Privacy safeguard: Never expose raw PNR in API output
    const safeData = {
      ...result,
      pnr: undefined,
    };

    return NextResponse.json({
      success: true,
      source,
      data: safeData,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to verify PNR';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
