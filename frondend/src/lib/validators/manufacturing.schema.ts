import { z } from "zod";

const optionalNullableString = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
});

export const createBatchSchema = z.object({
  branchId: z.string().min(1, "Branch is required."),
  productId: z.string().min(1, "Product is required."),
  productionDate: z.string().min(1, "Production date is required."),
  recipeId: z.string().min(1, "Recipe is required."),
  plannedQuantity: z.coerce.number().positive("Planned quantity must be greater than 0."),
  notes: optionalNullableString,
});

export const createProductionSchema = z.object({
  branchId: z.string().min(1, "Branch is required."),
  productId: z.string().min(1, "Product is required."),
  productVariantId: optionalNullableString,
  productionDate: z.string().min(1, "Production date is required."),
  quantityProduced: z.coerce.number().positive("Produced quantity must be greater than 0."),
  recipeId: z.string().min(1, "Recipe is required."),
  notes: optionalNullableString,
});

export const consumeSchema = z.object({
  lines: z
    .array(
      z.object({
        batchIngredientId: z.string().min(1, "Ingredient line is required."),
        consumedQuantity: z.coerce.number().positive("Consumed quantity must be greater than 0."),
      }),
    )
    .min(1, "At least one ingredient line is required."),
});

export const produceSchema = z.object({
  quantityProduced: z.coerce.number().positive("Produced quantity must be greater than 0."),
});

export const wastageSchema = z.object({
  inventoryItemId: z.string().min(1, "Inventory item is required."),
  wastageType: z.string().min(1, "Wastage type is required."),
  quantity: z.coerce.number().positive("Wastage quantity must be greater than 0."),
  reason: z.string().min(1, "Reason is required."),
});

export const batchFiltersSchema = z.object({
  branchId: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
  productId: z.string(),
  search: z.string(),
  status: z.enum(["all", "draft", "in_progress", "partially_completed", "completed", "cancelled"]),
});

export type CreateBatchFormValues = z.infer<typeof createBatchSchema>;
export type CreateProductionFormValues = z.infer<typeof createProductionSchema>;
export type ConsumeFormValues = z.infer<typeof consumeSchema>;
export type ProduceFormValues = z.infer<typeof produceSchema>;
export type WastageFormValues = z.infer<typeof wastageSchema>;
