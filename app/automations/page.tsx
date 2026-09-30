"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  Pause,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  TriangleAlert
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

export default function AutomationsPage(){
  const [data,setData]=useState<any>({templates:[],automations:[],jobs:[],role:""});
  const [status,setStatus]=useState("");
  const [template,setTemplate]=useState({
    name:"Booking confirmation",
    body:"Hi {{customer_name}}, your {{service_name}} booking at {{business_name}} is confirmed for {{booking_time}}.",
    channel:"whatsapp"
  });
  const [automation,setAutomation]=useState({
    name:"Booking confirmation",
    triggerType:"booking_created",
    templateId:"",
    minutesBefore:1440,
    delayMinutes:1440
  });

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

  const statCards=[
    {label:"Pending",value:counts.pending||0,icon:Clock3,tone:"pending"},
    {label:"Sent",value:counts.sent||0,icon:CheckCircle2,tone:"sent"},
    {label:"Failed",value:counts.failed||0,icon:TriangleAlert,tone:"failed"},
    {label:"Skipped",value:counts.skipped||0,icon:Activity,tone:"skipped"}
  ];

  return (
    <AppShell>
      <div className="ambient-orb ambient-orb-one"/>
      <div className="ambient-orb ambient-orb-two"/>
      <div className="ambient-grid"/>

      <div className="automation-page command-page">
        <header className="section-header">
          <div>
            <div className="eyebrow">Automations</div>
            <h1>Outbound workflows</h1>
            <p>Confirmations, reminders, lead follow-ups and scheduled customer messages.</p>
          </div>
          <button className="section-action-button automation-process-button" onClick={processJobs}>
            <RefreshCw size={14}/> Process due jobs
          </button>
        </header>

        <section className="automation-stats">
          {statCards.map(item=>{
            const Icon=item.icon;
            return (
              <div className="automation-stat glass-surface" key={item.label}>
                <span className={`automation-stat-icon ${item.tone}`}><Icon size={17}/></span>
                <div><small>{item.label}</small><strong>{item.value}</strong></div>
              </div>
            );
          })}
        </section>

        {editable&&(
          <div className="automation-create-grid">
            <section className="automation-card glass-surface">
              <div className="automation-card-head">
                <span><MessageSquareText size={16}/></span>
                <div>
                  <h2>Message template</h2>
                  <p>Create reusable WhatsApp message copy.</p>
                </div>
              </div>

              <div className="automation-form">
                <input value={template.name} onChange={e=>setTemplate({...template,name:e.target.value})} placeholder="Template name"/>
                <textarea value={template.body} onChange={e=>setTemplate({...template,body:e.target.value})} placeholder="Message body"/>
                <div className="automation-helper">
                  Available: {"{{customer_name}}"}, {"{{business_name}}"}, {"{{service_name}}"}, {"{{booking_time}}"}
                </div>
                <button className="automation-primary-button" onClick={createTemplate}>
                  <Sparkles size={14}/> Create template
                </button>
              </div>
            </section>

            <section className="automation-card glass-surface">
              <div className="automation-card-head">
                <span><RefreshCw size={16}/></span>
                <div>
                  <h2>New automation</h2>
                  <p>Choose what should trigger the message.</p>
                </div>
              </div>

              <div className="automation-form">
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

                <button className="automation-primary-button" disabled={!automation.templateId} onClick={createAutomation}>
                  <Sparkles size={14}/> Create automation
                </button>
              </div>
            </section>
          </div>
        )}

        <section className="automation-card automation-list-card glass-surface">
          <div className="automation-card-head">
            <span><Activity size={16}/></span>
            <div>
              <h2>Active workflows</h2>
              <p>Rules that create outbound jobs when their trigger occurs.</p>
            </div>
          </div>

          {(data.automations??[]).length===0 ? (
            <div className="automation-empty">No automations yet.</div>
          ) : (
            <div className="automation-list">
              {(data.automations??[]).map((item:any)=>(
                <div className="automation-row" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.message_templates?.name||"No template"}</span>
                  </div>
                  <div className="automation-trigger">{String(item.trigger_type).replaceAll("_"," ")}</div>
                  <span className={`automation-status-chip ${item.status}`}>
                    <i/>{item.status}
                  </span>
                  {editable&&(
                    <button className="automation-secondary-button" onClick={()=>toggle(item.id,item.status)}>
                      {item.status==="active"?<Pause size={13}/>:<Play size={13}/>}
                      {item.status==="active"?"Pause":"Activate"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="automation-card automation-list-card glass-surface">
          <div className="automation-card-head">
            <span><Send size={16}/></span>
            <div>
              <h2>Outbound queue</h2>
              <p>Recent and scheduled delivery jobs.</p>
            </div>
          </div>

          {(data.jobs??[]).length===0 ? (
            <div className="automation-empty">No outbound jobs yet.</div>
          ) : (
            <div className="automation-job-list">
              {(data.jobs??[]).map((job:any)=>(
                <div className="automation-job" key={job.id}>
                  <div className="automation-job-top">
                    <span className={`automation-status-chip ${job.status}`}><i/>{job.status}</span>
                    <time>{new Date(job.scheduled_for).toLocaleString("en-ZA")}</time>
                  </div>
                  <p>{job.rendered_body}</p>
                  <span>{job.destination||"No destination"} {job.last_error?`· ${job.last_error}`:""}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {status&&<div className="receptionist-feedback">{status}</div>}
      </div>
    </AppShell>
  );
}
