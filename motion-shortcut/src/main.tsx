import { lazy, Suspense, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import App from "./App.tsx";
import Overlay from "./Overlay.tsx";
import Keyboard from "./Keyboard.tsx";
import { DemoPresentation } from "./components/DemoPresentation";
import Laser from "./Laser.tsx";

const PdfPresentation = lazy(() => import("./components/PdfPresentation"));

const params = new URLSearchParams(window.location.search);
const isOverlay = params.has("overlay");
const isKeyboard = params.has("keyboard");
const isLaser = params.has("laser");
if (isOverlay) document.documentElement.classList.add("overlay-page");
if (isKeyboard) document.documentElement.classList.add("keyboard-page");
if (isLaser) document.documentElement.classList.add("laser-page");
// Web analytics only on the deployed web app (not Electron windows); the package skips dev mode itself.
const trackVisits = !window.motionAPI && !isOverlay && !isKeyboard && !isLaser;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {params.has("pdf") ? <Suspense fallback={<p role="status">PDF를 불러오는 중…</p>}><PdfPresentation /></Suspense> : params.has("demo") ? <DemoPresentation /> : isLaser ? (
      <Laser />
    ) : isKeyboard ? (
      <Keyboard />
    ) : isOverlay ? (
      <Overlay />
    ) : (
      <App />
    )}
    {trackVisits && <Analytics />}
  </StrictMode>,
);
