import { z } from "zod";

const nullableText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
  );

const nullableNonNegativeNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
  z.number().min(0).nullable(),
);

const outputVariantModeSchema = z.enum(["parent", "existing", "new"]);

export const yieldSchema = z.object({
  batchYieldQuantity: z.coerce.number().positive("Yield quantity must be greater than 0."),
  batchYieldUnitId: z.string().min(1, "Yield unit is required."),
  preparationTimeMinutes: nullableNonNegativeNumber,
});

export const ingredientLineSchema = z.object({
  componentProductId: z.string().min(1, "Component product is required."),
  componentVariantId: nullableText,
  quantityRequired: z.coerce.number().positive("Quantity must be greater than 0."),
  unitId: z.string().min(1, "Unit is required."),
  wastagePercentage: z.coerce.number().min(0, "Wastage cannot be negative."),
  notes: nullableText,
  sortOrder: z.coerce.number().int().min(0),
});

export const packagingLineSchema = z.object({
  componentProductId: z.string().min(1, "Packaging product is required."),
  componentVariantId: nullableText,
  quantityRequired: z.coerce.number().positive("Quantity must be greater than 0."),
  unitId: z.string().min(1, "Unit is required."),
  isOptional: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
});

const recipeBaseSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  outputVariantMode: outputVariantModeSchema,
  productVariantId: z.string().optional(),
  newProductVariantName: z.string().trim().optional(),
  newProductVariantSku: nullableText,
  newProductVariantSalePrice: nullableNonNegativeNumber,
  recipeName: z.string().trim().min(1, "Recipe name is required."),
  description: nullableText,
  batchYieldQuantity: z.coerce.number().positive("Yield quantity must be greater than 0."),
  batchYieldUnitId: z.string().min(1, "Yield unit is required."),
  preparationTimeMinutes: nullableNonNegativeNumber,
  instructions: nullableText,
  ingredients: z.array(ingredientLineSchema).default([]),
  packaging: z.array(packagingLineSchema).default([]),
});

export const createRecipeSchema = recipeBaseSchema.superRefine((values, context) => {
  if (values.outputVariantMode === "existing" && !values.productVariantId?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select an existing product variant.",
      path: ["productVariantId"],
    });
  }

  if (values.outputVariantMode === "new") {
    if (!values.newProductVariantName?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Variant name is required.",
        path: ["newProductVariantName"],
      });
    }

    if (values.newProductVariantSalePrice === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Variant sale price is required.",
        path: ["newProductVariantSalePrice"],
      });
    }
  }
});

export const updateRecipeSchema = recipeBaseSchema.partial();

export const updateRecipeStatusSchema = z.object({
  status: z.enum(["draft", "active", "inactive", "archived"]),
  isActive: z.boolean().optional(),
});

export const recipeVersionSchema = z.object({
  changeNote: nullableText,
});

export const recipeFiltersSchema = z.object({
  search: z.string(),
  productId: z.string(),
  status: z.enum(["all", "draft", "active", "inactive", "archived"]),
  active: z.enum(["all", "true", "false"]),
});

export type CreateRecipeFormValues = z.infer<typeof createRecipeSchema>;
export type CreateRecipeInputValues = z.input<typeof createRecipeSchema>;
export type IngredientLineFormValues = z.infer<typeof ingredientLineSchema>;
export type PackagingLineFormValues = z.infer<typeof packagingLineSchema>;
export type RecipeVersionFormValues = z.infer<typeof recipeVersionSchema>;
