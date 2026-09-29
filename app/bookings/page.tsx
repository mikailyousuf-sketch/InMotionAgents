import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function BookingsPage(){
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id,starts_at,ends_at,status,customers(full_name,phone),services(name),resources(name)")
    .eq("business_id",business.id)
    .order("starts_at",{ascending:true})
    .limit(200);

  const now=Date.now();
  const upcoming=(bookings??[]).filter((booking:any)=>new Date(booking.starts_at).getTime()>=now && !["cancelled","completed"].includes(booking.status));
  const past=(bookings??[]).filter((booking:any)=>!upcoming.some((u:any)=>u.id===booking.id)).slice(-30).reverse();

  function BookingRow({booking}:{booking:any}){
    const customer=Array.isArray(booking.customers)?booking.customers[0]:booking.customers;
    const service=Array.isArray(booking.services)?booking.services[0]:booking.services;
    const resource=Array.isArray(booking.resources)?booking.resources[0]:booking.resources;

    return (
      <div className="booking-row">
        <div className="booking-date">
          <strong>{new Date(booking.starts_at).toLocaleDateString("en-ZA",{day:"2-digit",month:"short"})}</strong>
          <span>{new Date(booking.starts_at).toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}</span>
        </div>
        <div className="booking-main">
          <strong>{customer?.full_name || "Customer"}</strong>
          <div className="muted">{service?.name || "Booking"}{resource?.name ? ` · ${resource.name}` : ""}</div>
        </div>
        <span className="integration-status">{booking.status}</span>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="home-header">
        <div>
          <div className="eyebrow">Bookings</div>
          <h1>Appointments</h1>
          <p className="muted">A clean view of what your receptionist has booked and what’s coming next.</p>
        </div>
      </div>

      <div className="bookings-layout">
        <section className="card home-panel">
          <div className="panel-heading">
            <div>
              <h2>Upcoming</h2>
              <p className="muted">{upcoming.length} appointment{upcoming.length===1?"":"s"}</p>
            </div>
          </div>
          {!upcoming.length
            ? <div className="empty-state"><strong>No upcoming bookings</strong><p className="muted">New appointments will appear here.</p></div>
            : upcoming.map((booking:any)=><BookingRow key={booking.id} booking={booking}/>)
          }
        </section>

        <section className="card home-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent history</h2>
              <p className="muted">Completed and past bookings.</p>
            </div>
          </div>
          {!past.length
            ? <div className="empty-state"><strong>No booking history yet</strong></div>
            : past.map((booking:any)=><BookingRow key={booking.id} booking={booking}/>)
          }
        </section>
      </div>
    </AppShell>
  );
}
