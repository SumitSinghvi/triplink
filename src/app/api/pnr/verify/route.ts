import { NextRequest, NextResponse } from 'next/server';
import { decodePNR, validatePNR } from '@/lib/pnr';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pnr } = body;

    if (!pnr || typeof pnr !== 'string') {
      return NextResponse.json(
        { success: false, error: 'PNR number is required' },
        { status: 400 }
      );
    }

    const cleanPnr = pnr.replace(/[\s-]/g, '');
    if (!validatePNR(cleanPnr)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid PNR format. Must be a 10-digit number starting with 1-9.',
        },
        { status: 400 }
      );
    }

    const result = await decodePNR(cleanPnr);

    // Notice: we do NOT expose raw PNR in response, only maskedPnr
    return NextResponse.json({
      success: true,
      data: {
        ...result,
        pnr: undefined, // strip raw PNR for privacy
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to verify PNR';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
