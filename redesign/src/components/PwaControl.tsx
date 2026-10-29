import { useEffect, useRef, useState } from 'react';
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function PwaControl() {
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [status, setStatus] = useState('Preparing offline games…');
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  );
  const [later, setLater] = useState(false);
  const reload = useRef(false);
  useEffect(() => {
    let alive = true;
    const cleanup: (() => void)[] = [];
    const install = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const installed = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('appinstalled', installed);
    cleanup.push(
      () => window.removeEventListener('beforeinstallprompt', install),
      () => window.removeEventListener('appinstalled', installed),
    );
    if (!import.meta.env.PROD)
      setStatus('Offline downloads are available in the built app.');
    else if (!('serviceWorker' in navigator) || !window.isSecureContext)
      setStatus(
        'Offline play needs HTTPS or localhost and a browser with service workers.',
      );
    else {
      const root = new URL('./', document.baseURI),
        script = new URL('arcade-sw.js', root).href;
      const changed = () => {
        if (navigator.serviceWorker.controller?.scriptURL !== script) return;
        setWaiting(null);
        if (reload.current) location.reload();
        else
          setStatus(
            'Games are ready offline. A newer version may be active in another tab; reload when you are ready.',
          );
      };
      navigator.serviceWorker.addEventListener('controllerchange', changed);
      cleanup.push(() =>
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          changed,
        ),
      );
      void (async () => {
        try {
          const existing = await navigator.serviceWorker.getRegistration(
            root.href,
          );
          if (
            existing &&
            (existing.active ?? existing.waiting ?? existing.installing)
              ?.scriptURL !== script
          ) {
            if (alive)
              setStatus(
                'Another app controls offline storage here. Open Arcade on a separate preview origin to enable offline play.',
              );
            return;
          }
          const reg = await navigator.serviceWorker.register(script, {
            scope: root.pathname,
            updateViaCache: 'none',
          });
          if (!alive) return;
          setRegistration(reg);
          const update = () => {
            if (!alive) return;
            if (
              reg.waiting &&
              reg.active &&
              navigator.serviceWorker.controller
            ) {
              setWaiting(reg.waiting);
              setLater(false);
              setStatus(
                'An update is ready. Saved games stay safe; room players reconnect after reloading.',
              );
            } else if (reg.active?.state === 'activated') {
              setWaiting(null);
              setStatus(
                'All game artwork, sounds, word lists and approved movie files are ready for offline play. Private rooms still need a connection between players.',
              );
            }
          };
          const watch = () => {
            const worker = reg.installing;
            if (!worker) {
              update();
              return;
            }
            const state = () => {
              if (worker.state === 'redundant' && alive)
                setStatus(
                  'The offline download did not finish. Reconnect and check again; existing saved games are safe.',
                );
              else update();
            };
            worker.addEventListener('statechange', state);
            cleanup.push(() =>
              worker.removeEventListener('statechange', state),
            );
            state();
          };
          reg.addEventListener('updatefound', watch);
          cleanup.push(() => reg.removeEventListener('updatefound', watch));
          watch();
          update();
        } catch {
          if (alive)
            setStatus(
              'Offline storage is unavailable or the download failed. Keep this tab open, then reconnect and try again.',
            );
        }
      })();
    }
    return () => {
      alive = false;
      for (const stop of cleanup) stop();
    };
  }, []);
  async function check() {
    if (!registration) {
      location.reload();
      return;
    }
    if (registration.waiting && registration.active) {
      setWaiting(registration.waiting);
      setLater(false);
      return;
    }
    try {
      await registration.update();
      if (!registration.waiting && !registration.installing)
        setStatus('You have the latest available offline copy.');
    } catch {
      setStatus(
        'Could not check for updates. Reconnect and try again; your downloaded copy is still available.',
      );
    }
  }
  function update() {
    if (
      !waiting ||
      waiting.state !== 'installed' ||
      registration?.waiting !== waiting
    )
      return;
    reload.current = true;
    waiting.postMessage({ type: 'ACTIVATE' });
  }
  return (
    <>
      {waiting && !later && (
        <aside className="pwa-notice" role="status">
          <p>
            An Arcade update is ready. Saved games stay safe; rooms reconnect
            after reload.
          </p>
          <button className="primary" onClick={update}>
            Update and reload
          </button>
          <button className="quiet" onClick={() => setLater(true)}>
            Later
          </button>
        </aside>
      )}
      <details className="pwa-control">
        <summary>
          <span>Offline &amp; install</span>
          {waiting && <strong> · Update ready</strong>}
        </summary>
        <p role="status">{status}</p>
        {installed ? (
          <p>Running as an installed app.</p>
        ) : prompt ? (
          <button
            className="quiet"
            onClick={async () => {
              try {
                await prompt.prompt();
                const choice = await prompt.userChoice;
                if (choice.outcome === 'accepted')
                  setStatus(
                    'Installation requested. Your browser will finish adding Arcade.',
                  );
              } catch {
                setStatus(
                  'Installation could not start. Use your browser’s install menu.',
                );
              } finally {
                setPrompt(null);
              }
            }}
          >
            Install Arcade
          </button>
        ) : (
          <p>
            To install, use your browser’s install menu. On iPhone or iPad, use
            Share → Add to Home Screen.
          </p>
        )}
        <button className="quiet" onClick={() => void check()}>
          Check offline updates
        </button>
        {waiting && (
          <button className="quiet" onClick={update}>
            Update and reload
          </button>
        )}
      </details>
    </>
  );
}
