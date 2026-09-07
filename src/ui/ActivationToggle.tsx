import { useGestureStore } from '../store/gestureStore';
import { ACTIVATION_SHORTCUT } from './shortcuts';

/** 활성화 on/off 버튼. 주먹 유지(fistHoldMs), 단축키와 같은 스토어 값을 뒤집는다. */
export function ActivationToggle() {
  const enabled = useGestureStore((s) => s.enabled);
  const toggle = useGestureStore((s) => s.toggleEnabled);
  const fistSec = useGestureStore((s) => s.config.fistHoldMs) / 1000;
  return (
    <button
      type="button"
      className={`activation-toggle ${enabled ? 'is-on' : 'is-off'}`}
      onClick={toggle}
      aria-pressed={enabled}
      title={`모션 단축키 ${enabled ? '끄기' : '켜기'} (${ACTIVATION_SHORTCUT.label}, 또는 주먹 ${fistSec.toFixed(1)}초)`}
    >
      <span className="activation-dot" aria-hidden />
      모션 단축키 {enabled ? 'ON' : 'OFF'}
      <kbd>{ACTIVATION_SHORTCUT.label}</kbd>
    </button>
  );
}
