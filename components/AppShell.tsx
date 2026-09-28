import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { ProductNavigation } from "@/components/ProductNavigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">IM</div>
          <div>
            <div className="brand">InMotion</div>
            <div className="brand-sub">AI Receptionist</div>
          </div>
        </div>

        <WorkspaceSwitcher />
        <ProductNavigation />

        <form action="/api/auth/logout" method="post" className="sidebar-logout">
          <button type="submit" className="link-button">Log out</button>
        </form>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
