import { runAgentTurn } from "@/lib/agent/run-agent-turn";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await createAuthServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return Response.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const latestUserMessage = [...messages].reverse().find(
      (message: { role?: string; content?: string }) => message?.role === "user" && message?.content
    );

    if (!latestUserMessage?.content) {
      return Response.json({ message: "No user message provided." }, { status: 400 });
    }

    const businessSlug = typeof body?.businessSlug === "string" ? body.businessSlug : "northstar-dental";
    const admin = createServerSupabaseClient();
    const { data: business } = await admin.from("businesses").select("id").eq("slug", businessSlug).maybeSingle();
    if (!business) return Response.json({ message: "Workspace not found" }, { status: 404 });
    const { data: membership } = await admin
      .from("business_members")
      .select("role")
      .eq("business_id", business.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return Response.json({ message: "Forbidden" }, { status: 403 });

    const result = await runAgentTurn({
      businessSlug,
      userMessage: String(latestUserMessage.content),
      conversationId: typeof body?.conversationId === "string" ? body.conversationId : null,
      channel: "internal"
    });

    return Response.json({
      ...result,
      source: "supabase",
      bookingTools: true
    });
  } catch (error) {
    console.error("Agent chat error", error);
    return Response.json(
      {
        message: error instanceof Error
          ? error.message
          : "The agent could not process the request."
      },
      { status: 500 }
    );
  }
}
