export {};

declare global {
  interface Window {
    motionAPI?: {
      launchApp(
        appId: string,
      ): Promise<{ ok: boolean; appName?: string; error?: string }>;
      executePresentationCommand(
        command: string,
        presentationApp?:
          "powerpoint" | "keynote" | "google-slides" | "web-slides",
        presentationUrl?: string,
      ): Promise<{ ok: boolean; error?: string }>;
      pickPresentationFile(applicationOnly?: boolean): Promise<string | null>;
      openPresentationResource(resource: {
        kind: "url" | "file" | "app";
        value: string;
        returnAfterMs?: number;
      }): Promise<{ ok: boolean; error?: string }>;
      restorePresentation(): Promise<{ ok: boolean; error?: string }>;
      openPresentationUrl(
        url: string,
      ): Promise<{ ok: boolean; url?: string; error?: string }>;
      goToSlide(
        slide: number,
        presentationApp?:
          "powerpoint" | "keynote" | "google-slides" | "web-slides",
        presentationUrl?: string,
      ): Promise<{ ok: boolean; error?: string }>;
      getPresentationMode(): Promise<"slide" | "cursor" | "laser">;
      setPresentationMode(mode: string): Promise<{
        ok: boolean;
        mode: "slide" | "cursor" | "laser";
        error?: string;
      }>;
      cyclePresentationMode(): Promise<{
        ok: boolean;
        mode: "slide" | "cursor" | "laser";
        error?: string;
      }>;
      onPresentationModeChanged(
        callback: (mode: "slide" | "cursor" | "laser") => void,
      ): void;
      onPresentationActivity(
        callback: (activity: {
          command: string;
          ok: boolean;
          error?: string;
        }) => void,
      ): void;
      moveLaser(point: { x: number; y: number }): void;
      getLaserSettings(): Promise<{
        color: string;
        size: number;
        trail: boolean;
        shareCompatible: boolean;
      }>;
      setLaserSettings(settings: {
        color: string;
        size: number;
        trail: boolean;
        shareCompatible: boolean;
      }): Promise<{ color: string; size: number; trail: boolean }>;
      onLaserSettingsChanged(
        callback: (settings: {
          color: string;
          size: number;
          trail: boolean;
          shareCompatible: boolean;
        }) => void,
      ): void;
      onLaserMoved(callback: () => void): void;
      getOverlayMode(): Promise<"camera" | "person-pet" | "hand-pet">;
      setOverlayMode(mode: string): Promise<boolean>;
      onOverlayMode(
        callback: (mode: "camera" | "person-pet" | "hand-pet") => void,
      ): void;
      setOverlayColor(color: string): Promise<boolean>;
      onOverlayColor(callback: (color: string) => void): void;
      getOverlayLayout(): Promise<{ scale: number; editing: boolean }>;
      setOverlayScale(scale: number): Promise<number>;
      setOverlayEditing(editing: boolean): Promise<boolean>;
      onOverlayEditing(callback: (editing: boolean) => void): void;
      sendOverlayTracking(tracking: {
        state: string;
        confidence: number;
        gestureLabel: string;
        modeGestureLabel: string;
      }): void;
      onOverlayTracking(
        callback: (tracking: {
          state: string;
          confidence: number;
          gestureLabel: string;
          modeGestureLabel: string;
        }) => void,
      ): void;
      getMotionEnabled(): Promise<boolean>;
      setMotionEnabled(enabled: boolean): Promise<boolean>;
      toggleMotion(): Promise<boolean>;
      onMotionChanged(callback: (enabled: boolean) => void): void;
      getCameraEnabled(): Promise<boolean>;
      setCameraEnabled(enabled: boolean): Promise<boolean>;
      onCameraChanged(callback: (enabled: boolean) => void): void;
      getPermissions(): Promise<{
        camera: string;
        screen: string;
        accessibility: string;
      }>;
      openPermissionSettings(
        permission: "camera" | "accessibility" | "screen",
      ): Promise<boolean>;
      getDisplays(): Promise<{
        selectedId: string | null;
        displays: Array<{
          id: string;
          label: string;
          primary: boolean;
        }>;
      }>;
      setDisplay(id: string): Promise<string | null>;
      getCursorEnabled(): Promise<boolean>;
      setCursorEnabled(
        enabled: boolean,
      ): Promise<{ ok: boolean; enabled: boolean; error?: string }>;
      toggleCursor(): Promise<{
        ok: boolean;
        enabled: boolean;
        error?: string;
      }>;
      moveCursor(point: { x: number; y: number }): void;
      clickCursor(): void;
      getCursorSensitivity(): Promise<number>;
      setCursorSensitivity(value: number): Promise<number>;
      onCursorSensitivityChanged(callback: (value: number) => void): void;
      onCursorChanged(callback: (enabled: boolean) => void): void;
      getKeyboardVisible(): Promise<boolean>;
      setKeyboardVisible(visible: boolean): Promise<boolean>;
      toggleKeyboard(): Promise<boolean>;
      getTypingSensitivity(): Promise<number>;
      setTypingSensitivity(value: number): Promise<number>;
      onTypingSensitivityChanged(callback: (value: number) => void): void;
      typeKey(key: string): Promise<{ ok: boolean; error?: string }>;
      sendKeyboardPointer(sample: {
        hand: "Left" | "Right";
        x: number;
        y: number;
        tap: boolean;
      }): void;
      onKeyboardPointer(
        callback: (sample: {
          hand: "Left" | "Right";
          x: number;
          y: number;
          tap: boolean;
        }) => void,
      ): void;
      sendKeyboardHands(
        hands: Array<{
          handedness: "Left" | "Right";
          landmarks: Array<{ x: number; y: number }>;
        }>,
      ): void;
      onKeyboardHands(
        callback: (
          hands: Array<{
            handedness: "Left" | "Right";
            landmarks: Array<{ x: number; y: number }>;
          }>,
        ) => void,
      ): void;
      onKeyboardChanged(callback: (visible: boolean) => void): void;
    };
  }
}
