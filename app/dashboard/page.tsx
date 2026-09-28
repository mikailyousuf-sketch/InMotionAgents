import { AppShell } from "@/components/AppShell";

const cards = [
  ["Conversations", "0"],
  ["Leads", "0"],
  ["Bookings", "0"],
  ["Human handovers", "0"]
];

export default function DashboardPage() {
  return (
    <AppShell>
      <h1>Dashboard</h1>
      <p className="muted">Northstar Dental · Demo workspace</p>
      <div className="grid cols-4" style={{ marginTop: 24 }}>
        {cards.map(([label, value]) => (
          <div className="card" key={label}>
            <div className="muted">{label}</div>
            <div className="kpi">{value}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Brick 1 status</h3>
        <p className="status"><span className="dot" /> Core app scaffold ready</p>
        <p className="muted">Next: connect Supabase data, then make the simulator answer from the business profile.</p>
      </div>
    </AppShell>
  );
}
