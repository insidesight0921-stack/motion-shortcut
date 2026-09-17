import { useEffect, useRef, useState } from "react";
import {
  useHandTracking,
  type MotionGestureId,
} from "./features/camera/useHandTracking";
import { loadProfile } from "./features/presentation/profile";
import type {
  PresentationAction,
  PresentationMode,
} from "./features/presentation/types";

type OverlayMode = "camera" | "person-pet" | "hand-pet";

export default function Overlay() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideCanvasRef = useRef<HTMLCanvasElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<OverlayMode>("camera");
  const [motionOn, setMotionOn] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [presentationMode, setPresentationMode] =
    useState<PresentationMode>("slide");
  const [profile, setProfile] = useState(loadProfile);
  const [cursorOn, setCursorOn] = useState(false);
  const [cursorSensitivity, setCursorSensitivity] = useState(1);
  const [handColor, setHandColor] = useState("#72dcff");
  const [editing, setEditing] = useState(false);
  const [selectedResourceIndex, setSelectedResourceIndex] = useState(-1);
  const selectedResource = profile.resources.filter((item) => item.value)[
    selectedResourceIndex
  ];
  const tracking = useHandTracking(
    videoRef,
    guideCanvasRef,
    handCanvasRef,
    cameraEnabled && mode !== "camera",
    handColor,
    (gesture: MotionGestureId) => {
      if (gesture === "toggle-motion") void window.motionAPI?.toggleMotion();
      else if (motionOn && presentationMode === "slide") {
        const available = profile.resources.filter((item) => item.value);
        if (gesture === "victory") {
          if (!available.length) return;
          setSelectedResourceIndex(
            (current) => (current + 1) % available.length,
          );
          return;
        }
        if (gesture === "index") {
          const selected = available[selectedResourceIndex];
          if (selected)
            void window.motionAPI?.openPresentationResource(selected);
          return;
        }
        const action = Object.entries(profile.mappings).find(
          ([, pattern]) => pattern === gesture,
        )?.[0] as PresentationAction | undefined;
        if (action === "resource-1" || action === "resource-2") {
          const resource = profile.resources.find((item) => item.id === action);
          if (resource?.value)
            void window.motionAPI?.openPresentationResource(resource);
        } else if (action) {
          void window.motionAPI?.executePresentationCommand(
            action,
            profile.app,
            profile.presentationUrl,
          );
        }
      }
    },
    (nextMode) => {
      if (motionOn && presentationMode !== nextMode)
        void window.motionAPI?.setPresentationMode(nextMode);
    },
    (point) => {
      if (motionOn && presentationMode === "cursor")
        window.motionAPI?.moveCursor(point);
      if (motionOn && presentationMode === "laser")
        window.motionAPI?.moveLaser(point);
    },
    () => {
      if (motionOn && presentationMode === "cursor")
        window.motionAPI?.clickCursor();
    },
    cursorSensitivity,
    () => {
      if (motionOn) void window.motionAPI?.setMotionEnabled(false);
    },
  );

  useEffect(() => {
    window.motionAPI?.sendOverlayTracking?.({
      state: tracking.state,
      confidence: tracking.confidence,
      gestureLabel: tracking.gestureLabel,
      modeGestureLabel: tracking.modeGestureLabel,
    });
  }, [
    tracking.confidence,
    tracking.gestureLabel,
    tracking.modeGestureLabel,
    tracking.state,
  ]);

  useEffect(() => {
    void window.motionAPI?.getOverlayMode().then(setMode);
    window.motionAPI?.onOverlayMode(setMode);
    window.motionAPI?.onOverlayColor(setHandColor);
    void window.motionAPI
      ?.getOverlayLayout?.()
      .then((layout) => setEditing(layout.editing));
    window.motionAPI?.onOverlayEditing?.(setEditing);
    void window.motionAPI?.getMotionEnabled().then(setMotionOn);
    window.motionAPI?.onMotionChanged(setMotionOn);
    void window.motionAPI?.getCameraEnabled().then(setCameraEnabled);
    window.motionAPI?.onCameraChanged(setCameraEnabled);
    void window.motionAPI?.getPresentationMode().then(setPresentationMode);
    window.motionAPI?.onPresentationModeChanged(setPresentationMode);
    void window.motionAPI?.getCursorEnabled?.().then(setCursorOn);
    window.motionAPI?.onCursorChanged?.(setCursorOn);
    void window.motionAPI?.getCursorSensitivity?.().then(setCursorSensitivity);
    window.motionAPI?.onCursorSensitivityChanged?.(setCursorSensitivity);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!cameraEnabled || mode === "camera") {
      if (video) video.srcObject = null;
      return;
    }
    let stream: MediaStream | null = null;
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(async (next) => {
        stream = next;
        if (video) {
          video.srcObject = next;
          await video.play();
        }
      });
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, [cameraEnabled, mode]);

  useEffect(() => {
    const updateProfile = () => setProfile(loadProfile());
    window.addEventListener("storage", updateProfile);
    return () => window.removeEventListener("storage", updateProfile);
  }, []);

  return (
    <main
      className={`desktop-pet ${mode} ${tracking.state === "tracking" ? "has-hand" : ""} ${editing ? "editing" : ""}`}
    >
      <video ref={videoRef} muted playsInline />
      <canvas ref={guideCanvasRef} className="guide-canvas" />
      <canvas ref={handCanvasRef} className="pet-hand-canvas" />
      <span>
        {motionOn ? "MOTION ON" : "MOTION OFF"} · CURSOR{" "}
        {cursorOn ? "ON" : "OFF"}
        {tracking.modeGestureLabel
          ? ` · ${tracking.modeGestureLabel} 전환 준비`
          : ""}
        {selectedResource ? ` · 자료: ${selectedResource.name}` : ""}
      </span>
      {selectedResource && (
        <div className="resource-hud pet-resource-hud">
          <small>SELECTED</small>
          <strong>{selectedResource.name}</strong>
          <span>검지로 실행</span>
        </div>
      )}
      {editing && <b className="pet-edit-hint">드래그해서 이동</b>}
    </main>
  );
}
