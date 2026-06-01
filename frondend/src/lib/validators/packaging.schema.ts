import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

const packagingStatusSchema = z.enum(["active", "inactive"]);

export const createPackagingSchema = z.object({
  packagingName: z.string().trim().min(2, "Packaging name is required."),
  packagingCategoryId: z.string().trim().min(1, "Packaging category is required."),
  supplierId: optionalTrimmedString,
  unitId: z.string().trim().min(1, "Unit is required."),
  costPerUnit: z.coerce.number().min(0, "Cost must be zero or more."),
  isStockTracked: z.boolean(),
  isConsumable: z.boolean(),
  reorderLevel: z.coerce.number().min(0, "Reorder level must be zero or more."),
  description: optionalTrimmedString,
  imageFileId: optionalTrimmedString,
});

export const updatePackagingSchema = createPackagingSchema.partial();

export const updatePackagingStatusSchema = z.object({
  status: packagingStatusSchema,
});

export const createPackagingUsageSchema = z.object({
  packagingItemId: z.string().trim().min(1, "Packaging item is required."),
  quantityRequired: z.coerce.number().positive("Quantity required must be greater than zero."),
  isDefault: z.boolean(),
});

export const packagingFiltersSchema = z.object({
  search: z.string(),
  categoryId: z.string(),
  supplierId: z.string(),
  status: z.union([packagingStatusSchema, z.literal("all")]),
  stockTracked: z.union([z.literal("all"), z.literal("true"), z.literal("false")]),
});

export type CreatePackagingFormValues = z.infer<typeof createPackagingSchema>;
export type CreatePackagingUsageFormValues = z.infer<typeof createPackagingUsageSchema>;
