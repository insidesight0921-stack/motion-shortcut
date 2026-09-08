import { useEffect } from 'react';
import { useCookingStore } from '../../store/cookingStore';

export function formatMs(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  /** 타이머 종료 시 호출 (효과음 등) */
  onDone?: () => void;
}

/** 3분 타이머 카드. 원 그리기로 시작/정지. 진행 바는 transform으로만 움직인다 (§7). */
export function Timer({ onDone }: Props) {
  const timer = useCookingStore((s) => s.timer);
  const toggleTimer = useCookingStore((s) => s.toggleTimer);
  const stopTimer = useCookingStore((s) => s.stopTimer);

  useEffect(() => {
    if (timer.status !== 'running') return;
    const tick = () => useCookingStore.getState().tickTimer(Date.now());
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [timer.status]);

  useEffect(() => {
    if (timer.status === 'done') onDone?.();
    // onDone은 최신 참조를 쓰지 않아도 되는 단발 알림
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.status]);

  const frac = timer.status === 'idle' ? 0 : 1 - timer.remainingMs / timer.durationMs;
  const statusText = timer.status === 'running' ? '진행 중' : timer.status === 'done' ? '완료' : '대기';

  return (
    <section className="card" aria-labelledby="timer-title">
      <div className="card-head">
        <h2 id="timer-title" className="t-title-3">
          3분 타이머
        </h2>
        <span className="t-caption t-muted">원 그리기로 시작/정지 · {statusText}</span>
      </div>

      <p className={`timer-time t-display num ${timer.status === 'done' ? 'is-done' : ''}`} aria-live="polite">
        {timer.status === 'done' ? '3분이 지났습니다' : formatMs(timer.remainingMs)}
      </p>

      <div className="timer-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)}>
        <div className="timer-fill" style={{ transform: `scaleX(${frac})` }} />
      </div>

      <div className="timer-actions">
        <button type="button" className="btn btn-secondary" onClick={() => toggleTimer(Date.now())}>
          {timer.status === 'running' ? '정지' : '시작'}
        </button>
        {timer.status === 'done' && (
          <button type="button" className="btn btn-ghost" onClick={stopTimer}>
            닫기
          </button>
        )}
      </div>
    </section>
  );
}
