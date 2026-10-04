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
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  MoreHorizontal
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
  { href: "/", label: "Agent Lab" },
  { href: "/whatsapp", label: "WhatsApp tester" },
  { href: "/onboarding", label: "Create workspace" }
];

export function ProductNavigation({ collapsed = false }: { collapsed?: boolean }) {
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

  useEffect(()=>{
    if(manage.some(item=>pathname.startsWith(item.href))) setManageOpen(true);
    if(advanced.some(item=>item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))) setAdvancedOpen(true);
  },[pathname]);

  function active(href:string){
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <>
      <nav className="product-nav command-nav">
        {main.map(item=>{
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={active(item.href)?"active":""} title={collapsed ? item.label : undefined}>
              <span className="nav-icon"><Icon size={16} strokeWidth={1.8} /></span>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}

        <NotificationBell collapsed={collapsed} />

        {!collapsed && ["owner","admin"].includes(role) && (
          <div className={`nav-section-card ${manageOpen ? "open" : ""}`}>
            <button className="nav-section-toggle" onClick={()=>setManageOpen(v=>!v)}>
              <span className="nav-section-icon"><Settings2 size={14}/></span>
              <span className="nav-section-copy">
                <strong>Manage</strong>
                <small>Business setup</small>
              </span>
              {manageOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
            </button>

            {manageOpen && (
              <div className="nav-section-links">
                {manage.map(item=>(
                  <Link key={item.href} href={item.href} className={active(item.href)?"active":""}>
                    <span className="nav-link-dot"/>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {!collapsed && <div className={`nav-section-card advanced ${advancedOpen ? "open" : ""}`}>
          <button className="nav-section-toggle" onClick={()=>setAdvancedOpen(v=>!v)}>
            <span className="nav-section-icon"><SlidersHorizontal size={14}/></span>
            <span className="nav-section-copy">
              <strong>Advanced</strong>
              <small>Tools & controls</small>
            </span>
            {advancedOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
          </button>

          {advancedOpen && (
            <div className="nav-section-links">
              {advanced.map(item=>(
                <Link key={item.href} href={item.href} className={active(item.href)?"active":""}>
                  <span className="nav-link-dot"/>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>}
      </nav>

      <nav className="mobile-nav" aria-label="Primary mobile navigation">
        <Link href="/dashboard" className={active("/dashboard")?"active":""}>
          <Gauge size={19} strokeWidth={1.8} />
          <small>Home</small>
        </Link>
        <Link href="/conversations" className={active("/conversations")?"active":""}>
          <Inbox size={19} strokeWidth={1.8} />
          <small>Inbox</small>
        </Link>
        <Link href="/receptionist" className={active("/receptionist")?"active":""}>
          <Bot size={19} strokeWidth={1.8} />
          <small>Receptionist</small>
        </Link>
        <Link
          href="/settings"
          className={
            ["/settings","/integrations","/team","/notifications","/notification-settings","/usage","/operations","/guardrails","/custom-work","/improve"].some(href=>active(href))
              ? "active"
              : ""
          }
        >
          <MoreHorizontal size={20} strokeWidth={1.8} />
          <small>More</small>
        </Link>
      </nav>
    </>
  );
}
