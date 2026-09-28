import { AppShell } from "@/components/AppShell";
import { getCustomerProfile } from "@/lib/crm/customers";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { customer, bookings, conversations } = await getCustomerProfile(id);

  return (
    <AppShell>
      <h1>{customer.full_name ?? "Customer"}</h1>
      <p className="muted">{customer.phone ?? customer.email ?? "No contact details"}</p>

      <div className="grid cols-4" style={{ marginTop: 24 }}>
        <div className="card"><div className="muted">Lead status</div><div className="kpi" style={{ fontSize: 20 }}>{customer.lead_status}</div></div>
        <div className="card"><div className="muted">Bookings</div><div className="kpi">{bookings.length}</div></div>
        <div className="card"><div className="muted">Conversations</div><div className="kpi">{conversations.length}</div></div>
        <div className="card"><div className="muted">Last contacted</div><div style={{ marginTop: 12 }}>{customer.last_contacted_at ? new Date(customer.last_contacted_at).toLocaleString("en-ZA") : "—"}</div></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Bookings</h3>
          {bookings.length === 0 ? <p className="muted">No bookings yet.</p> : bookings.map((booking: any) => (
            <div key={booking.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <strong>{booking.services?.name ?? "Booking"}</strong>
              <div className="muted">{new Date(booking.starts_at).toLocaleString("en-ZA")} · {booking.status}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Conversations</h3>
          {conversations.length === 0 ? <p className="muted">No conversations linked yet.</p> : conversations.map((conversation: any) => (
            <div key={conversation.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <strong>{conversation.channel}</strong>
              <div className="muted">{conversation.status} · {new Date(conversation.updated_at).toLocaleString("en-ZA")}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
