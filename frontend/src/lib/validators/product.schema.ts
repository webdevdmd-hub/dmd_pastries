import { z } from "zod";

import { ITEM_STRUCTURES, PRODUCT_TYPES } from "@/types/product";

const productTypeSchema = z.enum(PRODUCT_TYPES);
const itemStructureSchema = z.enum(ITEM_STRUCTURES);
const costUpdatePolicySchema = z.enum([
  "manual",
  "latest_purchase",
  "weighted_average",
  "recipe_actual",
]);
const pricingTypeSchema = z.enum(["markup", "margin"]);

const recordStatusSchema = z.enum(["active", "inactive"]);

export const productSchema = z.object({
  productName: z.string().trim().min(2, "Product name must be at least 2 characters."),
  categoryId: z.string().trim().min(1, "Category is required."),
  unitId: z.string().trim().min(1, "Unit is required."),
  taxRateId: z.string().trim().optional(),
  productType: productTypeSchema,
  itemStructure: itemStructureSchema,
  salePrice: z.coerce.number().min(0, "Sale price must be at least 0."),
  costPrice: z
    .union([z.coerce.number().min(0, "Cost price must be at least 0."), z.null()])
    .optional(),
  costUpdatePolicy: costUpdatePolicySchema,
  pricingType: pricingTypeSchema,
  pricingPercent: z.coerce.number().min(0, "Pricing percent cannot be negative."),
  minimumSalePrice: z
    .union([z.coerce.number().min(0, "Minimum sale price must be at least 0."), z.null()])
    .optional(),
  autoPriceUpdateEnabled: z.boolean(),
  salePriceLocked: z.boolean(),
  sku: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  description: z.string().trim().optional(),
  imageFileId: z.string().trim().optional(),
  isSellable: z.boolean(),
  isPosVisible: z.boolean(),
  isStockTracked: z.boolean(),
  isExpiryTracked: z.boolean(),
  isCustomOrderAvailable: z.boolean(),
  preparationTimeMinutes: z
    .union([z.coerce.number().int().min(0, "Preparation time cannot be negative."), z.null()])
    .optional(),
});

export const productVariantSchema = z.object({
  variantName: z.string().trim().min(2, "Variant name must be at least 2 characters."),
  sku: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  salePrice: z.coerce.number().min(0, "Sale price must be at least 0."),
  costPrice: z
    .union([z.coerce.number().min(0, "Cost price must be at least 0."), z.null()])
    .optional(),
  costUpdatePolicy: costUpdatePolicySchema,
  pricingType: pricingTypeSchema,
  pricingPercent: z.coerce.number().min(0, "Pricing percent cannot be negative."),
  minimumSalePrice: z
    .union([z.coerce.number().min(0, "Minimum sale price must be at least 0."), z.null()])
    .optional(),
  autoPriceUpdateEnabled: z.boolean(),
  salePriceLocked: z.boolean(),
  imageFileId: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().min(0, "Sort order cannot be negative."),
  status: recordStatusSchema,
});

export type ProductSchema = z.infer<typeof productSchema>;
export type ProductVariantSchema = z.infer<typeof productVariantSchema>;
