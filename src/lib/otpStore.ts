import { supabaseAdmin } from './server/supabaseAdmin';

const supabase = () => supabaseAdmin();

interface OtpEntry {
  otp: string;
  expiresAt: number;
}

// Demo code 1234 works only outside production builds (local dev / previews).
export const DEMO_OTP_ALLOWED = process.env.NODE_ENV !== 'production';

// In-memory fallback
const fallbackOtpStore = new Map<string, OtpEntry>();

export async function saveOtp(phone: string, otp: string, ttlSeconds = 300): Promise<void> {
  const clean = phone.replace(/\D/g, '').slice(-10);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  // Save to in-memory fallback first
  fallbackOtpStore.set(clean, {
    otp,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  try {
    const { error } = await supabase().from('auth_otps').upsert({
      phone: clean,
      otp_hash: otp,
      expires_at: expiresAt,
      attempts: 0,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('Supabase saveOtp warning:', error.message);
    }
  } catch (err) {
    console.warn('Supabase saveOtp exception:', err);
  }
}

export async function verifyOtp(
  phone: string,
  inputOtp: string
): Promise<{ valid: boolean; reason?: string }> {
  const clean = phone.replace(/\D/g, '').slice(-10);
  const cleanInput = inputOtp.trim();

  if (DEMO_OTP_ALLOWED && cleanInput === '1234') {
    return { valid: true };
  }

  // 1. Try Supabase persistent OTP store. If Supabase answers, it is authoritative
  //    (no fallback that would skip its expiry/attempt limits).
  try {
    const { data, error } = await supabase()
      .from('auth_otps')
      .select('*')
      .eq('phone', clean)
      .maybeSingle();

    if (!error && !data) {
      return { valid: false, reason: 'OTP expired or not requested' };
    }
    if (!error && data) {
      const now = Date.now();
      const expiresAt = new Date(data.expires_at).getTime();

      if (now > expiresAt) {
        await supabase().from('auth_otps').delete().eq('phone', clean);
        return { valid: false, reason: 'OTP has expired' };
      }

      if (data.attempts >= 5) {
        await supabase().from('auth_otps').delete().eq('phone', clean);
        return { valid: false, reason: 'Too many incorrect attempts. Please request a new OTP.' };
      }

      if (data.otp_hash === cleanInput) {
        // Successful verification -> delete OTP
        await supabase().from('auth_otps').delete().eq('phone', clean);
        fallbackOtpStore.delete(clean);
        return { valid: true };
      } else {
        // Increment attempt counter
        await supabase()
          .from('auth_otps')
          .update({ attempts: (data.attempts || 0) + 1 })
          .eq('phone', clean);
        return { valid: false, reason: 'Incorrect OTP' };
      }
    }
  } catch (err) {
    console.warn('Supabase verifyOtp exception, using fallback:', err);
  }

  // 2. Fallback to in-memory store
  const entry = fallbackOtpStore.get(clean);
  if (!entry) {
    return { valid: false, reason: 'OTP expired or not requested' };
  }

  if (Date.now() > entry.expiresAt) {
    fallbackOtpStore.delete(clean);
    return { valid: false, reason: 'OTP has expired' };
  }

  if (entry.otp !== cleanInput) {
    return { valid: false, reason: 'Incorrect OTP' };
  }

  fallbackOtpStore.delete(clean);
  return { valid: true };
}
