import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("Flickey 발표 인터페이스", () => {
  beforeEach(() => {
    delete window.motionAPI;
    localStorage.clear();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  it("모션을 기본 OFF 상태로 시작한다", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "MOTION OFF" })).toBeVisible();
    expect(screen.getByText("발표 제어 센터")).toBeVisible();
  });

  it("Electron 브리지로 다음 슬라이드 명령을 실행한다", async () => {
    const executePresentationCommand = vi.fn().mockResolvedValue({ ok: true });
    window.motionAPI = {
      launchApp: vi.fn(),
      executePresentationCommand,
      pickPresentationFile: vi.fn().mockResolvedValue(null),
      openPresentationResource: vi.fn().mockResolvedValue({ ok: true }),
      restorePresentation: vi.fn().mockResolvedValue({ ok: true }),
      openPresentationUrl: vi.fn().mockResolvedValue({ ok: true }),
      goToSlide: vi.fn().mockResolvedValue({ ok: true }),
      getPresentationMode: vi.fn().mockResolvedValue("slide"),
      setPresentationMode: vi
        .fn()
        .mockResolvedValue({ ok: true, mode: "slide" }),
      cyclePresentationMode: vi
        .fn()
        .mockResolvedValue({ ok: true, mode: "cursor" }),
      onPresentationModeChanged: vi.fn(),
      onPresentationActivity: vi.fn(),
      moveLaser: vi.fn(),
      getLaserSettings: vi.fn().mockResolvedValue({
        color: "#9fe9ff",
        size: 24,
        trail: true,
        shareCompatible: false,
      }),
      setLaserSettings: vi.fn().mockResolvedValue({
        color: "#9fe9ff",
        size: 24,
        trail: true,
        shareCompatible: false,
      }),
      onLaserSettingsChanged: vi.fn(),
      onLaserMoved: vi.fn(),
      getOverlayMode: vi.fn().mockResolvedValue("camera"),
      setOverlayMode: vi.fn().mockResolvedValue(true),
      onOverlayMode: vi.fn(),
      setOverlayColor: vi.fn().mockResolvedValue(true),
      onOverlayColor: vi.fn(),
      getOverlayLayout: vi.fn().mockResolvedValue({ scale: 1, editing: false }),
      setOverlayScale: vi.fn().mockResolvedValue(1),
      setOverlayEditing: vi.fn().mockResolvedValue(false),
      onOverlayEditing: vi.fn(),
      sendOverlayTracking: vi.fn(),
      onOverlayTracking: vi.fn(),
      getMotionEnabled: vi.fn().mockResolvedValue(true),
      setMotionEnabled: vi.fn().mockResolvedValue(true),
      toggleMotion: vi.fn().mockResolvedValue(false),
      onMotionChanged: vi.fn(),
      getCameraEnabled: vi.fn().mockResolvedValue(false),
      setCameraEnabled: vi.fn().mockResolvedValue(true),
      onCameraChanged: vi.fn(),
      getPermissions: vi.fn().mockResolvedValue({
        camera: "granted",
        accessibility: "granted",
        screen: "granted",
      }),
      openPermissionSettings: vi.fn().mockResolvedValue(true),
      getDisplays: vi.fn().mockResolvedValue({
        selectedId: null,
        displays: [{ id: "1", label: "모니터 1", primary: true }],
      }),
      setDisplay: vi.fn().mockResolvedValue("1"),
      getCursorEnabled: vi.fn().mockResolvedValue(false),
      setCursorEnabled: vi.fn().mockResolvedValue({ ok: true, enabled: false }),
      toggleCursor: vi.fn().mockResolvedValue({ ok: true, enabled: true }),
      moveCursor: vi.fn(),
      clickCursor: vi.fn(),
      getCursorSensitivity: vi.fn().mockResolvedValue(1),
      setCursorSensitivity: vi.fn().mockResolvedValue(1),
      onCursorSensitivityChanged: vi.fn(),
      getKeyboardVisible: vi.fn().mockResolvedValue(false),
      setKeyboardVisible: vi.fn().mockResolvedValue(true),
      toggleKeyboard: vi.fn().mockResolvedValue(true),
      getTypingSensitivity: vi.fn().mockResolvedValue(0.35),
      setTypingSensitivity: vi.fn().mockResolvedValue(0.35),
      onTypingSensitivityChanged: vi.fn(),
      typeKey: vi.fn(),
      sendKeyboardPointer: vi.fn(),
      onKeyboardPointer: vi.fn(),
      sendKeyboardHands: vi.fn(),
      onKeyboardHands: vi.fn(),
      onKeyboardChanged: vi.fn(),
      onCursorChanged: vi.fn(),
    };
    render(<App />);
    await userEvent.click(
      screen.getByRole("button", { name: "다음 슬라이드 테스트" }),
    );
    expect(executePresentationCommand).toHaveBeenCalledWith(
      "next-slide",
      "google-slides",
      "",
    );
    expect(await screen.findByText(/다음 슬라이드 실행/)).toBeInTheDocument();
    delete window.motionAPI;
  });

  it("발표 자료 슬롯을 추가할 수 있다", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "+ 자료 추가" }));
    expect(screen.getByText("RESOURCE 03")).toBeVisible();
  });
});
