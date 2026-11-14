import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://zmqumqthgfjhtxaciuab.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptcXVtcXRoZ2ZqaHR4YWNpdWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODc2MTMsImV4cCI6MjEwODI2MzYxM30.lcSrKx1FECnc2rLZnm6MPTulaXbJ7RaIFFwtKGX_xEE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

