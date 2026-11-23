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

export const supabase = configuredClient();
