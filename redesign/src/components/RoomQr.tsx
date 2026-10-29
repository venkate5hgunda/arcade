import { useEffect, useRef, useState } from 'react';
import { readSignal } from '../lib/room/protocol.ts';

type Scanner = { start(): Promise<void>; destroy(): void };
type ScannerClass = new (
  video: HTMLVideoElement,
  callback: (result: { data: string }) => void,
  options: Record<string, unknown>,
) => Scanner;
export function RoomQr({
  url,
  kind,
}: {
  url: string;
  kind: 'invite' | 'answer';
}) {
  const [open, setOpen] = useState(false),
    [image, setImage] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    setImage('');
    setError('');
    void (async () => {
      try {
        const path = new URL('./vendor/qrcode.mjs', document.baseURI).href;
        const module = (await import(/* @vite-ignore */ path)) as {
          default: (
            version: number,
            level: string,
          ) => {
            addData(value: string, mode: string): void;
            make(): void;
            createDataURL(size: number, margin: number): string;
          };
        };
        const code = module.default(0, 'L');
        code.addData(url, 'Byte');
        try {
          code.make();
        } catch (e) {
          if (/code length overflow/i.test(String(e)))
            throw new RangeError(
              'This link is too long for one QR code. Copy or share the link instead.',
            );
          throw e;
        }
        const data = code.createDataURL(4, 16);
        if (!cancelled) setImage(data);
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : 'Could not create a QR code. Copy or share the link instead.',
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, url]);
  return (
    <details
      className="room-qr"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>QR code</summary>
      {image && (
        <img
          src={image}
          alt={`QR code for ${kind === 'invite' ? 'invitation' : 'answer'} link`}
        />
      )}
      {error && <p role="status">{error}</p>}
      {open && !image && !error && <p>Preparing QR code…</p>}
    </details>
  );
}
export function RoomScanner({
  kind,
  onResult,
}: {
  kind: 'offer' | 'answer';
  onResult: (url: string) => void;
}) {
  const [active, setActive] = useState(false),
    [status, setStatus] = useState('');
  const video = useRef<HTMLVideoElement>(null),
    result = useRef(onResult);
  result.current = onResult;
  useEffect(() => {
    if (!active) return;
    let cancelled = false,
      scanner: Scanner | undefined;
    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw new Error(
            'Camera scanning requires HTTPS (or localhost) and camera access. Paste the link instead.',
          );
        const path = new URL('./vendor/qr-scanner.min.js', document.baseURI)
          .href;
        const { default: QrScanner } = (await import(
          /* @vite-ignore */ path
        )) as { default: ScannerClass };
        if (cancelled || !video.current) return;
        scanner = new QrScanner(
          video.current,
          ({ data }) => {
            if (cancelled) return;
            try {
              readSignal(data, kind);
              result.current(data);
              setStatus('');
              setActive(false);
            } catch (e) {
              setStatus(
                e instanceof Error
                  ? e.message
                  : 'That QR code is not a room link.',
              );
            }
          },
          {
            preferredCamera: 'environment',
            maxScansPerSecond: 10,
            returnDetailedScanResult: true,
          },
        );
        await scanner.start();
        if (cancelled) scanner.destroy();
      } catch (e) {
        if (!cancelled) {
          setStatus(
            `Camera scanning failed: ${e instanceof Error ? e.message : String(e)} Check camera permission, or paste the link instead.`,
          );
          setActive(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      scanner?.destroy();
    };
  }, [active, kind]);
  return (
    <div className="room-scanner">
      <button
        className="quiet"
        type="button"
        onClick={() => {
          setStatus('');
          setActive(!active);
        }}
      >
        {active
          ? 'Cancel scan'
          : `Scan ${kind === 'offer' ? 'invitation' : 'answer'} QR`}
      </button>
      {active && (
        <>
          <video
            ref={video}
            autoPlay
            muted
            playsInline
            aria-label="QR camera preview"
          />
          <p>Fit the entire QR code inside the camera view.</p>
        </>
      )}
      {status && <p role="status">{status}</p>}
    </div>
  );
}
