"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
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
      method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({notificationId:id})
    });
    if(conversationId) router.push(`/conversations/${conversationId}`);
    else load();
  }

  async function markAll(){
    setStatus("Marking all read...");
    await fetch("/api/notifications",{
      method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({markAll:true})
    });
    setStatus("");
    load();
  }

  const unread=items.filter((item:any)=>item.status==="unread").length;

  return (
    <AppShell>
      <div className="ambient-orb ambient-orb-one"/>
      <div className="ambient-orb ambient-orb-two"/>
      <div className="ambient-grid"/>

      <div className="section-page command-page">
        <header className="section-header">
          <div>
            <div className="eyebrow">Alerts</div>
            <h1>Notifications</h1>
            <p>Human handovers and operational alerts that need staff attention.</p>
          </div>
          <button className="section-action-button" onClick={markAll}>
            <CheckCheck size={14}/> Mark all read
          </button>
        </header>

        <section className="section-panel glass-surface">
          <div className="section-panel-head">
            <div>
              <h2>Recent alerts</h2>
              <p>{unread} unread notification{unread===1?"":"s"}.</p>
            </div>
            <Bell size={17} strokeWidth={1.6}/>
          </div>

          {items.length===0 ? (
            <div className="section-empty">
              <span><Bell size={21} strokeWidth={1.5}/></span>
              <strong>Nothing needs your attention</strong>
              <p>Operational alerts and handovers will appear here.</p>
            </div>
          ) : (
            <div className="clean-notification-list">
              {items.map((n:any)=>(
                <button key={n.id} onClick={()=>markRead(n.id,n.conversation_id)} className={`clean-notification-row ${n.status}`}>
                  <span className="clean-notification-dot"/>
                  <div>
                    <strong>{n.title}</strong>
                    <p>{n.body}</p>
                    <time>{new Date(n.created_at).toLocaleString("en-ZA")}</time>
                  </div>
                  <ChevronRight size={15} strokeWidth={1.6}/>
                </button>
              ))}
            </div>
          )}
        </section>

        {status&&<div className="receptionist-feedback">{status}</div>}
      </div>
    </AppShell>
  );
}
