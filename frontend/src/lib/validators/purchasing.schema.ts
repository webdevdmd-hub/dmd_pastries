import { z } from "zod";

const optionalNullableString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

export const purchaseItemLineSchema = z
  .object({
    itemType: z.enum(["product", "ingredient", "packaging"]),
    productId: optionalNullableString,
    ingredientId: optionalNullableString,
    packagingItemId: optionalNullableString,
    quantity: z.coerce.number().positive("Quantity must be greater than 0."),
    unitId: z.string().min(1, "Unit is required."),
    unitCost: z.coerce.number().min(0, "Unit cost cannot be negative."),
    discountAmount: z.coerce.number().min(0, "Discount cannot be negative."),
    taxRateId: optionalNullableString,
    expiryDate: optionalNullableString,
    batchNumber: optionalNullableString,
  })
  .superRefine((value, context) => {
    if (value.itemType === "product" && !value.productId) {
      context.addIssue({ code: "custom", message: "Product is required.", path: ["productId"] });
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
  });

export const purchaseOrderSchema = z.object({
  branchId: z.string().min(1, "Branch is required."),
  supplierId: z.string().min(1, "Supplier is required."),
  orderDate: z.string().min(1, "Order date is required."),
  expectedDeliveryDate: optionalNullableString,
  items: z.array(purchaseItemLineSchema).min(1, "At least one item is required."),
  notes: optionalNullableString,
});

export const purchaseInvoiceSchema = z.object({
  branchId: z.string().min(1, "Branch is required."),
  supplierId: z.string().min(1, "Supplier is required."),
  purchaseOrderId: optionalNullableString,
  invoiceNumber: z.string().min(1, "Invoice number is required."),
  invoiceDate: z.string().min(1, "Invoice date is required."),
  dueDate: optionalNullableString,
  items: z.array(purchaseItemLineSchema).min(1, "At least one item is required."),
  notes: optionalNullableString,
});

export const purchaseReceiveSchema = z.object({
  branchId: z.string().min(1, "Branch is required."),
  supplierId: z.string().min(1, "Supplier is required."),
  purchaseOrderId: optionalNullableString,
  purchaseInvoiceId: optionalNullableString,
  receivedDate: z.string().min(1, "Received date is required."),
  items: z.array(purchaseItemLineSchema).min(1, "At least one item is required."),
  notes: optionalNullableString,
});

export const purchaseFiltersSchema = z.object({
  search: z.string(),
  supplierId: z.string(),
  branchId: z.string(),
  status: z.string(),
  paymentStatus: z.string().optional(),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
export type PurchaseInvoiceFormValues = z.infer<typeof purchaseInvoiceSchema>;
export type PurchaseReceiveFormValues = z.infer<typeof purchaseReceiveSchema>;
