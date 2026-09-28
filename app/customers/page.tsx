import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id,full_name,phone,email,lead_status,last_contacted_at,created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <AppShell>
      <h1>Customers</h1>
      <p className="muted">{business.name} · customer profiles</p>

      <div className="card" style={{ marginTop: 24, padding: 0, overflow: "hidden" }}>
        {(customers ?? []).length === 0 ? (
          <p className="muted" style={{ padding: 18 }}>No customers yet.</p>
        ) : (customers ?? []).map((customer) => (
          <Link
            href={`/customers/${customer.id}`}
            key={customer.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
              gap: 12,
              padding: 16,
              borderBottom: "1px solid var(--line)"
            }}
          >
            <div>
              <strong>{customer.full_name ?? "Unnamed customer"}</strong>
              <div className="muted" style={{ fontSize: 13 }}>{customer.phone ?? customer.email ?? "No contact details"}</div>
            </div>
            <div><span className="muted">Lead status</span><div>{customer.lead_status}</div></div>
            <div><span className="muted">Last contact</span><div>{customer.last_contacted_at ? new Date(customer.last_contacted_at).toLocaleString("en-ZA") : "—"}</div></div>
            <div><span className="muted">Created</span><div>{new Date(customer.created_at).toLocaleDateString("en-ZA")}</div></div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
