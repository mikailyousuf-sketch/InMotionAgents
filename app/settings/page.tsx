"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

type Service={id?:string;name:string;description:string;durationMinutes:number;price:number|string;currency:string};
type Resource={id?:string;name:string;type:string};
type Hour={id?:string;dayOfWeek:number;label:string;opensAt:string;closesAt:string;closed:boolean};
type Policy={id?:string;title:string;content:string;type:string};
type Faq={id?:string;question:string;answer:string};

const dayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export default function SettingsPage() {
  const [businessId,setBusinessId]=useState("");
  const [role,setRole]=useState("");
  const [status,setStatus]=useState("");
  const [business,setBusiness]=useState<any>(null);
  const [services,setServices]=useState<Service[]>([]);
  const [resources,setResources]=useState<Resource[]>([]);
  const [hours,setHours]=useState<Hour[]>([]);
  const [policies,setPolicies]=useState<Policy[]>([]);
  const [faqs,setFaqs]=useState<Faq[]>([]);

  useEffect(()=>{ load(); },[]);

  async function load(){
    const current=await fetch("/api/workspace/current").then(r=>r.json());
    const id=current.business?.id;
    if(!id) return;
    setBusinessId(id);
    setRole(current.role || "");
    const data=await fetch(`/api/settings?businessId=${id}`).then(r=>r.json());
    setBusiness({
      name:data.business?.name || "",
      description:data.business?.description || "",
      phone:data.business?.phone || "",
      email:data.business?.email || "",
      website:data.business?.website || "",
      timezone:data.business?.timezone || "Africa/Johannesburg",
      tone:data.business?.tone || "friendly_professional",
      agentName:data.business?.agent_name || "Ava"
    });
    setServices((data.services??[]).map((s:any)=>({
      id:s.id,name:s.name,description:s.description||"",durationMinutes:s.duration_minutes,
      price:s.price_cents==null?"":s.price_cents/100,currency:s.currency||"ZAR"
    })));
    setResources((data.resources??[]).map((r:any)=>({id:r.id,name:r.name,type:r.resource_type||"staff"})));
    setHours((data.hours??[]).map((h:any)=>({
      id:h.id,dayOfWeek:h.day_of_week,label:dayNames[h.day_of_week],opensAt:(h.opens_at||"08:00").slice(0,5),
      closesAt:(h.closes_at||"17:00").slice(0,5),closed:Boolean(h.closed)
    })));
    setPolicies((data.policies??[]).map((p:any)=>({id:p.id,title:p.title,content:p.content,type:p.policy_type||"general"})));
    setFaqs((data.faqs??[]).map((f:any)=>({id:f.id,question:f.question,answer:f.answer})));
  }

  function patch<T>(setter:React.Dispatch<React.SetStateAction<T[]>>,index:number,change:Partial<T>){
    setter(current=>current.map((item,i)=>i===index?{...item,...change}:item));
  }

  async function save(){
    setStatus("Saving...");
    const response=await fetch("/api/settings",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({businessId,business,services,resources,hours,policies,faqs})
    });
    const data=await response.json();
    setStatus(response.ok?"Saved":data.error||"Could not save");
  }

  if(!business) return <AppShell><p className="muted">Loading settings...</p></AppShell>;

  const editable=["owner","admin"].includes(role);

  return (
    <AppShell>
      <h1>Workspace settings</h1>
      <p className="muted">Business profile, agent behaviour, services, staff, hours and knowledge.</p>

      <div className="card form-grid" style={{marginTop:24}}>
        <h3>Business & agent</h3>
        <input disabled={!editable} value={business.name} onChange={e=>setBusiness({...business,name:e.target.value})} placeholder="Business name"/>
        <textarea disabled={!editable} value={business.description} onChange={e=>setBusiness({...business,description:e.target.value})} placeholder="Description"/>
        <input disabled={!editable} value={business.phone} onChange={e=>setBusiness({...business,phone:e.target.value})} placeholder="Phone"/>
        <input disabled={!editable} value={business.email} onChange={e=>setBusiness({...business,email:e.target.value})} placeholder="Email"/>
        <input disabled={!editable} value={business.website} onChange={e=>setBusiness({...business,website:e.target.value})} placeholder="Website"/>
        <input disabled={!editable} value={business.agentName} onChange={e=>setBusiness({...business,agentName:e.target.value})} placeholder="Agent name"/>
        <select disabled={!editable} value={business.tone} onChange={e=>setBusiness({...business,tone:e.target.value})}>
          <option value="friendly_professional">Friendly & professional</option>
          <option value="luxury">Luxury</option>
          <option value="casual">Casual</option>
          <option value="formal">Formal</option>
        </select>

        <h3>Services</h3>
        {services.map((s,i)=><div className="repeat-row" key={i}>
          <input disabled={!editable} value={s.name} onChange={e=>patch(setServices,i,{name:e.target.value})} placeholder="Service"/>
          <input disabled={!editable} type="number" value={s.durationMinutes} onChange={e=>patch(setServices,i,{durationMinutes:Number(e.target.value)})} placeholder="Minutes"/>
          <input disabled={!editable} type="number" value={s.price} onChange={e=>patch(setServices,i,{price:e.target.value})} placeholder="Price"/>
          <input disabled={!editable} value={s.description} onChange={e=>patch(setServices,i,{description:e.target.value})} placeholder="Description"/>
        </div>)}
        {editable&&<button onClick={()=>setServices(c=>[...c,{name:"",description:"",durationMinutes:30,price:"",currency:"ZAR"}])}>+ Add service</button>}

        <h3>Staff / resources</h3>
        {resources.map((r,i)=><div className="repeat-row" key={i}>
          <input disabled={!editable} value={r.name} onChange={e=>patch(setResources,i,{name:e.target.value})} placeholder="Name"/>
          <select disabled={!editable} value={r.type} onChange={e=>patch(setResources,i,{type:e.target.value})}>
            <option value="staff">Staff</option><option value="room">Room</option><option value="table">Table</option>
            <option value="court">Court</option><option value="vehicle">Vehicle</option><option value="other">Other</option>
          </select>
        </div>)}
        {editable&&<button onClick={()=>setResources(c=>[...c,{name:"",type:"staff"}])}>+ Add resource</button>}

        <h3>Opening hours</h3>
        {hours.map((h,i)=><div className="hours-row" key={h.dayOfWeek}>
          <strong>{h.label}</strong>
          <label><input disabled={!editable} type="checkbox" checked={!h.closed} onChange={e=>patch(setHours,i,{closed:!e.target.checked})}/> Open</label>
          <input disabled={!editable||h.closed} type="time" value={h.opensAt} onChange={e=>patch(setHours,i,{opensAt:e.target.value})}/>
          <input disabled={!editable||h.closed} type="time" value={h.closesAt} onChange={e=>patch(setHours,i,{closesAt:e.target.value})}/>
        </div>)}

        <h3>Policies</h3>
        {policies.map((p,i)=><div className="repeat-row" key={i}>
          <input disabled={!editable} value={p.title} onChange={e=>patch(setPolicies,i,{title:e.target.value})} placeholder="Title"/>
          <textarea disabled={!editable} value={p.content} onChange={e=>patch(setPolicies,i,{content:e.target.value})} placeholder="Policy"/>
        </div>)}
        {editable&&<button onClick={()=>setPolicies(c=>[...c,{title:"",content:"",type:"general"}])}>+ Add policy</button>}

        <h3>FAQs</h3>
        {faqs.map((f,i)=><div className="repeat-row" key={i}>
          <input disabled={!editable} value={f.question} onChange={e=>patch(setFaqs,i,{question:e.target.value})} placeholder="Question"/>
          <textarea disabled={!editable} value={f.answer} onChange={e=>patch(setFaqs,i,{answer:e.target.value})} placeholder="Answer"/>
        </div>)}
        {editable&&<button onClick={()=>setFaqs(c=>[...c,{question:"",answer:""}])}>+ Add FAQ</button>}

        {editable&&<button onClick={save}>Save workspace</button>}
        {status&&<p className="muted">{status}</p>}
      </div>
    </AppShell>
  );
}
