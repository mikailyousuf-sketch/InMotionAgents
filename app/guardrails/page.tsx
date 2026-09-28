"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

export default function GuardrailsPage() {
  const [data,setData]=useState<any>({guardrails:[],role:""});
  const [form,setForm]=useState({
    title:"",
    instructions:"",
    ruleType:"custom",
    action:"handover",
    priority:100
  });
  const [status,setStatus]=useState("");

  async function load() {
    const response=await fetch("/api/guardrails");
    const next=await response.json();
    setData(next);
  }

  useEffect(()=>{ load(); },[]);

  async function create() {
    setStatus("Creating rule...");
    const response=await fetch("/api/guardrails",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(form)
    });
    const result=await response.json();
    setStatus(response.ok?"Rule created":result.error||"Failed");
    if(response.ok) {
      setForm({title:"",instructions:"",ruleType:"custom",action:"handover",priority:100});
      load();
    }
  }

  async function toggle(rule:any) {
    await fetch("/api/guardrails",{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({id:rule.id,active:!rule.active})
    });
    load();
  }

  async function remove(id:string) {
    await fetch(`/api/guardrails?id=${id}`,{method:"DELETE"});
    load();
  }

  const editable=["owner","admin"].includes(data.role);

  return (
    <AppShell>
      <h1>Receptionist guardrails</h1>
      <p className="muted">Define exactly when the AI can proceed and when it must involve staff.</p>

      {editable&&(
        <div className="card form-grid" style={{marginTop:24}}>
          <h3 style={{marginTop:0}}>New rule</h3>
          <input
            value={form.title}
            onChange={e=>setForm({...form,title:e.target.value})}
            placeholder="e.g. Refund disputes"
          />
          <textarea
            value={form.instructions}
            onChange={e=>setForm({...form,instructions:e.target.value})}
            placeholder="e.g. If a customer disputes a charge, refund or payment, do not promise an outcome. Hand over to a human."
          />
          <select value={form.action} onChange={e=>setForm({...form,action:e.target.value})}>
            <option value="handover">Hand over to staff</option>
            <option value="block">Do not perform action</option>
            <option value="warn">Proceed cautiously / warn</option>
          </select>
          <input
            type="number"
            value={form.priority}
            onChange={e=>setForm({...form,priority:Number(e.target.value)})}
            placeholder="Priority"
          />
          <button onClick={create}>Create guardrail</button>
          {status&&<p className="muted">{status}</p>}
        </div>
      )}

      <div className="card" style={{marginTop:16}}>
        <h3 style={{marginTop:0}}>Rules</h3>
        {(data.guardrails??[]).length===0
          ? <p className="muted">No custom guardrails configured yet.</p>
          : (data.guardrails??[]).map((rule:any)=>(
            <div key={rule.id} style={{padding:"14px 0",borderBottom:"1px solid var(--line)"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
                <div>
                  <strong>{rule.title}</strong>
                  <div className="muted" style={{fontSize:12,marginTop:3}}>
                    {rule.action} · priority {rule.priority} · {rule.active?"active":"paused"}
                  </div>
                  <p style={{marginBottom:0}}>{rule.instructions}</p>
                </div>
                {editable&&(
                  <div style={{display:"flex",gap:8}}>
                    <button className="link-button" onClick={()=>toggle(rule)}>
                      {rule.active?"Pause":"Activate"}
                    </button>
                    <button className="link-button" onClick={()=>remove(rule.id)}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))
        }
      </div>
    </AppShell>
  );
}
