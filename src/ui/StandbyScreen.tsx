import { COMMANDS } from '../commands/catalog';
import { GESTURE_ORDER } from '../mapping/types';
import { MODES } from '../modes/catalog';
import { isUserMode } from '../modes/types';
import { PROGRAM_LABEL } from '../profile/types';
import { useGestureStore } from '../store/gestureStore';
import { useModeStore } from '../store/modeStore';
import { useProfileStore } from '../store/profileStore';
import { useUiStore } from '../store/uiStore';
import { AgentPanel } from './AgentPanel';
import { GESTURE_LABEL } from './Hud';
import { endPresentation, presentationControls, startPresentation } from './presentation';
import type { AgentControls } from './useAgent';

interface Props {
  agent: AgentControls;
}

/**
 * 발표 대기 화면 (§21): 등록 제스처 요약, 현재 모드, 에이전트 상태, 발표 시작/종료.
 * 카메라 미리보기와 HUD 는 왼쪽 열에 항상 있다.
 * 버튼 규칙은 presentation.ts (카메라 꺼짐 → 발표 시작 disabled, 한 시점에 primary 하나).
 */
export function StandbyScreen({ agent }: Props) {
  const cameraRunning = useGestureStore((s) => s.visionStatus === 'running');
  const mode = useModeStore((s) => s.current);
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0]);
  const setView = useUiStore((s) => s.setView);
  const controls = presentationControls(cameraRunning, mode);
  const summaryMode = isUserMode(mode) ? mode : 'slide';
  const mapping = profile.mappingByMode[summaryMode];

  return (
    <>
      <section className={`card standby ${controls.presenting ? 'is-presenting' : ''}`} aria-labelledby="standby-title">
        <div className="card-head">
          <div>
            <h2 id="standby-title" className="t-title-3">
              {controls.presenting ? '발표 중' : '발표 대기'}
            </h2>
            <p className="t-caption t-muted">
              {profile.name} · {PROGRAM_LABEL[profile.program]} · {MODES[mode].labelEn}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView('gestures')}>
            제스처 설정
          </button>
        </div>

        <ul className="gesture-summary">
          {GESTURE_ORDER.map((g) => {
            const entry = mapping[g];
            const cmd = COMMANDS[entry.commandId];
            const locked = g === 'fist';
            const label = locked ? (profile.settings.motionToggle === 'fist' ? '활성화 on/off' : '(양손 X 가 켜기/끄기)') : cmd.name;
            const dim = locked ? profile.settings.motionToggle !== 'fist' : entry.commandId === 'none';
            return (
              <li key={g} className={dim ? 't-muted' : ''}>
                <span className="t-body-2 t-strong">{GESTURE_LABEL[g]}</span>
                <span className="t-body-2">{label}</span>
              </li>
            );
          })}
        </ul>

        {!cameraRunning && <p className="t-caption t-subtle">카메라를 먼저 켜야 발표를 시작할 수 있습니다.</p>}
        {controls.presenting && <p className="t-caption t-subtle">발표 중에는 양손 X, Ctrl+Shift+0, 아래 버튼으로 MOTION OFF 할 수 있습니다.</p>}

        <div className="standby-actions">
          {controls.presenting ? (
            <button type="button" className="btn btn-secondary" onClick={endPresentation}>
              발표 종료
            </button>
          ) : (
            <button type="button" className={`btn ${controls.primary === 'start' ? 'btn-primary' : 'btn-secondary'}`} onClick={startPresentation} disabled={!controls.startEnabled}>
              발표 시작
            </button>
          )}
        </div>
      </section>

      <AgentPanel controls={agent} />
    </>
  );
}
