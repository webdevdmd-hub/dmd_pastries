import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

const ingredientStatusSchema = z.enum(["active", "inactive"]);

export const createIngredientSchema = z.object({
  ingredientName: z.string().trim().min(2, "Ingredient name is required."),
  ingredientCategoryId: z.string().trim().min(1, "Ingredient category is required."),
  supplierId: optionalTrimmedString,
  unitId: z.string().trim().min(1, "Unit is required."),
  costPerUnit: z.coerce.number().min(0, "Cost must be zero or more."),
  isStockTracked: z.boolean(),
  isExpiryTracked: z.boolean(),
  reorderLevel: z.coerce.number().min(0, "Reorder level must be zero or more."),
  description: optionalTrimmedString,
  imageFileId: optionalTrimmedString,
});

export const updateIngredientSchema = createIngredientSchema.partial();

export const updateIngredientStatusSchema = z.object({
  status: ingredientStatusSchema,
});

export const ingredientFiltersSchema = z.object({
  search: z.string(),
  categoryId: z.string(),
  supplierId: z.string(),
  status: z.union([ingredientStatusSchema, z.literal("all")]),
  stockTracked: z.union([z.literal("all"), z.literal("true"), z.literal("false")]),
});

export type CreateIngredientFormValues = z.infer<typeof createIngredientSchema>;
