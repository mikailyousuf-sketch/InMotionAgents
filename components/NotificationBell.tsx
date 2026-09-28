"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function NotificationBell() {
  const [count,setCount]=useState(0);

  async function load(){
    try{
      const data=await fetch("/api/notifications?unread=true").then(r=>r.json());
      setCount((data.notifications??[]).length);
    }catch{}
  }

  useEffect(()=>{
    load();
    const id=setInterval(load,15000);
    return ()=>clearInterval(id);
  },[]);

  return (
    <Link href="/notifications" className="notification-link">
      Notifications
      {count>0&&<span className="notification-badge">{count>99?"99+":count}</span>}
    </Link>
  );
}
