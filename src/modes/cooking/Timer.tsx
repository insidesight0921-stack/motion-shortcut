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

/** 3분 타이머. 원 그리기로 시작/정지. */
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

  return (
    <div className={`timer timer-${timer.status}`}>
      <div className="timer-bar" style={{ width: `${Math.round(frac * 100)}%` }} />
      <div className="timer-body">
        <div className="timer-label">3분 타이머 (원 그리기)</div>
        <div className="timer-time">{timer.status === 'done' ? '완료!' : formatMs(timer.remainingMs)}</div>
        <div className="timer-actions">
          <button type="button" onClick={() => toggleTimer(Date.now())}>
            {timer.status === 'running' ? '정지' : '시작'}
          </button>
          {timer.status === 'done' && (
            <button type="button" onClick={stopTimer}>
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
