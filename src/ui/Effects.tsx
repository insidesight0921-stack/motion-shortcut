import { useEffect, useState } from 'react';
import { useGestureStore } from '../store/gestureStore';

const SHOW_MS = 1000;
const LEAVE_MS = 150; // = --duration-fast

/**
 * 명령 실행 순간의 토스트. 진입 220ms(opacity + translateY 8px), 퇴장 150ms(opacity).
 * prefers-reduced-motion이면 CSS에서 이동을 빼고 opacity만 남긴다 (§7).
 */
export function Effects() {
  const effect = useGestureStore((s) => s.effect);
  const [phase, setPhase] = useState<'hidden' | 'shown' | 'leaving'>('hidden');

  useEffect(() => {
    if (!effect) return;
    setPhase('shown');
    const t1 = window.setTimeout(() => setPhase('leaving'), SHOW_MS);
    const t2 = window.setTimeout(() => setPhase('hidden'), SHOW_MS + LEAVE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [effect]);

  if (!effect || phase === 'hidden') return null;
  return (
    <div key={effect.at} className={`fx-toast fx-${effect.tone} ${phase === 'leaving' ? 'is-leaving' : ''}`} role="status">
      <span className="fx-gesture t-body-2">{effect.gestureLabel}</span>
      <span className="fx-command t-body-2">{effect.label}</span>
    </div>
  );
}
