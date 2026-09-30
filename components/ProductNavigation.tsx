"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Gauge,
  Inbox,
  Phone,
  RefreshCw,
  Settings2,
  Sparkles,
  UsersRound
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

const main = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/conversations", label: "Inbox", icon: Inbox },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/customers", label: "Customers", icon: UsersRound },
  { href: "/receptionist", label: "Receptionist", icon: Bot },
  { href: "/automations", label: "Automations", icon: RefreshCw }
];

const manage = [
  { href: "/improve", label: "Improve receptionist" },
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
  { href: "/onboarding", label: "Create workspace" }
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
      <nav className="product-nav command-nav">
        {main.map(item=>{
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={active(item.href)?"active":""}>
              <span className="nav-icon"><Icon size={16} strokeWidth={1.8} /></span>
              <span>{item.label}</span>
            </Link>
          );
        })}

        <NotificationBell />

        {["owner","admin"].includes(role) && (
          <div className="nav-group">
            <button className="nav-group-button" onClick={()=>setManageOpen(v=>!v)}>
              <span className="nav-group-label"><Settings2 size={13} /> Manage</span>
              {manageOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
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
            <span className="nav-group-label"><Sparkles size={13} /> Advanced</span>
            {advancedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
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
        {main.filter(item=>["/dashboard","/conversations","/bookings"].includes(item.href)).map(item=>{
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={active(item.href)?"active":""}>
              <Icon size={18} strokeWidth={1.8} /><small>{item.label}</small>
            </Link>
          );
        })}
        <Link href="/notifications" className={active("/notifications")?"active":""}>
          <Sparkles size={18} strokeWidth={1.8} /><small>Alerts</small>
        </Link>
      </nav>
    </>
  );
}
