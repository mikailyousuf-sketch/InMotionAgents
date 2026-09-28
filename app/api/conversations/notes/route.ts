import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) return Response.json({ error: "conversationId is required" }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,business_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) return Response.json({ error: "Conversation not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", conversation.business_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data: notes, error } = await supabase
    .from("conversation_notes")
    .select("id,body,created_at,author_user_id")
    .eq("conversation_id", conversationId)
    .eq("business_id", conversation.business_id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const authorIds = Array.from(new Set((notes ?? []).map((note:any) => note.author_user_id).filter(Boolean)));
  const { data: profiles } = authorIds.length
    ? await supabase.from("user_profiles").select("id,full_name").in("id", authorIds)
    : { data: [] as any[] };

  const profileMap = new Map((profiles ?? []).map((profile:any) => [profile.id, profile.full_name]));

  return Response.json({
    notes: (notes ?? []).map((note:any) => ({
      ...note,
      author_name: profileMap.get(note.author_user_id) ?? "Staff"
    }))
  });
}

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const conversationId = String(body?.conversationId || "");
  const noteBody = String(body?.body || "").trim();

  if (!conversationId || !noteBody) {
    return Response.json({ error: "conversationId and body are required" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,business_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) return Response.json({ error: "Conversation not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", conversation.business_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data: note, error } = await supabase
    .from("conversation_notes")
    .insert({
      business_id: conversation.business_id,
      conversation_id: conversationId,
      author_user_id: user.id,
      body: noteBody
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ note });
}
