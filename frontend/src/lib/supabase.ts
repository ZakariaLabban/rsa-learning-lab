import { createClient } from '@supabase/supabase-js';

function configuredClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}

const supabase = configuredClient();
export const auth = supabase?.auth ?? null;

export async function readCloudProfile(accountId: string, signal: AbortSignal) {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase
    .from('profiles')
    .select('sync_enabled, data_deleted_at')
    .eq('user_id', accountId)
    .abortSignal(signal)
    .maybeSingle();
}

export async function deleteCloudApplicationData(accessToken: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase.rpc('delete_my_data').setHeader('Authorization', `Bearer ${accessToken}`);
}
