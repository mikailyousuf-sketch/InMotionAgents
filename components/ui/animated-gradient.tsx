import { ReactNode } from "react";

type AnimatedGradientProps = {
  children?: ReactNode;
  className?: string;
  variant?: "mist" | "aurora" | "halo";
  speed?: number;
  opacity?: number;
};

export function AnimatedGradient({
  children,
  className = "",
  variant = "mist",
  speed = 0.6,
  opacity = 0.8
}: AnimatedGradientProps) {
  const duration = Math.max(8, 28 / Math.max(speed, 0.1));

  return (
    <div
      className={`im-animated-gradient im-animated-gradient--${variant} ${className}`.trim()}
      style={
        {
          "--im-gradient-opacity": opacity,
          "--im-gradient-duration": `${duration}s`
        } as React.CSSProperties
      }
    >
      <div className="im-animated-gradient-layer im-gradient-layer-a" />
      <div className="im-animated-gradient-layer im-gradient-layer-b" />
      <div className="im-animated-gradient-layer im-gradient-layer-c" />
      <div className="im-animated-gradient-layer im-gradient-layer-d" />
      <div className="im-animated-gradient-sweep" />
      <div className="im-animated-gradient-vignette" />
      <div className="im-animated-gradient-content">{children}</div>
    </div>
  );
}
