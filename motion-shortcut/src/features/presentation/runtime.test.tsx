import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { GesturePattern } from "./types";
import { usePresentationController } from "./usePresentationController";
const tracking = vi.hoisted(() => ({ args: [] as unknown[] }));
vi.mock("../camera/useHandTracking", () => ({
  useHandTracking: (...args: unknown[]) => {
    tracking.args = args;
    return {
      state: "idle",
      confidence: 0,
      errorMessage: "",
      gestureLabel: "",
      modeGestureLabel: "",
    };
  },
}));
describe("web and desktop runtime boundaries", () => {
  beforeEach(() => {
    delete window.motionAPI;
    localStorage.clear();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
      },
    });
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue({ state: "prompt" }) },
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete window.motionAPI;
  });
  it("demo isolates all native commands and supports five slides, blackout, pointer and emergency stop", async () => {
    const native = vi.fn(() => { throw new Error("Demo must never call the native bridge"); });
    window.motionAPI = new Proxy({}, { get: () => native }) as NonNullable<typeof window.motionAPI>;
    const stop = vi.fn();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    const { result } = renderHook(() => usePresentationController("demo"));
    await act(async () => { await result.current.toggleMotion(); });
    await act(async () => { await result.current.executeAction("black-screen"); });
    expect(result.current.rehearsalBlack).toBe(true);
    await act(async () => { (tracking.args[5] as (g: string) => void)("swipe-right"); });
    expect(result.current.rehearsalSlide).toBe(2);
    expect(result.current.rehearsalBlack).toBe(false);
    await act(async () => { for (let i = 0; i < 8; i++) await result.current.executeAction("next-slide"); });
    expect(result.current.rehearsalSlide).toBe(5);
    await act(async () => { await result.current.setPresentationMode("cursor"); });
    act(() => { (tracking.args[7] as (p: { x: number; y: number }) => void)({ x: .5, y: .5 }); });
    act(() => { (tracking.args[8] as () => void)(); });
    expect(result.current.rehearsalClicks).toBe(1);
    act(() => { (tracking.args[10] as () => void)(); });
    expect(result.current.motionOn).toBe(false);
    await act(async () => { await result.current.stopCamera(); });
    expect(stop).toHaveBeenCalled();
    expect(native).not.toHaveBeenCalled();
  });
  it.each<GesturePattern>(["thumbs-up", "thumbs-down", "ok", "three-fingers", "point-left", "point-right", "point-up"])("dispatches a custom %s to its assigned slide action", async (gesture) => {
    const { result } = renderHook(() => usePresentationController("demo"));
    act(() => result.current.updateProfile({
      ...result.current.profile,
      mappings: { ...result.current.profile.mappings, "next-slide": gesture },
    }));
    expect(tracking.args[12]).toContain(gesture);
    await act(async () => { await result.current.startMotion(); });
    await act(async () => { (tracking.args[5] as (g: string) => void)(gesture); });
    expect(result.current.rehearsalSlide).toBe(2);
    await act(async () => { await result.current.toggleMotion(); });
    await act(async () => { (tracking.args[5] as (g: string) => void)(gesture); });
    expect(result.current.rehearsalSlide).toBe(2);
  });
  it("resumes slide commands after returning from pointer mode", async () => {
    const { result } = renderHook(() => usePresentationController("demo"));
    await act(async () => { await result.current.startMotion(); });
    await act(async () => { (tracking.args[6] as (mode: string) => void)("cursor"); });
    expect(result.current.mode).toBe("cursor");
    await act(async () => { (tracking.args[5] as (gesture: string) => void)("swipe-right"); });
    expect(result.current.rehearsalSlide).toBe(1);
    await act(async () => { (tracking.args[6] as (mode: string) => void)("slide"); });
    expect(result.current.mode).toBe("slide");
    await act(async () => { (tracking.args[5] as (gesture: string) => void)("swipe-right"); });
    expect(result.current.rehearsalSlide).toBe(2);
  });
  it.each(["slide", "cursor"] as const)("resumes paused motion with the slide-return pose from %s", async (initialMode) => {
    const { result } = renderHook(() => usePresentationController("demo"));
    await act(async () => { await result.current.startMotion(); });
    await act(async () => { await result.current.setPresentationMode(initialMode); });
    act(() => { (tracking.args[10] as () => void)(); });
    expect(result.current.motionOn).toBe(false);
    expect(result.current.cameraState).toBe("active");
    await act(async () => { await (tracking.args[6] as (mode: string) => Promise<void>)("cursor"); });
    expect(result.current.motionOn).toBe(false);
    await act(async () => { await (tracking.args[6] as (mode: string) => Promise<void>)("slide"); });
    expect(result.current.mode).toBe("slide");
    expect(result.current.motionOn).toBe(true);
    await act(async () => { (tracking.args[5] as (gesture: string) => void)("swipe-right"); });
    expect(result.current.rehearsalSlide).toBe(2);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });
  it("stops a pending camera request when the home camera is handed off", async () => {
    let resolve!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(r => { resolve = r; }));
    const stop = vi.fn();
    const { result } = renderHook(() => usePresentationController("demo"));
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.startCamera(); });
    await act(async () => { await result.current.stopCamera(); });
    await act(async () => { resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream); await pending; });
    expect(stop).toHaveBeenCalled();
    expect(result.current.cameraState).toBe("idle");
  });
  it("web motion toggles without a desktop bridge and gestures update only the sample", async () => {
    const { result } = renderHook(usePresentationController);
    await act(async () => {
      await result.current.toggleMotion();
    });
    expect(result.current.motionOn).toBe(true);
    await act(async () => {
      (tracking.args[5] as (s: string) => void)("swipe-right");
    });
    expect(result.current.rehearsalSlide).toBe(2);
    await act(async () => {
      await result.current.toggleMotion();
    });
    await act(async () => {
      (tracking.args[5] as (s: string) => void)("swipe-right");
    });
    expect(result.current.rehearsalSlide).toBe(2);
    expect(result.current.cameraState).toBe("active");
  });
  it("web session starts without presentation material and supports pointer hit testing", async () => {
    const { result } = renderHook(usePresentationController);
    await act(async () => {
      await result.current.startPresentationSession();
    });
    expect(result.current.sessionStartedAt).not.toBeNull();
    await act(async () => {
      await result.current.setPresentationMode("cursor");
    });
    act(() => {
      (tracking.args[7] as (p: { x: number; y: number }) => void)({
        x: 0.5,
        y: 0.5,
      });
    });
    act(() => {
      (tracking.args[8] as () => void)();
    });
    expect(result.current.rehearsalClicks).toBe(1);
    act(() => {
      (tracking.args[7] as (p: { x: number; y: number }) => void)({
        x: 0.1,
        y: 0.1,
      });
    });
    act(() => {
      (tracking.args[8] as () => void)();
    });
    expect(result.current.rehearsalClicks).toBe(1);
    act(() => {
      (tracking.args[10] as () => void)();
    });
    expect(result.current.motionOn).toBe(false);
  });
  it("web link opening validates protocols and does not claim external control", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const { result } = renderHook(usePresentationController);
    act(() =>
      result.current.updateProfile({
        ...result.current.profile,
        presentationUrl: "javascript:alert(1)",
      }),
    );
    await act(async () => {
      await result.current.openResource({
        id: "resource-1",
        name: "추가 자료",
        kind: "url",
        value: result.current.profile.presentationUrl,
        returnAfterMs: 0,
      });
    });
    expect(open).not.toHaveBeenCalled();
    act(() =>
      result.current.updateProfile({
        ...result.current.profile,
        presentationUrl: "https://example.com/slides",
      }),
    );
    await act(async () => {
      await result.current.openResource({
        id: "resource-1",
        name: "추가 자료",
        kind: "url",
        value: result.current.profile.presentationUrl,
        returnAfterMs: 0,
      });
    });
    expect(open).toHaveBeenCalledWith(
      "https://example.com/slides",
      "_blank",
      "noopener,noreferrer",
    );
    expect(result.current.presentationLinkStatus).toContain(
      "추가 자료는 제어하지 않습니다",
    );
  });
  it("additional resource URLs get an https scheme only when no scheme is present", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const { result } = renderHook(usePresentationController);
    const openValue = (value: string) =>
      act(async () => {
        await result.current.openResource({
          id: "resource-1",
          name: "추가 자료",
          kind: "url",
          value,
          returnAfterMs: 0,
        });
      });
    await openValue("  example.com ");
    expect(open).toHaveBeenLastCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer",
    );
    await openValue("https://a.b");
    expect(open).toHaveBeenLastCalledWith(
      "https://a.b",
      "_blank",
      "noopener,noreferrer",
    );
    expect(open).toHaveBeenCalledTimes(2);
    await openValue("javascript:alert(1)");
    await openValue("mailto:a@b.com");
    expect(open).toHaveBeenCalledTimes(2);
    expect(result.current.presentationLinkStatus).toContain("http/https");
  });
  it("browser permission refresh distinguishes prompt/denied and desktop-only permissions", async () => {
    const { result } = renderHook(usePresentationController);
    await act(async () => {
      await result.current.refreshSystemStatus();
    });
    expect(result.current.permissions.camera).toBe("not-determined");
    expect(result.current.permissions.accessibility).toBe("unsupported");
    vi.mocked(navigator.permissions.query).mockResolvedValue({
      state: "denied",
    } as PermissionStatus);
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() =>
      expect(result.current.permissions.camera).toBe("denied"),
    );
  });
  it("desktop refresh still updates permissions when display enumeration fails", async () => {
    const getPermissions = vi.fn().mockResolvedValue({
      camera: "granted",
      screen: "restricted",
      accessibility: "granted",
    });
    const getDisplays = vi
      .fn()
      .mockRejectedValue(new Error("display unavailable"));
    window.motionAPI = {
      getPermissions,
      getDisplays,
      getMotionEnabled: vi.fn().mockResolvedValue(false),
      getPresentationMode: vi.fn().mockResolvedValue("slide"),
      getCursorSensitivity: vi.fn().mockResolvedValue(1),
      onMotionChanged: vi.fn(), onCameraChanged: vi.fn(),
      onPresentationModeChanged: vi.fn(), onCursorSensitivityChanged: vi.fn(),
      setOverlayMode: vi.fn(),
    } as unknown as NonNullable<typeof window.motionAPI>;
    const { result, unmount } = renderHook(usePresentationController);
    await act(async () => {
      await result.current.refreshSystemStatus();
    });
    expect(result.current.permissions.camera).toBe("granted");
    expect(result.current.permissions.screen).toBe("restricted");
    expect(result.current.systemStatusError).toContain("일부");
    getPermissions.mockResolvedValue({
      camera: "denied",
      screen: "granted",
      accessibility: "denied",
    });
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() =>
      expect(result.current.permissions.camera).toBe("denied"),
    );
    unmount();
    const calls = getPermissions.mock.calls.length;
    window.dispatchEvent(new Event("focus"));
    expect(getPermissions).toHaveBeenCalledTimes(calls);
  });
});
