import { useState } from "react";
import { FIXED_MAPPINGS } from "../features/presentation/profile";
import type { PresentationController } from "../features/presentation/usePresentationController";
import { FIXED_ACTIONS } from "../features/presentation/usePresentationController";
import {
  ACTION_LABELS,
  GESTURE_OPTIONS,
  type GesturePattern,
  type KeyShortcut,
  type PresentationAction,
} from "../features/presentation/types";
import {
  DEFAULT_KEYS,
  formatShortcut,
  supportedKey,
} from "../features/presentation/shortcuts";
export function ShortcutSettings({
  controller: c,
}: {
  controller: PresentationController;
}) {
  const [recording, setRecording] = useState<PresentationAction | null>(null);
  const motionMappings = c.profile.mappings;
  const assignedAction = (gesture: GesturePattern, action: PresentationAction) =>
    (Object.keys(motionMappings) as PresentationAction[]).find(
      (other) => other !== action && motionMappings[other] === gesture,
    );
  const [message, setMessage] = useState("");
  return (
    <section
      className="control-panel keyboard-settings"
      aria-labelledby="keyboard-settings-title"
    >
      <h2 id="keyboard-settings-title">모션 · 키보드 커스텀</h2>
      <p>
        각 발표 기능에 사용할 손동작과 단축키를 설정하세요.
        이미 사용 중인 모션은 다른 기능에 지정할 수 없습니다.
        모션을 옮기려면 기존 기능을 ‘지정 안 함’으로 변경하세요.
      </p>
      <p>세 손가락은 엄지·검지·새끼손가락을 펴세요. 방향은 거울처럼 보이는 카메라 화면 기준입니다. 새 손동작은 약 0.8초 유지하세요. 지정한 방향 가리키기와 세 손가락은 기존 검지 동작·포인터 모드 전환보다 우선합니다.</p>
      <div
        className="input-customization-scroll"
        role="region"
        aria-label="모션과 키보드 설정 표"
        tabIndex={0}
      >
        <table className="input-customization-table">
          <thead>
            <tr>
              <th scope="col">기능</th>
              <th scope="col">모션 커스텀</th>
              <th scope="col">키보드 커스텀</th>
            </tr>
          </thead>
          <tbody>
            {FIXED_ACTIONS.map((action) => {
              const shortcut = c.profile.shortcuts[action] ?? {
                key: DEFAULT_KEYS[action]!,
                modifiers: [],
              };
              return (
                <tr key={action}>
                  <th scope="row">{ACTION_LABELS[action]}</th>
                  <td>
                    <div className="motion-select-field">
                      <select
                        aria-label={`${ACTION_LABELS[action]} 모션 선택`}
                        value={motionMappings[action]}
                        onChange={(event) => {
                          const gesture = event.target.value as GesturePattern | "";
                          if (gesture && assignedAction(gesture, action)) {
                            setMessage("다른 기능에 지정된 모션입니다. 기존 지정을 먼저 해제하세요.");
                            return;
                          }
                          c.updateProfile({
                            ...c.profile,
                            mappings: { ...motionMappings, [action]: gesture },
                          });
                          setMessage(`${ACTION_LABELS[action]} 모션 설정이 저장되었습니다.`);
                        }}
                      >
                        <option value="">지정 안 함</option>
                        {GESTURE_OPTIONS.map((gesture) => {
                          const owner = assignedAction(gesture.id, action);
                          const ownerLabel = owner === "resource-1" ? "자료 선택" : owner === "resource-2" ? "선택한 자료 실행" : owner ? ACTION_LABELS[owner] : "";
                          return (
                            <option key={gesture.id} value={gesture.id} disabled={Boolean(owner)}>
                              {gesture.label}{owner ? ` (${ownerLabel}에서 사용 중)` : ""}
                            </option>
                          );
                        })}
                      </select>
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path
                          d="m6 8 4 4 4-4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </td>
                  <td>
                    <div className="custom-key-controls">
                      <button
                        className={recording === action ? "recording" : ""}
                        aria-label={`${ACTION_LABELS[action]} 키 지정`}
                        aria-pressed={recording === action}
                        onClick={() => {
                          setRecording(action);
                          setMessage("변경할 키 조합을 누르세요.");
                        }}
                        onBlur={() => setRecording(null)}
                        onKeyDown={(event) => {
                          if (recording !== action || event.key === "Tab")
                            return;
                          event.preventDefault();
                          event.stopPropagation();
                          const key =
                            event.key === " "
                              ? "Space"
                              : event.key.length === 1
                                ? event.key.toLowerCase()
                                : event.key;
                          if (["Meta", "Control", "Alt", "Shift"].includes(key))
                            return;
                          if (!supportedKey(key)) {
                            setMessage(
                              "영문·숫자·방향키·Space·Enter·Escape·Backspace를 사용하세요.",
                            );
                            return;
                          }
                          const modifiers: KeyShortcut["modifiers"] = [];
                          if (event.metaKey) modifiers.push("Meta");
                          if (event.ctrlKey) modifiers.push("Control");
                          if (event.altKey) modifiers.push("Alt");
                          if (event.shiftKey) modifiers.push("Shift");
                          if (event.metaKey || event.ctrlKey || event.altKey) {
                            setMessage(
                              "브라우저 단축키와 겹치지 않도록 일반 키 또는 Shift 조합을 사용하세요.",
                            );
                            return;
                          }
                          const conflict = FIXED_ACTIONS.some(
                            (other) =>
                              other !== action &&
                              formatShortcut(
                                c.profile.shortcuts[other] ?? {
                                  key: DEFAULT_KEYS[other]!,
                                  modifiers: [],
                                },
                              ) === formatShortcut({ key, modifiers }),
                          );
                          if (conflict) {
                            setMessage(
                              "다른 기능에 지정된 키입니다. 다른 키를 선택하세요.",
                            );
                            return;
                          }
                          c.updateProfile({
                            ...c.profile,
                            shortcuts: {
                              ...c.profile.shortcuts,
                              [action]: { key, modifiers },
                            },
                          });
                          setRecording(null);
                          setMessage(
                            `${ACTION_LABELS[action]}: ${formatShortcut({ key, modifiers })} 저장됨`,
                          );
                        }}
                      >
                        {recording === action
                          ? "키 입력 대기…"
                          : formatShortcut(shortcut)}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td>
                <button className="button-quiet customization-reset" onClick={() => {
                  const mappings = { ...c.profile.mappings };
                  for (const action of FIXED_ACTIONS) mappings[action] = FIXED_MAPPINGS[action];
                  setRecording(null);
                  c.updateProfile({ ...c.profile, mappings });
                  setMessage("모션 설정을 모두 기본값으로 초기화했습니다. 키보드 설정은 유지됩니다.");
                }}>모션 전체 초기화</button>
              </td>
              <td>
                <button className="button-quiet customization-reset" onClick={() => {
                  const shortcuts = { ...c.profile.shortcuts };
                  for (const action of FIXED_ACTIONS) delete shortcuts[action];
                  setRecording(null);
                  c.updateProfile({ ...c.profile, shortcuts });
                  setMessage("키보드 설정을 모두 기본값으로 초기화했습니다. 모션 설정은 유지됩니다.");
                }}>키보드 전체 초기화</button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p role="status" className="settings-message">
        {message ||
          "모션과 키 설정은 이 브라우저에 자동 저장되며 새로고침 후에도 유지됩니다."}
      </p>
    </section>
  );
}
