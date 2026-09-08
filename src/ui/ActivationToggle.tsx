import { useGestureStore } from '../store/gestureStore';
import { StatusDot } from './icons';
import { ACTIVATION_SHORTCUT } from './shortcuts';

/**
 * 활성화 on/off. 주먹 유지(fistHoldMs), 단축키와 같은 스토어 값을 뒤집는다.
 * Ghost 버튼. ON은 text-success + 점, OFF는 text-muted. 항상 "ON/OFF" 텍스트를 동반한다 (§2.4).
 */
export function ActivationToggle() {
  const enabled = useGestureStore((s) => s.enabled);
  const toggle = useGestureStore((s) => s.toggleEnabled);
  const fistSec = useGestureStore((s) => s.config.fistHoldMs) / 1000;
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm activation-toggle ${enabled ? 'is-on' : 'is-off'}`}
      onClick={toggle}
      aria-pressed={enabled}
      title={`모션 단축키 ${enabled ? '끄기' : '켜기'} (${ACTIVATION_SHORTCUT.label}, 또는 주먹 ${fistSec.toFixed(1)}초)`}
    >
      <StatusDot />
      모션 단축키 {enabled ? 'ON' : 'OFF'}
      <kbd>{ACTIVATION_SHORTCUT.label}</kbd>
    </button>
  );
}
