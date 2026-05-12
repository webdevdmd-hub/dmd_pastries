import { z } from "zod";

const uuidSchema = z.string().min(1, "Required.");
const optionalTextSchema = z.string().optional();

export const openingStockSchema = z
  .object({
    branchId: uuidSchema,
    itemType: z.enum(["product", "ingredient", "packaging"]),
    productId: z.string().optional(),
    ingredientId: z.string().optional(),
    packagingItemId: z.string().optional(),
    unitId: uuidSchema,
    quantity: z.coerce.number().min(0, "Quantity cannot be negative."),
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

    if (value.itemType === "ingredient" && !value.ingredientId) {
      context.addIssue({
        code: "custom",
        message: "Ingredient is required.",
        path: ["ingredientId"],
      });
    }

    if (value.itemType === "packaging" && !value.packagingItemId) {
      context.addIssue({
        code: "custom",
        message: "Packaging item is required.",
        path: ["packagingItemId"],
      });
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
  itemType: z.enum(["all", "product", "ingredient", "packaging"]),
  status: z.enum(["all", "active", "inactive"]),
  lowStockOnly: z.boolean(),
  expiryTrackedOnly: z.boolean(),
});

export const stockMovementFiltersSchema = z.object({
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
  ]),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export type OpeningStockSchema = z.infer<typeof openingStockSchema>;
export type StockAdjustmentSchema = z.infer<typeof stockAdjustmentSchema>;
export type CreateExpiryBatchSchema = z.infer<typeof createExpiryBatchSchema>;
