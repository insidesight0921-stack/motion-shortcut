import { useRef, useState } from "react";
import type { PresentationController } from "../features/presentation/usePresentationController";
export function PresentationPreparation({
  controller: c,
}: {
  controller: PresentationController;
}) {
  const popup = useRef<Window | null>(null);
  const pdfPopup = useRef<Window | null>(null);
  const pdfUrl = useRef("");
  const openedFile = useRef<File | null>(null);
  const [popupError, setPopupError] = useState("");
  const openDemo = () => {
    if (popup.current && !popup.current.closed) {
      setPopupError("");
      void c.startCamera();
      popup.current.postMessage({ type: "start-presentation" }, window.location.origin);
      popup.current.focus();
      return;
    }
    const url = new URL(window.location.href);
    url.search = "?demo";
    url.hash = "";
    const next = window.open(url.href, "adam-demo-presentation", "popup,width=1280,height=800");
    if (!next) {
      setPopupError("팝업이 차단되었습니다. 주소창의 팝업 차단 아이콘 또는 브라우저 사이트 설정에서 이 사이트의 팝업을 허용한 뒤 발표 시작을 다시 누르세요.");
      return;
    }
    popup.current = next;
    setPopupError("");
    void c.startCamera();
    next.focus();
  };
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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const selectFile = (file: File) => {
    setPopupError("");
    if (!file.name.toLowerCase().endsWith(".pdf") || !file.size) {
      setPdfFile(null);
      setFileError("내용이 있는 PDF 파일을 선택하세요.");
      return;
    }
    setPdfFile(file);
    setFileError("");
  };
  const openPdf = () => {
    if (!pdfFile) return;
    if (pdfPopup.current && !pdfPopup.current.closed && openedFile.current === pdfFile) {
      setPopupError("");
      void c.startCamera();
      pdfPopup.current.postMessage({ type: "start-presentation" }, window.location.origin);
      pdfPopup.current.focus();
      return;
    }
    const blobUrl = URL.createObjectURL(pdfFile);
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ pdf: blobUrl, name: pdfFile.name }).toString();
    url.hash = "";
    const next = window.open(url.href, "adam-pdf-presentation", "popup,width=1280,height=800");
    if (!next) {
      URL.revokeObjectURL(blobUrl);
      setPopupError("팝업이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 발표 시작을 다시 누르세요.");
      return;
    }
    if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
    pdfUrl.current = blobUrl;
    openedFile.current = pdfFile;
    pdfPopup.current = next;
    setPopupError("");
    void c.startCamera();
    next.focus();
  };
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
              튜토리얼
            </button>
            <button
              aria-pressed={source === "pdf"}
              onClick={() => setSource("pdf")}
            >
              내 PDF 업로드
            </button>
          </div>
          {source === "demo" ? (
            <p>튜토리얼로 손동작과 단축키를 익히고 발표를 연습하세요.<br />튜토리얼은 기본 조작 설정을 기준으로 안내합니다.<br />커스텀 설정 연습은 내 PDF를 업로드해 진행하세요.</p>
          ) : pdfFile ? (
            <div className="uploaded-pdf" aria-label="업로드된 PDF">
              <span className="uploaded-pdf-icon" aria-hidden="true">
                <svg viewBox="0 0 32 40" fill="none">
                  <path d="M5 1h14l8 8v27a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V4a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M19 1v9h8" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <b>PDF</b>
              </span>
              <div className="uploaded-pdf-info">
                <strong title={pdfFile.name}>{pdfFile.name}</strong>
                <span>{pdfFile.size < 1024 * 1024 ? `${Math.max(1, Math.round(pdfFile.size / 1024))} KB` : `${(pdfFile.size / (1024 * 1024)).toFixed(1)} MB`} · 선택됨</span>
              </div>
              <button
                type="button"
                className="uploaded-pdf-remove"
                aria-label="PDF 삭제"
                title="PDF 삭제"
                onClick={() => {
                  setPdfFile(null);
                  setFileError("");
                  setPopupError("");
                  setDragging(false);
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </div>
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
              <p>PDF를 여기로 끌어 놓으세요</p>
              <small>
                PDF를 선택한 뒤 발표 시작을 누르면 별도 발표 창이 열립니다.
              </small>
              {fileError && <p role="alert">{fileError}</p>}
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
            <button
              type="button"
              className="primary-button"
              title={source === "demo" ? "데모 발표 창 열기" : "PDF 발표 창 열기"}
              disabled={source === "pdf" && !pdfFile}
              onClick={source === "pdf" ? openPdf : openDemo}
            >
              발표 시작 <span aria-hidden="true">↗</span>
            </button>
          </div>
          {popupError && <p role="alert">{popupError}</p>}
        </section>
        <section
          className="preparation-resources"
          aria-labelledby="resources-title"
        >
          <div className="resource-heading">
            <h3 id="resources-title">
              추가 자료 <span>{resources.length}</span>
            </h3>
            <button className="button-quiet" style={{ minWidth: 44, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }} aria-label="추가 자료 추가" title="추가 자료 추가" onClick={() => setEditing(c.addResource())}>
              <span aria-hidden="true" style={{ fontSize: 28, lineHeight: 1 }}>+</span>
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
