export const DEMO_BUSINESS = {
  name: "Northstar Dental",
  timezone: "Africa/Johannesburg",
  phone: "+27 12 555 0101",
  openingHours: {
    monday: "08:00-17:00",
    tuesday: "08:00-17:00",
    wednesday: "08:00-17:00",
    thursday: "08:00-17:00",
    friday: "08:00-17:00",
    saturday: "08:00-13:00",
    sunday: "Closed"
  },
  services: [
    { name: "Consultation", durationMinutes: 30, priceZar: 550 },
    { name: "Cleaning", durationMinutes: 45, priceZar: 750 },
    { name: "Teeth whitening", durationMinutes: 60, priceZar: 2000 },
    { name: "Emergency consultation", durationMinutes: 30, priceZar: 850 }
  ],
  rules: [
    "Bookings may be cancelled or rescheduled if more than 12 hours remain.",
    "Emergency or clinically sensitive matters must be escalated to a human.",
    "The AI may never promise a refund or diagnose a medical condition.",
    "The AI may answer business questions and help arrange appointments."
  ]
};
