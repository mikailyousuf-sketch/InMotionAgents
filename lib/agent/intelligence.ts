import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export async function generateHandoverSummary(input: {
  businessId: string;
  conversationId: string;
  customerId?: string | null;
  reason?: string | null;
}) {
  const supabase = createServerSupabaseClient();

  const { data: messages } = await supabase
    .from("messages")
    .select("sender_type,content,created_at")
    .eq("conversation_id", input.conversationId)
    .order("created_at", { ascending: true })
    .limit(40);

  const transcript = (messages ?? [])
    .map((m:any) => `${m.sender_type.toUpperCase()}: ${m.content}`)
    .join("\n");

  let summary = {
    customer_request: "",
    ai_actions: "",
    blocker: input.reason ?? "",
    suggested_next_action: "",
    raw_summary: ""
  };

  const client = getOpenAIClient();

  if (client && transcript) {
    try {
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: "Summarize a customer-service handover for staff. Be concise and factual. Return JSON with keys customer_request, ai_actions, blocker, suggested_next_action, raw_summary."
          },
          {
            role: "user",
            content: `Handover reason: ${input.reason || "Not specified"}\n\nTranscript:\n${transcript}`
          }
        ],
        response_format: { type: "json_object" }
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
      summary = {
        customer_request: String(parsed.customer_request || ""),
        ai_actions: String(parsed.ai_actions || ""),
        blocker: String(parsed.blocker || input.reason || ""),
        suggested_next_action: String(parsed.suggested_next_action || ""),
        raw_summary: String(parsed.raw_summary || "")
      };
    } catch {
      summary.raw_summary = input.reason || "Human assistance requested.";
    }
  } else {
    summary.raw_summary = input.reason || "Human assistance requested.";
  }

  const { error } = await supabase
    .from("handover_summaries")
    .upsert({
      business_id: input.businessId,
      conversation_id: input.conversationId,
      customer_id: input.customerId ?? null,
      reason: input.reason ?? null,
      customer_request: summary.customer_request,
      ai_actions: summary.ai_actions,
      blocker: summary.blocker,
      suggested_next_action: summary.suggested_next_action,
      raw_summary: summary.raw_summary,
      updated_at: new Date().toISOString()
    }, { onConflict: "conversation_id" });

  if (error) throw new Error(error.message);

  return summary;
}

export async function createKnowledgeSuggestion(input: {
  businessId: string;
  conversationId?: string | null;
  customerId?: string | null;
  type: "unanswered_question" | "repeated_question" | "historical_chat" | "tone_insight" | "policy_gap";
  title: string;
  sourceQuestion?: string | null;
  suggestedAnswer?: string | null;
  confidence?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("knowledge_suggestions")
    .insert({
      business_id: input.businessId,
      conversation_id: input.conversationId ?? null,
      customer_id: input.customerId ?? null,
      suggestion_type: input.type,
      title: input.title,
      source_question: input.sourceQuestion ?? null,
      suggested_answer: input.suggestedAnswer ?? null,
      confidence: input.confidence ?? null,
      metadata: input.metadata ?? {}
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
