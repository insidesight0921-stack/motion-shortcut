import { useEffect, useRef } from 'react';
import { useGestureStore } from '../store/gestureStore';
import type { VisionSession } from '../vision/session';
import { drawHand } from './drawLandmarks';
import { StatusDot } from './icons';
import { unlockAudio } from './sound';

interface Props {
  session: VisionSession;
}

/**
 * 카메라 카드. 이 화면의 주요 행동(primary)은 "카메라 시작" 하나다.
 * 실행 중에는 "카메라 중지"(Secondary)만 남아 파란 면이 0개가 된다.
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
    const unsubFrame = session.onFrame(({ hands }) => {
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
          for (const h of hands) drawHand(ctx, h.landmarks, canvas.width, canvas.height, h.hand);
        }
      }
      // 통계는 0.5초마다만 스토어에 반영
      frames++;
      lastHand = hands.length > 0;
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
    unlockAudio(); // 사용자 클릭 시점에 오디오 컨텍스트를 깨운다
    const video = videoRef.current;
    if (video) session.start(video).catch(() => undefined);
  };
  const stop = () => session.stop();

  const running = status === 'running';

  return (
    <section className="card" aria-labelledby="camera-title">
      <div className="card-head">
        <h2 id="camera-title" className="t-title-3">
          카메라
        </h2>
        <span className="t-caption t-muted">거울 모드 · 사용자 오른쪽 = 화면 오른쪽</span>
      </div>

      <div className={`camera-frame ${running ? 'is-running' : ''}`}>
        <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="camera-overlay" />

        {status === 'idle' && (
          <div className="camera-state">
            <p className="t-body-1 t-strong">카메라가 꺼져 있습니다</p>
            <p className="t-caption t-subtle reading">시작하면 손 인식이 바로 켜집니다. 영상은 이 기기 밖으로 나가지 않습니다.</p>
          </div>
        )}

        {status === 'stopped' && (
          <div className="camera-state">
            <p className="t-body-1 t-strong">카메라를 껐습니다</p>
            <p className="t-caption t-subtle reading">다시 시작하면 이전 설정 그대로 인식이 이어집니다.</p>
          </div>
        )}

        {status === 'starting' && (
          <div className="camera-skeleton" aria-live="polite" aria-label="손 인식 모델을 내려받는 중">
            <div className="skeleton camera-skeleton-hand" />
            <div className="camera-skeleton-lines">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="camera-state" role="alert">
            <p className="t-body-1 t-strong t-danger">카메라를 열지 못했습니다</p>
            <p className="t-caption t-subtle reading">{error}</p>
          </div>
        )}
      </div>

      <div className="camera-meta t-caption">
        {status === 'starting' && <span className="t-subtle">손 인식 모델을 내려받는 중 (약 10MB, 처음 한 번)</span>}
        {running && (
          <>
            <span className="camera-stat num">{fps} fps</span>
            <span className={`camera-stat ${handDetected ? 'is-on' : ''}`}>
              <StatusDot />
              {handDetected ? '손 감지됨' : '손 없음'}
            </span>
          </>
        )}
      </div>

      <div className="camera-actions">
        {running ? (
          <button type="button" className="btn btn-secondary" onClick={stop}>
            카메라 중지
          </button>
        ) : status === 'error' ? (
          <button type="button" className="btn btn-secondary" onClick={start}>
            다시 시도
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={start} disabled={status === 'starting'}>
            {status === 'starting' ? '준비 중' : '카메라 시작'}
          </button>
        )}
      </div>
    </section>
  );
}
