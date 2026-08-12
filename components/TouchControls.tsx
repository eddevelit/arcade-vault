"use client";

import { useEffect, useRef, useState } from "react";

export type DPadDirection = "up" | "down" | "left" | "right";

const DPAD_CODE: Record<DPadDirection, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

const DPAD_GLYPH: Record<DPadDirection, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
};

export interface TouchActionButton {
  id: string;
  label: string;
  code: string;
}

export interface TouchControlsProps {
  accent: "cyan" | "magenta" | "yellow" | "green";
  showDPad?: boolean;
  actions?: TouchActionButton[];
}

export default function TouchControls({
  accent,
  showDPad = true,
  actions = [],
}: TouchControlsProps) {
  const [isTouch, setIsTouch] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!isTouch) return null;

  return (
    <div className={`touch-controls touch-controls-${accent}`}>
      {showDPad && (
        <div className="touch-dpad">
          {(Object.keys(DPAD_CODE) as DPadDirection[]).map((dir) => (
            <TouchButton
              key={dir}
              code={DPAD_CODE[dir]}
              className={`touch-dpad-btn touch-dpad-${dir}`}
            >
              {DPAD_GLYPH[dir]}
            </TouchButton>
          ))}
        </div>
      )}
      {actions.length > 0 && (
        <div className="touch-actions">
          {actions.map((action) => (
            <TouchButton
              key={action.id}
              code={action.code}
              className="touch-action-btn"
            >
              {action.label}
            </TouchButton>
          ))}
        </div>
      )}
    </div>
  );
}

interface TouchButtonProps {
  code: string;
  className: string;
  children: React.ReactNode;
}

// Trackea su propio touch.identifier para que combinaciones de botones
// simultáneas (ej. rotar + propulsar) no se cancelen entre sí.
function TouchButton({ code, className, children }: TouchButtonProps) {
  const touchIdRef = useRef<number | null>(null);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    return () => {
      if (touchIdRef.current !== null) {
        window.dispatchEvent(
          new KeyboardEvent("keyup", { code, bubbles: true }),
        );
      }
    };
  }, [code]);

  const onTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    touchIdRef.current = touch.identifier;
    setPressed(true);
    window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    const released = Array.from(e.changedTouches).some(
      (t) => t.identifier === touchIdRef.current,
    );
    if (!released) return;
    touchIdRef.current = null;
    setPressed(false);
    window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
  };

  return (
    <button
      type="button"
      className={`${className} ${pressed ? "pressed" : ""}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
