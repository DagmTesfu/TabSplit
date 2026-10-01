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

export async function updateBillPaidStatus(client, shareCode, personId, isPaid) {
  const { data: row, error: fetchErr } = await client
    .from('bills')
    .select('bill')
    .eq('share_code', shareCode)
    .maybeSingle();

  if (fetchErr) return { data: null, error: fetchErr };
  if (!row) return { data: null, error: null };

  const bill = row.bill || {};
  const currentPaid = bill.paidMap || {};
  const updatedPaid = { ...currentPaid, [personId]: Boolean(isPaid) };
  const updatedBill = { ...bill, paidMap: updatedPaid };

  const { error: updateErr } = await client
    .from('bills')
    .update({ bill: updatedBill })
    .eq('share_code', shareCode);

  if (updateErr) return { data: null, error: updateErr };
  return { data: { shareCode, paidMap: updatedPaid }, error: null };
}
