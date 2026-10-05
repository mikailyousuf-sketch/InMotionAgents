"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  CalendarDays,
  Gauge,
  Inbox,
  MoreHorizontal,
  UsersRound
} from "lucide-react";

const primary = [
  { href: "/dashboard", label: "Home", icon: Gauge },
  { href: "/conversations", label: "Inbox", icon: Inbox },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/customers", label: "Customers", icon: UsersRound },
  { href: "/receptionist", label: "Receptionist", icon: Bot }
];

const moreRoutes = [
  "/more",
  "/settings",
  "/integrations",
  "/team",
  "/notifications",
  "/notification-settings",
  "/usage",
  "/operations",
  "/guardrails",
  "/custom-work",
  "/improve",
  "/automations",
  "/calls",
  "/whatsapp",
  "/onboarding"
];

export function ProductNavigation({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();

  function active(href:string){
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const moreActive = moreRoutes.some(route => active(route));

  return (
      <nav className="product-nav command-nav primary-product-nav" aria-label="Primary navigation">
        <div className="nav-cluster-label">Workspace</div>

        {primary.map(item=>{
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active(item.href) ? "active" : ""}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-icon"><Icon size={17} strokeWidth={1.8} /></span>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}

        <div className="nav-cluster-spacer" />

        <Link
          href="/more"
          className={moreActive ? "active" : ""}
          title={collapsed ? "More" : undefined}
        >
          <span className="nav-icon"><MoreHorizontal size={18} strokeWidth={1.8} /></span>
          <span className="nav-label">More</span>
        </Link>
      </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();

  function active(href:string){
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const moreActive = moreRoutes.some(route => active(route));

  return (
    <nav className="mobile-nav" aria-label="Primary mobile navigation">
      <Link href="/dashboard" className={active("/dashboard") ? "active" : ""}>
        <Gauge size={19} strokeWidth={1.8} />
        <small>Home</small>
      </Link>

      <Link href="/conversations" className={active("/conversations") ? "active" : ""}>
        <Inbox size={19} strokeWidth={1.8} />
        <small>Inbox</small>
      </Link>

      <Link href="/receptionist" className={active("/receptionist") ? "active" : ""}>
        <Bot size={19} strokeWidth={1.8} />
        <small>Receptionist</small>
      </Link>

      <Link href="/more" className={moreActive ? "active" : ""}>
        <MoreHorizontal size={20} strokeWidth={1.8} />
        <small>More</small>
      </Link>
    </nav>
  );
}
