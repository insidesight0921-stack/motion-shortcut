export interface CameraLease {
  stream: MediaStream;
  release: () => void;
}

export function createCameraBroker(getStream: () => Promise<MediaStream>) {
  let pending: Promise<MediaStream> | null = null;
  let users = 0;
  return {
    async acquire(): Promise<CameraLease> {
      // Count pending consumers too: closing one window must not cancel another.
      users += 1;
      const request = pending ??= Promise.resolve().then(getStream);
      let stream: MediaStream;
      try {
        stream = await request;
      } catch (error) {
        users -= 1;
        if (pending === request) pending = null;
        throw error;
      }
      let released = false;
      return {
        stream,
        release() {
          if (released) return;
          released = true;
          users -= 1;
          if (users === 0) {
            stream.getTracks().forEach((track) => track.stop());
            if (pending === request) pending = null;
          }
        },
      };
    },
  };
}

type CameraWindow = Window & { __motionCameraBroker?: ReturnType<typeof createCameraBroker> };

export function acquireCamera(): Promise<CameraLease> {
  let owner: CameraWindow = window;
  try {
    // Named presentation popups and their control center share one camera source.
    if (window.opener && !window.opener.closed && window.opener.location.origin === window.location.origin)
      owner = window.opener as CameraWindow;
  } catch { /* A cross-origin opener cannot share its camera. */ }
  owner.__motionCameraBroker ??= createCameraBroker(async () => {
    if (!owner.navigator.mediaDevices?.getUserMedia)
      throw new Error("카메라는 HTTPS 또는 localhost 환경에서 지원되는 브라우저로 실행하세요.");
    return owner.navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  });
  return owner.__motionCameraBroker.acquire();
}
