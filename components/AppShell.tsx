import Link from "next/link";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">InMotion Agents</div>
        <WorkspaceSwitcher />
        <nav className="nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/">Agent Simulator</Link>
          <Link href="/conversations">Conversations</Link>
          <Link href="/customers">Customers</Link>
          <Link href="/whatsapp">WhatsApp Test</Link>
          <Link href="/automations">Automations</Link>
          <Link href="/usage">Usage</Link>
          <Link href="/settings">Settings</Link>
          <Link href="/team">Team</Link>
          <Link href="/integrations">Integrations</Link>
          <Link href="/onboarding">New workspace</Link>
        </nav>
        <form action="/api/auth/logout" method="post" style={{ marginTop: 24 }}>
          <button type="submit" className="link-button">Log out</button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
