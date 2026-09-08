import { useState } from 'react';
import { CONFIG_RANGES, DEFAULT_CONFIG, type GestureConfig } from '../gesture/config';
import { useGestureStore } from '../store/gestureStore';
import { IconClose, IconSliders } from './icons';

type Key = keyof GestureConfig;

const GROUPS: { title: string; keys: Key[] }[] = [
  { title: '신뢰도', keys: ['minHandScore', 'minPoseScore', 'minDynamicScore'] },
  { title: '손가락 판정', keys: ['fingerExtendRatio', 'fingerFoldRatio', 'thumbExtendMargin', 'poseSoftMargin'] },
  { title: '정적 유지', keys: ['palmHoldMs', 'fistHoldMs', 'holdGraceMs', 'palmHoldMaxSpeed', 'fistHoldMaxSpeed', 'motionWindowMs'] },
  { title: '실행·쿨다운', keys: ['armDurationMs', 'cooldownMs', 'ignoreLogThrottleMs'] },
  { title: '스와이프', keys: ['swipeWindowMs', 'swipeMinDurationMs', 'swipeMinDistance', 'swipeMaxYRatio', 'swipeMinStraightness', 'swipeMaxPointingFraction', 'trackingMaxGapMs'] },
  {
    title: '원',
    keys: [
      'circleWindowMs',
      'circleMinAngleDeg',
      'circleInProgressAngleDeg',
      'circleMaxRadiusCv',
      'circleMinRadius',
      'circleMinIndexExtendedFraction',
      'circleMinAspect',
      'circleMaxAspect',
    ],
  },
  { title: '버퍼', keys: ['trajectoryMs'] },
];

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/**
 * 개발용 패널: 임계값 슬라이더 + 프레임당 판정 점수. 카메라 앞에서 튜닝할 때 쓴다.
 * 개발자용이라 별도 규칙 없이 토큰만 지킨다. 기본은 접힘, Ghost 버튼으로 연다.
 */
export function DevPanel() {
  const [open, setOpen] = useState(false);
  const config = useGestureStore((s) => s.config);
  const setConfig = useGestureStore((s) => s.setConfig);
  const resetConfig = useGestureStore((s) => s.resetConfig);
  const hud = useGestureStore((s) => s.hud);

  const changed = (Object.keys(DEFAULT_CONFIG) as Key[]).filter((k) => config[k] !== DEFAULT_CONFIG[k]);

  const copyConfig = async () => {
    const diff = Object.fromEntries(changed.map((k) => [k, config[k]]));
    try {
      await navigator.clipboard.writeText(JSON.stringify(diff, null, 2));
    } catch {
      console.log('[motion] config diff', diff);
    }
  };

  const fingers = hud.staticPose?.fingers;
  const margins = hud.staticPose?.margins;
  const dyn = hud.dynamic;
  const signed = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2);

  return (
    <>
      {!open && (
        <button type="button" className="btn btn-ghost btn-sm dev-toggle" onClick={() => setOpen(true)} aria-expanded={false}>
          <IconSliders />
          개발 패널{changed.length ? ` · ${changed.length} 변경` : ''}
        </button>
      )}
      {open && (
        <aside className="dev-panel" aria-label="개발 패널">
          <div className="dev-head">
            <h2 className="t-title-3">임계값</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyConfig} disabled={changed.length === 0}>
              변경값 복사
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetConfig} disabled={changed.length === 0}>
              기본값 복원
            </button>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)} aria-label="개발 패널 닫기">
              <IconClose />
            </button>
          </div>

          <section className="dev-scores">
            <span className="t-strong">프레임 판정</span>
            <dl className="num">
              <dt>단계</dt>
              <dd>
                {hud.phase}
                {hud.candidate ? ` (${hud.candidate})` : ''}
              </dd>
              <dt>손 신뢰도</dt>
              <dd>{hud.handScore === null ? '–' : hud.handScore.toFixed(2)}</dd>
              <dt>정적 포즈</dt>
              <dd>
                {hud.staticPose?.pose ?? '–'} {hud.staticPose?.pose ? hud.staticPose.score.toFixed(2) : ''}
              </dd>
              <dt>손가락 비율</dt>
              <dd>
                {fingers
                  ? `검 ${fingers.ratios.index.toFixed(2)} 중 ${fingers.ratios.middle.toFixed(2)} 약 ${fingers.ratios.ring.toFixed(2)} 새 ${fingers.ratios.pinky.toFixed(2)} 엄지 ${fingers.thumbMargin.toFixed(2)}`
                  : '–'}
              </dd>
              <dt>펼침 마진</dt>
              <dd className="mono">
                {margins
                  ? `검 ${signed(margins.extend.index)} 중 ${signed(margins.extend.middle)} 약 ${signed(margins.extend.ring)} 새 ${signed(margins.extend.pinky)} 엄지 ${signed(margins.extend.thumb)}`
                  : '–'}
              </dd>
              <dt>접힘 마진</dt>
              <dd className="mono">
                {margins
                  ? `검 ${signed(margins.fold.index)} 중 ${signed(margins.fold.middle)} 약 ${signed(margins.fold.ring)} 새 ${signed(margins.fold.pinky)}`
                  : '–'}
              </dd>
              <dt>점수 기준</dt>
              <dd>마진 0 → 0.5, 마진 ≥ {config.poseSoftMargin.toFixed(2)} → 1.0 (손가락 평균)</dd>
              <dt>속도</dt>
              <dd>{hud.motion.toFixed(2)} 손 크기/초</dd>
              <dt>동적</dt>
              <dd>
                {dyn
                  ? `${dyn.gesture} ${dyn.score.toFixed(2)} ${Object.entries(dyn.detail)
                      .map(([k, v]) => `${k}=${fmt(v)}`)
                      .join(' ')}`
                  : '–'}
              </dd>
            </dl>
          </section>

          {GROUPS.map((g) => (
            <section key={g.title} className="dev-group">
              <h4 className="t-caption t-strong">{g.title}</h4>
              {g.keys.map((k) => {
                const r = CONFIG_RANGES[k];
                const isChanged = config[k] !== DEFAULT_CONFIG[k];
                return (
                  <label key={k} className={`dev-row ${isChanged ? 'is-changed' : ''}`}>
                    <span className="dev-label" title={k}>
                      {r.label}
                    </span>
                    <input
                      type="range"
                      min={r.min}
                      max={r.max}
                      step={r.step}
                      value={config[k]}
                      onChange={(e) => setConfig({ [k]: Number(e.target.value) } as Partial<GestureConfig>)}
                    />
                    <span className="dev-value num">{fmt(config[k])}</span>
                  </label>
                );
              })}
            </section>
          ))}
          <p className="t-caption t-subtle" style={{ marginTop: 'var(--space-16)' }}>
            값은 새로고침하면 기본값으로 돌아갑니다. 좋은 값을 찾으면 "변경값 복사" 후 config.ts에 반영하세요.
          </p>
        </aside>
      )}
    </>
  );
}
