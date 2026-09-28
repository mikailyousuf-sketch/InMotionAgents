import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">InMotion Agents</div>
        <nav className="nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/">Agent Simulator</Link>
          <Link href="/onboarding">Onboarding</Link>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
