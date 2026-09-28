"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function InvitePage(){
  const params=useParams<{token:string}>();
  const router=useRouter();
  const [status,setStatus]=useState("");

  async function accept(){
    setStatus("Accepting...");
    const response=await fetch("/api/team/accept",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({token:params.token})
    });
    const data=await response.json();
    if(response.ok){
      setStatus("Invite accepted");
      await fetch("/api/workspace/switch",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({businessId:data.businessId})
      });
      router.push("/dashboard");
      router.refresh();
    }else{
      setStatus(data.error||"Could not accept invite");
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand" style={{marginBottom:8}}>InMotion Agents</div>
        <h1>Workspace invite</h1>
        <p className="muted">Log in with the email address this invite was sent to, then accept it.</p>
        <button onClick={accept}>Accept invite</button>
        {status&&<p className="muted" style={{marginTop:12}}>{status}</p>}
      </div>
    </main>
  );
}
