"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";

export default function AutomationsPage(){
  const [data,setData]=useState<any>({templates:[],automations:[],jobs:[],role:""});
  const [status,setStatus]=useState("");
  const [template,setTemplate]=useState({name:"Booking confirmation",body:"Hi {{customer_name}}, your {{service_name}} booking at {{business_name}} is confirmed for {{booking_time}}.",channel:"whatsapp"});
  const [automation,setAutomation]=useState({name:"Booking confirmation",triggerType:"booking_created",templateId:"",minutesBefore:1440,delayMinutes:1440});

  async function load(){
    const response=await fetch("/api/automations");
    const next=await response.json();
    setData(next);
    if(!automation.templateId && next.templates?.[0]?.id){
      setAutomation(current=>({...current,templateId:next.templates[0].id}));
    }
  }

  useEffect(()=>{load();},[]);

  async function createTemplate(){
    setStatus("Creating template...");
    const response=await fetch("/api/automations",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({kind:"template",...template})
    });
    const result=await response.json();
    setStatus(response.ok?"Template created":result.error||"Failed");
    if(response.ok) load();
  }

  async function createAutomation(){
    setStatus("Creating automation...");
    const response=await fetch("/api/automations",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({kind:"automation",...automation,channel:"whatsapp"})
    });
    const result=await response.json();
    setStatus(response.ok?"Automation created":result.error||"Failed");
    if(response.ok) load();
  }

  async function toggle(id:string,current:string){
    const next=current==="active"?"paused":"active";
    await fetch("/api/automations",{
      method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({kind:"automation",id,status:next})
    });
    load();
  }

  async function processJobs(){
    setStatus("Processing due jobs...");
    const response=await fetch("/api/automations/process",{method:"POST"});
    const result=await response.json();
    setStatus(response.ok?`Processed ${result.processed} due job(s)`:result.error||"Failed");
    load();
  }

  const editable=["owner","admin"].includes(data.role);
  const counts=useMemo(()=>{
    const out:any={pending:0,sent:0,failed:0,skipped:0};
    for(const job of data.jobs??[]) out[job.status]=(out[job.status]??0)+1;
    return out;
  },[data.jobs]);

  return (
    <AppShell>
      <h1>Automations</h1>
      <p className="muted">Outbound confirmations, reminders, lead follow-ups and scheduled WhatsApp jobs.</p>

      <div className="grid cols-4" style={{marginTop:24}}>
        <div className="card"><div className="muted">Pending</div><div className="kpi">{counts.pending||0}</div></div>
        <div className="card"><div className="muted">Sent</div><div className="kpi">{counts.sent||0}</div></div>
        <div className="card"><div className="muted">Failed</div><div className="kpi">{counts.failed||0}</div></div>
        <div className="card"><div className="muted">Skipped</div><div className="kpi">{counts.skipped||0}</div></div>
      </div>

      {editable&&(
        <div className="grid" style={{gridTemplateColumns:"1fr 1fr",marginTop:16}}>
          <div className="card form-grid">
            <h3 style={{marginTop:0}}>New message template</h3>
            <input value={template.name} onChange={e=>setTemplate({...template,name:e.target.value})} placeholder="Template name"/>
            <textarea value={template.body} onChange={e=>setTemplate({...template,body:e.target.value})} placeholder="Message body"/>
            <p className="muted" style={{fontSize:12}}>
              Available variables: {"{{customer_name}}"}, {"{{business_name}}"}, {"{{service_name}}"}, {"{{booking_time}}"}
            </p>
            <button onClick={createTemplate}>Create template</button>
          </div>

          <div className="card form-grid">
            <h3 style={{marginTop:0}}>New automation</h3>
            <input value={automation.name} onChange={e=>setAutomation({...automation,name:e.target.value})} placeholder="Automation name"/>
            <select value={automation.triggerType} onChange={e=>setAutomation({...automation,triggerType:e.target.value})}>
              <option value="booking_created">Booking confirmation</option>
              <option value="booking_reminder">Booking reminder</option>
              <option value="lead_followup">Lead follow-up</option>
              <option value="manual">Manual</option>
            </select>
            <select value={automation.templateId} onChange={e=>setAutomation({...automation,templateId:e.target.value})}>
              <option value="">Choose template</option>
              {(data.templates??[]).map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            {automation.triggerType==="booking_reminder"&&(
              <input type="number" value={automation.minutesBefore} onChange={e=>setAutomation({...automation,minutesBefore:Number(e.target.value)})} placeholder="Minutes before"/>
            )}

            {automation.triggerType==="lead_followup"&&(
              <input type="number" value={automation.delayMinutes} onChange={e=>setAutomation({...automation,delayMinutes:Number(e.target.value)})} placeholder="Delay minutes"/>
            )}

            <button disabled={!automation.templateId} onClick={createAutomation}>Create automation</button>
          </div>
        </div>
      )}

      <div className="card" style={{marginTop:16}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
          <div>
            <h3 style={{margin:"0 0 4px"}}>Automations</h3>
            <p className="muted" style={{margin:0}}>Active rules create outbound jobs when their trigger occurs.</p>
          </div>
          <button onClick={processJobs}>Process due jobs</button>
        </div>

        {(data.automations??[]).length===0?<p className="muted">No automations yet.</p>:(data.automations??[]).map((a:any)=>(
          <div key={a.id} style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 120px",gap:12,padding:"14px 0",borderBottom:"1px solid var(--line)",alignItems:"center"}}>
            <div><strong>{a.name}</strong><div className="muted" style={{fontSize:12}}>{a.message_templates?.name||"No template"}</div></div>
            <div>{a.trigger_type}</div>
            <div>{a.status}</div>
            {editable&&<button className="link-button" onClick={()=>toggle(a.id,a.status)}>{a.status==="active"?"Pause":"Activate"}</button>}
          </div>
        ))}
      </div>

      <div className="card" style={{marginTop:16}}>
        <h3 style={{marginTop:0}}>Outbound queue</h3>
        {(data.jobs??[]).length===0?<p className="muted">No outbound jobs yet.</p>:(data.jobs??[]).map((job:any)=>(
          <div key={job.id} style={{padding:"12px 0",borderBottom:"1px solid var(--line)"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12}}>
              <strong>{job.status}</strong>
              <span className="muted">{new Date(job.scheduled_for).toLocaleString("en-ZA")}</span>
            </div>
            <div style={{marginTop:6}}>{job.rendered_body}</div>
            <div className="muted" style={{fontSize:12,marginTop:4}}>{job.destination||"No destination"} {job.last_error?`· ${job.last_error}`:""}</div>
          </div>
        ))}
      </div>

      {status&&<p className="muted" style={{marginTop:14}}>{status}</p>}
    </AppShell>
  );
}
