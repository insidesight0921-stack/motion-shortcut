import { ASSIGNABLE_COMMANDS, COMMANDS } from '../commands/catalog';
import type { CommandDef } from '../commands/types';
import type { GestureId } from '../gesture/types';
import { GESTURE_ORDER } from '../mapping/types';
import { MODES } from '../modes/catalog';
import { isUserMode } from '../modes/types';
import { useGestureStore } from '../store/gestureStore';
import { useModeStore } from '../store/modeStore';
import { useProfileStore } from '../store/profileStore';
import { GESTURE_LABEL } from './Hud';
import { MappingEditor } from './MappingEditor';

const RISK_LABEL = { low: '낮음', medium: '중간', high: '높음' } as const;

/** 제스처별 유지 시간·쿨다운 (인식 설정에서 읽는다). 정적 포즈만 유지 시간이 있다 */
function holdText(g: GestureId, cfg: { palmHoldMs: number; fistHoldMs: number }): string {
  if (g === 'open_palm') return `${(cfg.palmHoldMs / 1000).toFixed(1)}초 유지`;
  if (g === 'fist') return `${(cfg.fistHoldMs / 1000).toFixed(1)}초 유지`;
  return '동작 완료 시';
}

/**
 * 제스처 설정 (§21): 기능 목록(현재 모드) → 연결된 제스처·위험도·유지시간·쿨다운 요약 + 편집 표.
 * 추천 제스처·충돌 위험도는 4차(리허설)에서 채운다.
 */
export function GestureSettings() {
  // 선택자는 원시값만 (객체를 새로 만들면 매 렌더 스냅샷이 바뀌어 무한 갱신)
  const modeCurrent = useModeStore((s) => s.current);
  const modePrevious = useModeStore((s) => s.previous);
  const cfg = useGestureStore((s) => s.config);
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0]);

  // MOTION OFF 여도 매핑은 편집할 수 있어야 한다: 직전 사용자 모드(없으면 slide)를 편집한다
  const current = isUserMode(modeCurrent) ? modeCurrent : modePrevious && isUserMode(modePrevious) ? modePrevious : 'slide';
  const editingWhileOff = !isUserMode(modeCurrent);

  const mapping = profile.mappingByMode[current];
  const functions: CommandDef[] = ASSIGNABLE_COMMANDS.filter((c) => c.id !== 'none' && (current === 'slide' ? c.id.startsWith('slide.') || c.id === 'key.press' : c.id === 'key.press'));
  const gestureFor = (id: CommandDef['id']): GestureId[] => GESTURE_ORDER.filter((g) => mapping[g].commandId === id);

  return (
    <>
      <section className="card" aria-labelledby="gs-title">
        <div className="card-head">
          <div>
            <h2 id="gs-title" className="t-title-3">
              기능 목록 · {MODES[current].name} 모드
            </h2>
            <p className="t-caption t-muted">
              프로필 "{profile.name}"{editingWhileOff ? ' · MOTION OFF 상태에서 편집 중 (위 세그먼트로 모드를 바꿀 수 있습니다)' : ''} · 추천 제스처와 충돌 위험도는 리허설(4차) 후 표시됩니다
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>기능</th>
                <th>연결된 제스처</th>
                <th>위험도</th>
                <th>유지 시간</th>
                <th>쿨다운</th>
              </tr>
            </thead>
            <tbody>
              {functions.map((fn) => {
                const gs = gestureFor(fn.id);
                return (
                  <tr key={fn.id}>
                    <td data-label="기능" className="t-strong">
                      {fn.name}
                    </td>
                    <td data-label="제스처">{gs.length ? gs.map((g) => GESTURE_LABEL[g]).join(', ') : <span className="t-muted">없음</span>}</td>
                    <td data-label="위험도" className={fn.risk === 'high' ? 't-danger' : ''}>
                      {RISK_LABEL[fn.risk]}
                    </td>
                    <td data-label="유지">{gs.length ? gs.map((g) => holdText(g, cfg)).join(', ') : '–'}</td>
                    <td data-label="쿨다운" className="num">
                      {(cfg.cooldownMs / 1000).toFixed(1)}초
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td data-label="기능" className="t-strong">
                  {COMMANDS['system.toggleEnabled'].name}
                </td>
                <td data-label="제스처">{profile.settings.motionToggle === 'fist' ? GESTURE_LABEL.fist : '양손 X (프로필 설정)'}</td>
                <td data-label="위험도">{RISK_LABEL.medium}</td>
                <td data-label="유지" className="num">
                  {profile.settings.motionToggle === 'fist' ? holdText('fist', cfg) : `${(cfg.xHoldMs / 1000).toFixed(1)}초 유지`}
                </td>
                <td data-label="쿨다운" className="num">
                  {(cfg.cooldownMs / 1000).toFixed(1)}초
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="t-caption t-muted">유지 시간·쿨다운은 인식 설정(개발 패널)의 값입니다. 프로필별 조정은 4차에서 추가됩니다.</p>
      </section>

      <MappingEditor mode={current} />
    </>
  );
}
