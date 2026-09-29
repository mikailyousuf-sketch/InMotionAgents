"use client";

import {useEffect,useState} from "react";
import {AppShell} from "@/components/AppShell";

export default function CustomWorkPage(){
  const [requests,setRequests]=useState<any[]>([]);
  const [form,setForm]=useState({
    requestType:"custom_automation",
    title:"",
    description:"",
    currentSystems:"",
    desiredOutcome:""
  });
  const [status,setStatus]=useState("");

  async function load(){
    const data=await fetch("/api/custom-work").then(r=>r.json());
    setRequests(data.requests??[]);
  }

  useEffect(()=>{load();},[]);

  async function submit(){
    setStatus("Sending request…");
    const response=await fetch("/api/custom-work",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(form)
    });
    const result=await response.json();
    setStatus(response.ok?"Request received. We'll assess the scope and price it separately.":result.error||"Could not send request");
    if(response.ok){
      setForm({requestType:"custom_automation",title:"",description:"",currentSystems:"",desiredOutcome:""});
      load();
    }
  }

  return (
    <AppShell>
      <div className="home-header">
        <div>
          <div className="eyebrow">InMotion Custom</div>
          <h1>Need something more?</h1>
          <p className="muted">Custom AI work, automations, integrations, websites and internal systems can be scoped separately.</p>
        </div>
      </div>

      <div className="improve-grid">
        <section className="card">
          <h2 style={{marginTop:0}}>Request a custom build</h2>
          <p className="muted">Tell us the outcome you want. We'll assess the work and quote it separately.</p>

          <div className="form-grid" style={{marginTop:20}}>
            <select value={form.requestType} onChange={e=>setForm({...form,requestType:e.target.value})}>
              <option value="custom_automation">Custom automation</option>
              <option value="integration">Custom integration</option>
              <option value="website">Website</option>
              <option value="internal_system">Internal system</option>
              <option value="ai_workflow">Custom AI workflow</option>
              <option value="other">Other</option>
            </select>
            <input placeholder="What do you need?" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
            <textarea placeholder="Describe the problem or workflow…" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
            <textarea placeholder="What systems do you use today? (optional)" value={form.currentSystems} onChange={e=>setForm({...form,currentSystems:e.target.value})}/>
            <textarea placeholder="What should the finished solution achieve? (optional)" value={form.desiredOutcome} onChange={e=>setForm({...form,desiredOutcome:e.target.value})}/>
            <button onClick={submit} disabled={!form.title.trim()||!form.description.trim()}>Request assessment</button>
          </div>

          {status&&<p className="muted" style={{marginTop:12}}>{status}</p>}
        </section>

        <aside className="home-side">
          <div className="card setup-card">
            <div className="setup-icon">↗</div>
            <h3>Price on assessment</h3>
            <p className="muted">Custom work stays separate from the core receptionist so your everyday workspace remains simple.</p>
          </div>

          <div className="card">
            <h3 style={{marginTop:0}}>Previous requests</h3>
            {requests.length===0
              ? <p className="muted">No custom requests yet.</p>
              : requests.map((r:any)=>(
                <div className="ops-row" key={r.id}>
                  <div>
                    <strong>{r.title}</strong>
                    <div className="muted" style={{fontSize:12}}>{r.request_type.replaceAll("_"," ")}</div>
                  </div>
                  <span className="integration-status">{r.status}</span>
                </div>
              ))
            }
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
