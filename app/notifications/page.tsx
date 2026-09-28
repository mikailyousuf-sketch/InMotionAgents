"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";

export default function NotificationsPage(){
  const router=useRouter();
  const [items,setItems]=useState<any[]>([]);
  const [status,setStatus]=useState("");

  async function load(){
    const data=await fetch("/api/notifications").then(r=>r.json());
    setItems(data.notifications??[]);
  }

  useEffect(()=>{load();},[]);

  async function markRead(id:string,conversationId?:string|null){
    await fetch("/api/notifications",{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({notificationId:id})
    });
    if(conversationId){
      router.push(`/conversations/${conversationId}`);
    }else{
      load();
    }
  }

  async function markAll(){
    setStatus("Marking all read...");
    await fetch("/api/notifications",{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({markAll:true})
    });
    setStatus("");
    load();
  }

  return (
    <AppShell>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
        <div>
          <h1>Notifications</h1>
          <p className="muted">Human handovers and operational alerts that need staff attention.</p>
        </div>
        <button onClick={markAll}>Mark all read</button>
      </div>

      <div className="card" style={{marginTop:24,padding:0,overflow:"hidden"}}>
        {items.length===0?<p className="muted" style={{padding:18}}>No notifications yet.</p>:items.map((n:any)=>(
          <button
            key={n.id}
            onClick={()=>markRead(n.id,n.conversation_id)}
            className="notification-row"
          >
            <div>
              <strong>{n.title}</strong>
              <div style={{marginTop:4}}>{n.body}</div>
              <div className="muted" style={{fontSize:12,marginTop:6}}>
                {new Date(n.created_at).toLocaleString("en-ZA")}
              </div>
            </div>
            <span className={`notification-state ${n.status}`}>{n.status}</span>
          </button>
        ))}
      </div>

      {status&&<p className="muted" style={{marginTop:12}}>{status}</p>}
    </AppShell>
  );
}
