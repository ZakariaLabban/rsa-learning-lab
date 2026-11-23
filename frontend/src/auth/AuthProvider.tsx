import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearKeyVault } from '../engine/client';
import { clearAccountCache } from './accountCache';

type AuthContextValue = {
  session: Session | null;
  accountId: string | null;
  loading: boolean;
  configured: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  const previousAccountId = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextAccountId = nextSession?.user.id ?? null;
      const previousId = previousAccountId.current;

      // A user signed out or another account became active.
      if (previousId && previousId !== nextAccountId) {
        try {
          clearAccountCache(previousId, window.localStorage);
        } catch {
          // Authentication remains usable if storage is blocked.
        }
      }

      if (previousId !== nextAccountId) clearKeyVault();
      previousAccountId.current = nextAccountId;

      setSession(nextSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        accountId: session?.user.id ?? null,
        loading,
        configured: Boolean(supabase),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
