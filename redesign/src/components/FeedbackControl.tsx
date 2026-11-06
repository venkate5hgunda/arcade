import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { KEYS, observeStorage } from '../lib/storage.ts';
import { feedback } from '../lib/feedback.ts';

export function FeedbackControl() {
  const [sound, setSound] = useState(feedback.audio.enabled);
  const [haptics, setHaptics] = useState(feedback.hapticsEnabled);
  const [status, setStatus] = useState('');
  const panel = useRef<HTMLDetailsElement>(null);
  const testAttempt = useRef(0);
  const { pathname } = useLocation();

  useEffect(() => {
    if (panel.current) panel.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panel.current?.open) {
        panel.current.open = false;
        panel.current.querySelector('summary')?.focus({ preventScroll: true });
      }
    };
    const outside = (event: Event) => {
      if (
        panel.current?.open &&
        event.target instanceof Node &&
        !panel.current.contains(event.target)
      )
        panel.current.open = false;
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, []);
  useEffect(
    () =>
      observeStorage([KEYS.SOUND_ENABLED, KEYS.HAPTICS_ENABLED], () => {
        feedback.syncPreferences();
        setSound(feedback.audio.enabled);
        setHaptics(feedback.hapticsEnabled);
      }),
    [],
  );
  const supported = feedback.hasVibration();

  async function testSound() {
    const attempt = ++testAttempt.current;
    const ready = await feedback.audio.prepare();
    if (attempt !== testAttempt.current || !feedback.audio.enabled) return;
    if (ready) feedback.audio.chime();
    setStatus(
      ready
        ? 'Didn’t hear the chime? Check your volume or audio output.'
        : 'Sound couldn’t start. Try again.',
    );
  }

  return (
    <details className="feedback-control" ref={panel}>
      <summary aria-label="Sound settings" aria-describedby="sound-state">
        <svg
          className="icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          {sound ? (
            <path d="M15 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12" />
          ) : (
            <path d="m16 9 6 6m0-6-6 6" />
          )}
        </svg>
        Sound
        <span className="sr-only" id="sound-state">
          {sound ? 'Game sounds on' : 'Game sounds off'}
        </span>
      </summary>
      <div className="feedback-panel">
        <label className="feedback-row">
          <span>Game sounds</span>
          <input
            type="checkbox"
            role="switch"
            checked={sound}
            onChange={(e) => {
              const next = e.target.checked;
              ++testAttempt.current;
              setSound(next);
              feedback.setSound(next);
              setStatus('');
              if (next) void feedback.audio.prepare();
            }}
          />
        </label>
        <label className="feedback-row">
          <span>
            Vibration
            {!supported && (
              <small id="vibration-support">Unavailable on this device</small>
            )}
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Vibration"
            aria-describedby={supported ? undefined : 'vibration-support'}
            checked={supported && haptics}
            disabled={!supported}
            onChange={(e) => {
              const next = e.target.checked;
              setHaptics(next);
              feedback.setHaptics(next);
              if (next) feedback.vibrate('light');
            }}
          />
        </label>
        <button
          className="feedback-test"
          disabled={!sound}
          onClick={() => void testSound()}
        >
          Test sound
        </button>
        <p role="status">{sound ? status : ''}</p>
      </div>
    </details>
  );
}
