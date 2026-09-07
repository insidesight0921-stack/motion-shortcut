import { useEffect, useRef } from 'react';
import { useGestureStore } from '../store/gestureStore';
import type { VisionSession } from '../vision/session';
import { drawHand } from './drawLandmarks';

interface Props {
  session: VisionSession;
}

/**
 * 웹캠 미리보기(거울 모드) + 랜드마크 오버레이.
 * <video>만 CSS scaleX(-1)로 뒤집고, <canvas>는 뒤집지 않는다(좌표가 이미 사용자 시점).
 */
export function CameraView({ session }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const status = useGestureStore((s) => s.visionStatus);
  const error = useGestureStore((s) => s.visionError);
  const fps = useGestureStore((s) => s.fps);
  const handDetected = useGestureStore((s) => s.handDetected);

  useEffect(() => {
    const setVisionStatus = useGestureStore.getState().setVisionStatus;
    const setFrameStats = useGestureStore.getState().setFrameStats;
    const unsubStatus = session.onStatus(setVisionStatus);

    let frames = 0;
    let lastStat = performance.now();
    let lastHand = false;
    const unsubFrame = session.onFrame(({ frame }) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (frame) drawHand(ctx, frame.landmarks, canvas.width, canvas.height);
        }
      }
      // 통계는 0.5초마다만 스토어에 반영
      frames++;
      lastHand = frame !== null;
      const now = performance.now();
      if (now - lastStat >= 500) {
        setFrameStats(Math.round((frames * 1000) / (now - lastStat)), lastHand);
        frames = 0;
        lastStat = now;
      }
    });
    return () => {
      unsubStatus();
      unsubFrame();
    };
  }, [session]);

  const start = () => {
    const video = videoRef.current;
    if (video) session.start(video).catch(() => undefined);
  };
  const stop = () => session.stop();

  return (
    <div className="camera-view">
      <div className="camera-frame">
        <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="camera-overlay" />
        {status !== 'running' && (
          <div className="camera-placeholder">
            {status === 'idle' && <p>카메라를 시작하면 손 인식이 시작됩니다.</p>}
            {status === 'starting' && <p>모델과 카메라를 준비하는 중…</p>}
            {status === 'stopped' && <p>카메라가 꺼져 있습니다.</p>}
            {status === 'error' && <p className="camera-error">{error}</p>}
          </div>
        )}
      </div>
      <div className="camera-controls">
        {status === 'running' ? (
          <button onClick={stop}>카메라 정지</button>
        ) : (
          <button onClick={start} disabled={status === 'starting'}>
            카메라 시작
          </button>
        )}
        <span className="camera-stat">{fps} fps</span>
        <span className={`camera-stat ${handDetected ? 'is-on' : ''}`}>{handDetected ? '손 감지됨' : '손 없음'}</span>
        <span className="camera-hint">미리보기는 거울 모드입니다. 사용자 오른쪽 = 화면 오른쪽</span>
      </div>
    </div>
  );
}
