export type BookingProvider = "inmotion" | "google" | "outlook" | "playtomic" | "dineplan" | "custom";

export interface BookingProviderAdapter {
  getAvailability(input: { businessId: string; serviceId?: string; resourceId?: string; from: string; to: string }): Promise<unknown>;
  createBooking(input: Record<string, unknown>): Promise<unknown>;
  updateBooking(input: Record<string, unknown>): Promise<unknown>;
  cancelBooking(input: { bookingId: string; reason?: string }): Promise<unknown>;
  getBooking(input: { bookingId: string }): Promise<unknown>;
}
