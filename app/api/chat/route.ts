import OpenAI from "openai";
import { getBusinessContext } from "@/lib/business-context";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatBusinessContext(context: Awaited<ReturnType<typeof getBusinessContext>>) {
  const hours = context.hours.map((row) => ({
    day: DAY_NAMES[row.day_of_week] ?? String(row.day_of_week),
    hours: row.closed
      ? "Closed"
      : `${String(row.opens_at).slice(0, 5)}-${String(row.closes_at).slice(0, 5)}`
  }));

  const services = context.services.map((service) => ({
    name: service.name,
    description: service.description,
    durationMinutes: service.duration_minutes,
    price: service.price_cents == null
      ? null
      : `${service.currency} ${(service.price_cents / 100).toFixed(2)}`
  }));

  return {
    name: context.business.name,
    timezone: context.business.timezone,
    bookingProvider: context.business.booking_provider,
    hours,
    services,
    rules: [
      "Bookings may be cancelled or rescheduled if more than 12 hours remain.",
      "Emergency or clinically sensitive matters must be escalated to a human.",
      "Never promise a refund or diagnose a medical condition.",
      "You may answer business questions and help arrange appointments."
    ]
  };
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ message: "OPENAI_API_KEY is not configured yet." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const businessSlug = typeof body?.businessSlug === "string" ? body.businessSlug : "northstar-dental";

    const context = await getBusinessContext(businessSlug);
    const business = formatBusinessContext(context);
    const businessContext = JSON.stringify(business, null, 2);

    const system = `You are the customer-facing AI receptionist for ${business.name}.
Be concise, warm and professional. Never invent business information.
Use only the business data below as the source of truth.
If something is not provided, say you can have a staff member help.
Do not provide medical diagnoses or medical advice. For urgent or sensitive medical matters, tell the customer to contact the practice or appropriate emergency services.

BUSINESS DATA:
${businessContext}`;

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
    return Response.json({ message, source: "supabase" });
  } catch (error) {
    console.error("Agent chat error", error);
    return Response.json(
      { message: "The agent could not load the business workspace. Check the Supabase connection and demo seed." },
      { status: 500 }
    );
  }
}
