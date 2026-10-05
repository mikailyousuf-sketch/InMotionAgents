import { CalendarDays, Clock3, History, UserRound } from "lucide-react";
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
  const startOfToday=new Date();
  startOfToday.setHours(0,0,0,0);
  const startOfTomorrow=new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate()+1);

  const upcoming=(bookings??[]).filter((booking:any)=>new Date(booking.starts_at).getTime()>=now && !["cancelled","completed"].includes(booking.status));
  const today=upcoming.filter((booking:any)=>{
    const time=new Date(booking.starts_at).getTime();
    return time>=startOfToday.getTime() && time<startOfTomorrow.getTime();
  });
  const later=upcoming.filter((booking:any)=>!today.some((item:any)=>item.id===booking.id));
  const past=(bookings??[]).filter((booking:any)=>!upcoming.some((u:any)=>u.id===booking.id)).slice(-30).reverse();

  function BookingRow({booking}:{booking:any}){
    const customer=Array.isArray(booking.customers)?booking.customers[0]:booking.customers;
    const service=Array.isArray(booking.services)?booking.services[0]:booking.services;
    const resource=Array.isArray(booking.resources)?booking.resources[0]:booking.resources;

    return (
      <div className="schedule-row">
        <div className="schedule-date">
          <strong>{new Date(booking.starts_at).toLocaleDateString("en-ZA",{day:"2-digit"})}</strong>
          <span>{new Date(booking.starts_at).toLocaleDateString("en-ZA",{month:"short"})}</span>
        </div>

        <div className="schedule-time">
          <Clock3 size={14} strokeWidth={1.7}/>
          <span>{new Date(booking.starts_at).toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}</span>
        </div>

        <div className="schedule-main">
          <strong>{customer?.full_name || "Customer"}</strong>
          <span>{service?.name || "Booking"}{resource?.name ? ` · ${resource.name}` : ""}</span>
        </div>

        <div className="schedule-status">{booking.status}</div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="ambient-orb ambient-orb-one"/>
      <div className="ambient-orb ambient-orb-two"/>
      <div className="ambient-grid"/>

      <div className="section-page command-page">
        <header className="section-header">
          <div>
            <div className="eyebrow">Bookings</div>
            <h1>Appointments</h1>
            <p>{business.name} · everything your receptionist has booked, in one clean schedule.</p>
          </div>

          <div className="section-stat glass-chip">
            <CalendarDays size={15} strokeWidth={1.7}/>
            <span><strong>{today.length}</strong> today</span>
            <i/>
            <span><strong>{upcoming.length}</strong> upcoming</span>
          </div>
        </header>

        <div className="bookings-clean-layout">
          <section className="section-panel glass-surface">
            <div className="section-panel-head">
              <div>
                <h2>Today</h2>
                <p>{today.length ? "Your appointments for today." : "Nothing scheduled for today."}</p>
              </div>
              <Clock3 size={17} strokeWidth={1.6}/>
            </div>

            {!today.length ? (
              <div className="section-empty compact">
                <span><Clock3 size={20} strokeWidth={1.5}/></span>
                <strong>No appointments today</strong>
                <p>Your next bookings are shown below.</p>
              </div>
            ) : (
              <div className="schedule-list">
                {today.map((booking:any)=><BookingRow key={booking.id} booking={booking}/>)}
              </div>
            )}

            {later.length > 0 && (
              <>
                <div className="schedule-subhead">Coming up next</div>
                <div className="schedule-list">
                  {later.slice(0,8).map((booking:any)=><BookingRow key={booking.id} booking={booking}/>)}
                </div>
              </>
            )}
          </section>

          <section className="section-panel glass-surface">
            <div className="section-panel-head">
              <div>
                <h2>Recent history</h2>
                <p>Past and completed appointments.</p>
              </div>
              <History size={17} strokeWidth={1.6}/>
            </div>

            {!past.length ? (
              <div className="section-empty compact">
                <span><UserRound size={20} strokeWidth={1.5}/></span>
                <strong>No booking history yet</strong>
              </div>
            ) : (
              <div className="schedule-list">
                {past.map((booking:any)=><BookingRow key={booking.id} booking={booking}/>)}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
