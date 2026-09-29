"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NotificationBell } from "@/components/NotificationBell";

const main = [
  { href: "/dashboard", label: "Home", icon: "⌂" },
  { href: "/receptionist", label: "Your Receptionist", icon: "✦" },
  { href: "/conversations", label: "Inbox", icon: "◌" },
  { href: "/calls", label: "Calls", icon: "☎" },
  { href: "/bookings", label: "Bookings", icon: "□" },
  { href: "/customers", label: "Customers", icon: "◎" },
  { href: "/automations", label: "Automations", icon: "↻" },
  { href: "/improve", label: "Improve", icon: "＋" }
];

const manage = [
  { href: "/settings", label: "Business profile" },
  { href: "/team", label: "Team" },
  { href: "/integrations", label: "Connections" },
  { href: "/custom-work", label: "Custom work" }
];

const advanced = [
  { href: "/guardrails", label: "AI guardrails" },
  { href: "/notification-settings", label: "Notification rules" },
  { href: "/operations", label: "Operations" },
  { href: "/usage", label: "Usage" },
  { href: "/", label: "Agent tester" },
  { href: "/whatsapp", label: "WhatsApp tester" },
  { href: "/onboarding", label: "Create another workspace" }
];

export function ProductNavigation() {
  const pathname = usePathname();
  const [manageOpen,setManageOpen]=useState(false);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [role,setRole]=useState("");

  useEffect(()=>{
    fetch("/api/workspace/current")
      .then(r=>r.json())
      .then(data=>setRole(data.role||""))
      .catch(()=>{});
  },[]);

  function active(href:string){
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <>
      <nav className="product-nav">
        {main.map(item=>(
          <Link key={item.href} href={item.href} className={active(item.href)?"active":""}>
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}

        <NotificationBell />

        {["owner","admin"].includes(role) && (
          <div className="nav-group">
            <button className="nav-group-button" onClick={()=>setManageOpen(v=>!v)}>
              <span>Manage</span><span>{manageOpen?"−":"+"}</span>
            </button>
            {manageOpen && (
              <div className="nav-submenu">
                {manage.map(item=>(
                  <Link key={item.href} href={item.href} className={active(item.href)?"active":""}>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="nav-group">
          <button className="nav-group-button muted-nav" onClick={()=>setAdvancedOpen(v=>!v)}>
            <span>Advanced</span><span>{advancedOpen?"−":"+"}</span>
          </button>
          {advancedOpen && (
            <div className="nav-submenu">
              {advanced.map(item=>(
                <Link key={item.href} href={item.href} className={active(item.href)?"active":""}>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <nav className="mobile-nav">
        {main.filter(item=>["/dashboard","/receptionist","/conversations"].includes(item.href)).map(item=>(
          <Link key={item.href} href={item.href} className={active(item.href)?"active":""}>
            <span>{item.icon}</span><small>{item.label}</small>
          </Link>
        ))}
        <Link href="/notifications" className={active("/notifications")?"active":""}>
          <span>◉</span><small>Alerts</small>
        </Link>
      </nav>
    </>
  );
}
