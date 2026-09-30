import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import ConversationDetailClient from "./ConversationDetailClient";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />
      <div className="ambient-grid" />

      <div className="conversation-page command-page">
        <header className="conversation-page-head">
          <Link href="/conversations" className="conversation-back">
            <ArrowLeft size={15} strokeWidth={1.8} /> Inbox
          </Link>
          <div>
            <div className="eyebrow">Customer conversation</div>
            <h1>Conversation</h1>
          </div>
        </header>

        <ConversationDetailClient conversationId={id} />
      </div>
    </AppShell>
  );
}
