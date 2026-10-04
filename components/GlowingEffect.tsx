"use client";

import { useRef } from "react";

type GlowingEffectProps = {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  spread?: number;
  proximity?: number;
  borderWidth?: number;
};

export function GlowingEffect({
  children,
  className = "",
  glow = false,
  spread = 110,
  proximity = 72,
  borderWidth = 1
}: GlowingEffectProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const within =
      x >= -proximity &&
      x <= rect.width + proximity &&
      y >= -proximity &&
      y <= rect.height + proximity;

    el.style.setProperty("--glow-x", `${x}px`);
    el.style.setProperty("--glow-y", `${y}px`);
    el.style.setProperty("--glow-opacity", within || glow ? "1" : "0");
    el.style.setProperty("--glow-spread", `${spread}px`);
    el.style.setProperty("--glow-border-width", `${borderWidth}px`);
  }

  function handlePointerLeave() {
    const el = ref.current;
    if (!el || glow) return;
    el.style.setProperty("--glow-opacity", "0");
  }

  return (
    <div
      ref={ref}
      className={`glowing-effect-shell ${className}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="glowing-effect-border" aria-hidden="true" />
      {children}
    </div>
  );
}
