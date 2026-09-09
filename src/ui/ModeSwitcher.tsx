import { useEffect, useState } from 'react';
import { MODES, USER_MODES } from '../modes/catalog';
import { useModeStore } from '../store/modeStore';
import { IconLock } from './icons';
import { MODE_SHORTCUT_LABEL } from './shortcuts';

/**
 * 모드 세그먼트(4개) + 대기 버튼. 선택 상태는 bg-brand-weak (DESIGN.md). primary 버튼은 여전히 "카메라 시작" 하나다.
 * 전환 직후 220ms 강조(--duration-base). 음성·키보드로 바뀐 것도 여기 반영된다.
 */
export function ModeSwitcher() {
  const current = useModeStore((s) => s.current);
  const switchedAt = useModeStore((s) => s.switchedAt);
  const setMode = useModeStore((s) => s.setMode);
  const standby = useModeStore((s) => s.standby);
  const wake = useModeStore((s) => s.wake);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!switchedAt) return;
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 220);
    return () => window.clearTimeout(id);
  }, [switchedAt]);

  const inStandby = current === 'standby';

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
              title={`${m.name} 모드 (${MODE_SHORTCUT_LABEL(m.shortcutDigit)}, 음성 "${m.voiceAliases[0]}")`}
            >
              {m.name}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={`btn btn-ghost btn-sm mode-standby ${inStandby ? 'is-selected' : ''}`}
        aria-pressed={inStandby}
        onClick={() => (inStandby ? wake('ui') : standby('ui'))}
        title={inStandby ? `대기 해제 (${MODE_SHORTCUT_LABEL('0')}, 음성 "깨어나")` : `대기 (${MODE_SHORTCUT_LABEL('0')}, 음성 "대기")`}
      >
        <IconLock />
        {inStandby ? '대기 해제' : '대기'}
      </button>
      <span className="sr-only" aria-live="polite">
        현재 {MODES[current].name} 모드
      </span>
    </div>
  );
}
