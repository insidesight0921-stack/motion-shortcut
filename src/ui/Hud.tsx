import type { GestureId } from '../gesture/types';
import { useGestureStore } from '../store/gestureStore';

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

/** 인식 상태 HUD: 활성화 배지, 현재 후보, 유지 진행 링, 쿨다운. */
export function Hud() {
  const hud = useGestureStore((s) => s.hud);
  const enabled = useGestureStore((s) => s.enabled);

  const ringProgress = hud.phase === 'holding' || hud.phase === 'armed' ? hud.progress : 0;
  const cooldownFrac =
    hud.phase === 'cooldown' && hud.cooldownRemainingMs > 0
      ? Math.min(1, hud.cooldownRemainingMs / useGestureStore.getState().config.cooldownMs)
      : 0;

  return (
    <div className={`hud hud-${hud.phase}`}>
      <div className={`hud-badge ${enabled ? 'is-on' : 'is-off'}`}>{enabled ? '모션 단축키 ON' : '모션 단축키 OFF'}</div>

      <div className="hud-main">
        <svg className="hud-ring" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r={RING_R} className="hud-ring-track" />
          {ringProgress > 0 && (
            <circle
              cx="32"
              cy="32"
              r={RING_R}
              className="hud-ring-progress"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - ringProgress)}
            />
          )}
          {cooldownFrac > 0 && (
            <circle
              cx="32"
              cy="32"
              r={RING_R}
              className="hud-ring-cooldown"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - cooldownFrac)}
            />
          )}
        </svg>
        <div className="hud-text">
          <div className="hud-phase">{PHASE_LABEL[hud.phase]}</div>
          <div className="hud-candidate">
            {hud.candidate
              ? GESTURE_LABEL[hud.candidate]
              : hud.staticPose?.pose
                ? `${GESTURE_LABEL[hud.staticPose.pose]} (감지)`
                : hud.handScore === null
                  ? '손 없음'
                  : '후보 없음'}
          </div>
        </div>
      </div>

      <dl className="hud-stats">
        <dt>손 신뢰도</dt>
        <dd>{hud.handScore === null ? '-' : hud.handScore.toFixed(2)}</dd>
        <dt>포즈 점수</dt>
        <dd>{hud.staticPose?.pose ? hud.staticPose.score.toFixed(2) : '-'}</dd>
        <dt>속도</dt>
        <dd>{hud.motion.toFixed(2)}</dd>
        <dt>마지막 실행</dt>
        <dd>{hud.lastExecuted ? GESTURE_LABEL[hud.lastExecuted] : '-'}</dd>
      </dl>
    </div>
  );
}
