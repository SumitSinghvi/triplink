// Server-only Supabase client using a secret key (sb_secret_..., bypasses RLS).
// Legacy service_role keys stop working at the end of 2026; they're accepted only as a fallback.
// Never import this from client components: the key must not reach the browser.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') throw new Error('supabaseAdmin is server-only');
  if (client) return client;
  // The project URL is public (not a secret); the fallback matches the previous client's default.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zmqumqthgfjhtxaciuab.supabase.co';
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set on the server');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
