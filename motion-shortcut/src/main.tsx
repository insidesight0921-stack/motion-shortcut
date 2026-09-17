import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import Overlay from "./Overlay.tsx";
import Keyboard from "./Keyboard.tsx";
import Laser from "./Laser.tsx";

const params = new URLSearchParams(window.location.search);
const isOverlay = params.has("overlay");
const isKeyboard = params.has("keyboard");
const isLaser = params.has("laser");
if (isOverlay) document.documentElement.classList.add("overlay-page");
if (isKeyboard) document.documentElement.classList.add("keyboard-page");
if (isLaser) document.documentElement.classList.add("laser-page");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isLaser ? (
      <Laser />
    ) : isKeyboard ? (
      <Keyboard />
    ) : isOverlay ? (
      <Overlay />
    ) : (
      <App />
    )}
  </StrictMode>,
);
