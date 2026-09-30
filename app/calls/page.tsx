import { ArrowDownLeft, ArrowUpRight, Phone, PhoneCall } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function CallsPage(){
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const { data: calls } = await supabase
    .from("calls")
    .select("id,customer_id,direction,from_number,to_number,status,handled_by,started_at,duration_seconds,summary,outcome,recording_url,customers(full_name,phone)")
    .eq("business_id",business.id)
    .order("started_at",{ascending:false})
    .limit(100);

  return (
    <AppShell>
      <div className="ambient-orb ambient-orb-one"/>
      <div className="ambient-orb ambient-orb-two"/>
      <div className="ambient-grid"/>

      <div className="section-page command-page">
        <header className="section-header">
          <div>
            <div className="eyebrow">Calls</div>
            <h1>Phone conversations</h1>
            <p>Call history, summaries and outcomes from the same receptionist.</p>
          </div>
          <div className="section-stat glass-chip">
            <PhoneCall size={15} strokeWidth={1.7}/>
            <span>SIP voice foundation ready</span>
          </div>
        </header>

        <section className="section-panel glass-surface">
          <div className="section-panel-head">
            <div>
              <h2>Recent calls</h2>
              <p>Live calls will appear here once the SIP trunk and OpenAI voice webhook are connected.</p>
            </div>
            <Phone size={17} strokeWidth={1.6}/>
          </div>

          {!calls?.length ? (
            <div className="section-empty">
              <span><Phone size={21} strokeWidth={1.5}/></span>
              <strong>No calls yet</strong>
              <p>The call workspace is ready. Connect the SIP trunk and OpenAI voice webhook to begin receiving calls.</p>
            </div>
          ) : calls.map((call:any)=>{
            const customer=Array.isArray(call.customers)?call.customers[0]:call.customers;
            const minutes=call.duration_seconds ? Math.floor(call.duration_seconds/60) : 0;
            const seconds=call.duration_seconds ? call.duration_seconds%60 : 0;
            const DirectionIcon=call.direction==="outbound"?ArrowUpRight:ArrowDownLeft;

            return (
              <div className="clean-call-row" key={call.id}>
                <div className="clean-call-icon"><DirectionIcon size={16} strokeWidth={1.7}/></div>
                <div className="clean-call-main">
                  <strong>{customer?.full_name || call.from_number || "Unknown caller"}</strong>
                  <span>
                    {call.handled_by ? `${call.handled_by.toUpperCase()} handled` : call.status}
                    {call.duration_seconds ? ` · ${minutes}m ${seconds}s` : ""}
                  </span>
                  {call.summary && <p>{call.summary}</p>}
                </div>
                <div className="clean-call-meta">
                  <span className="schedule-status">{call.status}</span>
                  <time>{new Date(call.started_at).toLocaleString("en-ZA")}</time>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
