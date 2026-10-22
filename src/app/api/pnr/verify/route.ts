import { NextRequest, NextResponse } from 'next/server';
import { verifyPNRWaterfall } from '@/lib/pnrScraper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pnr, forceFresh } = body;

    if (!pnr || typeof pnr !== 'string') {
      return NextResponse.json(
        { success: false, error: 'PNR number is required', reason: 'Missing PNR field' },
        { status: 400 }
      );
    }

    const verification = await verifyPNRWaterfall(pnr, { forceFresh });

    if (!verification.success) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error,
          reason: verification.reason,
        },
        { status: 404 }
      );
    }

    // Privacy safeguard: Never expose raw PNR in API output
    const safeData = {
      ...verification.result,
      pnr: undefined,
    };

    return NextResponse.json({
      success: true,
      source: verification.source,
      data: safeData,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to verify PNR';
    return NextResponse.json(
      { success: false, error: 'Internal Error', reason: message },
      { status: 500 }
    );
  }
}
