import type { OrderStatus } from "@prisma/client";
import type { BadgeTone } from "@/components/admin/ui";

export const ORDER_STATUS: Record<OrderStatus, [string, BadgeTone]> = {
  AWAITING_PAYMENT: ["Waiting for payment", "blue"],
  PAID: ["Paid — to deliver", "amber"],
  DELIVERED: ["Delivered", "green"],
  CANCELLED: ["Cancelled", "gray"],
};
