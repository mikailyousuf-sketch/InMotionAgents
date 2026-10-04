"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function PageSurface({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="route-page">
      {children}
    </div>
  );
}
