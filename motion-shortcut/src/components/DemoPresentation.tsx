import { useEffect, useRef, useState } from "react";
import { usePresentationController } from "../features/presentation/usePresentationController";
import "./DemoPresentation.css";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PdfPage } from "./PdfPage";
import { TutorialMotion } from "./TutorialMotion";

const slides = [
  ["손끝으로 여는 발표", "오른쪽으로 스와이프해 이동을 시작해보세요."],
  ["화면을 가리고 다시 켜보세요", "손바닥을 펼쳐 유지하면 화면이 가려집니다. 다시 켜려면 손을 카메라 밖으로 잠시 내린 뒤, 손바닥을 펼쳐 다시 보여주세요."],
  ["포인터로 전달하세요", ""],
  ["잠시 멈추고 다시 시작하세요", "양손 주먹을 유지하면 모션이 정지됩니다. 재개하려면 엄지와 새끼손가락을 펴 전화기 모양을 보여주세요."],
  ["이제 발표를 종료하세요", "한 손만 주먹을 쥐어 발표를 마무리하세요."],
];

export function DemoPresentation({ pdf }: { pdf?: PDFDocumentProxy }) {
  const pageCount = pdf?.numPages ?? slides.length;
  const stage = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState("");
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current?.requestFullscreen({ navigationUI: "hide" });
      setError("");
    } catch { setError("전체 화면을 시작하지 못했습니다. 브라우저의 전체 화면 권한을 확인하고 다시 시도하세요."); }
  };
  const c = usePresentationController("demo", pageCount);
  const { executeAction, stopCamera, videoRef, canvasRef } = c;
  const startRef = useRef(c.startMotion);
  useEffect(() => { startRef.current = c.startMotion; });
  useEffect(() => {
    // Cancel the first StrictMode setup before requesting the camera.
    const timer = window.setTimeout(() => void startRef.current(), 0);
    const restart = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !window.opener || event.source !== window.opener) return;
      if (event.data?.type === "start-presentation") void startRef.current();
    };
    window.addEventListener("message", restart);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", restart);
    };
  }, []);
  const actionRef = useRef(executeAction);
  const stopRef = useRef(stopCamera);
  const pageCountRef = useRef(pageCount);
  useEffect(() => { actionRef.current = executeAction; stopRef.current = stopCamera; pageCountRef.current = pageCount; });
  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    const key = (e: KeyboardEvent) => {
      if ((e.target instanceof HTMLElement && e.target.closest("input, select, textarea, [contenteditable=true]")) || e.altKey || e.ctrlKey || e.metaKey) return;
      const action = e.key === "ArrowRight" || e.key === "ArrowDown" ? "next-slide" : e.key === "ArrowLeft" || e.key === "ArrowUp" ? "previous-slide" : null;
      if (action) { e.preventDefault(); void actionRef.current(action); }
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        for (let i = 0; i < pageCountRef.current; i++) void actionRef.current(e.key === "Home" ? "previous-slide" : "next-slide");
      }
    };
    const unload = () => { void stopRef.current(); };
    document.addEventListener("fullscreenchange", change);
    window.addEventListener("keydown", key);
    window.addEventListener("pagehide", unload);
    return () => {
      document.removeEventListener("fullscreenchange", change);
      window.removeEventListener("keydown", key);
      window.removeEventListener("pagehide", unload);
    };
  }, []);
  const motionStatus = c.motionOn
    ? { tone: "active", label: "모션 제어 중", hint: "양손 주먹으로 일시정지" }
    : { tone: "paused", label: "모션 일시정지", hint: "엄지·새끼손가락을 펴면 재개" };
  return <div ref={stage} className="demo-presentation">
    <div className="demo-media" aria-hidden="true"><video ref={videoRef} muted playsInline /><canvas ref={canvasRef} /></div>
    <main className={`demo-slide ${pdf ? "pdf-slide" : ""} ${c.rehearsalBlack ? "is-black" : ""}`} aria-label={pdf ? "PDF 슬라이드" : "데모 슬라이드"}>
      {!c.rehearsalBlack && pdf && <PdfPage document={pdf} pageNumber={c.rehearsalSlide} />}
      {!c.rehearsalBlack && pdf && c.mode !== "slide" && <span className="demo-pointer" style={{ left: `${c.rehearsalPointer.x * 100}%`, top: `${c.rehearsalPointer.y * 100}%` }} />}
      {!c.rehearsalBlack && !pdf && <>
        <small>TUTORIAL</small>
        <h1>{slides[c.rehearsalSlide - 1][0]}</h1>
        <TutorialMotion key={c.rehearsalSlide} slide={c.rehearsalSlide} />
        {c.rehearsalSlide === 3 ? <div className="tutorial-mode-copy"><p>L자로 포인터 모드로 전환하세요.<br />오른손 검지로 위치를 가리키고, 왼손을 펼쳤다가 주먹을 쥐어 클릭하세요.</p><p>검지·중지·약지를 펴서 슬라이드 모드로 돌아가세요.</p></div> : <p>{c.rehearsalSlide === 2 ? <>손바닥을 펼쳐 유지하면 화면이 가려집니다.<br />다시 켜려면 손을 카메라 밖으로 잠시 내린 뒤, 손바닥을 펼쳐 다시 보여주세요.</> : slides[c.rehearsalSlide - 1][1]}</p>}
        {c.mode !== "slide" && <>
          <div className="demo-target">클릭 표적 · 성공 {c.rehearsalClicks}회</div>
          <span className="demo-pointer" style={{ left: `${c.rehearsalPointer.x * 100}%`, top: `${c.rehearsalPointer.y * 100}%` }} />
        </>}
      </>}
    </main>
    {(error || c.cameraError || c.activeTracking.errorMessage) && <p className="demo-error" role="alert">{error || c.cameraError || c.activeTracking.errorMessage}</p>}
    <footer className="demo-controls">
      <nav className="demo-pagination" aria-label="슬라이드 페이지 이동">
        <button aria-label="이전" title="이전 슬라이드" disabled={c.rehearsalSlide === 1} onClick={() => void c.executeAction("previous-slide")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
        </button>
        <span aria-live="polite" aria-atomic="true">{c.rehearsalSlide} / {pageCount}</span>
        <button aria-label="다음" title="다음 슬라이드" disabled={c.rehearsalSlide === pageCount} onClick={() => void c.executeAction("next-slide")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
        </button>
      </nav>
      <div className="demo-actions">
        <button aria-label={fullscreen ? "전체 화면 종료" : "전체 화면"} title={fullscreen ? "전체 화면 종료" : "전체 화면"} aria-pressed={fullscreen} onClick={() => void toggleFullscreen()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={fullscreen ? "M4 9h5V4m6 0v5h5M4 15h5v5m6 0v-5h5" : "M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5"} /></svg>
          <span className="demo-action-label">{fullscreen ? "전체 화면 종료" : "전체 화면"}</span>
        </button>
        <span className={`demo-on-air is-${motionStatus.tone}`} role="status" aria-live="polite" aria-atomic="true" aria-label={motionStatus.label} title={`${motionStatus.label} · ${motionStatus.hint}`}>
          <span className="demo-on-air-dot" aria-hidden="true" />
          {c.motionOn ? "ON AIR" : "PAUSED"}
        </span>
      </div>
      <p className="demo-control-status">방향키 / Home / End</p>
    </footer>
  </div>;
}
