import { useEffect, useRef, useState, type CSSProperties } from "react";

export default function Laser() {
  const [settings, setSettings] = useState({
    color: "#9fe9ff",
    size: 24,
    trail: true,
    shareCompatible: false,
  });
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    void window.motionAPI?.getLaserSettings().then(setSettings);
    window.motionAPI?.onLaserSettingsChanged(setSettings);
    window.motionAPI?.onLaserMoved(() => {
      setHolding(false);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setHolding(true), 420);
    });
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <main
      className={`laser-pointer ${settings.trail ? "trail" : ""} ${holding ? "holding" : ""}`}
      style={
        {
          "--laser-color": settings.color,
          "--laser-size": `${settings.size}px`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <i />
      <span />
      <em />
      <em />
      <em />
    </main>
  );
}
