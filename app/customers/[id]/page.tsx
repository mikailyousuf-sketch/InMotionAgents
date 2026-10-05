import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Mail,
  MessageSquareText,
  Phone,
  UserRound
} from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

function relativeDate(value:string|null){
  if(!value) return "No contact yet";
  const diff=Math.max(0,Date.now()-new Date(value).getTime());
  const days=Math.floor(diff/86400000);
  if(days===0) return "Today";
  if(days===1) return "Yesterday";
  if(days<30) return `${days} days ago`;
  return new Date(value).toLocaleDateString("en-ZA",{day:"2-digit",month:"short",year:"numeric"});
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!customer) notFound();

  const [{ data: bookings }, { data: conversations }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,starts_at,ends_at,status,services(name),resources(name)")
      .eq("customer_id", id)
      .eq("business_id", business.id)
      .order("starts_at", { ascending: false }),
    supabase
      .from("conversations")
      .select("id,status,channel,started_at,updated_at")
      .eq("customer_id", id)
      .eq("business_id", business.id)
      .order("updated_at", { ascending: false })
  ]);

  const now=Date.now();
  const upcoming=(bookings??[])
    .filter((booking:any)=>new Date(booking.starts_at).getTime()>=now && !["cancelled","completed"].includes(booking.status))
    .sort((a:any,b:any)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime());

  const nextBooking=upcoming[0] ?? null;
  const latestConversation=(conversations??[])[0] ?? null;
  const phoneDigits=String(customer.phone||"").replace(/\D/g,"");

  return (
    <AppShell>
      <div className="section-page command-page customer-detail-page">
        <Link href="/customers" className="conversation-back">
          <ArrowLeft size={15}/> Customers
        </Link>

        <header className="customer-profile-head customer-profile-head-v2">
          <div className="customer-profile-avatar"><UserRound size={24} strokeWidth={1.6}/></div>

          <div className="customer-profile-identity">
            <div className="eyebrow">Customer</div>
            <h1>{customer.full_name ?? "Customer"}</h1>
            <div className="customer-contact-line">
              {customer.phone && <span><Phone size={12}/>{customer.phone}</span>}
              {customer.email && <span><Mail size={12}/>{customer.email}</span>}
            </div>
          </div>

          <div className="customer-profile-actions">
            {customer.phone && (
              <a className="customer-profile-action primary" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer">
                <MessageSquareText size={14}/> WhatsApp
              </a>
            )}
            {latestConversation && (
              <Link className="customer-profile-action" href={`/conversations/${latestConversation.id}`}>
                Open conversation <ArrowRight size={14}/>
              </Link>
            )}
          </div>
        </header>

        <section className="customer-profile-summary">
          <div>
            <span>Lead status</span>
            <strong className="customer-lead-pill">{customer.lead_status || "new"}</strong>
          </div>
          <div>
            <span>Last contact</span>
            <strong>{relativeDate(customer.last_contacted_at)}</strong>
          </div>
          <div>
            <span>Bookings</span>
            <strong>{bookings?.length ?? 0}</strong>
          </div>
          <div>
            <span>Conversations</span>
            <strong>{conversations?.length ?? 0}</strong>
          </div>
        </section>

        <div className="customer-profile-grid customer-profile-grid-v2">
          <section className="section-panel glass-surface customer-next-panel">
            <div className="section-panel-head">
              <div>
                <h2>Next booking</h2>
                <p>The next thing on this customer’s schedule.</p>
              </div>
              <CalendarDays size={17}/>
            </div>

            {!nextBooking ? (
              <div className="profile-empty">
                <strong>No upcoming booking</strong>
                <span>Future appointments will appear here.</span>
              </div>
            ) : (
              <Link href={`/bookings/${nextBooking.id}`} className="customer-next-booking">
                <div className="customer-next-date">
                  <strong>{new Date(nextBooking.starts_at).toLocaleDateString("en-ZA",{day:"2-digit"})}</strong>
                  <span>{new Date(nextBooking.starts_at).toLocaleDateString("en-ZA",{month:"short"})}</span>
                </div>
                <div>
                  <strong>{nextBooking.services?.name ?? "Booking"}</strong>
                  <span>
                    {new Date(nextBooking.starts_at).toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}
                    {nextBooking.resources?.name ? ` · ${nextBooking.resources.name}` : ""}
                  </span>
                </div>
                <span className="schedule-status">{nextBooking.status}</span>
                <ArrowRight size={15}/>
              </Link>
            )}
          </section>

          <section className="section-panel glass-surface">
            <div className="section-panel-head">
              <div>
                <h2>Recent conversations</h2>
                <p>Jump straight back into the relationship.</p>
              </div>
              <MessageSquareText size={17}/>
            </div>

            {(conversations ?? []).length===0 ? (
              <div className="profile-empty">No conversations linked yet.</div>
            ) : (
              (conversations ?? []).slice(0,5).map((conversation:any)=>(
                <Link href={`/conversations/${conversation.id}`} className="profile-list-row" key={conversation.id}>
                  <div>
                    <strong>{conversation.channel || "Conversation"}</strong>
                    <span>{relativeDate(conversation.updated_at)}</span>
                  </div>
                  <span className="schedule-status">{conversation.status}</span>
                </Link>
              ))
            )}
          </section>
        </div>

        {(bookings ?? []).length > 0 && (
          <section className="section-panel glass-surface customer-history-panel">
            <div className="section-panel-head">
              <div>
                <h2>Booking history</h2>
                <p>Past and future appointments for this customer.</p>
              </div>
            </div>

            {(bookings ?? []).slice(0,10).map((booking:any)=>(
              <Link href={`/bookings/${booking.id}`} className="profile-list-row" key={booking.id}>
                <div>
                  <strong>{booking.services?.name ?? "Booking"}</strong>
                  <span>{new Date(booking.starts_at).toLocaleString("en-ZA")}</span>
                </div>
                <span className="schedule-status">{booking.status}</span>
              </Link>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
