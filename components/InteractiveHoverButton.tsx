"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

type InteractiveHoverButtonProps = {
  children: ReactNode;
  href?: string;
  className?: string;
};

export function InteractiveHoverButton({ children, href, className = "" }: InteractiveHoverButtonProps) {
  const content = (
    <>
      <span className="interactive-hover-button-dot" />
      <span className="interactive-hover-button-label">{children}</span>
      <span className="interactive-hover-button-arrow"><ArrowRight size={14} strokeWidth={1.8} /></span>
    </>
  );

  const classes = `interactive-hover-button ${className}`;

  if (href) {
    return <Link href={href} className={classes}>{content}</Link>;
  }

  return <button type="button" className={classes}>{content}</button>;
}
