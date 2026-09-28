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
  getOrCreateConversation,
  getConversationHistory,
  saveMessage,
  requestHumanHandover
} from "@/lib/crm/conversations";
import {
  findOrCreateCustomerByIdentity,
  attachConversationToCustomer
} from "@/lib/crm/identity";
import { applyLeadSignal } from "@/lib/crm/lead-intelligence";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { recordUsage } from "@/lib/billing/usage";
import { getAgentGuardrails, formatGuardrailsForPrompt, recordAgentEvent } from "@/lib/agent/guardrails";

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
    description: context.business.description,
    phone: context.business.phone,
    email: context.business.email,
    website: context.business.website,
    timezone: context.business.timezone,
    bookingProvider: context.business.booking_provider,
    tone: context.business.tone,
    agentName: context.business.agent_name,
    hours,
    services,
    policies: context.policies,
    faqs: context.faqs
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

export async function runAgentTurn(input: {
  businessSlug: string;
  userMessage: string;
  conversationId?: string | null;
  channel?: string;
  externalThreadId?: string | null;
  customer?: {
    id?: string | null;
    fullName?: string | null;
    phone?: string | null;
    email?: string | null;
  };
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const context = await getBusinessContext(input.businessSlug);

  let customerId = input.customer?.id ?? null;

  if (!customerId && (input.customer?.phone || input.customer?.email || input.customer?.fullName)) {
    const customer = await findOrCreateCustomerByIdentity({
      businessId: context.business.id,
      identity: {
        fullName: input.customer?.fullName,
        phone: input.customer?.phone,
        email: input.customer?.email
      }
    });
    customerId = customer.id;
  }

  const conversation = await getOrCreateConversation({
    businessId: context.business.id,
    customerId,
    conversationId: input.conversationId ?? null,
    channel: input.channel ?? "internal",
    externalThreadId: input.externalThreadId ?? null
  });

  if (customerId && conversation.customer_id !== customerId) {
    await attachConversationToCustomer({
      businessId: context.business.id,
      conversationId: conversation.id,
      customerId
    });
  }

  await saveMessage({
    businessId: context.business.id,
    conversationId: conversation.id,
    customerId: customerId ?? conversation.customer_id ?? null,
    direction: "inbound",
    senderType: "customer",
    content: input.userMessage
  });

  await Promise.all([
    recordUsage({
      businessId: context.business.id,
      eventType: "agent_turn",
      metadata: { channel: input.channel ?? "internal" }
    }),
    recordUsage({
      businessId: context.business.id,
      eventType: "message_inbound",
      metadata: { channel: input.channel ?? "internal" }
    })
  ]);

  if (conversation.status === "human") {
    return {
      message: "A team member has taken over this conversation. The AI will stay paused.",
      conversationId: conversation.id,
      customerId: customerId ?? conversation.customer_id ?? null,
      handover: true
    };
  }

  const history = await getConversationHistory(conversation.id, 18);
  const guardrails = await getAgentGuardrails(context.business.id);
  const business = formatBusinessContext(context);
  const businessContext = JSON.stringify(business, null, 2);

  const now = new Intl.DateTimeFormat("en-CA", {
    timeZone: business.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const system = `You are the customer-facing AI receptionist for ${business.name}.
Today is ${now} in the business timezone ${business.timezone}.
Speak in the configured business tone: ${business.tone || "friendly_professional"}.
Be concise, natural and professional. Never invent business information.
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
- Interpret relative dates using today's date above.
- Times should be discussed in the business timezone.
- Do not expose internal IDs unless needed to distinguish multiple bookings.

CUSTOM RECEPTIONIST GUARDRAILS:
${formatGuardrailsForPrompt(guardrails)}

When a configured guardrail says to hand over, do not improvise around it. Call request_human_handover and briefly tell the customer a team member will assist.

Do not provide medical diagnoses or medical advice. For urgent or sensitive medical matters, tell the customer to contact the practice or appropriate emergency services.

BUSINESS DATA:
${businessContext}`;

  const modelMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...history.map((message) => ({
      role: message.sender_type === "customer" ? "user" : "assistant",
      content: message.content
    })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  ];

  let consecutiveToolFailures = 0;

  for (let step = 0; step < 6; step++) {
    let completion: OpenAI.Chat.Completions.ChatCompletion;

    try {
      completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        messages: modelMessages,
        tools,
        tool_choice: "auto"
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "AI provider failed";

      await recordAgentEvent({
        businessId: context.business.id,
        conversationId: conversation.id,
        customerId: customerId ?? conversation.customer_id ?? null,
        eventType: "ai_provider_failure",
        severity: "error",
        message: errorMessage,
        metadata: { step }
      });

      await requestHumanHandover({
        businessId: context.business.id,
        conversationId: conversation.id,
        reason: "The AI receptionist is temporarily unavailable and a team member needs to assist."
      });

      const fallback = "I’m having a temporary system issue, so I’ve passed this conversation to a team member who can help you.";

      await saveMessage({
        businessId: context.business.id,
        conversationId: conversation.id,
        customerId: customerId ?? conversation.customer_id ?? null,
        direction: "outbound",
        senderType: "ai",
        content: fallback
      });

      return {
        message: fallback,
        conversationId: conversation.id,
        customerId: customerId ?? conversation.customer_id ?? null,
        handover: true
      };
    }

    const assistant = completion.choices[0]?.message;
    if (!assistant) throw new Error("No assistant response");

    modelMessages.push(assistant);

    if (!assistant.tool_calls?.length) {
      const responseMessage = assistant.content || "I couldn't create a response.";

      const supabase = createServerSupabaseClient();
      const { data: refreshedConversation } = await supabase
        .from("conversations")
        .select("customer_id,status")
        .eq("id", conversation.id)
        .single();

      const resolvedCustomerId = refreshedConversation?.customer_id ?? customerId ?? null;

      await saveMessage({
        businessId: context.business.id,
        conversationId: conversation.id,
        customerId: resolvedCustomerId,
        direction: "outbound",
        senderType: "ai",
        content: responseMessage
      });

      await recordUsage({
        businessId: context.business.id,
        eventType: "message_outbound",
        metadata: { channel: input.channel ?? "internal" }
      });

      return {
        message: responseMessage,
        conversationId: conversation.id,
        customerId: resolvedCustomerId,
        handover: refreshedConversation?.status === "human"
      };
    }

    for (const toolCall of assistant.tool_calls) {
      if (toolCall.type !== "function") continue;

      try {
        const result = await runTool(
          toolCall.function.name,
          toolCall.function.arguments,
          context.business.id,
          conversation.id,
          customerId ?? conversation.customer_id
        );

        consecutiveToolFailures = 0;

        modelMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ ok: true, result })
        });
      } catch (error) {
        consecutiveToolFailures += 1;
        const errorMessage = error instanceof Error ? error.message : "Tool failed";

        await recordAgentEvent({
          businessId: context.business.id,
          conversationId: conversation.id,
          customerId: customerId ?? conversation.customer_id ?? null,
          eventType: "tool_failure",
          severity: "warning",
          message: `${toolCall.function.name}: ${errorMessage}`,
          metadata: {
            tool: toolCall.function.name,
            step,
            consecutiveToolFailures
          }
        });

        modelMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            ok: false,
            error: errorMessage
          })
        });

        if (consecutiveToolFailures >= 2) {
          await requestHumanHandover({
            businessId: context.business.id,
            conversationId: conversation.id,
            reason: "The receptionist could not safely complete the requested action after repeated system failures."
          });

          await recordAgentEvent({
            businessId: context.business.id,
            conversationId: conversation.id,
            customerId: customerId ?? conversation.customer_id ?? null,
            eventType: "automatic_handover",
            severity: "warning",
            message: "Repeated tool failures triggered an automatic human handover.",
            metadata: { lastTool: toolCall.function.name }
          });

          const fallback = "I’m having trouble completing that safely right now, so I’ve handed this over to a team member who can assist you.";

          await saveMessage({
            businessId: context.business.id,
            conversationId: conversation.id,
            customerId: customerId ?? conversation.customer_id ?? null,
            direction: "outbound",
            senderType: "ai",
            content: fallback
          });

          return {
            message: fallback,
            conversationId: conversation.id,
            customerId: customerId ?? conversation.customer_id ?? null,
            handover: true
          };
        }
      }
    }
  }

  await requestHumanHandover({
    businessId: context.business.id,
    conversationId: conversation.id,
    reason: "The receptionist reached its safe action limit and needs human assistance."
  });

  await recordAgentEvent({
    businessId: context.business.id,
    conversationId: conversation.id,
    customerId: customerId ?? conversation.customer_id ?? null,
    eventType: "tool_loop_limit",
    severity: "warning",
    message: "Agent tool loop exceeded the safe step limit and was handed over."
  });

  const fallback = "I’m going to hand this over to a team member so we can make sure this is handled correctly.";

  await saveMessage({
    businessId: context.business.id,
    conversationId: conversation.id,
    customerId: customerId ?? conversation.customer_id ?? null,
    direction: "outbound",
    senderType: "ai",
    content: fallback
  });

  return {
    message: fallback,
    conversationId: conversation.id,
    customerId: customerId ?? conversation.customer_id ?? null,
    handover: true
  };
}
