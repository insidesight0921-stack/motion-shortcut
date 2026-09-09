import { useId } from 'react';
import { ASSIGNABLE_COMMANDS, COMMANDS } from '../commands/catalog';
import { runCommand, validateParams } from '../commands/registry';
import type { CommandId } from '../commands/types';
import type { GestureId } from '../gesture/types';
import { hasAnyCommand } from '../mapping/defaults';
import { GESTURE_ORDER, LOCKED_GESTURE } from '../mapping/types';
import { MODES } from '../modes/catalog';
import type { UserModeId } from '../modes/types';
import { useGestureStore } from '../store/gestureStore';
import { useLogStore } from '../store/logStore';
import { useMappingStore } from '../store/mappingStore';
import { GESTURE_LABEL } from './Hud';
import { IconGestureCircle, IconGestureFist, IconGestureOpenPalm, IconGestureSwipeLeft, IconGestureSwipeRight, IconLock } from './icons';
import { KeyCaptureInput } from './KeyCaptureInput';
import { playSound } from './sound';

const GESTURE_ICON: Record<GestureId, (props: { title?: string }) => JSX.Element> = {
  open_palm: IconGestureOpenPalm,
  fist: IconGestureFist,
  swipe_right: IconGestureSwipeRight,
  swipe_left: IconGestureSwipeLeft,
  circle: IconGestureCircle,
};

interface Props {
  /** 편집할 모드 (standby 는 편집기가 없다) */
  mode: UserModeId;
}

/**
 * 현재 모드의 제스처 ↔ 명령 매핑 편집기. 변경은 즉시 반영되고 localStorage(v2, 모드별)에 저장된다.
 * 주먹은 활성화 on/off 로 고정되어 편집할 수 없다 (잠금 해제 경로 안전장치).
 * data-mapping-editor: key.press 가 이 안의 폼 요소를 대상으로 삼지 않게 하는 표식 (D-015 보완 3).
 */
