import { useEffect, useRef, useState } from 'react';
import { feedback } from '../lib/feedback.ts';
export function FeedbackControl() {
  const [sound, setSound] = useState(feedback.audio.enabled);
  const [haptics, setHaptics] = useState(feedback.hapticsEnabled);
  const [status, setStatus] = useState('');
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panel.current?.open) {
        panel.current.open = false;
        panel.current.querySelector('summary')?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        panel.current?.open &&
        event.target instanceof Node &&
        !panel.current.contains(event.target)
      )
        panel.current.open = false;
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
    };
  }, []);
  const supported = feedback.hasVibration() || feedback.hasNativeSwitch();
  async function testSound() {
    feedback.audio.chime();
    const ready = await feedback.audio.prepare();
    setStatus(
      ready
        ? `Audio is ready. If you did not hear the chime, check media volume, mute and audio output.${feedback.audio.playbackSession ? ' On iOS Chrome, this may pause other audio.' : ''}`
        : 'Audio is blocked or unavailable. Try again after interacting with the page.',
    );
  }
  return (
    <details className="feedback-control" ref={panel}>
      <summary aria-label="Sound & feel" title="Sound & feel">
        <span aria-hidden="true">♫</span>
      </summary>
      <div className="feedback-panel">
        <label>
          <input
            type="checkbox"
            checked={sound}
            onChange={(e) => {
              const next = e.target.checked;
              setSound(next);
              feedback.setSound(next);
              setStatus('');
              if (next) void feedback.audio.prepare();
            }}
          />{' '}
          Game sounds
        </label>
        <button
          className="quiet"
          disabled={!sound}
          onClick={() => void testSound()}
        >
          Test sound
        </button>
        <p role="status">{status}</p>
        <label>
          <input
            type="checkbox"
            ref={(element) => {
              if (element && feedback.hasNativeSwitch())
                element.setAttribute('switch', '');
            }}
            checked={supported && haptics}
            disabled={!supported}
            onChange={(e) => {
              const next = e.target.checked;
              setHaptics(next);
              feedback.setHaptics(next);
              if (next) feedback.vibrate('light');
            }}
          />{' '}
          Haptics
        </label>
        <p>
          {!supported
            ? 'This browser has no haptics API.'
            : !feedback.hasVibration()
              ? 'iOS can give feedback on this native switch; game vibrations are unavailable in iOS browsers.'
              : 'Game vibration is available on this device.'}
        </p>
      </div>
    </details>
  );
}
