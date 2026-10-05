import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MessageSquareText,
  Phone,
  UserRound
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";
import BookingActions from "./BookingActions";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({ params }:{ params:Promise<{id:string}> }) {
  const { id } = await params;
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,starts_at,ends_at,status,notes,customer_id,customers(id,full_name,phone,email),services(name),resources(name)")
    .eq("business_id",business.id)
    .eq("id",id)
    .maybeSingle();

  if(!booking) notFound();

  const customer:any = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers;
  const service:any = Array.isArray(booking.services) ? booking.services[0] : booking.services;
  const resource:any = Array.isArray(booking.resources) ? booking.resources[0] : booking.resources;

  const { data: conversation } = customer?.id
    ? await supabase
        .from("conversations")
        .select("id,updated_at,status")
        .eq("business_id",business.id)
        .eq("customer_id",customer.id)
        .order("updated_at",{ascending:false})
        .limit(1)
        .maybeSingle()
    : { data:null as any };

  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);
  const phoneDigits = String(customer?.phone||"").replace(/\D/g,"");

  return (
    <AppShell>
      <div className="section-page command-page booking-detail-page">
        <Link href="/bookings" className="conversation-back">
          <ArrowLeft size={15}/> Bookings
        </Link>

        <header className="booking-detail-head">
          <div>
            <div className="eyebrow">Booking</div>
            <h1>{service?.name || "Appointment"}</h1>
            <p>{customer?.full_name || "Customer"} · {business.name}</p>
          </div>
          <span className="schedule-status booking-detail-status">{booking.status}</span>
        </header>

        <section className="booking-detail-hero glass-surface">
          <div className="booking-detail-time">
            <span className="booking-detail-icon"><CalendarDays size={18}/></span>
            <div>
              <span>Date</span>
              <strong>{start.toLocaleDateString("en-ZA",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</strong>
            </div>
          </div>

          <div className="booking-detail-time">
            <span className="booking-detail-icon"><Clock3 size={18}/></span>
            <div>
              <span>Time</span>
              <strong>
                {start.toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}
                {" – "}
                {end.toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}
              </strong>
            </div>
          </div>

          <div className="booking-detail-time">
            <span className="booking-detail-icon"><UserRound size={18}/></span>
            <div>
              <span>Assigned to</span>
              <strong>{resource?.name || "Unassigned"}</strong>
            </div>
          </div>
        </section>

        <div className="booking-detail-grid">
          <section className="section-panel glass-surface">
            <div className="section-panel-head">
              <div>
                <h2>Customer</h2>
                <p>Who this appointment belongs to.</p>
              </div>
            </div>

            <div className="booking-customer-card">
              <div className="customer-avatar"><UserRound size={18}/></div>
              <div>
                <strong>{customer?.full_name || "Customer"}</strong>
                <span>{customer?.phone || customer?.email || "No contact details"}</span>
              </div>
            </div>

            <div className="booking-customer-actions">
              {customer?.id && (
                <Link href={`/customers/${customer.id}`} className="customer-profile-action">
                  View customer
                </Link>
              )}
              {conversation?.id && (
                <Link href={`/conversations/${conversation.id}`} className="customer-profile-action">
                  <MessageSquareText size={14}/> Open conversation
                </Link>
              )}
              {customer?.phone && (
                <a
                  href={`https://wa.me/${phoneDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="customer-profile-action"
                >
                  <Phone size={14}/> WhatsApp
                </a>
              )}
            </div>
          </section>

          <section className="section-panel glass-surface">
            <div className="section-panel-head">
              <div>
                <h2>Booking details</h2>
                <p>Operational information for staff.</p>
              </div>
            </div>

            <div className="booking-detail-list">
              <div><span>Service</span><strong>{service?.name || "Booking"}</strong></div>
              <div><span>Resource</span><strong>{resource?.name || "Unassigned"}</strong></div>
              <div><span>Status</span><strong>{booking.status}</strong></div>
              <div><span>Notes</span><strong>{booking.notes || "No notes"}</strong></div>
            </div>
          </section>
        </div>

        <BookingActions bookingId={booking.id} status={booking.status}/>
      </div>
    </AppShell>
  );
}
