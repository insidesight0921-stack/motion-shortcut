/**
 * 웹캠 열기. getUserMedia는 localhost 또는 HTTPS에서만 동작한다.
 */
export interface CameraOptions {
  width?: number;
  height?: number;
}

export async function startCamera(video: HTMLVideoElement, opts: CameraOptions = {}): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('이 브라우저에서는 카메라 API(getUserMedia)를 쓸 수 없습니다. 최신 Chrome·Safari에서 localhost 또는 https:// 주소로 열어 주세요.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: opts.width ?? 640 },
      height: { ideal: opts.height ?? 480 },
      frameRate: { ideal: 30 },
    },
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('카메라는 열렸지만 영상 크기 정보를 받지 못했습니다. 카메라를 중지했다가 다시 시작해 보세요.'));
    };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });
  await video.play();
  return stream;
}

export function stopCamera(video: HTMLVideoElement): void {
  const stream = video.srcObject as MediaStream | null;
  stream?.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
}

/** getUserMedia 오류를 사용자에게 보여줄 문장으로 바꾼다. */
export function describeCameraError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return '브라우저가 이 페이지의 카메라 접근을 막고 있습니다. 주소창 왼쪽 자물쇠 아이콘에서 카메라를 허용한 뒤 다시 시도하세요.';
      case 'NotFoundError':
        return '연결된 카메라를 찾지 못했습니다. 웹캠을 연결하거나 다른 기기에서 열어 보세요.';
      case 'NotReadableError':
        return '다른 앱이 카메라를 쓰고 있어 영상을 받을 수 없습니다. 화상회의·카메라 앱을 닫고 다시 시도하세요.';
      case 'SecurityError':
        return '이 주소에서는 카메라를 열 수 없습니다. localhost 또는 https:// 주소로 접속해야 합니다.';
      default:
        return `카메라를 여는 중 브라우저가 오류를 돌려줬습니다 (${err.name}): ${err.message}`;
    }
  }
  return err instanceof Error ? err.message : String(err);
}
