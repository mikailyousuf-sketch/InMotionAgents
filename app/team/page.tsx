"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

export default function TeamPage(){
  const [businessId,setBusinessId]=useState("");
  const [members,setMembers]=useState<any[]>([]);
  const [invites,setInvites]=useState<any[]>([]);
  const [email,setEmail]=useState("");
  const [role,setRole]=useState("staff");
  const [status,setStatus]=useState("");

  useEffect(()=>{ load(); },[]);

  async function load(){
    const current=await fetch("/api/workspace/current").then(r=>r.json());
    const id=current.business?.id;
    if(!id) return;
    setBusinessId(id);
    const data=await fetch(`/api/team?businessId=${id}`).then(r=>r.json());
    setMembers(data.members??[]);
    setInvites(data.invites??[]);
  }

  async function invite(){
    setStatus("Creating invite...");
    const response=await fetch("/api/team",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({businessId,email,role})
    });
    const data=await response.json();
    setStatus(response.ok?"Invite created":data.error||"Could not invite");
    if(response.ok){ setEmail(""); await load(); }
  }

  async function changeRole(userId:string,nextRole:string){
    await fetch("/api/team",{
      method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({businessId,userId,role:nextRole})
    });
    load();
  }

  return (
    <AppShell>
      <h1>Team</h1>
      <p className="muted">Manage who can access this workspace.</p>

      <div className="card form-grid" style={{marginTop:24}}>
        <h3>Invite member</h3>
        <input type="email" placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)}/>
        <select value={role} onChange={e=>setRole(e.target.value)}>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
        </select>
        <button onClick={invite}>Create invite</button>
        {status&&<p className="muted">{status}</p>}
      </div>

      <div className="card" style={{marginTop:16}}>
        <h3 style={{marginTop:0}}>Members</h3>
        {members.length===0?<p className="muted">No members found.</p>:members.map((m:any)=>(
          <div key={m.user_id} style={{display:"grid",gridTemplateColumns:"1fr 180px",gap:12,padding:"12px 0",borderBottom:"1px solid var(--line)"}}>
            <div>
              <strong>{m.user_profiles?.full_name || "User"}</strong>
              <div className="muted" style={{fontSize:12}}>{m.user_id}</div>
            </div>
            <select value={m.role} onChange={e=>changeRole(m.user_id,e.target.value)}>
              <option value="staff">Staff</option><option value="admin">Admin</option><option value="owner">Owner</option>
            </select>
          </div>
        ))}
      </div>

      <div className="card" style={{marginTop:16}}>
        <h3 style={{marginTop:0}}>Pending invites</h3>
        {invites.length===0?<p className="muted">No pending invites.</p>:invites.map((i:any)=>(
          <div key={i.id} style={{padding:"12px 0",borderBottom:"1px solid var(--line)"}}>
            <strong>{i.email}</strong> · {i.role}
            <div className="muted" style={{fontSize:12,marginTop:4}}>
              Accept link: /invite/{i.token}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
