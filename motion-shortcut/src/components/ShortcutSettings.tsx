import { useState } from "react";
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
  const [motionDraft, setMotionDraft] = useState(c.profile.mappings);
  const [message, setMessage] = useState("");
  return (
    <section
      className="control-panel keyboard-settings"
      aria-labelledby="keyboard-settings-title"
    >
      <h2 id="keyboard-settings-title">모션 · 키보드 커스텀</h2>
      <p>
        각 발표 기능에 사용할 손동작과 단축키를 설정하세요.
        발표 중 편한 입력 방식으로 제어할 수 있습니다.
      </p>
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
                        value={motionDraft[action]}
                        onChange={(event) =>
                          setMotionDraft({
                            ...motionDraft,
                            [action]: event.target.value as GesturePattern,
                          })
                        }
                      >
                        {GESTURE_OPTIONS.map((gesture) => (
                          <option key={gesture.id} value={gesture.id}>
                            {gesture.label}
                          </option>
                        ))}
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
                      <button
                        className="button-quiet"
                        aria-label={`${ACTION_LABELS[action]} 기본키 초기화`}
                        disabled={!c.profile.shortcuts[action]}
                        onClick={() => {
                          const defaultKey = DEFAULT_KEYS[action];
                          if (
                            FIXED_ACTIONS.some(
                              (other) =>
                                other !== action &&
                                c.profile.shortcuts[other]?.key ===
                                  defaultKey &&
                                c.profile.shortcuts[other]?.modifiers.length ===
                                  0,
                            )
                          ) {
                            setMessage(
                              "기본키가 다른 기능에 사용 중입니다. 해당 기능의 키를 먼저 바꾸세요.",
                            );
                            return;
                          }
                          const shortcuts = { ...c.profile.shortcuts };
                          delete shortcuts[action];
                          c.updateProfile({ ...c.profile, shortcuts });
                          setMessage("단축키를 기본값으로 초기화했습니다.");
                        }}
                      >
                        초기화
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p role="status" className="settings-message">
        {message ||
          "키 버튼을 누른 뒤 원하는 키를 입력하세요. 키 설정은 프로필에 저장됩니다."}
      </p>
    </section>
  );
}
