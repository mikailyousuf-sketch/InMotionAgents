"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

export default function NotificationRulesPage(){
  const [data,setData]=useState<any>({rules:[],role:""});
  const [form,setForm]=useState({
    eventType:"human_handover",
    recipientRole:"staff",
    channel:"in_app",
    delayMinutes:0
  });
  const [status,setStatus]=useState("");

  async function load(){
    const next=await fetch("/api/notification-rules").then(r=>r.json());
    setData(next);
  }

  useEffect(()=>{load();},[]);

  async function create(){
    setStatus("Creating rule...");
    const response=await fetch("/api/notification-rules",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(form)
    });
    const result=await response.json();
    setStatus(response.ok?"Rule created":result.error||"Failed");
    if(response.ok) load();
  }

  async function toggle(rule:any){
    await fetch("/api/notification-rules",{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({id:rule.id,active:!rule.active})
    });
    load();
  }

  async function process(){
    setStatus("Processing escalations...");
    const response=await fetch("/api/notifications/process",{method:"POST"});
    const result=await response.json();
    setStatus(response.ok?`Processed ${result.processed} escalation(s)`:result.error||"Failed");
  }

  const editable=["owner","admin"].includes(data.role);

  return (
    <AppShell>
      <h1>Notification routing</h1>
      <p className="muted">Choose who gets alerted, through which channel, and how quickly escalation happens.</p>

      {editable&&(
        <div className="card form-grid" style={{marginTop:24}}>
          <h3 style={{marginTop:0}}>New rule</h3>
          <select value={form.eventType} onChange={e=>setForm({...form,eventType:e.target.value})}>
            <option value="human_handover">Human handover</option>
            <option value="booking_failed">Booking failure</option>
            <option value="integration_failed">Integration failure</option>
            <option value="qualified_lead">Qualified lead</option>
          </select>
          <select value={form.recipientRole} onChange={e=>setForm({...form,recipientRole:e.target.value})}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
          <select value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})}>
            <option value="in_app">In-app</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
          <input type="number" min="0" value={form.delayMinutes} onChange={e=>setForm({...form,delayMinutes:Number(e.target.value)})} placeholder="Delay minutes"/>
          <button onClick={create}>Create rule</button>
        </div>
      )}

      <div className="card" style={{marginTop:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
          <h3 style={{margin:0}}>Rules</h3>
          <button onClick={process}>Process escalations</button>
        </div>

        {(data.rules??[]).length===0?<p className="muted">No notification rules yet.</p>:(data.rules??[]).map((r:any)=>(
          <div key={r.id} style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr 120px",gap:12,padding:"14px 0",borderBottom:"1px solid var(--line)",alignItems:"center"}}>
            <div><strong>{r.event_type}</strong></div>
            <div>{r.recipient_role||"Specific user"}</div>
            <div>{r.channel}</div>
            <div>{r.delay_minutes===0?"Immediate":`${r.delay_minutes} min`}</div>
            {editable&&<button className="link-button" onClick={()=>toggle(r)}>{r.active?"Pause":"Activate"}</button>}
          </div>
        ))}
      </div>

      {status&&<p className="muted" style={{marginTop:12}}>{status}</p>}
    </AppShell>
  );
}
