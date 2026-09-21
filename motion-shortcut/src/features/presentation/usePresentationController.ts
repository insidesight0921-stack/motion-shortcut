import { acquireCamera } from "../camera/sharedCamera";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useHandTracking,
  type MotionGestureId,
} from "../camera/useHandTracking";
import {
  ACTION_LABELS,
  type PresentationAction,
  type PresentationMode,
  type PresentationProfile,
} from "./types";
import { loadProfile, saveProfile } from "./profile";

type DisplayMode = "camera" | "person-pet" | "hand-pet";
type CameraState = "idle" | "requesting" | "active" | "error";

export const MODE_LABELS: Record<PresentationMode, string> = {
  slide: "슬라이드",
  cursor: "포인터",
  laser: "포인터",
};

export const APP_LABELS = {
  "google-slides": "Google Slides",
  powerpoint: "PowerPoint",
  keynote: "Keynote",
  "web-slides": "웹 슬라이드 (Chrome)",
};

export function normalizeHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function detectWebPresentation(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
      return null;
    const host = parsed.hostname.toLowerCase();
    if (host.includes("docs.google.com"))
      return { app: "google-slides" as const, label: "Google Slides" };
    if (host.includes("canva.com"))
      return { app: "web-slides" as const, label: "Canva" };
    if (host.includes("pitch.com"))
      return { app: "web-slides" as const, label: "Pitch" };
    if (host.includes("gamma.app"))
      return { app: "web-slides" as const, label: "Gamma" };
    return { app: "web-slides" as const, label: host };
  } catch {
    return null;
  }
}

export const FIXED_ACTIONS: PresentationAction[] = [
  "next-slide",
  "previous-slide",
  "black-screen",
  "exit-presentation",
];

