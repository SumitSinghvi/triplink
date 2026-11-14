import { NextRequest, NextResponse } from 'next/server';
import { saveOtp, DEMO_OTP_ALLOWED } from '@/lib/otpStore';

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    const cleanPhone = (phone || '').replace(/\D/g, '');

    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid 10-digit mobile number' },
        { status: 400 }
      );
    }

    // 10-digit mobile number without country code
    const tenDigitPhone = cleanPhone.slice(-10);

    // Generate random 4-digit OTP
    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    await saveOtp(tenDigitPhone, generatedOtp);

    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
      if (!DEMO_OTP_ALLOWED) {
        return NextResponse.json(
          { success: false, error: 'SMS service is not configured. Please try again later.' },
          { status: 503 }
        );
      }
      // Dev mode without key: generated OTP returned in response (demo 1234 also accepted)
      return NextResponse.json({
        success: true,
        message: 'Dev mode: OTP saved',
        devOtp: generatedOtp,
      });
    }

    // Call Fast2SMS Bulk V2 OTP Route
    const fastRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': apiKey,
      },
      body: JSON.stringify({
        route: 'otp',
        variables_values: generatedOtp,
        numbers: tenDigitPhone,
      }),
    });

    const fastData = await fastRes.json();

    if (fastData && fastData.return === true) {
      return NextResponse.json({
        success: true,
        message: 'OTP sent to mobile via SMS',
      });
    } else {
      console.warn('Fast2SMS response warning:', fastData);
      return NextResponse.json(
        { success: false, error: 'Could not send SMS. Please try again in a minute.' },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send OTP';
    console.error('Send OTP error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
