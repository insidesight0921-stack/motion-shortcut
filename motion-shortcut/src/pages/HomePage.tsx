import type { PresentationController } from "../features/presentation/usePresentationController";
import { MODE_LABELS } from "../features/presentation/usePresentationController";
import { PresentationPreparation } from "../components/PresentationPreparation";

export function HomePage({
  controller: c,
}: {
  controller: PresentationController;
}) {
  const {
    videoRef,
    canvasRef,
    cameraState,
    cameraView,
    changeCameraView,
    cameraError,
    startCamera,
    activeTracking,
    mode,
    selectedResource,
    stopCamera,
    motionOn,
    sessionStartedAt,
  } = c;
  const cameraStatus =
    cameraState === "active"
      ? "카메라 켜짐"
      : cameraState === "requesting"
        ? "카메라 연결 중"
        : cameraState === "error"
          ? "카메라 연결 오류"
          : "카메라 꺼짐";
  return (
    <div className="home-workspace">
      <div className="console-settings-row">
        <a href="#/settings" className="console-settings-button" aria-label="설정" aria-haspopup="dialog" title="설정">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 3 .5-2h5L15 3l2 1 2-.5 2.5 4-1.5 1.5v3l1.5 1.5-2.5 4-2-.5-2 1-.5 2h-5L9 18l-2-1-2 .5-2.5-4L4 12V9L2.5 7.5l2.5-4L7 4Z" transform="translate(0 1.5)" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
        </a>
      </div>
      <section
        className="camera-console home-console"
        aria-labelledby="control-center-title"
      >
        <div className="console-heading">
          <div className="console-title">
            <h2 id="control-center-title">발표 제어 센터</h2>
          </div>
          <span
            className={`camera-indicator ${cameraState}`}
            role="status"
            title={cameraStatus}
          >
            <span className="visually-hidden">{cameraStatus}</span>
          </span>
        </div>
        <div className="camera-preview-mat">
          <div
            className={`camera-stage ${cameraView === "hands" ? "hands-only" : ""}`}
          >
            <video ref={videoRef} muted playsInline />
            <canvas ref={canvasRef} aria-hidden="true" />
            {cameraState !== "active" && (
              <div className="camera-empty">
                <img
                  className="standby-hand"
                  src="./assets/adam-hand-wireframe-3d.png"
                  alt=""
                  aria-hidden="true"
                />
                <strong>
                  {cameraState === "requesting"
                    ? "카메라 연결 중"
                    : cameraState === "error"
                      ? "카메라를 연결할 수 없습니다"
                      : "카메라가 꺼져 있습니다"}
                </strong>
                <p>
                  {cameraError ||
                    (cameraState === "requesting"
                      ? "카메라 접근 권한을 확인하고 있습니다."
                      : "아래에서 카메라를 켠 뒤, 발표를 시작하세요.")}
                </p>
              </div>
            )}
            {cameraState === "active" && (
              <div className="tracking-hud">
                <span>
                  {motionOn
                    ? MODE_LABELS[mode]
                    : sessionStartedAt
                      ? "모션 제어 정지"
                      : "모션 제어 대기"}
                </span>
                <b>
                  {activeTracking.modeGestureLabel
                    ? `${activeTracking.modeGestureLabel} 전환 준비`
                    : activeTracking.gestureLabel
                      ? `${activeTracking.gestureLabel} 감지`
                      : activeTracking.state === "tracking"
                        ? "손 추적 중"
                        : "손을 보여주세요"}
                </b>
                <em>{activeTracking.confidence}%</em>
              </div>
            )}
            {selectedResource && (
              <div className="resource-hud">
                <strong>{selectedResource.name}</strong>
                <span>검지를 잠깐 유지해 실행</span>
              </div>
            )}
          </div>
        </div>
        {activeTracking.errorMessage && (
          <p role="alert" className="camera-error">
            손 인식을 시작하지 못했습니다: {activeTracking.errorMessage}
          </p>
        )}
        <div className="home-console-toolbar">
          <div className="camera-controls-group">
            <div
              className="camera-view-options"
              role="group"
              aria-label="카메라 표시 방식"
            >
              <button
                type="button"
                disabled={cameraState !== "active"}
                aria-pressed={cameraView === "camera"}
                onClick={() => changeCameraView("camera")}
              >
                전체 화면
              </button>
              <button
                type="button"
                disabled={cameraState !== "active"}
                aria-pressed={cameraView === "hands"}
                onClick={() => changeCameraView("hands")}
              >
                손만 보기
              </button>
            </div>
            <button
              className="camera-power-button"
              disabled={cameraState === "requesting"}
              onClick={() =>
                void (cameraState === "active" ? stopCamera() : startCamera())
              }
            >
              {cameraState === "active"
                ? "카메라 끄기"
                : cameraState === "requesting"
                  ? "연결 중…"
                  : "카메라 켜기"}
            </button>
          </div>

        </div>
      </section>
      <PresentationPreparation controller={c} />
    </div>
  );
}
