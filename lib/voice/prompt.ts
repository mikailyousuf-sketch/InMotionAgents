import { getBusinessContext } from "@/lib/business-context";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export async function buildVoiceSessionPrompts(slug: string) {
  const context = await getBusinessContext(slug);

  const voiceInstructions = [
    `You are ${context.business.agent_name || "the receptionist"} for ${context.business.name}.`,
    "You are answering a real phone call. Speak naturally, briefly, and professionally.",
    "Use short sentences and ask one question at a time.",
    "Never invent business facts, availability, prices, bookings, policies, or outcomes.",
    "For anything requiring live business data or an action, delegate to the backend before answering.",
    "If the caller asks for a human or the issue needs human judgment, say you can bring in a staff member.",
    "Do not read URLs, IDs, JSON, or internal system details aloud."
  ].join("\n");

  const hours = context.hours.map((row:any) =>
    `${DAYS[row.day_of_week] || row.day_of_week}: ${row.closed ? "Closed" : `${String(row.opens_at).slice(0,5)}-${String(row.closes_at).slice(0,5)}`}`
  ).join("\n");

  const services = context.services.map((service:any) => {
    const price = service.price_cents == null
      ? "price not specified"
      : `${service.currency} ${(service.price_cents / 100).toFixed(2)}`;
    return `- ${service.name}: ${service.duration_minutes} min, ${price}${service.description ? ` — ${service.description}` : ""}`;
  }).join("\n");

  const policies = context.policies.map((policy:any) => `- ${policy.title}: ${policy.content}`).join("\n");
  const faqs = context.faqs.map((faq:any) => `- Q: ${faq.question}\n  A: ${faq.answer}`).join("\n");

  const backendInstructions = [
    `You are the backend reasoning agent for the phone receptionist at ${context.business.name}.`,
    "Use approved business information only.",
    "Live availability, booking creation, rescheduling, cancellation, customer lookup, and human handover must be handled by application tools when available.",
    "Never claim an action succeeded without a successful tool result.",
    `Timezone: ${context.business.timezone}`,
    `Business description: ${context.business.description || "Not provided"}`,
    "Hours:",
    hours || "Not configured",
    "Services:",
    services || "None configured",
    "Policies:",
    policies || "None configured",
    "FAQs:",
    faqs || "None configured"
  ].join("\n");

  return { voiceInstructions, backendInstructions };
}
