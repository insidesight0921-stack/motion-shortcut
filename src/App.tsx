import { useMemo } from 'react';
import { CameraView } from './ui/CameraView';
import { GESTURE_LABEL, Hud } from './ui/Hud';
import { useGestureEngine } from './ui/useGestureEngine';
import { VisionSession } from './vision/session';

export default function App() {
  const session = useMemo(() => new VisionSession(), []);

  useGestureEngine(session, {
    onExecute: (gesture, t) => {
      // 7단계에서 명령 레지스트리로 교체된다.
      console.log(`[execute] ${Math.round(t)}ms ${gesture} (${GESTURE_LABEL[gesture]})`);
    },
  });

  return (
    <div className="app">
      <header className="app-header">
        <h1>모션 단축키</h1>
        <span className="app-subtitle">요리 모드 · 1차 초안</span>
      </header>
      <main className="layout">
        <section className="panel panel-left">
          <CameraView session={session} />
          <Hud />
        </section>
        <section className="panel panel-right">
          <p className="placeholder">요리 모드 UI는 7단계에서 붙습니다.</p>
        </section>
      </main>
    </div>
  );
}