export function MappingEditor({ mode }: Props) {
  const mapping = useMappingStore((s) => s.byMode[mode]);
  const setCommand = useMappingStore((s) => s.setCommand);
  const setParams = useMappingStore((s) => s.setParams);
  const reset = useMappingStore((s) => s.reset);
  const setCapturing = useMappingStore((s) => s.setCapturing);
  const baseId = useId();
  const def = MODES[mode];
  const empty = !hasAnyCommand(mapping);

  const test = (gesture: GestureId) => {
    const entry = mapping[gesture];
    const cmd = COMMANDS[entry.commandId];
    const result = runCommand(entry.commandId, entry.params, {
      now: Date.now(),
      toggleEnabled: () => useGestureStore.getState().toggleEnabled(),
    });
    const status = entry.commandId === 'none' ? 'ignored' : result.ok ? 'executed' : 'failed';
    useLogStore.getState().add({
      gesture,
      result: status,
      command: cmd.name,
      reason: status === 'executed' ? undefined : result.message,
      note: status === 'executed' ? `${result.message} · 테스트 버튼` : '테스트 버튼',
    });
    useGestureStore.getState().setEffect({
      gestureLabel: `${GESTURE_LABEL[gesture]} (테스트)`,
      label: result.ok ? result.message : `${cmd.name} · ${result.message}`,
      tone: result.ok ? 'ok' : 'noop',
      at: performance.now(),
    });
    if (result.ok && entry.commandId !== 'none') playSound('execute');
  };

  return (
    <section className="card mapping-editor" aria-labelledby="mapping-title" data-mapping-editor>
      <div className="card-head">
        <div>
          <h2 id="mapping-title" className="t-title-3">
            {def.name} 모드 매핑
          </h2>
          <p className="t-caption t-muted">바꾸면 바로 적용되고 이 브라우저에 모드별로 저장됩니다</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => reset(mode)}>
          기본값으로 되돌리기
        </button>
      </div>

      {empty && <p className="mapping-empty t-body-2 t-subtle">아직 명령이 없습니다. 아래에서 연결하세요.</p>}

      <div className="table-scroll">
        <table className="data-table mapping-table">
          <thead>
            <tr>
              <th>제스처</th>
              <th>명령</th>
              <th>설정</th>
              <th>
                <span className="sr-only">테스트</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {GESTURE_ORDER.map((gesture) => {
              const entry = mapping[gesture];
              const cmd = COMMANDS[entry.commandId];
              const Icon = GESTURE_ICON[gesture];
              const locked = gesture === LOCKED_GESTURE;
              const selectId = `${baseId}-${gesture}-cmd`;
              const paramId = `${baseId}-${gesture}-param`;
              const helpId = `${baseId}-${gesture}-help`;
              const validation = validateParams(cmd, entry.params);
              const schema = cmd.params;
              // 콜백 안에서는 타입 좁힘이 유지되지 않으므로 키를 미리 꺼낸다
              const paramKey = schema.kind === 'none' ? null : schema.key;

              return (
                <tr key={gesture} className={locked ? 'is-locked' : ''}>
                  <td data-label="제스처">
                    <span className="mapping-gesture">
                      <span className="mapping-gesture-icon" aria-hidden>
                        <Icon />
                      </span>
                      <span className="t-strong">{GESTURE_LABEL[gesture]}</span>
                    </span>
                  </td>

                  {locked ? (
                    <td data-label="명령" colSpan={3}>
                      <span className="mapping-locked t-subtle">
                        <IconLock />
                        활성화 on/off (고정)
                      </span>
                      <p id={helpId} className="t-caption t-muted mapping-help">
                        {COMMANDS['system.toggleEnabled'].description}
                      </p>
                    </td>
                  ) : (
                    <>
                      <td data-label="명령">
                        <label htmlFor={selectId} className="sr-only">
                          {GESTURE_LABEL[gesture]} 명령
                        </label>
                        <span className="select-wrap">
                          <select
                            id={selectId}
                            className="input select"
                            value={entry.commandId}
                            onChange={(e) => setCommand(mode, gesture, e.target.value as CommandId)}
                            aria-describedby={helpId}
                          >
                            {ASSIGNABLE_COMMANDS.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </span>
                        <p id={helpId} className="t-caption t-muted mapping-help">
                          {cmd.description}
                        </p>
                      </td>

                      <td data-label="설정">
                        {schema.kind === 'none' && <span className="t-caption t-muted">—</span>}
                        {schema.kind === 'number' && paramKey && (
                          <div className="field mapping-param">
                            <label htmlFor={paramId} className="field-label">
                              {schema.label} ({schema.unit})
                            </label>
                            <input
                              id={paramId}
                              className={`input num ${validation.ok ? '' : 'is-invalid'}`}
                              type="number"
                              min={schema.min}
                              max={schema.max}
                              step={schema.step}
                              value={entry.params[paramKey] ?? ''}
                              onChange={(e) => setParams(mode, gesture, { [paramKey]: e.target.value === '' ? '' : Number(e.target.value) })}
                              aria-invalid={validation.ok ? undefined : true}
                            />
                            <p className="field-error">{validation.ok ? '' : validation.error}</p>
                          </div>
                        )}
                        {schema.kind === 'keyCombo' && paramKey && (
                          <div className="field mapping-param">
                            <label htmlFor={paramId} className="field-label">
                              {schema.label}
                            </label>
                            <KeyCaptureInput
                              id={paramId}
                              value={String(entry.params[paramKey] ?? '')}
                              onChange={(combo) => setParams(mode, gesture, { [paramKey]: combo })}
                              onCapturingChange={setCapturing}
                            />
                            <p className="field-error">{validation.ok ? '' : validation.error}</p>
                          </div>
                        )}
                      </td>

                      <td data-label="">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => test(gesture)} disabled={!validation.ok} title="명령만 즉시 실행합니다">
                          테스트
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
