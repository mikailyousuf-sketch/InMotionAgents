import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">InMotion Agents</div>
        <nav className="nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/">Agent Simulator</Link>
          <Link href="/conversations">Conversations</Link>
          <Link href="/customers">Customers</Link>
          <Link href="/whatsapp">WhatsApp Test</Link>
          <Link href="/usage">Usage</Link>
          <Link href="/onboarding">Onboarding</Link>
        </nav>
        <form action="/api/auth/logout" method="post" style={{ marginTop: 24 }}>
          <button type="submit" className="link-button">Log out</button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
