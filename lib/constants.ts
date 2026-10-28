/**
 * Shared option lists. Labels here are what the admin and visitors see.
 * To add a new portfolio category or location type later, add it here — no
 * database migration is needed.
 */

export const PORTFOLIO_CATEGORIES = [
  "Surf",
  "Ocean",
  "Laamu",
  "Travel",
  "Commercial",
  "Resort",
  "Photography",
  "Videography",
] as const;

export const LOCATION_KINDS = [
  "Surf spot",
  "Island",
  "Beach",
  "Lagoon",
  "Reef",
  "Boats & marine",
  "Wildlife",
  "Local life",
  "Other",
] as const;

export const SERVICE_STATUS_LABEL = {
  ACTIVE: "Active",
  COMING_SOON: "Coming soon",
  HIDDEN: "Hidden",
} as const;

export const PRICE_TYPE_LABEL = {
  ON_REQUEST: "Price on request",
  FIXED: "Fixed price",
  FROM: "From",
  PER_PERSON: "Per person",
  PER_HOUR: "Per hour",
  PER_SESSION: "Per session",
} as const;

export const BOOKING_STATUS_LABEL = {
  NEW: "New",
  CONTACTED: "Contacted",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export const PAYMENT_STATUS_LABEL = {
  UNPAID: "Unpaid",
  DEPOSIT: "Deposit paid",
  PAID: "Paid",
  REFUNDED: "Refunded",
} as const;

export const SESSION_STATUS_LABEL = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export const DELIVERY_STATUS_LABEL = {
  NOT_READY: "Not ready",
  PROCESSING: "Processing",
  READY: "Ready",
  SENT: "Sent",
} as const;

export const TIME_SLOTS = ["Sunrise", "Morning", "Midday", "Afternoon", "Sunset", "Flexible"] as const;
