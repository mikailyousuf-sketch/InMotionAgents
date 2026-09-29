import OpenAI from "openai";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const current = await getPrimaryUserBusiness();
  if (!["owner","admin"].includes(current.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const instruction = String(body?.instruction || "").trim();

  if (!instruction) return Response.json({ error: "Instruction is required" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "AI is not configured" }, { status: 500 });

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `You translate business-owner instructions into safe receptionist configuration proposals.
Return JSON only:
{
  "summary":"short plain-English summary",
  "changes":[
    {
      "type":"tone|faq|policy|guardrail|automation",
      "operation":"set|add",
      "data":{}
    }
  ]
}

Supported shapes:
tone/set: {"tone":"friendly_professional|casual|formal|luxury"}
faq/add: {"question":"...","answer":"..."}
policy/add: {"title":"...","content":"...","policy_type":"general|cancellation|payment|booking"}
guardrail/add: {"title":"...","instructions":"...","action":"handover|block|warn","priority":100}
automation/add: {
 "name":"...",
 "trigger_type":"booking_created|booking_reminder|lead_followup|manual",
 "channel":"whatsapp",
 "template_body":"...",
 "minutes_before":1440,
 "delay_minutes":1440
}

Rules:
- Never invent missing business facts.
- If the instruction is too vague to safely configure, return an empty changes array and explain what detail is missing in summary.
- Prefer guardrails for 'never', 'always escalate', refund disputes, sensitive exceptions or manager approval.
- Prefer policies for factual business rules.
- Prefer FAQs for reusable customer questions and answers.
- Only create automations for clear receptionist-related confirmations, reminders or follow-ups.
- Do not create marketing broadcasts or mass campaigns.`
      },
      {
        role: "user",
        content: `Business: ${current.business.name}\nInstruction: ${instruction}`
      }
    ],
    response_format: { type: "json_object" }
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  const changes = Array.isArray(parsed.changes) ? parsed.changes : [];
  const summary = String(parsed.summary || "Review the proposed changes.");

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("receptionist_change_proposals")
    .insert({
      business_id: current.business.id,
      requested_by: user.id,
      user_instruction: instruction,
      summary,
      changes,
      status: "proposed"
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ proposal: data });
}
