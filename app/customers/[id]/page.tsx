import Link from "next/link";
import { ArrowLeft, CalendarDays, MessageSquareText, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (!customer) notFound();

  const [{ data: bookings }, { data: conversations }] = await Promise.all([
    supabase.from("bookings").select("id,starts_at,ends_at,status,services(name),resources(name)").eq("customer_id", id).eq("business_id", business.id).order("starts_at", { ascending: false }),
    supabase.from("conversations").select("id,status,channel,started_at,updated_at").eq("customer_id", id).eq("business_id", business.id).order("updated_at", { ascending: false })
  ]);

  return (
    <AppShell>
      <div className="ambient-orb ambient-orb-one"/>
      <div className="ambient-orb ambient-orb-two"/>
      <div className="ambient-grid"/>

      <div className="section-page command-page">
        <Link href="/customers" className="conversation-back"><ArrowLeft size={15}/> Customers</Link>

        <header className="customer-profile-head">
          <div className="customer-profile-avatar"><UserRound size={24} strokeWidth={1.6}/></div>
          <div>
            <div className="eyebrow">Customer profile</div>
            <h1>{customer.full_name ?? "Customer"}</h1>
            <p>{customer.phone ?? customer.email ?? "No contact details"}</p>
          </div>
        </header>

        <section className="customer-profile-stats">
          <div className="glass-surface"><span>Lead status</span><strong>{customer.lead_status}</strong></div>
          <div className="glass-surface"><span>Bookings</span><strong>{bookings?.length ?? 0}</strong></div>
          <div className="glass-surface"><span>Conversations</span><strong>{conversations?.length ?? 0}</strong></div>
          <div className="glass-surface"><span>Last contacted</span><strong className="profile-date">{customer.last_contacted_at ? new Date(customer.last_contacted_at).toLocaleDateString("en-ZA") : "—"}</strong></div>
        </section>

        <div className="customer-profile-grid">
          <section className="section-panel glass-surface">
            <div className="section-panel-head">
              <div><h2>Bookings</h2><p>Appointment history for this customer.</p></div>
              <CalendarDays size={17}/>
            </div>
            {(bookings ?? []).length===0 ? <div className="profile-empty">No bookings yet.</div> : (bookings ?? []).map((booking:any)=>(
              <div className="profile-list-row" key={booking.id}>
                <div>
                  <strong>{booking.services?.name ?? "Booking"}</strong>
                  <span>{new Date(booking.starts_at).toLocaleString("en-ZA")}</span>
                </div>
                <span className="schedule-status">{booking.status}</span>
              </div>
            ))}
          </section>

          <section className="section-panel glass-surface">
            <div className="section-panel-head">
              <div><h2>Conversations</h2><p>Linked customer conversations.</p></div>
              <MessageSquareText size={17}/>
            </div>
            {(conversations ?? []).length===0 ? <div className="profile-empty">No conversations linked yet.</div> : (conversations ?? []).map((conversation:any)=>(
              <Link href={`/conversations/${conversation.id}`} className="profile-list-row" key={conversation.id}>
                <div>
                  <strong>{conversation.channel}</strong>
                  <span>{new Date(conversation.updated_at).toLocaleString("en-ZA")}</span>
                </div>
                <span className="schedule-status">{conversation.status}</span>
              </Link>
            ))}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
