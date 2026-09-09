import { useEffect, useId, useState } from 'react';
import { useTargetStore } from '../../store/targetStore';
import { formatMs } from './formatMs';

interface Props {
  /** 타이머 종료 시 호출 (효과음 등) */
  onDone?: () => void;
}

/**
 * 범용 카운트다운 타이머 (timer.toggle 명령의 데모 대상). 길이는 명령 파라미터(분) 또는 여기서 직접 정한다.
 * 진행 바는 transform으로만 움직인다 (DESIGN.md §7).
 */
export function Timer({ onDone }: Props) {
  const timer = useTargetStore((s) => s.timer);
  const toggleTimer = useTargetStore((s) => s.toggleTimer);
  const stopTimer = useTargetStore((s) => s.stopTimer);
  const [minutes, setMinutes] = useState(() => Math.max(1, Math.round(timer.durationMs / 60_000)));
  const minutesId = useId();

  useEffect(() => {
    if (timer.status !== 'running') return;
    const tick = () => useTargetStore.getState().tickTimer(Date.now());
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
  const runningMinutes = Math.round(timer.durationMs / 60_000);

  return (
    <section className="card" aria-labelledby="timer-title">
      <div className="card-head">
        <h2 id="timer-title" className="t-title-3">
          타이머
        </h2>
        <span className="t-caption t-muted">
          {timer.status === 'running' ? `${runningMinutes}분 · ` : ''}
          {statusText}
        </span>
      </div>

      <p className={`timer-time t-display num ${timer.status === 'done' ? 'is-done' : ''}`} aria-live="polite">
        {timer.status === 'done' ? `${runningMinutes}분이 지났습니다` : formatMs(timer.remainingMs)}
      </p>

      <div className="timer-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)}>
        <div className="timer-fill" style={{ transform: `scaleX(${frac})` }} />
      </div>

      <div className="timer-actions">
        {timer.status !== 'running' && (
          <div className="field timer-minutes">
            <label htmlFor={minutesId} className="field-label">
              분
            </label>
            <input
              id={minutesId}
              className="input num"
              type="number"
              min={1}
              max={180}
              step={1}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Math.min(180, Math.round(Number(e.target.value) || 1))))}
            />
          </div>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => toggleTimer(Date.now(), minutes * 60_000)}>
          {timer.status === 'running' ? '정지' : '시작'}
        </button>
        {timer.status === 'done' && (
          <button type="button" className="btn btn-ghost" onClick={stopTimer}>
            닫기
          </button>
        )}
      </div>
      <p className="t-caption t-muted timer-hint">제스처로도 켜고 끌 수 있습니다. 기본 매핑은 원 그리기입니다.</p>
    </section>
  );
}
