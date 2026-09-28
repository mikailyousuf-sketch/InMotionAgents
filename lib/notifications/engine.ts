import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function dispatchStaffEvent(input: {
  businessId: string;
  eventType: string;
  conversationId?: string | null;
  customerId?: string | null;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServerSupabaseClient();

  const { data: rules, error } = await supabase
    .from("notification_rules")
    .select("*")
    .eq("business_id", input.businessId)
    .eq("event_type", input.eventType)
    .eq("active", true);

  if (error) throw new Error(error.message);

  const createdNotifications: any[] = [];
  const createdEscalations: any[] = [];

  for (const rule of rules ?? []) {
    const recipients = new Set<string>();

    if (rule.recipient_user_id) {
      recipients.add(rule.recipient_user_id);
    }

    if (rule.recipient_role) {
      const { data: members } = await supabase
        .from("business_members")
        .select("user_id")
        .eq("business_id", input.businessId)
        .eq("role", rule.recipient_role);

      for (const member of members ?? []) {
        recipients.add(member.user_id);
      }
    }

    if (rule.delay_minutes > 0) {
      const scheduledFor = new Date(Date.now() + rule.delay_minutes * 60_000).toISOString();

      const { data: escalation, error: escalationError } = await supabase
        .from("escalation_jobs")
        .insert({
          business_id: input.businessId,
          notification_rule_id: rule.id,
          conversation_id: input.conversationId ?? null,
          customer_id: input.customerId ?? null,
          event_type: input.eventType,
          scheduled_for: scheduledFor,
          status: "pending",
          metadata: {
            title: input.title,
            body: input.body,
            recipients: Array.from(recipients),
            channel: rule.channel,
            ...(input.metadata ?? {})
          }
        })
        .select("*")
        .single();

      if (escalationError) throw new Error(escalationError.message);
      createdEscalations.push(escalation);
      continue;
    }

    for (const userId of recipients) {
      const { data: notification, error: notificationError } = await supabase
        .from("notifications")
        .insert({
          business_id: input.businessId,
          user_id: userId,
          conversation_id: input.conversationId ?? null,
          customer_id: input.customerId ?? null,
          event_type: input.eventType,
          title: input.title,
          body: input.body,
          status: "unread",
          metadata: {
            channel: rule.channel,
            ...(input.metadata ?? {})
          }
        })
        .select("*")
        .single();

      if (notificationError) throw new Error(notificationError.message);
      createdNotifications.push(notification);
    }
  }

  return {
    notifications: createdNotifications,
    escalations: createdEscalations
  };
}

export async function cancelEscalationsForConversation(conversationId: string) {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("escalation_jobs")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString()
    })
    .eq("conversation_id", conversationId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);
}
