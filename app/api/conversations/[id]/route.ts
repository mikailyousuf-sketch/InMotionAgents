import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const [{ data: conversation, error: conversationError }, { data: messages, error: messagesError }] = await Promise.all([
    supabase.from("conversations").select("*").eq("id", id).single(),
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at")
  ]);

  if (conversationError) return Response.json({ error: conversationError.message }, { status: 404 });
  if (messagesError) return Response.json({ error: messagesError.message }, { status: 500 });

  return Response.json({ conversation, messages: messages ?? [] });
}
