import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { auth } from '../lib/supabase';
import { clearKeyVault } from '../engine/client';
import { clearAccountCache } from './accountCache';

type AuthContextValue = {
  session: Session | null;
  accountId: string | null;
  loading: boolean;
  configured: boolean;
  guestOverride: boolean;
  setGuestOverride: (enabled: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [guestOverride, setGuestOverrideState] = useState(false);
  const guestOverrideRef = useRef(false);

  const previousAccountId = useRef<string | null>(null);

  useEffect(() => {
    if (!auth) return;

    const {
      data: { subscription },
    } = auth.onAuthStateChange((_event, nextSession) => {
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

      if (previousId !== nextAccountId && !guestOverrideRef.current) clearKeyVault();
      previousAccountId.current = nextAccountId;

      setSession(nextSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session: guestOverride ? null : session,
        accountId: guestOverride ? null : (session?.user.id ?? null),
        loading: !guestOverride && loading,
        configured: Boolean(auth),
        guestOverride,
        setGuestOverride(enabled) {
          guestOverrideRef.current = enabled;
          clearKeyVault();
          setGuestOverrideState(enabled);
        },
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
