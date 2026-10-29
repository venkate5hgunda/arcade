/** Injected at the room boundary; production always uses real WebRTC. */
export type ConnectionFactory = () => RTCPeerConnection;
export const webrtcConnectionFactory: ConnectionFactory = () => {
  if (typeof RTCPeerConnection !== 'function')
    throw new Error(
      'This browser does not support direct rooms. Try a current browser.',
    );
  return new RTCPeerConnection({
    iceServers: navigator.onLine
      ? [{ urls: 'stun:stun.l.google.com:19302' }]
      : [],
  });
};

export function waitForIce(
  pc: RTCPeerConnection,
  timeout = 20_000,
): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = (error?: Error) => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', changed);
      pc.removeEventListener('connectionstatechange', closed);
      error ? reject(error) : resolve();
    };
    const changed = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    const closed = () => {
      if (pc.connectionState === 'closed')
        done(new Error('Invitation cancelled.'));
    };
    const timer = setTimeout(
      () =>
        done(
          new Error(
            'Connection timed out. Check your network and create a new invite.',
          ),
        ),
      timeout,
    );
    pc.addEventListener('icegatheringstatechange', changed);
    pc.addEventListener('connectionstatechange', closed);
  });
}
