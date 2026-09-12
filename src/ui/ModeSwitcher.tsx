import { useEffect, useState } from 'react';
import { MODES, USER_MODES } from '../modes/catalog';
import { useModeStore } from '../store/modeStore';
import { IconLock } from './icons';
import { MODE_SHORTCUT_LABEL } from './shortcuts';

/**
 * 모드 세그먼트(4개) + MOTION OFF 토글. 선택 상태는 bg-brand-weak (DESIGN.md). primary 버튼은 여전히 "카메라 시작" 하나다.
 * 전환 직후 220ms 강조(--duration-base). 제스처·키보드·음성으로 바뀐 것도 여기 반영된다.
 */
export function ModeSwitcher() {
  const current = useModeStore((s) => s.current);
  const switchedAt = useModeStore((s) => s.switchedAt);
  const setMode = useModeStore((s) => s.setMode);
  const toggleStandby = useModeStore((s) => s.toggleStandby);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!switchedAt) return;
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 220);
    return () => window.clearTimeout(id);
  }, [switchedAt]);

  const off = current === 'standby';

  return (
    <div className={`mode-switcher ${flash ? 'is-flash' : ''}`} role="group" aria-label="모드">
      <div className="segment" role="tablist" aria-label="모드 선택">
        {USER_MODES.map((m) => {
          const selected = current === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`segment-item ${selected ? 'is-selected' : ''}`}
              onClick={() => setMode(m.id, 'ui')}
              title={`${m.name} 모드 (${MODE_SHORTCUT_LABEL(m.shortcutDigit)})`}
            >
              {m.name}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={`btn btn-ghost btn-sm mode-standby ${off ? 'is-selected' : ''}`}
        aria-pressed={off}
        onClick={() => toggleStandby('ui')}
        title={off ? `모션 켜기 (${MODE_SHORTCUT_LABEL('0')}, 양손 X 유지)` : `모션 끄기 (${MODE_SHORTCUT_LABEL('0')}, 양손 X 유지)`}
      >
        <IconLock />
        {off ? 'MOTION OFF · 켜기' : '모션 끄기'}
      </button>
      <span className="sr-only" aria-live="polite">
        현재 {MODES[current].labelEn}
      </span>
    </div>
  );
}
