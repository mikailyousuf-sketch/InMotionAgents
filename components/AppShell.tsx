import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { ProductNavigation } from "@/components/ProductNavigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell command-shell">
      <aside className="sidebar command-sidebar">
        <div className="brand-lockup command-brand">
          <div className="brand-signature">InMotion</div>
          <div className="brand-sub">AGENTS</div>
        </div>

        <div className="workspace-wrap">
          <WorkspaceSwitcher />
        </div>

        <ProductNavigation />

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

      <main className="main command-main">{children}</main>
    </div>
  );
}
