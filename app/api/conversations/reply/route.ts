import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { saveMessage } from "@/lib/crm/conversations";
import { cancelEscalationsForConversation } from "@/lib/notifications/engine";
import { writeAuditLog } from "@/lib/audit/log";

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const conversationId = String(body?.conversationId || "");
  const text = String(body?.message || "").trim();

  if (!conversationId || !text) {
    return Response.json({ error: "conversationId and message are required" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,business_id,customer_id,channel,status")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", conversation.business_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

  let externalMessageId: string | null = null;

  if (conversation.channel === "whatsapp") {
    const { data: customer } = await supabase
      .from("customers")
      .select("phone")
      .eq("id", conversation.customer_id)
      .maybeSingle();

    if (!customer?.phone) {
      return Response.json({ error: "Customer has no WhatsApp phone number" }, { status: 400 });
    }

    const { data: connections } = await supabase
      .from("integration_connections")
      .select("config")
      .eq("business_id", conversation.business_id)
      .eq("provider", "whatsapp")
      .eq("status", "connected");

    const phoneNumberId =
      (connections?.[0]?.config as any)?.phone_number_id ||
      process.env.META_PHONE_NUMBER_ID;

    if (!phoneNumberId && process.env.WHATSAPP_MOCK_MODE !== "true") {
      return Response.json({ error: "WhatsApp is not connected for this workspace" }, { status: 400 });
    }

    const result: any = await sendWhatsAppText({
      phoneNumberId: phoneNumberId || "mock",
      to: String(customer.phone).replace(/\D/g, ""),
      body: text
    });

    externalMessageId = result?.messages?.[0]?.id ?? null;
  }

  await saveMessage({
    businessId: conversation.business_id,
    conversationId: conversation.id,
    customerId: conversation.customer_id,
    direction: "outbound",
    senderType: "human",
    content: text,
    metadata: {
      sent_by_user_id: user.id,
      external_message_id: externalMessageId
    }
  });

  await supabase
    .from("conversations")
    .update({
      status: "human",
      assigned_user_id: user.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", conversation.id);

  await cancelEscalationsForConversation(conversation.id);

  await writeAuditLog({
    businessId: conversation.business_id,
    actorUserId: user.id,
    action: "conversation.staff_reply",
    entityType: "conversation",
    entityId: conversation.id,
    metadata: { channel: conversation.channel, externalMessageId }
  });

  return Response.json({ ok: true, externalMessageId });
}
