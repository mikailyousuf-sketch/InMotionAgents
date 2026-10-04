"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type PulsatingButtonProps = {
  children: ReactNode;
  href?: string;
  className?: string;
};

export function PulsatingButton({ children, href, className = "" }: PulsatingButtonProps) {
  const classes = `pulsating-button ${className}`;
  if (href) {
    return <Link href={href} className={classes}>{children}</Link>;
  }

  return <button type="button" className={classes}>{children}</button>;
}
