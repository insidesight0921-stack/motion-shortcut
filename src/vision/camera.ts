/**
 * 웹캠 열기. getUserMedia는 localhost 또는 HTTPS에서만 동작한다.
 */
export interface CameraOptions {
  width?: number;
  height?: number;
}

export async function startCamera(video: HTMLVideoElement, opts: CameraOptions = {}): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('이 브라우저는 카메라(getUserMedia)를 지원하지 않거나, HTTPS/localhost가 아닙니다.');
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
      reject(new Error('비디오 메타데이터 로드 실패'));
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
        return '카메라 권한이 거부되었습니다. 주소창 왼쪽 자물쇠 아이콘에서 카메라를 허용한 뒤 새로고침하세요.';
      case 'NotFoundError':
        return '사용할 수 있는 카메라가 없습니다.';
      case 'NotReadableError':
        return '다른 앱이 카메라를 사용 중입니다. 해당 앱을 닫고 다시 시도하세요.';
      case 'SecurityError':
        return '보안 컨텍스트가 아닙니다. localhost 또는 HTTPS에서 열어야 합니다.';
      default:
        return `카메라 오류 (${err.name}): ${err.message}`;
    }
  }
  return err instanceof Error ? err.message : String(err);
}
