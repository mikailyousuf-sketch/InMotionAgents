"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Check,
  CircleDot,
  MessageSquareMore,
  Settings2,
  ShieldCheck,
  Sparkles,
  Workflow,
  X
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

function describeChange(change:any){
  const data=change?.data||{};
  if(change?.type==="tone") return `Change tone to ${String(data.tone||"").replaceAll("_"," ")}`;
  if(change?.type==="faq") return `Add FAQ: ${data.question||"New question"}`;
  if(change?.type==="policy") return `Add policy: ${data.title||"New policy"}`;
  if(change?.type==="guardrail") return `Add guardrail: ${data.title||"New rule"}`;
  if(change?.type==="automation") return `Add automation: ${data.name||"New automation"}`;
  return "Update receptionist configuration";
}

export default function ReceptionistPage(){
  const [instruction,setInstruction]=useState("");
  const [proposal,setProposal]=useState<any>(null);
  const [status,setStatus]=useState("");
  const [working,setWorking]=useState(false);

  async function propose(){
    const text=instruction.trim();
    if(!text||working) return;

    setWorking(true);
    setStatus("Interpreting your instruction…");
    setProposal(null);

    const response=await fetch("/api/receptionist/propose",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({instruction:text})
    });
    const data=await response.json();

    if(!response.ok){
      setStatus(data.error||"Could not prepare the change.");
      setWorking(false);
      return;
    }

    setProposal(data.proposal);
    setStatus("");
    setWorking(false);
  }

  async function decide(decision:"apply"|"reject"){
    if(!proposal||working) return;
    setWorking(true);
    setStatus(decision==="apply"?"Applying changes…":"Cancelling…");

    const response=await fetch("/api/receptionist/apply",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({proposalId:proposal.id,decision})
    });
    const data=await response.json();

    if(!response.ok){
      setStatus(data.error||"Could not update your receptionist.");
      setWorking(false);
      return;
    }

    setStatus(decision==="apply"?"Agent configuration updated.":"No changes were made.");
    setProposal(null);
    if(decision==="apply") setInstruction("");
    setWorking(false);
  }

  const examples=[
    "Make the receptionist warmer and less formal.",
    "Refund requests must always go to a manager.",
    "Customers can park behind the building.",
    "Remind customers 24 hours before a booking."
  ];

  const capabilities=[
    {label:"Knowledge",sub:"FAQs & business context",icon:BookOpen,href:"/settings"},
    {label:"Guardrails",sub:"Boundaries & escalation",icon:ShieldCheck,href:"/guardrails"},
    {label:"Automations",sub:"Follow-ups & workflows",icon:Workflow,href:"/automations"},
    {label:"Learning",sub:"Improve from real chats",icon:BrainCircuit,href:"/improve"}
  ];

  return (
    <AppShell>
      <div className="agent-control-page">
        <header className="agent-control-head">
          <div>
            <div className="eyebrow">AI operations</div>
            <h1>Shape how your agent thinks.</h1>
            <p>Direct behaviour, knowledge and operating rules without digging through settings.</p>
          </div>
          <Link href="/settings" className="agent-settings-link">
            <Settings2 size={14}/> Manual controls <ArrowUpRight size={12}/>
          </Link>
        </header>

        <section className="agent-command-center">
          <div className="agent-core-zone">
            <div className="agent-core-stage">
              <div className="agent-orbit orbit-one"/>
              <div className="agent-orbit orbit-two"/>
              <div className="agent-core">
                <span className="agent-core-pulse"/>
                <BrainCircuit size={30} strokeWidth={1.45}/>
              </div>

              <div className="agent-node node-one"><BookOpen size={13}/><span>Knowledge</span></div>
              <div className="agent-node node-two"><ShieldCheck size={13}/><span>Rules</span></div>
              <div className="agent-node node-three"><Workflow size={13}/><span>Actions</span></div>
              <div className="agent-node node-four"><MessageSquareMore size={13}/><span>Tone</span></div>
            </div>

            <div className="agent-core-copy">
              <div className="agent-live-line"><CircleDot size={12}/> Agent online</div>
              <h2>One brain. Every customer touchpoint.</h2>
              <p>Your instructions become structured policies, knowledge, guardrails and automations behind the scenes.</p>
            </div>
          </div>

          <div className="agent-directive-panel glass-surface">
            <div className="agent-directive-head">
              <div>
                <span>Directive</span>
                <h2>What should change?</h2>
              </div>
              <div className="agent-directive-state">
                <span className={working ? "thinking" : ""}/>
                {working ? "Processing" : "Ready"}
              </div>
            </div>

            <textarea
              autoFocus
              value={instruction}
              onChange={e=>setInstruction(e.target.value)}
              placeholder="Example: If someone asks for a refund, never promise one. Hand the conversation to a manager."
              onKeyDown={e=>{
                if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)){
                  e.preventDefault();
                  propose();
                }
              }}
            />

            <div className="agent-directive-footer">
              <span>Nothing changes until you approve it.</span>
              <button disabled={!instruction.trim()||working} onClick={propose}>
                <Sparkles size={14}/>
                {working&&!proposal?"Interpreting…":"Review directive"}
              </button>
            </div>
          </div>
        </section>

        {!proposal&&(
          <>
            <section className="agent-quick-directives">
              <span>Quick directives</span>
              <div>
                {examples.map(example=>(
                  <button key={example} onClick={()=>setInstruction(example)}>{example}</button>
                ))}
              </div>
            </section>

            <section className="agent-capability-grid">
              {capabilities.map(item=>{
                const Icon=item.icon;
                return (
                  <Link href={item.href} key={item.label} className="agent-capability">
                    <span><Icon size={16} strokeWidth={1.6}/></span>
                    <div><strong>{item.label}</strong><small>{item.sub}</small></div>
                    <ArrowUpRight size={12}/>
                  </Link>
                );
              })}
            </section>
          </>
        )}

        {proposal&&(
          <section className="agent-proposal glass-surface">
            <div className="agent-proposal-head">
              <div>
                <div className="eyebrow">Proposed configuration</div>
                <h2>{proposal.summary}</h2>
              </div>
              <span>{(proposal.changes??[]).length} change{(proposal.changes??[]).length===1?"":"s"}</span>
            </div>

            {(proposal.changes??[]).length===0 ? (
              <div className="agent-proposal-empty">
                <strong>More detail needed</strong>
                <p>{proposal.summary}</p>
              </div>
            ) : (
              <div className="agent-change-grid">
                {(proposal.changes??[]).map((change:any,index:number)=>(
                  <div className="agent-change" key={index}>
                    <div className="agent-change-index">{String(index+1).padStart(2,"0")}</div>
                    <div>
                      <strong>{describeChange(change)}</strong>
                      <span>{change.type} · {change.operation}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="agent-proposal-actions">
              <button className="agent-reject" disabled={working} onClick={()=>decide("reject")}>
                <X size={14}/> Discard
              </button>
              {(proposal.changes??[]).length>0&&(
                <button disabled={working} onClick={()=>decide("apply")}>
                  <Check size={14}/> {working?"Applying…":"Apply to agent"}
                </button>
              )}
            </div>
          </section>
        )}

        {status&&<div className="agent-feedback">{status}</div>}
      </div>
    </AppShell>
  );
}
