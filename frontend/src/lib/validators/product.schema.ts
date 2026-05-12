import { z } from "zod";

const productTypeSchema = z.enum([
  "ready_to_sell",
  "made_to_order",
  "manufactured",
  "retail",
  "service",
]);

const recordStatusSchema = z.enum(["active", "inactive"]);

export const productSchema = z
  .object({
    productName: z.string().trim().min(2, "Product name must be at least 2 characters."),
    categoryId: z.string().trim().min(1, "Category is required."),
    unitId: z.string().trim().min(1, "Unit is required."),
    taxRateId: z.string().trim().optional(),
    productType: productTypeSchema,
    salePrice: z.coerce.number().min(0, "Sale price must be at least 0."),
    costPrice: z
      .union([z.coerce.number().min(0, "Cost price must be at least 0."), z.null()])
      .optional(),
    compareAtPrice: z
      .union([z.coerce.number().min(0, "Compare at price must be at least 0."), z.null()])
      .optional(),
    sku: z.string().trim().optional(),
    barcode: z.string().trim().optional(),
    description: z.string().trim().optional(),
    imageFileId: z.string().trim().optional(),
    isPosVisible: z.boolean(),
    isStockTracked: z.boolean(),
    isExpiryTracked: z.boolean(),
    isCustomOrderAvailable: z.boolean(),
    preparationTimeMinutes: z
      .union([z.coerce.number().int().min(0, "Preparation time cannot be negative."), z.null()])
      .optional(),
  })
  .refine(
    (values) =>
      values.compareAtPrice === undefined ||
      values.compareAtPrice === null ||
      values.compareAtPrice >= values.salePrice,
    {
      message: "Compare at price must be greater than or equal to sale price.",
      path: ["compareAtPrice"],
    },
  );

export const productVariantSchema = z.object({
  variantName: z.string().trim().min(2, "Variant name must be at least 2 characters."),
  sku: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  salePrice: z.coerce.number().min(0, "Sale price must be at least 0."),
  costPrice: z
    .union([z.coerce.number().min(0, "Cost price must be at least 0."), z.null()])
    .optional(),
  imageFileId: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().min(0, "Sort order cannot be negative."),
  status: recordStatusSchema,
});

export type ProductSchema = z.infer<typeof productSchema>;
export type ProductVariantSchema = z.infer<typeof productVariantSchema>;
