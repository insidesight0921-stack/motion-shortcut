import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { useSmoothWheel } from "./hooks/useSmoothWheel";
import { WelcomeIntro } from "./components/WelcomeIntro";
import { usePresentationController } from "./features/presentation/usePresentationController";
import { HomePage } from "./pages/HomePage";
import { SettingsPage } from "./pages/SettingsPage";
import { GuidePage } from "./pages/GuidePage";
const pages = {
  home: ["홈", "발표 준비와 실시간 제어"],
  settings: ["설정", "권한과 입력 설정"],
  guide: ["가이드", "사용법과 기능 설명"],
  privacy: ["개인정보 안내", "정식 공개 전 검토가 필요한 초안입니다."],
} as const;
type Page = keyof typeof pages;
const navigationPaths: Record<Exclude<Page, "privacy">, string> = {
  home: "M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9",
  settings:
    "m9 3 .5-2h5L15 3l2 1 2-.5 2.5 4-1.5 1.5v3l1.5 1.5-2.5 4-2-.5-2 1-.5 2h-5L9 18l-2-1-2 .5-2.5-4L4 12V9L2.5 7.5l2.5-4L7 4Z",
  guide:
    "M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z",
};
function readPage(): Page {
  const value = window.location.hash.replace("#/", "");
  return value in pages ? (value as Page) : "home";
}
export default function App() {
  const c = usePresentationController();
  const [introVisible, setIntroVisible] = useState(
    () => !!window.matchMedia && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [settingsOpen, setSettingsOpen] = useState(() => readPage() === "settings");
  useSmoothWheel(!introVisible && !settingsOpen);
  const finishIntro = useCallback(() => {
    const restoreFocus = document.activeElement?.closest(".welcome-intro");
    setIntroVisible(false);
    if (restoreFocus) requestAnimationFrame(() => heading.current?.focus());
  }, []);
  const [page, setPage] = useState<Page>(() => readPage() === "settings" ? "home" : readPage());
  const heading = useRef<HTMLHeadingElement>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    window.history.replaceState(null, "", `#/${page}`);
  }, [page]);
  useEffect(() => {
    if (!settingsOpen || introVisible) return;
    const dialog = settingsDialog.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.documentElement.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [settingsOpen, introVisible]);
  useEffect(() => {
    const change = () => {
      const next = readPage();
      setSettingsOpen(next === "settings");
      if (next !== "settings") {
        setPage(next);
        requestAnimationFrame(() => heading.current?.focus());
      }
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return (
    <>
    {introVisible && <WelcomeIntro onDone={finishIntro} />}
    <div inert={introVisible} className={`presenter-app is-${page}`}>
      <a
        className="skip-link"
        href="#page-title"
        onClick={(e) => {
          e.preventDefault();
          heading.current?.focus();
        }}
      >
        본문으로 이동
      </a>
      <header className="presenter-topbar">
        <a href="#/home" className="brand" aria-label="Adam 홈">
          <img src="./assets/adam-header-stacked-02.png" alt="Adam" />
        </a>
        <nav className="page-nav" aria-label="주 메뉴">
          {Object.entries(pages)
            .filter(([id]) => id !== "privacy" && id !== "settings")
            .map(([id, [label]]) => (
              <a
                key={id}
                href={`#/${id}`}
                aria-label={label}
                aria-current={!settingsOpen && page === id ? "page" : undefined}
                aria-haspopup={id === "settings" ? "dialog" : undefined}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d={navigationPaths[id as Exclude<Page, "privacy">]}
                    transform={
                      id === "settings" ? "translate(0 1.5)" : undefined
                    }
                  />
                  {id === "settings" && <circle cx="12" cy="12" r="3.2" />}
                </svg>
                <span className="nav-tooltip" aria-hidden="true">
                  {label}
                </span>
              </a>
            ))}
        </nav>
      </header>
      <main>
        <div
          className={`page-heading ${page === "home" ? "home-page-heading" : ""}`}
        >
          <div>
            <h1 id="page-title" ref={heading} tabIndex={-1}>
              {pages[page][0]}
            </h1>
            <p>{pages[page][1]}</p>
          </div>
        </div>
        <div
          className={page === "home" ? "" : "inactive-home"}
          inert={page !== "home"}
          aria-hidden={page !== "home"}
        >
          <HomePage controller={c} />
        </div>

        {page === "guide" && <GuidePage />}
        {page === "privacy" && (
          <section
            className="control-panel footer-privacy"
            aria-label="개인정보 안내 초안"
          >
            <h2>개인정보 안내 · 초안</h2>
            <p>
              서비스 공개 전에 실제 운영 방식과 데이터 처리 내용을 확인하여
              확정할 문서입니다.
            </p>
            <dl>
              <div>
                <dt>운영 주체 및 문의</dt>
                <dd>팀 이름, 담당자, 문의 이메일 입력 필요</dd>
              </div>
              <div>
                <dt>카메라</dt>
                <dd>
                  손동작 인식을 위해 브라우저 카메라 권한을 요청합니다. 영상
                  전송·저장 여부와 처리 범위는 배포 전 확인 필요
                </dd>
              </div>
              <div>
                <dt>브라우저 저장 정보</dt>
                <dd>
                  프로필, 키 설정과 표시 설정을 브라우저에 저장합니다. 최종 저장
                  항목과 삭제 방법 확인 필요
                </dd>
              </div>
              <div>
                <dt>PDF 및 추가 링크</dt>
                <dd>
                  PDF 기능 구현 후 수집·보관·삭제 방식을 기재해야 합니다. 추가
                  링크는 외부 사이트로 연결됩니다.
                </dd>
              </div>
              <div>
                <dt>배포 환경</dt>
                <dd>
                  호스팅 로그, 분석 도구, 외부 서비스 이용 여부 및 보관 기간
                  확인 필요
                </dd>
              </div>
              <div>
                <dt>시행일</dt>
                <dd>정식 공개일 확정 후 입력</dd>
              </div>
            </dl>
            <a href="#/home">홈으로 돌아가기</a>
          </section>
        )}
      </main>
      <dialog
        ref={settingsDialog}
        className="settings-modal"
        aria-labelledby="settings-modal-title"
        onCancel={(event) => { event.preventDefault(); closeSettings(); }}
      >
        <header className="settings-modal-header">
          <div>
            <h2 id="settings-modal-title">설정</h2>
          </div>
          <button type="button" className="settings-modal-close" onClick={closeSettings} aria-label="설정 닫기" autoFocus>✕</button>
        </header>
        <div className="settings-modal-body" data-lenis-prevent>
          <SettingsPage controller={c} />
        </div>
      </dialog>
      <footer className="site-footer">
        <div className="site-footer-main">
          <div className="site-footer-brand">
            <a href="#/home" aria-label="Adam 홈으로 이동">
              <img src="./assets/adam-header-stacked-02.png" alt="Adam" />
            </a>
            <p>ADAM · 손끝으로 설계하는 발표의 흐름</p>
          </div>
          <div className="site-footer-contact">
            <span>TEAM / CONTACT</span>
            <p>제작팀 · 추후 공개</p>
            <p>문의 이메일 · 추후 공개</p>
          </div>
          <nav aria-label="하단 메뉴">
            <a
              href="https://github.com/insidesight0921-stack/motion-shortcut"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub ↗
            </a>
            <a href="#/privacy">
              개인정보 안내 <small>초안</small>
            </a>
          </nav>
        </div>
        <div className="site-footer-bottom">
          <span>© 2026 Adam</span>
        </div>
      </footer>
    </div>
    </>
  );
}
