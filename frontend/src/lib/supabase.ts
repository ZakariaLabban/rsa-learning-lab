import { createClient } from '@supabase/supabase-js';
import type { CloudContact, CloudEntity, CloudPublicKey, CloudSnapshot } from '../auth/cloudSync';
import type { PracticeProgress } from '../features/lessons/practiceProgress';

function configuredClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  try {
    return createClient(url, key, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: /^\/account\/?$/.test(window.location.pathname),
      },
    });
  } catch {
    return null;
  }
}

const supabase = configuredClient();
export const auth = supabase?.auth ?? null;

const SYNC_COLUMNS = 'id,name,n,e,fingerprint,revision,updated_at,deleted_at';

export async function loadCloudSnapshot(accountId: string, signal?: AbortSignal) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const [keys, contacts, progress] = await Promise.all([
    supabase
      .from('public_keys')
      .select(SYNC_COLUMNS)
      .eq('user_id', accountId)
      .abortSignal(signal ?? new AbortController().signal),
    supabase
      .from('contacts')
      .select(`${SYNC_COLUMNS},verified`)
      .eq('user_id', accountId)
      .abortSignal(signal ?? new AbortController().signal),
    supabase
      .from('exam_progress')
      .select('user_id,progress,revision,updated_at,deleted_at')
      .eq('user_id', accountId)
      .abortSignal(signal ?? new AbortController().signal)
      .maybeSingle(),
  ]);
  if (keys.error) throw keys.error;
  if (contacts.error) throw contacts.error;
  if (progress.error) throw progress.error;
  return {
    publicKeys: (keys.data ?? []) as unknown as CloudSnapshot['publicKeys'],
    contacts: (contacts.data ?? []) as unknown as CloudSnapshot['contacts'],
    practiceProgress: progress.data as unknown as CloudSnapshot['practiceProgress'],
  } satisfies CloudSnapshot;
}

export async function insertCloudPublicKey(accountId: string, value: CloudPublicKey) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('public_keys')
    .insert({ ...value, user_id: accountId })
    .select(SYNC_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CloudEntity<CloudPublicKey> | null;
}

export async function updateCloudPublicKeyIfRevision(
  accountId: string,
  id: string,
  revision: number,
  value: Omit<CloudPublicKey, 'id'> & { deleted_at: string | null },
) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('public_keys')
    .update(value)
    .eq('user_id', accountId)
    .eq('id', id)
    .eq('revision', revision)
    .select(SYNC_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CloudEntity<CloudPublicKey> | null;
}

export async function insertCloudContact(accountId: string, value: CloudContact) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...value, user_id: accountId })
    .select(`${SYNC_COLUMNS},verified`)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CloudEntity<CloudContact> | null;
}

export async function updateCloudContactIfRevision(
  accountId: string,
  id: string,
  revision: number,
  value: Omit<CloudContact, 'id'> & { deleted_at: string | null },
) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('contacts')
    .update(value)
    .eq('user_id', accountId)
    .eq('id', id)
    .eq('revision', revision)
    .select(`${SYNC_COLUMNS},verified`)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CloudEntity<CloudContact> | null;
}

export async function insertCloudPracticeProgress(accountId: string, progress: PracticeProgress) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('exam_progress')
    .insert({ user_id: accountId, progress })
    .select('user_id,progress,revision,updated_at,deleted_at')
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CloudSnapshot['practiceProgress'];
}

export async function updateCloudPracticeProgressIfRevision(
  accountId: string,
  revision: number,
  progress: PracticeProgress,
  deletedAt: string | null,
) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('exam_progress')
    .update({ progress, deleted_at: deletedAt })
    .eq('user_id', accountId)
    .eq('revision', revision)
    .select('user_id,progress,revision,updated_at,deleted_at')
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CloudSnapshot['practiceProgress'];
}

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
