import { runAgentTurn } from "@/lib/agent/run-agent-turn";

export async function POST(request: Request) {
  const body = await request.json();

  const from = String(body?.from || "27820000000").replace(/\D/g, "");
  const message = String(body?.message || "").trim();

  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const result = await runAgentTurn({
    businessSlug: body?.businessSlug || "northstar-dental",
    userMessage: message,
    channel: "whatsapp",
    externalThreadId: from,
    customer: {
      phone: `+${from}`,
      fullName: body?.name || "WhatsApp Test Customer"
    }
  });

  return Response.json(result);
}
