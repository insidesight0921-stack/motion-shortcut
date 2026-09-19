import type { PresentationController } from "../features/presentation/usePresentationController";
import { SectionTitle } from "../components/SectionTitle";
import { ShortcutSettings } from "../components/ShortcutSettings";
const permissionLabels: Record<string, string> = {
  granted: "허용됨",
  "not-determined": "요청 전",
  denied: "거부됨 · 설정 확인",
  restricted: "시스템 제한",
  unsupported: "데스크톱 앱 전용",
  unknown: "상태 확인 불가",
};
export function SettingsPage({
  controller: c,
}: {
  controller: PresentationController;
}) {
  const {
    cursorSensitivity,
    setCursorSensitivity,
    permissions,
    refreshSystemStatus,
  } = c;
  return (
    <div className="settings-stack">
      <ShortcutSettings controller={c} />
      <section className="control-panel settings-sensitivity">
        {" "}
        <SectionTitle index="03" title="포인터 감도" />
        <label className="range-control">
          <input
            type="range"
            aria-label="포인터 감도"
            min="0.6"
            max="2"
            step="0.01"
            value={cursorSensitivity}
            onChange={(event) => {
              const value = Number(event.target.value);
              setCursorSensitivity(value);
              void window.motionAPI?.setCursorSensitivity(value);
            }}
          />
          <strong>{cursorSensitivity.toFixed(2)}×</strong>
        </label>
      </section>
      <section className="control-panel settings-permissions">
        {" "}
        <SectionTitle index="SYS" title="권한 점검" />
        <p className="muted">
          손동작 인식을 위해 브라우저의 카메라 접근을 허용해 주세요. 권한 변경
          후 상태를 새로고침할 수 있습니다.
        </p>
        {c.systemStatusError && <p role="status">{c.systemStatusError}</p>}
        <div className="permission-list">
          {([["camera", "카메라"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => void c.requestPermission(id)}>
              <span>{label}</span>
              <b className={permissions[id] === "granted" ? "ok" : "warn"}>
                {permissionLabels[permissions[id]] ?? "상태 확인 불가"}
              </b>
            </button>
          ))}
          <button className="button-quiet" onClick={() => void refreshSystemStatus()}>
            권한 상태 새로고침
          </button>
        </div>
      </section>
    </div>
  );
}
