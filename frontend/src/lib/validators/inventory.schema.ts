import { z } from "zod";

const uuidSchema = z.string().min(1, "Required.");
const optionalTextSchema = z.string().optional();
const inventoryItemTypeFilterSchema = z.enum(["all", "product", "product_variant"]);
const inventoryProductTypeFilterSchema = z.enum([
  "all",
  "finished_product",
  "ingredient",
  "packaging",
  "raw_material",
  "semi_finished",
  "consumable",
  "equipment",
  "service",
]);

export const openingStockSchema = z
  .object({
    branchId: uuidSchema,
    itemType: z.enum(["product", "product_variant"]),
    productId: z.string().optional(),
    productVariantId: z.string().optional(),
    unitId: uuidSchema,
    stockLocationId: z.string().optional(),
    quantity: z.coerce.number().positive("Opening quantity must be greater than zero."),
    unitCost: z.coerce.number().positive("Opening cost must be greater than zero."),
    reorderLevel: z.coerce.number().min(0, "Reorder level cannot be negative."),
    isExpiryTracked: z.boolean(),
    expiryDate: z.string().optional(),
    reason: optionalTextSchema,
  })
  .superRefine((value, context) => {
    if (value.itemType === "product" && !value.productId) {
      context.addIssue({
        code: "custom",
        message: "Product is required.",
        path: ["productId"],
      });
    }

    if (value.itemType === "product_variant") {
      if (!value.productId) {
        context.addIssue({
          code: "custom",
          message: "Product is required.",
          path: ["productId"],
        });
      }

      if (!value.productVariantId) {
        context.addIssue({
          code: "custom",
          message: "Variant is required.",
          path: ["productVariantId"],
        });
      }
    }

    if (value.isExpiryTracked && value.expiryDate && Number.isNaN(Date.parse(value.expiryDate))) {
      context.addIssue({
        code: "custom",
        message: "Expiry date is invalid.",
        path: ["expiryDate"],
      });
    }
  });

export const stockAdjustmentSchema = z.object({
  adjustmentType: z.enum(["increase", "decrease"]),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  reason: z.string().min(2, "Reason is required."),
});

export const createExpiryBatchSchema = z
  .object({
    batchNumber: optionalTextSchema,
    quantity: z.coerce.number().positive("Quantity must be greater than zero."),
    receivedDate: z.string().min(1, "Received date is required."),
    expiryDate: z.string().min(1, "Expiry date is required."),
  })
  .superRefine((value, context) => {
    const receivedDate = Date.parse(value.receivedDate);
    const expiryDate = Date.parse(value.expiryDate);

    if (Number.isNaN(receivedDate)) {
      context.addIssue({
        code: "custom",
        message: "Received date is invalid.",
        path: ["receivedDate"],
      });
    }

    if (Number.isNaN(expiryDate)) {
      context.addIssue({
        code: "custom",
        message: "Expiry date is invalid.",
        path: ["expiryDate"],
      });
    }

    if (!Number.isNaN(receivedDate) && !Number.isNaN(expiryDate) && expiryDate < receivedDate) {
      context.addIssue({
        code: "custom",
        message: "Expiry date must be after received date.",
        path: ["expiryDate"],
      });
    }
  });

export const updateExpiryBatchSchema = z.object({
  batchNumber: optionalTextSchema,
  quantity: z.coerce.number().positive("Quantity must be greater than zero.").optional(),
  receivedDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const inventoryFiltersSchema = z.object({
  search: z.string(),
  branchId: z.string(),
  itemType: inventoryItemTypeFilterSchema,
  productType: inventoryProductTypeFilterSchema,
  status: z.enum(["all", "active", "inactive"]),
  lowStockOnly: z.boolean(),
  expiryTrackedOnly: z.boolean(),
});

export const stockMovementFiltersSchema = z.object({
  search: z.string(),
  branchId: z.string(),
  itemType: inventoryItemTypeFilterSchema,
  productType: inventoryProductTypeFilterSchema,
  movementType: z.enum([
    "all",
    "opening_stock",
    "purchase_in",
    "sale_out",
    "adjustment_in",
    "adjustment_out",
    "wastage",
    "return_in",
    "transfer",
    "transfer_in",
    "transfer_out",
    "production_in",
    "production_out",
  ]),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export type OpeningStockSchema = z.infer<typeof openingStockSchema>;
export type StockAdjustmentSchema = z.infer<typeof stockAdjustmentSchema>;
export type CreateExpiryBatchSchema = z.infer<typeof createExpiryBatchSchema>;
