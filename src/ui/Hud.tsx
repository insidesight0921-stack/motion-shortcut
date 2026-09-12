import type { GestureId } from '../gesture/types';
import { useGestureStore } from '../store/gestureStore';
import { useModeStore } from '../store/modeStore';
import { StatusDot } from './icons';

export const GESTURE_LABEL: Record<GestureId, string> = {
  open_palm: '손바닥 펼치기',
  fist: '주먹 쥐기',
  swipe_right: '오른쪽 스와이프',
  swipe_left: '왼쪽 스와이프',
  circle: '원 그리기',
};

const PHASE_LABEL = {
  idle: '대기',
  holding: '유지 중',
  armed: '실행 예정',
  cooldown: '쿨다운',
} as const;

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

/**
 * 인식 상태 카드: 활성화 상태, 현재 후보, 유지 진행 링, 쿨다운.
 * 진행 링은 애니메이션이 아니라 상태 표시다 (DESIGN.md 적용 노트).
 */
export function Hud() {
  const hud = useGestureStore((s) => s.hud);
  const enabled = useGestureStore((s) => s.enabled);
  const cooldownMs = useGestureStore((s) => s.config.cooldownMs);
  const inStandby = useModeStore((s) => s.current === 'standby');

  const ringProgress = hud.phase === 'holding' || hud.phase === 'armed' ? hud.progress : 0;
  const cooldownFrac = hud.phase === 'cooldown' && hud.cooldownRemainingMs > 0 ? Math.min(1, hud.cooldownRemainingMs / cooldownMs) : 0;

  const candidateText = hud.candidate
    ? GESTURE_LABEL[hud.candidate]
    : hud.staticPose?.pose
      ? `${GESTURE_LABEL[hud.staticPose.pose]} 감지`
      : hud.handScore === null
        ? '손 없음'
        : '후보 없음';

  return (
    <section className="card" aria-labelledby="hud-title">
      <div className="card-head">
        <h2 id="hud-title" className="t-title-3">
          인식 상태
        </h2>
        {inStandby ? (
          <span className="hud-badge t-caption is-off">
            <StatusDot />
            MOTION OFF — 양손 X·키보드·화면으로 켜기
          </span>
        ) : (
          <span className={`hud-badge t-caption ${enabled ? 'is-on' : 'is-off'}`}>
            <StatusDot />
            모션 단축키 {enabled ? 'ON' : 'OFF'}
          </span>
        )}
      </div>

      <div className="hud-main">
        <svg className="hud-ring" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r={RING_R} className="hud-ring-track" />
          {ringProgress > 0 && (
            <circle cx="32" cy="32" r={RING_R} className="hud-ring-progress" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - ringProgress)} />
          )}
          {cooldownFrac > 0 && (
            <circle cx="32" cy="32" r={RING_R} className="hud-ring-cooldown" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - cooldownFrac)} />
          )}
        </svg>
        <div className="hud-text">
          <span className="t-caption t-subtle">{PHASE_LABEL[hud.phase]}</span>
          <span className="t-title-3">{candidateText}</span>
        </div>
      </div>

      <dl className="hud-stats t-caption">
        <dt>손 신뢰도</dt>
        <dd className="num">{hud.handScore === null ? '–' : hud.handScore.toFixed(2)}</dd>
        <dt>포즈 점수</dt>
        <dd className="num">{hud.staticPose?.pose ? hud.staticPose.score.toFixed(2) : '–'}</dd>
        <dt>속도</dt>
        <dd className="num">{hud.motion.toFixed(2)} 손 크기/초</dd>
        <dt>마지막 실행</dt>
        <dd>{hud.lastExecuted ? GESTURE_LABEL[hud.lastExecuted] : '–'}</dd>
      </dl>
    </section>
  );
}
