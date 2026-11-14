import { NextRequest, NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otpStore';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json();
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    const cleanOtp = (otp || '').trim();

    if (!cleanPhone || !cleanOtp) {
      return NextResponse.json(
        { success: false, error: 'Phone and OTP are required' },
        { status: 400 }
      );
    }

    const result = await verifyOtp(cleanPhone, cleanOtp);

    if (result.valid) {
      // Canonical deterministic user ID anchored to verified phone
      const userId = `usr_${cleanPhone}`;

      // Check if user already has a profile
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        message: 'OTP verified successfully',
        userId,
        profile: existingProfile || null,
      });
    }

    return NextResponse.json(
      { success: false, error: result.reason || 'Invalid OTP code. Try demo code 1234.' },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    console.error('Verify OTP error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
