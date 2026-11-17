import { useEffect, useRef, useState } from 'react';

/*
 * Registers the offline service worker (#50) and shows its two states:
 * - a new version is installed and waiting: offer a reload (never forced);
 * - the browser is offline: say that guest tools keep working.
 * The app deliberately does not import swPolicy.ts: sharing a module with the
 * worker entry would split it into a chunk and turn sw.js into an ES module.
 * `offline.test.ts` checks this message matches swPolicy.SKIP_WAITING.
 */
export const SKIP_WAITING_MESSAGE = 'rsa-lab:skip-waiting';
export const SERVICE_WORKER_URL = '/sw.js';

export function OfflineStatus({ enabled = import.meta.env.PROD }: { enabled?: boolean }) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [offlineDismissed, setOfflineDismissed] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updatedElsewhere, setUpdatedElsewhere] = useState(false);
  // True once this page is controlled by the worker, i.e. every guest file is cached.
  const [installed, setInstalled] = useState(
    () => 'serviceWorker' in navigator && !!navigator.serviceWorker.controller,
  );
  const requested = useRef(false);

  useEffect(() => {
    const up = () => setOnline(true),
      down = () => {
        setOnline(false);
        setOfflineDismissed(false);
      };
    addEventListener('online', up);
    addEventListener('offline', down);
    return () => {
      removeEventListener('online', up);
      removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !('serviceWorker' in navigator)) return;
    const container = navigator.serviceWorker;
    let active = true,
      hadController = !!container.controller,
      reloading = false;
    const onControllerChange = () => {
      // The first install takes control without a previous version: nothing to announce.
      if (requested.current) {
        if (!reloading) {
          reloading = true;
          location.reload();
        }
      } else if (hadController && active) setUpdatedElsewhere(true);
      hadController = true;
      if (active) setInstalled(!!container.controller);
    };
    container.addEventListener('controllerchange', onControllerChange);
    container
      .register(SERVICE_WORKER_URL)
      .then((registration) => {
        const check = () => {
          if (active && registration.waiting && container.controller)
            setWaiting(registration.waiting);
        };
        check();
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed') check();
          });
        });
      })
      .catch(() => {
        // Without a service worker the app still works online; offline reload is unavailable.
      });
    return () => {
      active = false;
      container.removeEventListener('controllerchange', onControllerChange);
    };
  }, [enabled]);

  if (!online && !offlineDismissed)
    return (
      <div className="offline-status" role="status">
        {installed
          ? 'You are offline. RSA Lab is saved in this browser, so guest tools keep working.'
          : 'You are offline. RSA Lab has not finished saving for offline use, so pages that have not loaded yet need a connection.'}{' '}
        <button type="button" onClick={() => setOfflineDismissed(true)}>
          Dismiss
        </button>
      </div>
    );
  if (updatedElsewhere)
    return (
      <div className="offline-status" role="status">
        RSA Lab was updated in another tab. Pages you have not opened here may fail until you
        reload.{' '}
        <button type="button" onClick={() => location.reload()}>
          Reload to finish
        </button>
      </div>
    );
  if (waiting)
    return (
      <div className="offline-status" role="status">
        A new version of RSA Lab is ready. Reloading clears keys held only in this tab’s memory.{' '}
        <button
          type="button"
          onClick={() => {
            // A newer version may have replaced this one; a plain reload then picks it up.
            if (waiting.state === 'redundant') {
              location.reload();
              return;
            }
            requested.current = true;
            waiting.postMessage(SKIP_WAITING_MESSAGE);
          }}
        >
          Reload now
        </button>
      </div>
    );
  return null;
}
