import OpenAI from "openai";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const current = await getPrimaryUserBusiness();
  if (!["owner","admin"].includes(current.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const transcript = String(body?.transcript || "").trim();

  if (transcript.length < 50) {
    return Response.json({ error: "Paste a meaningful sample of previous customer conversations." }, { status: 400 });
  }

  const client = getOpenAIClient();
  if (!client) {
    return Response.json({ error: "AI analysis is not configured." }, { status: 500 });
  }

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `Analyze historical customer-service chats for an AI receptionist.
Extract only reusable business knowledge and communication-style insights.
Ignore one-off exceptions, employee mistakes, gossip, private/internal information, and anything uncertain.
Return JSON:
{
 "knowledge":[
  {"title":"short title","question":"customer-style question","answer":"approved-style factual answer","confidence":0.0}
 ],
 "tone":{
  "summary":"brief style summary",
  "recommended_tone":"friendly_professional|casual|formal|luxury",
  "traits":["short trait"]
 }
}
Return at most 12 knowledge items. Do not invent facts.`
      },
      {
        role: "user",
        content: `Business: ${current.business.name}\n\nHistorical chats:\n${transcript.slice(0, 50000)}`
      }
    ],
    response_format: { type: "json_object" }
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  const knowledge = Array.isArray(parsed.knowledge) ? parsed.knowledge : [];
  const tone = parsed.tone || null;

  const supabase = createServerSupabaseClient();
  const rows: any[] = [];

  for (const item of knowledge.slice(0,12)) {
    if (!item?.question || !item?.answer) continue;
    rows.push({
      business_id: current.business.id,
      suggestion_type: "historical_chat",
      title: String(item.title || item.question).slice(0,200),
      source_question: String(item.question),
      suggested_answer: String(item.answer),
      confidence: typeof item.confidence === "number" ? item.confidence : null,
      metadata: { source: "historical_chat_analysis" }
    });
  }

  if (tone?.summary) {
    rows.push({
      business_id: current.business.id,
      suggestion_type: "tone_insight",
      title: "Recommended communication style",
      source_question: null,
      suggested_answer: String(tone.summary),
      confidence: null,
      metadata: {
        source: "historical_chat_analysis",
        recommended_tone: tone.recommended_tone || "friendly_professional",
        traits: Array.isArray(tone.traits) ? tone.traits : []
      }
    });
  }

  if (rows.length) {
    const { error } = await supabase.from("knowledge_suggestions").insert(rows);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ created: rows.length });
}
