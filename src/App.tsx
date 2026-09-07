import { useEffect, useMemo } from 'react';
import { runGesture } from './commands/registry';
import { IGNORE_REASON_LABEL } from './gesture/stateMachine';
import { CookingMode } from './modes/cooking/CookingMode';
import { cookingMode } from './modes/cooking/mapping';
import { useGestureStore } from './store/gestureStore';
import { useLogStore } from './store/logStore';
import { ActivationToggle } from './ui/ActivationToggle';
import { CameraView } from './ui/CameraView';
import { DevPanel } from './ui/DevPanel';
import { Effects } from './ui/Effects';
import { EventLog } from './ui/EventLog';
import { GESTURE_LABEL, Hud } from './ui/Hud';
import { MappingTable } from './ui/MappingTable';
import { useActivationShortcut } from './ui/shortcuts';
import { playSound, setMuted, unlockAudio } from './ui/sound';
import { useGestureEngine } from './ui/useGestureEngine';
import { VisionSession } from './vision/session';

/** YouTube iframe이 포커스를 가지면 단축키가 페이지에 오지 않으므로 명령 실행 후 포커스를 돌려놓는다 */
function blurIframeFocus() {
  const el = document.activeElement;
  if (el instanceof HTMLIFrameElement) el.blur();
}

export default function App() {
  const session = useMemo(() => new VisionSession(), []);
  const muted = useGestureStore((s) => s.muted);
  const setMutedState = useGestureStore((s) => s.setMuted);

  useActivationShortcut();

  // 효과음은 첫 사용자 입력 뒤에만 낼 수 있다
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => setMuted(muted), [muted]);

  // 활성화 상태가 바뀌면(제스처·버튼·단축키 어느 경로든) 효과음
  useEffect(() => {
    let prev = useGestureStore.getState().enabled;
    return useGestureStore.subscribe((s) => {
      if (s.enabled !== prev) {
        prev = s.enabled;
        playSound(s.enabled ? 'toggleOn' : 'toggleOff');
      }
    });
  }, []);

  useGestureEngine(session, {
    onEvents: (events) => {
      const log = useLogStore.getState();
      for (const e of events) {
        if (e.type !== 'ignored') continue;
        log.add({
          gesture: e.gesture,
          result: 'ignored',
          reason: e.reason ? IGNORE_REASON_LABEL[e.reason] : undefined,
          note:
            e.detail ??
            (e.progress !== undefined && e.progress > 0
              ? `진행 ${Math.round(e.progress * 100)}%`
              : e.score !== undefined
                ? `점수 ${e.score.toFixed(2)}`
                : undefined),
        });
      }
    },
    onExecute: (gesture) => {
      blurIframeFocus();
      const log = useLogStore.getState();
      const { setEffect, enabled } = useGestureStore.getState();
      const gestureLabel = GESTURE_LABEL[gesture];

      if (gesture === 'fist') {
        // 엔진이 이미 enabled를 뒤집은 뒤 호출된다
        const label = `모션 단축키 ${enabled ? 'ON' : 'OFF'}`;
        log.add({ gesture, result: 'executed', command: label });
        setEffect({ gestureLabel, label, tone: enabled ? 'on' : 'off', at: performance.now() });
        return;
      }

      const exec = runGesture(cookingMode, gesture, { now: Date.now() });
      if (!exec) {
        log.add({ gesture, result: 'ignored', reason: '매핑된 명령 없음' });
        return;
      }
      const { command, result } = exec;
      log.add({ gesture, result: result.ok ? 'executed' : 'noop', command: command.label, reason: result.ok ? undefined : result.message, note: result.ok ? result.message : undefined });
      setEffect({ gestureLabel, label: result.ok ? result.message : `${command.label} (${result.message})`, tone: result.ok ? 'ok' : 'noop', at: performance.now() });
      if (result.ok) playSound('execute');
    },
  });

  return (
    <div className="app">
      <header className="app-header">
        <h1>모션 단축키</h1>
        <span className="app-subtitle">{cookingMode.name} · 1차 초안</span>
        <div className="app-header-right">
          <button type="button" onClick={() => setMutedState(!muted)} title="효과음 켜기/끄기">
            {muted ? '🔇 효과음 꺼짐' : '🔊 효과음'}
          </button>
          <ActivationToggle />
        </div>
      </header>
      <main className="layout">
        <section className="panel panel-left">
          <CameraView session={session} />
          <Hud />
        </section>
        <section className="panel panel-right">
          <CookingMode onTimerDone={() => playSound('timerDone')} />
        </section>
        <section className="panel panel-bottom">
          <MappingTable mode={cookingMode} />
        </section>
        <section className="panel panel-bottom">
          <EventLog />
        </section>
      </main>
      <Effects />
      <DevPanel />
    </div>
  );
}
