import OpenAI from "openai";
import { DEMO_BUSINESS } from "@/lib/demo-business";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ message: "OPENAI_API_KEY is not configured yet." }, { status: 500 });
  }

  const body = await request.json();
  const messages = Array.isArray(body?.messages) ? body.messages : [];

  const businessContext = JSON.stringify(DEMO_BUSINESS, null, 2);
  const system = `You are the customer-facing AI receptionist for ${DEMO_BUSINESS.name}.
Be concise, warm and professional. Never invent business information.
Use the business data below as the source of truth. If something is not provided, say you can have a staff member help.
Do not provide medical diagnoses or medical advice. For urgent or sensitive medical matters, tell the customer to contact the practice or appropriate emergency services.

BUSINESS DATA:\n${businessContext}`;

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    messages: [
      { role: "system", content: system },
      ...messages.slice(-12).map((message: { role: string; content: string }) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content || "")
      }))
    ]
  });

  const message = completion.choices[0]?.message?.content || "I couldn't create a response.";
  return Response.json({ message });
}
