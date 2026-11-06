import type { BrowserContext } from '@playwright/test';

export function prepareLocalRoom(context: BrowserContext) {
  const useLoopback = context.browser()?.browserType().name() === 'webkit';
  return context.addInitScript((normalize) => {
    // Avoid external STUN in browser tests. Chromium supplies reachable numeric
    // addresses through its test launch flag; keep WebKit's loopback fixture.
    Object.defineProperty(navigator, 'onLine', { get: () => false });
    if (!normalize) return;
    const Native = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Native {
      setRemoteDescription(description: RTCSessionDescriptionInit) {
        return super.setRemoteDescription({
          ...description,
          sdp: description.sdp?.replace(
            /^(a=candidate:\S+ \d+ \S+ \d+ )\S+/gm,
            (_match, prefix) => prefix + '127.0.0.1',
          ),
        });
      }
    };
  }, useLoopback);
}
