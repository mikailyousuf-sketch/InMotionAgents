import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function writeAuditLog(input: {
  businessId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.from("audit_logs").insert({
    business_id: input.businessId ?? null,
    actor_user_id: input.actorUserId ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {}
  });

  if (error) console.error("Audit log failed", error.message);
}
