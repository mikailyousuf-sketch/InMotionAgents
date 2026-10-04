"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { ProductNavigation } from "@/components/ProductNavigation";
import { PageSurface } from "@/components/PageSurface";
import { BackgroundGradientAnimation } from "@/components/BackgroundGradientAnimation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("inmotion.sidebar.collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggleSidebar() {
    setCollapsed(current => {
      const next = !current;
      window.localStorage.setItem("inmotion.sidebar.collapsed", String(next));
      return next;
    });
  }

  return (
    <div className={`shell command-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar command-sidebar">
        <div className="sidebar-brand-row">
          <div className="brand-lockup command-brand">
            <img className="inmotion-brand-logo" src="/inmotion-logo-floating.webp" alt="InMotion" />
          </div>

          <button
            type="button"
            className="sidebar-collapse-button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <div className="workspace-wrap">
          <WorkspaceSwitcher />
        </div>

        <ProductNavigation collapsed={collapsed} />

        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span className="status-orb" />
            <div>
              <strong>AI Receptionist</strong>
              <span>Online</span>
            </div>
          </div>

          <form action="/api/auth/logout" method="post" className="sidebar-logout">
            <button type="submit" className="sidebar-logout-button">Log out</button>
          </form>
        </div>
      </aside>

      <header className="mobile-app-header">
        <div className="mobile-app-brand">
          <img src="/inmotion-logo-floating.webp" alt="InMotion" />
        </div>
        <div className="mobile-app-status" aria-label="AI Receptionist online">
          <span className="status-orb" />
          <span>AI online</span>
        </div>
      </header>

      <main className="main command-main">
        <PageSurface>{children}</PageSurface>
      </main>
    </div>
  );
}
