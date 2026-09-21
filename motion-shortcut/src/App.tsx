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
  privacy: ["개인정보 안내", "카메라 사용과 브라우저에 저장되는 정보를 안내합니다."],
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
            aria-label="개인정보 안내"
          >
            <h2>개인정보 안내</h2>
            <p>
              Adam은 손동작 인식을 위해 카메라를 사용하지만, 영상과 개인정보를 서버로 보내거나 저장하지 않습니다.
            </p>
            <dl>
              <div>
                <dt>운영 주체 및 문의</dt>
                <dd>Team 곰팡이 (2026 원티드 해커톤 출품작) · 문의: <a href="mailto:gompangy2e@gmail.com">gompangy2e@gmail.com</a></dd>
              </div>
              <div>
                <dt>카메라</dt>
                <dd>
                  발표 제어를 위해 브라우저의 카메라 권한을 요청합니다. 영상은 브라우저 안에서 실행되는 손 인식 모델(MediaPipe)로만 처리되며, 외부 서버로 전송되거나 파일로 저장되지 않습니다.
                  카메라는 사용자가 카메라 켜기, 발표 시작 또는 모션 시작을 선택할 때 동작하며, 카메라 끄기 버튼이나 해당 창 닫기로 중단됩니다.
                </dd>
              </div>
              <div>
                <dt>브라우저에 저장되는 정보</dt>
                <dd>
                  발표 프로필(이름, 발표 프로그램, 추가 자료 링크), 손동작·키 설정, 화면 표시 설정을 이 브라우저의 저장소(localStorage)에만 저장합니다.
                  계정 정보, 영상, 손 좌표 기록은 저장하지 않습니다. 브라우저의 사이트 데이터 삭제로 모두 제거됩니다.
                </dd>
              </div>
              <div>
                <dt>외부 링크</dt>
                <dd>
                  사용자가 직접 등록한 추가 자료 링크는 새 탭에서 외부 사이트로 이동합니다. 해당 사이트의 개인정보 처리는 각 사이트의 정책을 따릅니다.
                </dd>
              </div>
              <div>
                <dt>서비스 이용 기록</dt>
                <dd>
                  방문 통계를 위해 Vercel Web Analytics를 사용합니다. 쿠키를 사용하지 않으며 페이지 조회 수, 유입 경로, 국가, 브라우저·기기 종류 같은 익명 집계만 수집하고 개인을 식별하지 않습니다. 카메라 영상과 손 좌표는 포함되지 않습니다. 호스팅 서비스(Vercel)가 접속 로그를 기본 수집할 수 있으며, 이는 서비스 운영 목적으로만 사용됩니다.
                </dd>
              </div>
              <div>
                <dt>시행일</dt>
                <dd>2026년 9월 21일</dd>
              </div>
            </dl>
            <a href="#/home">← 돌아가기</a>
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
            <p>제작팀 · 곰팡이</p>
            <p>문의 이메일 · <a href="mailto:gompangy2e@gmail.com">gompangy2e@gmail.com</a></p>
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
              개인정보 안내
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
