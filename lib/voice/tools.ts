export const voiceResponseTools = [
  {
    type:"function",
    name:"check_availability",
    description:"Check live available appointment slots before offering a time.",
    parameters:{
      type:"object",
      properties:{
        serviceName:{type:"string"},
        from:{type:"string",description:"ISO datetime with timezone offset"},
        to:{type:"string",description:"ISO datetime with timezone offset"}
      },
      required:["serviceName","from","to"],
      additionalProperties:false
    },
    strict:true
  },
  {
    type:"function",
    name:"create_booking",
    description:"Create a booking only after the caller clearly confirms an available slot.",
    parameters:{
      type:"object",
      properties:{
        serviceName:{type:"string"},
        customerName:{type:"string"},
        startsAt:{type:"string"},
        resourceId:{type:"string"},
        phone:{type:"string"},
        email:{type:"string"}
      },
      required:["serviceName","customerName","startsAt"],
      additionalProperties:false
    },
    strict:true
  },
  {
    type:"function",
    name:"find_bookings",
    description:"Find the caller's active bookings before changing or cancelling one.",
    parameters:{
      type:"object",
      properties:{
        customerName:{type:"string"},
        phone:{type:"string"}
      },
      additionalProperties:false
    },
    strict:true
  },
  {
    type:"function",
    name:"cancel_booking",
    description:"Cancel a booking when business policy permits.",
    parameters:{
      type:"object",
      properties:{
        bookingId:{type:"string"},
        reason:{type:"string"}
      },
      required:["bookingId"],
      additionalProperties:false
    },
    strict:true
  },
  {
    type:"function",
    name:"reschedule_booking",
    description:"Reschedule a booking to a new confirmed available start time when policy permits.",
    parameters:{
      type:"object",
      properties:{
        bookingId:{type:"string"},
        startsAt:{type:"string"},
        resourceId:{type:"string"}
      },
      required:["bookingId","startsAt"],
      additionalProperties:false
    },
    strict:true
  },
  {
    type:"function",
    name:"capture_customer_identity",
    description:"Capture or update the caller's name, phone number, or email.",
    parameters:{
      type:"object",
      properties:{
        fullName:{type:"string"},
        phone:{type:"string"},
        email:{type:"string"}
      },
      additionalProperties:false
    },
    strict:true
  },
  {
    type:"function",
    name:"request_human_handover",
    description:"Request a human staff handover when the caller asks for a person or human judgment is required.",
    parameters:{
      type:"object",
      properties:{
        reason:{type:"string"}
      },
      additionalProperties:false
    },
    strict:true
  }
] as const;
