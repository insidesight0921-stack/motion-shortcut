import { useRef, useState } from "react";
import type { PresentationController } from "../features/presentation/usePresentationController";
export function PresentationPreparation({
  controller: c,
}: {
  controller: PresentationController;
}) {
  const [editing, setEditing] = useState<string | null>(null),
    [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const resources = c.profile.resources.filter((r) => r.kind === "url");
  const resource = resources.find((r) => r.id === editing) ?? resources[0];
  const update = (change: { name?: string; value?: string }) =>
    c.updateProfile({
      ...c.profile,
      resources: resources.map((r) =>
        r.id === resource?.id ? { ...r, ...change, returnAfterMs: 0 } : r,
      ),
    });
  const [source, setSource] = useState<"demo" | "pdf">("demo");
  const [fileName, setFileName] = useState("");
  const selectFile = (file: File) =>
    setFileName(
      file.name.toLowerCase().endsWith(".pdf")
        ? file.name
        : "PDF 파일을 선택하세요.",
    );
  return (
    <section className="preparation-panel" aria-labelledby="preparation-title">
      <div className="preparation-heading">
        <h2 id="preparation-title">발표 준비</h2>
      </div>
      <div className="preparation-body">
        <section
          className="preparation-profile"
          aria-labelledby="profile-title"
        >
          <h3 id="profile-title">발표 프로필</h3>
          <label>
            프로필 이름
            <input
              value={c.profile.name}
              onChange={(e) =>
                c.updateProfile({ ...c.profile, name: e.target.value })
              }
            />
          </label>
          <h3>자료 선택</h3>
          <div
            className="deck-options"
            role="group"
            aria-label="발표 자료 선택"
          >
            <button
              aria-pressed={source === "demo"}
              onClick={() => setSource("demo")}
            >
              데모 덱으로 연습
            </button>
            <button
              aria-pressed={source === "pdf"}
              onClick={() => setSource("pdf")}
            >
              내 PDF 업로드
            </button>
          </div>
          {source === "demo" ? (
            <p>데모 슬라이드로 손동작과 단축키를 익히고 발표를 연습하세요.</p>
          ) : (
            <div
              className={`pdf-drop ${dragging ? "is-dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files[0])
                  selectFile(e.dataTransfer.files[0]);
              }}
            >
              <p>{fileName || "PDF를 여기로 끌어 놓으세요"}</p>
              <small>
                PDF 파일을 선택한 뒤 발표 시작을 누르면 별도의 발표 창에서 열립니다.
              </small>
              <input
                ref={input}
                type="file"
                accept="application/pdf,.pdf"
                aria-label="발표 PDF 파일 선택"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) selectFile(file);
                  e.target.value = "";
                }}
              />
              <button onClick={() => input.current?.click()}>파일 선택</button>
            </div>
          )}
          <div className="preparation-start-actions">
            {/* UI placeholder: the viewer developer will connect the selected source here. */}
            <button
              type="button"
              className="primary-button"
              title="선택한 자료로 발표 창 열기"
            >
              발표 시작 <span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>
        <section
          className="preparation-resources"
          aria-labelledby="resources-title"
        >
          <div className="resource-heading">
            <h3 id="resources-title">
              추가 자료 <span>{resources.length}</span>
            </h3>
            <button className="button-quiet" onClick={() => setEditing(c.addResource())}>
              + 추가 자료 추가
            </button>
          </div>
          <div className="resource-browser">
            <div
              className="resource-picker"
              role="group"
              aria-label="추가 자료 선택"
            >
              {resources.map((r) => (
                <button
                  key={r.id}
                  className="resource-picker-item"
                  aria-pressed={r.id === resource?.id}
                  onClick={() => setEditing(r.id)}
                >
                  <strong>{r.name || "이름 없음"}</strong>
                </button>
              ))}
            </div>
            {resource && (
              <div className="resource-editor">
                <label>
                  추가 자료 이름
                  <input
                    aria-label="추가 자료 이름"
                    value={resource.name}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </label>
                <label>
                  URL
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={resource.value}
                    onChange={(e) => update({ value: e.target.value })}
                  />
                </label>
                <div className="resource-editor-actions">
                  <button onClick={() => void c.openResource(resource)}>
                    새 탭에서 열기
                  </button>
                  <button
                    className="button-quiet button-danger"
                    onClick={() =>
                      c.updateProfile({
                        ...c.profile,
                        resources: resources.filter(
                          (r) => r.id !== resource.id,
                        ),
                      })
                    }
                  >
                    삭제
                  </button>
                </div>
                <p role="status">{c.presentationLinkStatus}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
