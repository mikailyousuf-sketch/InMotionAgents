import { runAgentTurn } from "@/lib/agent/run-agent-turn";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const latestUserMessage = [...messages].reverse().find(
      (message: { role?: string; content?: string }) => message?.role === "user" && message?.content
    );

    if (!latestUserMessage?.content) {
      return Response.json({ message: "No user message provided." }, { status: 400 });
    }

    const result = await runAgentTurn({
      businessSlug: typeof body?.businessSlug === "string" ? body.businessSlug : "northstar-dental",
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
