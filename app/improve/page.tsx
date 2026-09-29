"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";

export default function ImprovePage() {
  const [data,setData]=useState<any>({suggestions:[],role:""});
  const [transcript,setTranscript]=useState("");
  const [status,setStatus]=useState("");
  const [editing,setEditing]=useState<Record<string,string>>({});

  async function load(){
    const response=await fetch("/api/improve");
    const next=await response.json();
    setData(next);
  }

  useEffect(()=>{ load(); },[]);

  const pending=useMemo(
    ()=>(data.suggestions??[]).filter((item:any)=>item.status==="pending"),
    [data.suggestions]
  );

  async function review(item:any, action:"approve"|"dismiss"){
    setStatus(action==="approve"?"Teaching receptionist…":"Dismissing…");

    const response=await fetch("/api/improve",{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        id:item.id,
        action,
        answer:editing[item.id] ?? item.suggested_answer,
        tone:item.metadata?.recommended_tone
      })
    });

    const result=await response.json();
    setStatus(response.ok?"Saved":result.error||"Could not save");
    if(response.ok) load();
  }

  async function analyze(){
    setStatus("Reading previous conversations…");

    const response=await fetch("/api/improve/analyze",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({transcript})
    });

    const result=await response.json();
    setStatus(response.ok?`Found ${result.created} suggestion(s) to review.`:result.error||"Could not analyze");
    if(response.ok){
      setTranscript("");
      load();
    }
  }

  return (
    <AppShell>
      <div className="home-header">
        <div>
          <div className="eyebrow">Improve receptionist</div>
          <h1>Help it get better over time</h1>
          <p className="muted">Review what the AI struggled with and teach it using real business knowledge.</p>
        </div>
        <div className="receptionist-health online">
          <span className="health-dot" />
          {pending.length} suggestion{pending.length===1?"":"s"} waiting
        </div>
      </div>

      <div className="improve-grid">
        <section className="card">
          <div className="panel-heading">
            <div>
              <h2>Needs your review</h2>
              <p className="muted">Nothing is learned permanently until you approve it.</p>
            </div>
          </div>

          {pending.length===0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <strong>Your receptionist is caught up</strong>
              <p className="muted">New gaps and learning suggestions will appear here.</p>
            </div>
          ) : pending.map((item:any)=>(
            <div className="learning-card" key={item.id}>
              <div className="learning-top">
                <div>
                  <span className="learning-type">{item.suggestion_type.replaceAll("_"," ")}</span>
                  <h3>{item.title}</h3>
                </div>
                {item.confidence!=null&&(
                  <span className="confidence">{Math.round(Number(item.confidence)*100)}%</span>
                )}
              </div>

              {item.source_question&&(
                <div className="source-question">
                  <span>Customer question</span>
                  <strong>{item.source_question}</strong>
                </div>
              )}

              {item.suggestion_type==="tone_insight" ? (
                <div className="tone-suggestion">
                  <p>{item.suggested_answer}</p>
                  <div className="review-chips">
                    {(item.metadata?.traits??[]).map((trait:string)=><span key={trait}>{trait}</span>)}
                  </div>
                  <strong>Recommended style: {item.metadata?.recommended_tone?.replaceAll("_"," ")}</strong>
                </div>
              ) : (
                <label className="field-label">
                  <span>What should the receptionist know?</span>
                  <textarea
                    value={editing[item.id] ?? item.suggested_answer ?? ""}
                    onChange={e=>setEditing({...editing,[item.id]:e.target.value})}
                  />
                </label>
              )}

              <div className="learning-actions">
                <button className="soft-button" onClick={()=>review(item,"dismiss")}>Dismiss</button>
                <button onClick={()=>review(item,"approve")}>
                  {item.suggestion_type==="tone_insight"?"Use this style":"Teach receptionist"}
                </button>
              </div>
            </div>
          ))}
        </section>

        <aside className="home-side">
          <div className="card setup-card">
            <div className="setup-icon">✦</div>
            <h3>Learn from previous chats</h3>
            <p className="muted">Paste exported or older customer conversations. InMotion will find reusable answers and how your team normally speaks.</p>
            <textarea
              className="history-input"
              value={transcript}
              onChange={e=>setTranscript(e.target.value)}
              placeholder={"Customer: Do you have parking?\nStaff: Yes, parking is available behind the building…"}
            />
            <button style={{width:"100%",marginTop:10}} disabled={transcript.trim().length<50} onClick={analyze}>
              Analyze conversations
            </button>
            <p className="privacy-note">Suggestions are reviewed before they become receptionist knowledge.</p>
          </div>

          <div className="card quick-card">
            <h3>How learning works</h3>
            <p className="muted">InMotion can suggest answers and tone. Your team remains the final source of truth.</p>
          </div>
        </aside>
      </div>

      {status&&<p className="muted" style={{marginTop:14}}>{status}</p>}
    </AppShell>
  );
}
