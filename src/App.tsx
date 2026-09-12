import { useEffect, useMemo } from 'react';
import { runMapping } from './commands/registry';
import { IGNORE_REASON_LABEL } from './gesture/stateMachine';
import { MODES } from './modes/catalog';
import { isUserMode } from './modes/types';
import { useGestureStore } from './store/gestureStore';
import { useLogStore } from './store/logStore';
import { useModeStore } from './store/modeStore';
import { useProfileStore } from './store/profileStore';
import { useUiStore, type View } from './store/uiStore';
import { ActivationToggle } from './ui/ActivationToggle';
import { CameraView } from './ui/CameraView';
import { DevPanel } from './ui/DevPanel';
import { Effects } from './ui/Effects';
import { EventLog } from './ui/EventLog';
import { GestureSettings } from './ui/GestureSettings';
import { Home } from './ui/Home';
import { GESTURE_LABEL, Hud } from './ui/Hud';
import { IconSoundOff, IconSoundOn } from './ui/icons';
import { ModeSwitcher } from './ui/ModeSwitcher';
import { ProfileSettings } from './ui/ProfileSettings';
import { useActivationShortcut, useModeShortcuts } from './ui/shortcuts';
import { playSound, setMuted, unlockAudio } from './ui/sound';
import { StandbyScreen } from './ui/StandbyScreen';
import { useAgent } from './ui/useAgent';
import { useGestureEngine } from './ui/useGestureEngine';
import { useVoice } from './ui/useVoice';
import { VisionSession } from './vision/session';

const VIEWS: { id: View; label: string }[] = [
  { id: 'home', label: '홈' },
  { id: 'profile', label: '프로필' },
  { id: 'gestures', label: '제스처' },
  { id: 'standby', label: '발표' },
];

/** 다른 문서(iframe)가 포커스를 가지면 단축키가 페이지에 오지 않으므로 명령 실행 후 포커스를 돌려놓는다 */
function blurIframeFocus() {
  const el = document.activeElement;
  if (el instanceof HTMLIFrameElement) el.blur();
}

export default function App() {
  const session = useMemo(() => new VisionSession(), []);
  const muted = useGestureStore((s) => s.muted);
  const setMutedState = useGestureStore((s) => s.setMuted);
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const fistToggle = useProfileStore((s) => (s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0]).settings.motionToggle === 'fist');

  useActivationShortcut();
  useModeShortcuts();
  const voice = useVoice();
  const agent = useAgent();

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

  // 활성화(주먹 옵션) 상태가 바뀌면 효과음
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
    onBlocked: (gesture, reason) => {
      // MOTION OFF·모드 전환 직후·양손 진행 중·주먹 옵션 꺼짐: 주먹 포함 모두 무시 (D-016·D-017)
      useLogStore.getState().add({ gesture, result: 'ignored', reason });
    },
    onTwoHand: () => {
      // 양손 X 유지 → MOTION OFF 토글 (modeStore 가 이미 바뀐 뒤 호출된다). 전환 로그는 모드 전환 구독이 남긴다
      const current = useModeStore.getState().current;
      const off = current === 'standby';
      useGestureStore.getState().setEffect({ gestureLabel: '양손 X', label: off ? 'MOTION OFF' : MODES[current].labelEn, tone: off ? 'off' : 'on', at: performance.now() });
      playSound(off ? 'toggleOff' : 'toggleOn');
    },
    onExecute: (gesture) => {
      blurIframeFocus();
      const log = useLogStore.getState();
      const { setEffect, enabled, toggleEnabled } = useGestureStore.getState();
      const gestureLabel = GESTURE_LABEL[gesture];

      if (gesture === 'fist') {
        // 엔진이 이미 enabled를 뒤집은 뒤 호출된다 (D-015 결정 1). motionToggle === 'fist' 일 때만 온다
        const label = `활성화 ${enabled ? 'ON' : 'OFF'}`;
        log.add({ gesture, result: 'executed', command: '활성화 on/off', note: label });
        setEffect({ gestureLabel, label, tone: enabled ? 'on' : 'off', at: performance.now() });
        return;
      }

      const current = useModeStore.getState().current;
      if (!isUserMode(current)) return; // 게이트가 먼저 막지만 방어적으로
      const mapping = useProfileStore.getState().mapping(current);
      const capturing = useUiStore.getState().capturing;
      const exec = runMapping(mapping, gesture, { now: Date.now(), toggleEnabled }, { paused: capturing, pausedReason: '키 캡처 중' });
      const commandName = exec.def?.name;

      log.add({
        gesture,
        result: exec.status,
        command: commandName,
        reason: exec.status === 'executed' ? undefined : exec.message,
        note: exec.status === 'executed' ? `${exec.message} · ${MODES[current].labelEn}` : MODES[current].labelEn,
      });
      setEffect({
        gestureLabel,
        label: exec.status === 'executed' ? exec.message : `${commandName ?? '명령'} · ${exec.status === 'failed' ? '실행 실패 · ' : ''}${exec.message}`,
        tone: exec.status === 'executed' ? 'ok' : 'noop',
        at: performance.now(),
      });
      if (exec.status === 'executed') playSound('execute');
    },
  });

  return (
    <div className="app">
      <header className="topbar">
        <div className="container topbar-inner">
          <div className="topbar-title">
            <h1 className="t-title-2">Flickey</h1>
          </div>
          <nav className="view-nav" aria-label="화면">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" className={`btn btn-ghost btn-sm view-tab ${view === v.id ? 'is-active' : ''}`} aria-current={view === v.id ? 'page' : undefined} onClick={() => setView(v.id)}>
                {v.label}
              </button>
            ))}
          </nav>
          <div className="topbar-actions">
            {fistToggle && <ActivationToggle />}
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => setMutedState(!muted)}
              aria-pressed={muted}
              aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
              title={muted ? '효과음 켜기' : '효과음 끄기'}
            >
              {muted ? <IconSoundOff /> : <IconSoundOn />}
            </button>
          </div>
        </div>
        <div className="container topbar-modes">
          <ModeSwitcher />
        </div>
      </header>

      <main className="container layout">
        <div className="col">
          <CameraView session={session} />
          <Hud />
        </div>
        <div className="col">
          {view === 'home' && <Home />}
          {view === 'profile' && <ProfileSettings voice={voice} />}
          {view === 'gestures' && <GestureSettings />}
          {view === 'standby' && <StandbyScreen agent={agent} />}
        </div>
        <div className="row-full">
          <EventLog />
        </div>
      </main>

      <Effects />
      <DevPanel />
    </div>
  );
}
