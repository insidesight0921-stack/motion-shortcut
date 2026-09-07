import { useMemo } from 'react';
import { runGesture } from './commands/registry';
import { CookingMode } from './modes/cooking/CookingMode';
import { cookingMode } from './modes/cooking/mapping';
import { ActivationToggle } from './ui/ActivationToggle';
import { CameraView } from './ui/CameraView';
import { GESTURE_LABEL, Hud } from './ui/Hud';
import { useActivationShortcut } from './ui/shortcuts';
import { useGestureEngine } from './ui/useGestureEngine';
import { VisionSession } from './vision/session';

/** YouTube iframe이 포커스를 가지면 단축키가 페이지에 오지 않으므로 명령 실행 후 포커스를 돌려놓는다 */
function blurIframeFocus() {
  const el = document.activeElement;
  if (el instanceof HTMLIFrameElement) el.blur();
}

export default function App() {
  const session = useMemo(() => new VisionSession(), []);

  useActivationShortcut();
  useGestureEngine(session, {
    onExecute: (gesture) => {
      blurIframeFocus();
      if (gesture === 'fist') {
        console.log(`[execute] ${GESTURE_LABEL[gesture]} → 활성화 토글`);
        return;
      }
      const exec = runGesture(cookingMode, gesture, { now: Date.now() });
      if (!exec) {
        console.log(`[execute] ${GESTURE_LABEL[gesture]} → 매핑 없음`);
        return;
      }
      // 8단계에서 화면 로그·이펙트·효과음으로 확장된다
      console.log(`[execute] ${GESTURE_LABEL[gesture]} → ${exec.command.label}: ${exec.result.message}${exec.result.ok ? '' : ' (무시)'}`);
    },
  });

  return (
    <div className="app">
      <header className="app-header">
        <h1>모션 단축키</h1>
        <span className="app-subtitle">{cookingMode.name} · 1차 초안</span>
        <div className="app-header-right">
          <ActivationToggle />
        </div>
      </header>
      <main className="layout">
        <section className="panel panel-left">
          <CameraView session={session} />
          <Hud />
        </section>
        <section className="panel panel-right">
          <CookingMode />
        </section>
      </main>
    </div>
  );
}
