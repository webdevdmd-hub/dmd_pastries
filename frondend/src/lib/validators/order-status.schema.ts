import { z } from "zod";

export const orderStatusSchema = z.object({
  statusName: z.string().trim().min(2, "Status name must be at least 2 characters."),
  statusKey: z.string().trim().min(2, "Status key must be at least 2 characters."),
  sortOrder: z.coerce.number().int().min(0, "Sort order cannot be negative."),
  color: z.string().trim().min(1, "Color is required."),
  isFinalStatus: z.boolean(),
});

export type OrderStatusSchema = z.infer<typeof orderStatusSchema>;
