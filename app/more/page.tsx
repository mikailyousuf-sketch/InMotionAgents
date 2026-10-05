import Link from "next/link";
import {
  Bell,
  Bot,
  BriefcaseBusiness,
  Cable,
  ChevronRight,
  Gauge,
  MessagesSquare,
  Phone,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

const groups = [
  {
    title: "Business",
    items: [
      { href: "/settings", label: "Business profile", sub: "Hours, services and booking rules", icon: BriefcaseBusiness },
      { href: "/integrations", label: "Connections", sub: "WhatsApp and connected services", icon: Cable },
      { href: "/team", label: "Team", sub: "People who can access this workspace", icon: UsersRound }
    ]
  },
  {
    title: "Receptionist",
    items: [
      { href: "/improve", label: "Improve receptionist", sub: "Review learning suggestions from real chats", icon: Sparkles },
      { href: "/guardrails", label: "AI guardrails", sub: "Escalation rules and hard boundaries", icon: ShieldCheck },
      { href: "/automations", label: "Automations", sub: "Follow-ups and scheduled actions", icon: RefreshCw }
    ]
  },
  {
    title: "Workspace",
    items: [
      { href: "/notification-settings", label: "Notifications", sub: "Choose what your team gets alerted about", icon: Bell },
      { href: "/calls", label: "Calls", sub: "Voice activity and call handling", icon: Phone },
      { href: "/usage", label: "Usage", sub: "Workspace activity and limits", icon: Gauge }
    ]
  }
];

export default async function MorePage() {
  const { business } = await getPrimaryUserBusiness();

  return (
    <AppShell>
      <div className="more-page command-page">
        <header className="more-page-head">
          <div>
            <div className="eyebrow">More</div>
            <h1>Everything else, kept out of the way.</h1>
            <p>
              {business.name} · configuration and secondary tools live here so the main app stays simple.
            </p>
          </div>

          <Link href="/receptionist" className="more-primary-shortcut">
            <Bot size={16} />
            <span>
              <strong>Receptionist</strong>
              <small>Change how your AI behaves</small>
            </span>
            <ChevronRight size={15} />
          </Link>
        </header>

        <section className="more-fast-links" aria-label="Common secondary actions">
          <Link href="/integrations">
            <Cable size={17} />
            <span><strong>Connections</strong><small>WhatsApp & apps</small></span>
          </Link>
          <Link href="/settings">
            <Settings2 size={17} />
            <span><strong>Business setup</strong><small>Services & hours</small></span>
          </Link>
          <Link href="/notifications">
            <MessagesSquare size={17} />
            <span><strong>Alerts</strong><small>Needs attention</small></span>
          </Link>
        </section>

        <div className="more-groups">
          {groups.map(group => (
            <section className="more-group" key={group.title}>
              <div className="more-group-title">{group.title}</div>
              <div className="more-list">
                {group.items.map(item => {
                  const Icon = item.icon;
                  return (
                    <Link href={item.href} key={item.href} className="more-row">
                      <span className="more-row-icon"><Icon size={17} strokeWidth={1.7} /></span>
                      <span className="more-row-copy">
                        <strong>{item.label}</strong>
                        <small>{item.sub}</small>
                      </span>
                      <ChevronRight size={15} strokeWidth={1.7} />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
