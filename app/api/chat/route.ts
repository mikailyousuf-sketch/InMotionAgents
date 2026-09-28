import OpenAI from "openai";
import { getBusinessContext } from "@/lib/business-context";
import {
  checkAvailability,
  createBookingFromAgent,
  findBookings,
  cancelBookingFromAgent,
  rescheduleBookingFromAgent
} from "@/lib/booking/agent-tools";
import {
  getOrCreateInternalConversation,
  saveMessage,
  requestHumanHandover
} from "@/lib/crm/conversations";
import {
  findOrCreateCustomerByIdentity,
  attachConversationToCustomer
} from "@/lib/crm/identity";
import { applyLeadSignal } from "@/lib/crm/lead-intelligence";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
      name: "capture_customer_identity",
      description: "Capture or update the customer's identity when they provide a name, phone number, or email address.",
      parameters: {
        type: "object",
        properties: {
          fullName: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "mark_lead_signal",
      description: "Update the customer lead stage based on the strongest clear buying signal in the conversation.",
      parameters: {
        type: "object",
        properties: {
          signal: {
            type: "string",
            enum: [
              "general_question",
              "pricing_interest",
              "availability_interest",
              "booking_intent",
              "booking_created",
              "payment_intent",
              "not_interested"
            ]
          }
        },
        required: ["signal"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "request_human_handover",
      description: "Hand the conversation to a human staff member when the customer asks for a person or the issue requires human intervention.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" }
        },
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

async function runTool(
  name: string,
  rawArguments: string,
  businessId: string,
  conversationId: string,
  customerId?: string | null
) {
  const args = JSON.parse(rawArguments || "{}");

  if (name === "check_availability") {
    return checkAvailability({ businessId, ...args });
  }
  if (name === "create_booking") {
    const result = await createBookingFromAgent({ businessId, ...args });

    if (result.customerId) {
      await attachConversationToCustomer({
        businessId,
        conversationId,
        customerId: result.customerId
      });
      await applyLeadSignal({
        businessId,
        customerId: result.customerId,
        signal: "booking_created"
      });
    }

    return result;
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
  if (name === "capture_customer_identity") {
    const customer = await findOrCreateCustomerByIdentity({
      businessId,
      identity: {
        fullName: args.fullName,
        phone: args.phone,
        email: args.email
      }
    });
    await attachConversationToCustomer({
      businessId,
      conversationId,
      customerId: customer.id
    });
    return {
      customerId: customer.id,
      fullName: customer.full_name,
      phone: customer.phone,
      email: customer.email,
      leadStatus: customer.lead_status
    };
  }
  if (name === "mark_lead_signal") {
    let resolvedCustomerId = customerId ?? null;

    if (!resolvedCustomerId) {
      const supabase = createServerSupabaseClient();
      const { data: currentConversation } = await supabase
        .from("conversations")
        .select("customer_id")
        .eq("id", conversationId)
        .single();

      resolvedCustomerId = currentConversation?.customer_id ?? null;
    }

    if (!resolvedCustomerId) {
      return { skipped: true, reason: "No customer profile is attached yet" };
    }

    const customer = await applyLeadSignal({
      businessId,
      customerId: resolvedCustomerId,
      signal: args.signal
    });
    return { customerId: customer.id, leadStatus: customer.lead_status };
  }
  if (name === "request_human_handover") {
    const conversation = await requestHumanHandover({
      businessId,
      conversationId,
      reason: args.reason
    });
    return { status: conversation.status };
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
    const conversation = await getOrCreateInternalConversation({
      businessId: context.business.id,
      conversationId: typeof body?.conversationId === "string" ? body.conversationId : null
    });

    const latestUserMessage = [...messages].reverse().find(
      (message: { role?: string; content?: string }) => message?.role === "user" && message?.content
    );

    if (latestUserMessage?.content) {
      await saveMessage({
        businessId: context.business.id,
        conversationId: conversation.id,
        direction: "inbound",
        senderType: "customer",
        content: String(latestUserMessage.content)
      });
    }

    if (conversation.status === "human") {
      return Response.json({
        message: "A team member has taken over this conversation. The AI will stay paused.",
        conversationId: conversation.id,
        handover: true
      });
    }
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
- If the customer gives their name, phone number, or email address and that identity is not yet captured, call capture_customer_identity.
- Use mark_lead_signal for meaningful commercial intent: pricing/availability interest, booking intent, successful booking, payment intent, or clear loss of interest.
- Do not over-classify casual FAQ questions as qualified leads.
- If a tool returns a policy error requiring human assistance, call request_human_handover.
- If the customer asks to speak to a person, manager, receptionist, staff member, or human, call request_human_handover immediately.
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
        const responseMessage = assistant.content || "I couldn't create a response.";

        await saveMessage({
          businessId: context.business.id,
          conversationId: conversation.id,
          direction: "outbound",
          senderType: "ai",
          content: responseMessage
        });

        return Response.json({
          message: responseMessage,
          source: "supabase",
          bookingTools: true,
          conversationId: conversation.id,
          customerId: conversation.customer_id ?? null
        });
      }

      for (const toolCall of assistant.tool_calls) {
        if (toolCall.type !== "function") continue;

        try {
          const result = await runTool(
            toolCall.function.name,
            toolCall.function.arguments,
            context.business.id,
            conversation.id,
            conversation.customer_id
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
