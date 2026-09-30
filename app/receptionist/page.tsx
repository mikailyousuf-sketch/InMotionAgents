"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, Settings2, Sparkles, WandSparkles, X } from "lucide-react";
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
    setStatus("Working out the safest change…");
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

    setStatus(decision==="apply"?"Your receptionist has been updated.":"No changes were made.");
    setProposal(null);
    if(decision==="apply") setInstruction("");
    setWorking(false);
  }

  const examples=[
    "Make the receptionist more casual.",
    "If someone asks for a refund, hand them over to a manager.",
    "Customers can park behind the building.",
    "Remind customers 24 hours before their booking."
  ];

  return (
    <AppShell>
      <div className="ambient-orb ambient-orb-one"/>
      <div className="ambient-orb ambient-orb-two"/>
      <div className="ambient-grid"/>

      <div className="receptionist-page command-page">
        <header className="section-header receptionist-page-head">
          <div>
            <div className="eyebrow">Your receptionist</div>
            <h1>Tell it how your business works.</h1>
            <p>Describe the change in normal language. Nothing updates until you approve it.</p>
          </div>
          <Link href="/settings" className="section-link">
            <Settings2 size={14}/> Manual settings <ArrowUpRight size={13}/>
          </Link>
        </header>

        <section className="receptionist-editor glass-surface">
          <div className="receptionist-editor-top">
            <span><WandSparkles size={17} strokeWidth={1.7}/></span>
            <div>
              <strong>What should your receptionist know or do differently?</strong>
              <p>Policies, tone, FAQs, guardrails and automations can all be changed here.</p>
            </div>
          </div>

          <textarea
            autoFocus
            value={instruction}
            onChange={e=>setInstruction(e.target.value)}
            placeholder="For example: If someone asks for a refund, never promise one. Send it to a manager."
            onKeyDown={e=>{
              if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)){
                e.preventDefault();
                propose();
              }
            }}
          />

          <div className="receptionist-editor-footer">
            <span>Ctrl / ⌘ + Enter to review</span>
            <button disabled={!instruction.trim()||working} onClick={propose}>
              <Sparkles size={14}/>
              {working&&!proposal?"Thinking…":"Review change"}
            </button>
          </div>
        </section>

        {!proposal&&(
          <section className="receptionist-suggestions">
            <span>Try one of these</span>
            <div>
              {examples.map(example=>(
                <button key={example} onClick={()=>setInstruction(example)}>{example}</button>
              ))}
            </div>
          </section>
        )}

        {proposal&&(
          <section className="receptionist-proposal glass-surface">
            <div className="receptionist-proposal-head">
              <div>
                <div className="eyebrow">Review before applying</div>
                <h2>{proposal.summary}</h2>
              </div>
              <span>{(proposal.changes??[]).length} change{(proposal.changes??[]).length===1?"":"s"}</span>
            </div>

            {(proposal.changes??[]).length===0 ? (
              <div className="receptionist-proposal-empty">
                <strong>I need a little more detail.</strong>
                <p>{proposal.summary}</p>
              </div>
            ) : (
              <div className="receptionist-change-list">
                {(proposal.changes??[]).map((change:any,index:number)=>(
                  <div className="receptionist-change" key={index}>
                    <div className="change-number">{index+1}</div>
                    <div>
                      <strong>{describeChange(change)}</strong>
                      <span>{change.type} · {change.operation}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="receptionist-proposal-actions">
              <button className="receptionist-cancel" disabled={working} onClick={()=>decide("reject")}>
                <X size={14}/> Cancel
              </button>
              {(proposal.changes??[]).length>0&&(
                <button disabled={working} onClick={()=>decide("apply")}>
                  <Check size={14}/> {working?"Applying…":"Apply changes"}
                </button>
              )}
            </div>
          </section>
        )}

        {status&&<div className="receptionist-feedback">{status}</div>}

        <footer className="receptionist-footer-links">
          <span>Need precise control?</span>
          <div>
            <Link href="/settings">FAQs & policies</Link>
            <Link href="/guardrails">Guardrails</Link>
            <Link href="/automations">Automations</Link>
            <Link href="/improve">Improve</Link>
          </div>
        </footer>
      </div>
    </AppShell>
  );
}