export function usePresentationController(target: "external" | "demo" = "external", pageCount = 5) {
  const api = target === "demo" ? undefined : window.motionAPI;
  const isDesktop = Boolean(api);
  const [rehearsalSlide, setRehearsalSlide] = useState(1);
  const [rehearsalBlack, setRehearsalBlack] = useState(false);
  const [rehearsalClicks, setRehearsalClicks] = useState(0);
  const [rehearsalMessage, setRehearsalMessage] = useState(
    "자료 없이 버튼이나 손동작으로 시험할 수 있습니다.",
  );
  const [rehearsalPointer, setRehearsalPointer] = useState({ x: 0.5, y: 0.5 });
  const rehearsalPointerRef = useRef(rehearsalPointer);
  const [systemStatusError, setSystemStatusError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const petCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const releaseCameraRef = useRef<(() => void) | null>(null);
  const cameraRequestRef = useRef(0);
  const requestingRef = useRef(false);

  const [profile, setProfile] = useState<PresentationProfile>(loadProfile);
  const [motionOn, setMotionOn] = useState(false);
  const [mode, setMode] = useState<PresentationMode>("slide");
  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    () => (localStorage.getItem("displayMode") as DisplayMode) || "camera",
  );
  const [cameraView, setCameraView] = useState<"camera" | "hands">(() =>
    localStorage.getItem("flickey.camera-view.v1") === "hands"
      ? "hands"
      : "camera",
  );
  const changeCameraView = (next: "camera" | "hands") => {
    setCameraView(next);
    localStorage.setItem("flickey.camera-view.v1", next);
  };
  const [cursorSensitivity, setCursorSensitivity] = useState(1);
  const [pointerTestOpen, setPointerTestOpen] = useState(false);
  const [testPointer, setTestPointer] = useState({ x: 0.5, y: 0.5 });
  const pointerTestRef = useRef(false);
  const testOwnsCamera = useRef(false);
  const [slideNumber, setSlideNumber] = useState(1);
  const [selectedResourceIndex, setSelectedResourceIndex] = useState(-1);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState("");
  const [presentationLinkStatus, setPresentationLinkStatus] = useState("");
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [permissions, setPermissions] = useState({
    camera: "not-determined",
    accessibility: "denied",
    screen: "not-determined",
  });
  const [displays, setDisplays] = useState<
    Array<{ id: string; label: string; primary: boolean }>
  >([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState("");
  const [logs, setLogs] = useState<string[]>(["Adam이 준비되었습니다."]);
  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((items) => [`${time} · ${message}`, ...items].slice(0, 10));
  };

  const updateProfile = (next: PresentationProfile) => {
    setProfile(next);
    saveProfile(next);
  };

  const startCamera = async () => {
    if (streamRef.current) return true;
    if (requestingRef.current) return false;
    requestingRef.current = true;
    const request = ++cameraRequestRef.current;
    setCameraState("requesting");
    setCameraError("");
    try {
      const lease = await acquireCamera();
      const { stream } = lease;
      if (request !== cameraRequestRef.current) {
        lease.release();
        return false;
      }
      streamRef.current = stream;
      releaseCameraRef.current = lease.release;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (request !== cameraRequestRef.current) {
        lease.release();
        return false;
      }
      setCameraState("active");
      setPermissions((p) => ({ ...p, camera: "granted" }));
      await api?.setCameraEnabled(true);
      addLog("카메라 연결 완료");
      return true;
    } catch (error) {
      if (request !== cameraRequestRef.current) return false;
      releaseCameraRef.current?.();
      streamRef.current = null;
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? isDesktop
            ? "시스템 설정에서 실행 중인 앱의 카메라 권한을 허용하세요."
            : "브라우저의 사이트 설정에서 카메라 권한을 허용한 뒤 발표 시작을 다시 누르세요."
          : error instanceof Error
            ? error.message
            : "카메라를 연결하지 못했습니다.";
      setCameraError(message);
      setCameraState("error");
      addLog(`카메라 오류 · ${message}`);
      return false;
    } finally {
      requestingRef.current = false;
    }
  };

  const changeDisplayMode = async (nextMode: DisplayMode) => {
    setDisplayMode(nextMode);
    addLog(`손 추적 오버레이 ${nextMode === "camera" ? "OFF" : "ON"}`);
  };

  const stopCamera = async () => {
    cameraRequestRef.current += 1;
    releaseCameraRef.current?.();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
    setMotionOn(false);
    setSessionStartedAt(null);
    await api?.setMotionEnabled(false);
    await api?.setCameraEnabled(false);
    addLog("카메라 OFF · 모션 안전 정지");
  };

  const openPointerTest = () => {
    testOwnsCamera.current = !streamRef.current && !requestingRef.current;
    pointerTestRef.current = true;
    setTestPointer({ x: 0.5, y: 0.5 });
    setPointerTestOpen(true);
    void startCamera();
  };
  const closePointerTest = () => {
    pointerTestRef.current = false;
    setPointerTestOpen(false);
    if (testOwnsCamera.current) void stopCamera();
    testOwnsCamera.current = false;
  };

  const toggleMotion = async () => {
    if (motionOn) {
      await api?.setMotionEnabled(false);
      setMotionOn(false);
      addLog("모션 OFF");
      return;
    }
    await startMotion();
  };

  const startMotion = async () => {
    const cameraReady = await startCamera();
    if (!cameraReady) return;
    const enabled = api
      ? await api.setMotionEnabled(true)
      : true;
    setMotionOn(Boolean(enabled));
    addLog(enabled ? "모션 ON" : "모션을 켜지 못했습니다.");
  };

  const setPresentationMode = async (next: PresentationMode) => {
    next = next === "laser" ? "cursor" : next;
    const result = await api?.setPresentationMode(next);
    if (!result) {
      setMode(next);
      return;
    }
    if (result.ok) {
      setMode(result.mode);
      addLog(`${MODE_LABELS[result.mode]} MODE 전환`);
    } else {
      addLog(`모드 전환 실패 · ${result.error}`);
    }
  };

  const executeAction = async (action: PresentationAction) => {
    if (!api) {
      if (action === "next-slide" || action === "previous-slide") setRehearsalBlack(false);
      if (action === "next-slide") setRehearsalSlide((n) => Math.min(target === "demo" ? pageCount : 3, n + 1));
      if (action === "previous-slide")
        setRehearsalSlide((n) => Math.max(1, n - 1));
      if (action === "black-screen") setRehearsalBlack((b) => !b);
      if (action === "exit-presentation") {
        setMotionOn(false);
        setSessionStartedAt(null);
        if (target === "demo") {
          await stopCamera();
          window.close();
        }
      }
      const message = `웹 리허설 · ${ACTION_LABELS[action]}`;
      setRehearsalMessage(message);
      addLog(message);
      return;
    }
    if (action === "resource-1" || action === "resource-2") {
      const resource = profile.resources.find((item) => item.id === action);
      if (!resource?.value) {
        addLog(`${ACTION_LABELS[action]} 실패 · 등록된 자료가 없습니다.`);
        return;
      }
      await openResource(resource);
      return;
    }
    const result = await api?.executePresentationCommand(
      action,
      profile.app,
      profile.presentationUrl,
      profile.shortcuts[action],
    );
    addLog(
      result?.ok
        ? `${ACTION_LABELS[action]} 실행`
        : `${ACTION_LABELS[action]} 실패 · ${result?.error ?? "Electron에서 실행하세요."}`,
    );
  };

  const openResource = async (
    resource: PresentationProfile["resources"][number],
  ) => {
    const url = normalizeHttpUrl(resource.value);
    if (resource.kind !== "url" || !detectWebPresentation(url)) {
      setPresentationLinkStatus(
        "http/https 형식의 추가 자료 URL을 입력하세요.",
      );
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    setPresentationLinkStatus(
      `${resource.name} 새 탭 열기 요청 · 추가 자료는 제어하지 않습니다.`,
    );
  };

  const addResource = () => {
    const id = `resource-${Date.now()}`;
    updateProfile({
      ...profile,
      resources: [
        ...profile.resources,
        {
          id,
          name: `자료 ${profile.resources.length + 1}`,
          kind: "url",
          value: "",
        },
      ],
    });
    return id;
  };

  const startPresentationSession = async () => {
    const ready = await startCamera();
    if (!ready) return;
    await setPresentationMode("slide");
    const enabled = api
      ? await api.setMotionEnabled(true)
      : true;
    setMotionOn(Boolean(enabled));
    if (!enabled) {
      addLog("발표 제어는 Electron 앱에서 실행하세요.");
      return;
    }
    setSessionStartedAt((current) => current ?? Date.now());
    if (!sessionStartedAt) {
      setSessionElapsed(0);
      setRehearsalSlide(1);
      setRehearsalBlack(false);
      setRehearsalClicks(0);
    }
    addLog(
      sessionStartedAt
        ? "발표 세션 재개"
        : isDesktop
          ? "발표 세션 시작"
          : "웹 리허설 시작 · 외부 사이트는 제어하지 않습니다.",
    );
  };

  const endPresentationSession = async () => {
    await stopCamera();
    setSessionStartedAt(null);
    addLog("발표 세션 종료");
  };

  const refreshSystemStatus = useCallback(async () => {
    setSystemStatusError("");
    if (!api) {
      let camera = streamRef.current ? "granted" : "unknown";
      try {
        const result = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        camera = result.state === "prompt" ? "not-determined" : result.state;
      } catch {
        /* Some browsers cannot query camera permission; do not invent a denial. */
      }
      setPermissions({
        camera,
        accessibility: "unsupported",
        screen: "unsupported",
      });
      return;
    }
    const [permissionResult, displayResult] = await Promise.allSettled([
      api.getPermissions(),
      api.getDisplays(),
    ]);
    if (permissionResult.status === "fulfilled")
      setPermissions(permissionResult.value);
    if (displayResult.status === "fulfilled") {
      const info = displayResult.value;
      setDisplays(info.displays);
      setSelectedDisplayId(
        info.selectedId ||
          info.displays.find((d) => d.primary)?.id ||
          info.displays[0]?.id ||
          "",
      );
    }
    if (
      permissionResult.status === "rejected" ||
      displayResult.status === "rejected"
    ) {
      setSystemStatusError(
        "일부 시스템 정보를 가져오지 못했습니다. 다시 새로고침하거나 앱을 재실행하세요.",
      );
    }
  }, [api]);

  const requestPermission = async (
    permission: "camera" | "accessibility" | "screen",
  ) => {
    try {
      if (api)
        await api.openPermissionSettings(permission);
      else if (permission === "camera") {
        if (streamRef.current) {
          await refreshSystemStatus();
          return;
        }
        const lease = await acquireCamera();
        lease.release();
      }
      await refreshSystemStatus();
    } catch {
      setSystemStatusError(
        "권한 요청을 완료하지 못했습니다. 실행 중인 앱 또는 브라우저의 권한 설정을 확인하세요.",
      );
      if (permission === "camera")
        setPermissions((p) => ({ ...p, camera: "denied" }));
    }
  };

  useEffect(() => {
    const refresh = () => {
      void refreshSystemStatus();
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [api, refreshSystemStatus]);

  const handleGesture = (gesture: MotionGestureId) => {
    if (pointerTestRef.current) return;
    if (gesture === "toggle-motion") {
      void toggleMotion();
      return;
    }
    if (!motionOn || mode !== "slide") return;
    if (gesture === "victory") {
      const available = profile.resources.filter((item) => item.value);
      if (!available.length) {
        addLog("자료 선택 실패 · 등록된 자료가 없습니다.");
        return;
      }
      const next = (selectedResourceIndex + 1) % available.length;
      setSelectedResourceIndex(next);
      addLog(`자료 선택 · ${available[next].name}`);
      return;
    }
    if (gesture === "index") {
      const available = profile.resources.filter((item) => item.value);
      const selected = available[selectedResourceIndex];
      if (!selected) {
        addLog("먼저 V 사인으로 실행할 자료를 선택하세요.");
        return;
      }
      if (!api) {
        const message = `웹 리허설 · ${selected.name} 실행 동작 감지. 실제 링크는 자료 열기 버튼으로 여세요.`;
        setRehearsalMessage(message);
        addLog(message);
      } else void openResource(selected);
      return;
    }
    const action = FIXED_ACTIONS.find(
      (candidate) => profile.mappings[candidate] === gesture,
    );
    if (action) void executeAction(action);
  };

  useEffect(() => {
    const subscriptions: Array<void | (() => void)> = [];
    void api?.getMotionEnabled().then(setMotionOn);
    subscriptions.push(api?.onMotionChanged(setMotionOn));
    subscriptions.push(
      api?.onCameraChanged((enabled) => {
        if (enabled) return;
        releaseCameraRef.current?.();
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraState("idle");
        setMotionOn(false);
        setSessionStartedAt(null);
      }),
    );
    void api?.getPresentationMode().then(setMode);
    subscriptions.push(api?.onPresentationModeChanged(setMode));
    subscriptions.push(
      api?.onPresentationActivity?.((activity) => {
        const action = activity.command as PresentationAction;
        const label = ACTION_LABELS[action] ?? activity.command;
        addLog(
          activity.ok
            ? `${label} 전달 완료`
            : `${label} 전달 실패 · ${activity.error ?? "알 수 없는 오류"}`,
        );
      }),
    );
    void api?.getCursorSensitivity().then(setCursorSensitivity);
    subscriptions.push(
      api?.onCursorSensitivityChanged(setCursorSensitivity),
    );
    const statusTimer = window.setTimeout(() => void refreshSystemStatus(), 0);
    return () => {
      window.clearTimeout(statusTimer);
      subscriptions.forEach((unsubscribe) => unsubscribe?.());
    };
  }, [api, refreshSystemStatus]);

  useEffect(() => {
    localStorage.setItem("displayMode", displayMode);
    void api?.setOverlayMode(displayMode);
  }, [api, displayMode]);

  useEffect(() => {
    if (!sessionStartedAt) return;
    const update = () =>
      setSessionElapsed(Math.floor((Date.now() - sessionStartedAt) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [sessionStartedAt]);

  useEffect(
    () => () => {
      cameraRequestRef.current += 1;
      releaseCameraRef.current?.();
    },
    [],
  );

  const tracking = useHandTracking(
    videoRef,
    canvasRef,
    petCanvasRef,
    cameraState === "active",
    "#b794ff",
    handleGesture,
    async (nextMode) => {
      if (pointerTestRef.current || cameraState !== "active") return;
      // A completed slide-return pose also explicitly resumes paused motion.
      // Other mode poses must not cancel an emergency stop.
      if (!motionOn && nextMode !== "slide") return;
      if (mode !== nextMode) await setPresentationMode(nextMode);
      if (!motionOn && nextMode === "slide") await startMotion();
    },
    (point) => {
      if (pointerTestRef.current) { setTestPointer(point); return; }
      if (!api && motionOn && mode !== "slide") {
        rehearsalPointerRef.current = point;
        setRehearsalPointer(point);
        return;
      }
      if (motionOn && mode === "cursor") api?.moveCursor(point);
      if (motionOn && mode === "laser") api?.moveCursor(point);
    },
    () => {
      if (pointerTestRef.current) return;
      if (motionOn && mode !== "slide") {
        if (!api) {
          const { x, y } = rehearsalPointerRef.current;
          if (x >= 0.35 && x <= 0.65 && y >= 0.3 && y <= 0.7) {
            setRehearsalClicks((n) => n + 1);
            setRehearsalMessage("클릭 성공 · 중앙 표적을 눌렀습니다.");
          } else
            setRehearsalMessage(
              "클릭 동작 감지 · 포인터를 중앙 표적으로 옮겨보세요.",
            );
        } else api.clickCursor();
        addLog("왼손 펼치기 → 주먹 · 클릭");
      }
    },
    cursorSensitivity,
    () => {
      if (!motionOn) return;
      void api?.setMotionEnabled(false);
      setMotionOn(false);
      addLog("양손 주먹 · 긴급 정지");
    },
    (frame) => api?.sendHandOverlayFrame?.(frame),
    FIXED_ACTIONS.map((action) => profile.mappings[action]),
  );
  const activeTracking = tracking;
  const selectedResource = profile.resources.filter((item) => item.value)[
    selectedResourceIndex
  ];

  return {
    isDesktop,
    rehearsalSlide,
    rehearsalBlack,
    rehearsalClicks,
    rehearsalPointer,
    rehearsalMessage,
    systemStatusError,
    requestPermission,
    setPresentationMode,
    profile,
    updateProfile,
    motionOn,
    mode,
    displayMode,
    changeDisplayMode,
    cameraView,
    changeCameraView,
    cursorSensitivity,
    setCursorSensitivity,
    pointerTestOpen,
    testPointer,
    openPointerTest,
    closePointerTest,
    slideNumber,
    setSlideNumber,
    cameraState,
    cameraError,
    presentationLinkStatus,
    sessionStartedAt,
    sessionElapsed,
    permissions,
    displays,
    selectedDisplayId,
    setSelectedDisplayId,
    logs,
    setLogs,
    addLog,
    startCamera,
    stopCamera,
    toggleMotion,
    startMotion,
    executeAction,
    openResource,
    addResource,
    startPresentationSession,
    endPresentationSession,
    refreshSystemStatus,
    videoRef,
    canvasRef,
    activeTracking,
    selectedResource,
  };
}
export type PresentationController = ReturnType<
  typeof usePresentationController
>;
