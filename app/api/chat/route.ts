import OpenAI from "openai";
import { getBusinessContext } from "@/lib/business-context";
import {
  checkAvailability,
  createBookingFromAgent,
  findBookings,
  cancelBookingFromAgent,
  rescheduleBookingFromAgent
} from "@/lib/booking/agent-tools";

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

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check live available appointment slots for a business service.",
      parameters: {
        type: "object",
        properties: {
          serviceName: { type: "string" },
          from: { type: "string", description: "ISO datetime with timezone offset" },
          to: { type: "string", description: "ISO datetime with timezone offset" }
        },
        required: ["serviceName", "from", "to"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_booking",
      description: "Create a confirmed appointment only after the customer has clearly selected an offered available slot.",
      parameters: {
        type: "object",
        properties: {
          serviceName: { type: "string" },
          customerName: { type: "string" },
          startsAt: { type: "string", description: "ISO datetime for the chosen slot" },
          resourceId: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" }
        },
        required: ["serviceName", "customerName", "startsAt"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "find_bookings",
      description: "Find active bookings for a customer so they can be changed or cancelled.",
      parameters: {
        type: "object",
        properties: {
          customerName: { type: "string" },
          phone: { type: "string" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cancel_booking",
      description: "Cancel a booking when policy permits. Use find_bookings first if the booking ID is unknown.",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          reason: { type: "string" }
        },
        required: ["bookingId"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reschedule_booking",
      description: "Move an existing booking to a new confirmed available start time when policy permits.",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          startsAt: { type: "string", description: "ISO datetime for the new slot" },
          resourceId: { type: "string" }
        },
        required: ["bookingId", "startsAt"],
        additionalProperties: false
      }
    }
  }
];

async function runTool(name: string, rawArguments: string, businessId: string) {
  const args = JSON.parse(rawArguments || "{}");

  if (name === "check_availability") {
    return checkAvailability({ businessId, ...args });
  }
  if (name === "create_booking") {
    return createBookingFromAgent({ businessId, ...args });
  }
  if (name === "find_bookings") {
    return findBookings({ businessId, ...args });
  }
  if (name === "cancel_booking") {
    return cancelBookingFromAgent({ businessId, ...args });
  }
  if (name === "reschedule_booking") {
    return rescheduleBookingFromAgent({ businessId, ...args });
  }

  throw new Error(`Unknown tool: ${name}`);
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
Today is 2026-09-28 in the business timezone ${business.timezone}.
Be concise, warm and professional. Never invent business information.
Use only the business data below as the source of truth.
Use booking tools whenever availability, booking, rescheduling, or cancellation requires live data.

BOOKING RULES:
- Never invent or guess availability.
- Always call check_availability before offering times.
- Offer a small useful selection of returned slots, not every slot.
- Do not call create_booking until the customer clearly chooses a slot and gives their name.
- When create_booking succeeds, clearly confirm the booking.
- For cancellations/reschedules, identify the booking first when necessary.
- If a tool returns a policy error requiring human assistance, explain that and offer human handover.
- Interpret relative dates such as tomorrow using today's date above.
- Times should be discussed in the business timezone.
- Do not expose internal IDs unless needed to distinguish multiple bookings.

Do not provide medical diagnoses or medical advice. For urgent or sensitive medical matters, tell the customer to contact the practice or appropriate emergency services.

BUSINESS DATA:
${businessContext}`;

    const conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      ...messages.slice(-16).map((message: { role: string; content: string }) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content || "")
      })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[]
    ];

    for (let step = 0; step < 6; step++) {
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        messages: conversation,
        tools,
        tool_choice: "auto"
      });

      const assistant = completion.choices[0]?.message;
      if (!assistant) throw new Error("No assistant response");

      conversation.push(assistant);

      if (!assistant.tool_calls?.length) {
        return Response.json({
          message: assistant.content || "I couldn't create a response.",
          source: "supabase",
          bookingTools: true
        });
      }

      for (const toolCall of assistant.tool_calls) {
        if (toolCall.type !== "function") continue;

        try {
          const result = await runTool(
            toolCall.function.name,
            toolCall.function.arguments,
            context.business.id
          );

          conversation.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ ok: true, result })
          });
        } catch (error) {
          conversation.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : "Tool failed"
            })
          });
        }
      }
    }

    return Response.json(
      { message: "I couldn't finish that booking request. A staff member can help." },
      { status: 500 }
    );
  } catch (error) {
    console.error("Agent chat error", error);
    return Response.json(
      { message: "The agent could not load the business workspace. Check the local server logs." },
      { status: 500 }
    );
  }
}
