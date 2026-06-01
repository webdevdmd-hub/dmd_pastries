import { z } from "zod";

export const paymentStatusSchema = z.object({
  statusName: z.string().trim().min(2, "Status name must be at least 2 characters."),
  statusKey: z.string().trim().min(2, "Status key must be at least 2 characters."),
  color: z.string().trim().min(1, "Color is required."),
});

export type PaymentStatusSchema = z.infer<typeof paymentStatusSchema>;
