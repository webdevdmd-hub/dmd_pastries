import { z } from "zod";

export const manualMovementSchema = z.object({
  inventoryItemId: z.string().min(1, "Inventory item is required."),
  movementType: z.enum(["adjustment_in", "adjustment_out", "wastage", "return_in"]),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  reason: z.string().min(2, "Reason is required."),
  notes: z.string().optional(),
});

export const reversalSchema = z.object({
  reason: z.string().min(2, "Reason is required."),
});

export const movementFiltersSchema = z.object({
  search: z.string(),
  branchId: z.string(),
  itemType: z.enum(["all", "product", "ingredient", "packaging"]),
  movementType: z.enum([
    "all",
    "opening_stock",
    "purchase_in",
    "sale_out",
    "adjustment_in",
    "adjustment_out",
    "wastage",
    "return_in",
    "transfer_in",
    "transfer_out",
    "production_in",
    "production_out",
    "reversal",
  ]),
  direction: z.enum(["all", "in", "out", "neutral"]),
  dateFrom: z.string(),
  dateTo: z.string(),
  createdBy: z.string(),
});

export type ManualMovementSchema = z.infer<typeof manualMovementSchema>;
export type ReversalSchema = z.infer<typeof reversalSchema>;
