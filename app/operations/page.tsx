"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function OperationsPage() {
  const [data,setData]=useState<any>({
    events:[],failedJobs:[],integrations:[],handovers:[],audits:[],unreadConversations:0
  });

  async function load(){
    const response=await fetch("/api/operations");
    const next=await response.json();
    setData(next);
  }

  useEffect(()=>{
    load();
    const id=setInterval(load,15000);
    return ()=>clearInterval(id);
  },[]);

  const warningCount=useMemo(
    ()=>data.events.filter((event:any)=>["warning","error"].includes(event.severity)).length,
    [data.events]
  );

  return (
    <AppShell>
      <h1>Operations</h1>
      <p className="muted">Receptionist health, handovers, automation failures and recent system activity.</p>

      <div className="grid cols-4" style={{marginTop:24}}>
        <div className="card">
          <div className="muted">Needs human</div>
          <div className="kpi">{data.handovers.length}</div>
        </div>
        <div className="card">
          <div className="muted">Unread chats</div>
          <div className="kpi">{data.unreadConversations}</div>
        </div>
        <div className="card">
          <div className="muted">Failed outbound</div>
          <div className="kpi">{data.failedJobs.length}</div>
        </div>
        <div className="card">
          <div className="muted">AI warnings</div>
          <div className="kpi">{warningCount}</div>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns:"1fr 1fr",marginTop:16}}>
        <div className="card">
          <h3 style={{marginTop:0}}>Human attention</h3>
          {data.handovers.length===0
            ? <p className="muted">No conversations waiting for staff.</p>
            : data.handovers.map((item:any)=>{
                const customer=Array.isArray(item.customers)?item.customers[0]:item.customers;
                return (
                  <Link key={item.id} href={`/conversations/${item.id}`} className="ops-row">
                    <div>
                      <strong>{customer?.full_name || "Customer"}</strong>
                      <div className="muted" style={{fontSize:12}}>{customer?.phone || "Human handover"}</div>
                    </div>
                    <span className="attention-pill human">Needs attention</span>
                  </Link>
                );
              })
          }
        </div>

        <div className="card">
          <h3 style={{marginTop:0}}>Integrations</h3>
          {data.integrations.length===0
            ? <p className="muted">No integrations configured.</p>
            : data.integrations.map((integration:any)=>(
                <div className="ops-row" key={integration.provider}>
                  <strong>{integration.provider}</strong>
                  <span className="integration-status">{integration.status}</span>
                </div>
              ))
          }
        </div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <h3 style={{marginTop:0}}>Agent events</h3>
        {data.events.length===0
          ? <p className="muted">No warnings or system events yet.</p>
          : data.events.map((event:any)=>(
              <div className="ops-row" key={event.id}>
                <div>
                  <strong>{event.event_type}</strong>
                  <div>{event.message}</div>
                  <div className="muted" style={{fontSize:12}}>
                    {new Date(event.created_at).toLocaleString("en-ZA")}
                  </div>
                </div>
                <span className={`severity-pill ${event.severity}`}>{event.severity}</span>
              </div>
            ))
        }
      </div>

      <div className="grid" style={{gridTemplateColumns:"1fr 1fr",marginTop:16}}>
        <div className="card">
          <h3 style={{marginTop:0}}>Failed outbound jobs</h3>
          {data.failedJobs.length===0
            ? <p className="muted">No failed outbound jobs.</p>
            : data.failedJobs.map((job:any)=>(
                <div className="ops-row" key={job.id}>
                  <div>
                    <strong>Failed message</strong>
                    <div className="muted">{job.last_error || "Unknown error"}</div>
                  </div>
                </div>
              ))
          }
        </div>

        <div className="card">
          <h3 style={{marginTop:0}}>Recent audit activity</h3>
          {data.audits.length===0
            ? <p className="muted">No audit activity yet.</p>
            : data.audits.map((log:any)=>(
                <div className="ops-row" key={log.id}>
                  <div>
                    <strong>{log.action}</strong>
                    <div className="muted" style={{fontSize:12}}>
                      {new Date(log.created_at).toLocaleString("en-ZA")}
                    </div>
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </AppShell>
  );
}
