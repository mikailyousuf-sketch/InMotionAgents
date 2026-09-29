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
      <div className="home-header">
        <div>
          <div className="eyebrow">Calls</div>
          <h1>Phone conversations</h1>
          <p className="muted">Call history, AI summaries and outcomes stay separate from your WhatsApp inbox.</p>
        </div>
        <div className="receptionist-health setup">
          <span className="health-dot" />
          Voice connection coming next
        </div>
      </div>

      <div className="card home-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent calls</h2>
            <p className="muted">Once voice is connected, every call will appear here automatically.</p>
          </div>
        </div>

        {!calls?.length ? (
          <div className="empty-state">
            <div className="empty-icon">☎</div>
            <strong>No calls yet</strong>
            <p className="muted">We’ve prepared the call workspace. Telephony provider connection is part of the production integration phase.</p>
          </div>
        ) : calls.map((call:any)=>{
          const customer=Array.isArray(call.customers)?call.customers[0]:call.customers;
          const minutes=call.duration_seconds ? Math.floor(call.duration_seconds/60) : 0;
          const seconds=call.duration_seconds ? call.duration_seconds%60 : 0;

          return (
            <div className="call-row" key={call.id}>
              <div className="call-icon">{call.direction==="outbound"?"↗":"↙"}</div>
              <div className="call-main">
                <strong>{customer?.full_name || call.from_number || "Unknown caller"}</strong>
                <div className="muted">
                  {call.handled_by ? `${call.handled_by.toUpperCase()} handled` : call.status}
                  {call.duration_seconds ? ` · ${minutes}m ${seconds}s` : ""}
                </div>
                {call.summary && <p>{call.summary}</p>}
              </div>
              <div className="call-meta">
                <span className={`attention-pill ${call.status==="completed"?"ai":"human"}`}>{call.status}</span>
                <span className="muted">{new Date(call.started_at).toLocaleString("en-ZA")}</span>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
