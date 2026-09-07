import { useEffect, useState } from 'react';
import { useGestureStore } from '../store/gestureStore';

/** 명령 실행 순간의 화면 이펙트: 상단 토스트 + 짧은 테두리 플래시 */
export function Effects() {
  const effect = useGestureStore((s) => s.effect);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!effect) return;
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), 900);
    return () => window.clearTimeout(id);
  }, [effect]);

  if (!effect || !visible) return null;
  return (
    <>
      <div key={`flash-${effect.at}`} className={`fx-flash fx-${effect.tone}`} aria-hidden />
      <div key={`toast-${effect.at}`} className={`fx-toast fx-${effect.tone}`} role="status">
        <span className="fx-gesture">{effect.gestureLabel}</span>
        <span className="fx-arrow">→</span>
        <span className="fx-command">{effect.label}</span>
      </div>
    </>
  );
}
