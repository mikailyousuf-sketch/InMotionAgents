import { AppShell } from "@/components/AppShell";
import ConversationDetailClient from "./ConversationDetailClient";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <h1>Conversation</h1>
      <p className="muted">Human takeover and transcript controls.</p>
      <ConversationDetailClient conversationId={id} />
    </AppShell>
  );
}
