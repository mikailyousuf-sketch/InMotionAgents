"use client";

import Link from "next/link";
import { useState } from "react";
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
      <div className="receptionist-control-shell">
        <header className="receptionist-control-header">
          <div>
            <div className="eyebrow">Your receptionist</div>
            <h1>Tell it how your business works.</h1>
            <p className="muted">Use plain English. InMotion will show you the exact change before anything is updated.</p>
          </div>
          <Link href="/settings" className="text-link">Manual settings →</Link>
        </header>

        <section className="receptionist-command-card">
          <textarea
            autoFocus
            value={instruction}
            onChange={e=>setInstruction(e.target.value)}
            placeholder="e.g. If somebody asks for a refund, never promise one. Send it to a manager."
            onKeyDown={e=>{
              if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)){
                e.preventDefault();
                propose();
              }
            }}
          />
          <div className="command-footer">
            <span className="muted">⌘/Ctrl + Enter to review</span>
            <button disabled={!instruction.trim()||working} onClick={propose}>
              {working&&!proposal?"Thinking…":"Review change"}
            </button>
          </div>
        </section>

        {!proposal&&(
          <section className="receptionist-examples">
            <span className="muted">Try saying:</span>
            <div>
              {examples.map(example=>(
                <button key={example} onClick={()=>setInstruction(example)}>{example}</button>
              ))}
            </div>
          </section>
        )}

        {proposal&&(
          <section className="proposal-card">
            <div className="proposal-heading">
              <div>
                <div className="eyebrow">Proposed changes</div>
                <h2>{proposal.summary}</h2>
              </div>
              <span className="proposal-count">{(proposal.changes??[]).length} change{(proposal.changes??[]).length===1?"":"s"}</span>
            </div>

            {(proposal.changes??[]).length===0 ? (
              <div className="proposal-empty">
                <strong>I need a little more detail.</strong>
                <p className="muted">{proposal.summary}</p>
              </div>
            ) : (
              <div className="proposal-list">
                {(proposal.changes??[]).map((change:any,index:number)=>(
                  <div className="proposal-row" key={index}>
                    <div className="proposal-number">{index+1}</div>
                    <div>
                      <strong>{describeChange(change)}</strong>
                      <div className="muted">{change.type} · {change.operation}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="proposal-actions">
              <button className="soft-button" disabled={working} onClick={()=>decide("reject")}>Cancel</button>
              {(proposal.changes??[]).length>0&&(
                <button disabled={working} onClick={()=>decide("apply")}>
                  {working?"Applying…":"Apply changes"}
                </button>
              )}
            </div>
          </section>
        )}

        {status&&<p className="receptionist-status">{status}</p>}

        <section className="receptionist-control-links">
          <div>
            <strong>Prefer manual control?</strong>
            <span className="muted">Every setting is still available.</span>
          </div>
          <div>
            <Link href="/settings">FAQs & policies</Link>
            <Link href="/guardrails">Guardrails</Link>
            <Link href="/automations">Automations</Link>
            <Link href="/improve">Improve</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
