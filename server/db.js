// Supabase access: client factory plus the narrow data port used by routes.
// The service-role key stays server-side only; the browser never talks to
// Supabase directly. Kept dependency-free of domain logic so it is trivially
// fakeable in hermetic tests.
import { createClient } from '@supabase/supabase-js';

let client = null;

export function getSupabaseClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !serviceKey?.trim()) return null;
  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export async function insertBill(client, row) {
  const { data, error } = await client.from('bills').insert(row).select('share_code').single();
  return { data, error };
}

export async function findBillByCode(client, shareCode) {
  const { data, error } = await client
    .from('bills')
    .select('share_code, created_at, restaurant_name, currency, bill')
    .eq('share_code', shareCode)
    .maybeSingle();
  return { data, error };
}
