import { z } from "zod";

const optionalNullableString = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
});

const purchaseProductLineSchema = z
  .object({
    id: z.string().optional(),
    lineType: z.literal("product").optional(),
    itemType: z.literal("product"),
    productId: optionalNullableString,
    productVariantId: optionalNullableString,
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
    if (!value.productId) {
      context.addIssue({ code: "custom", message: "Product is required.", path: ["productId"] });
    }
  });

const purchaseAccountLineSchema = z
  .object({
    id: z.string().optional(),
    lineType: z.literal("account"),
    itemType: z.literal("account"),
    productId: optionalNullableString,
    productVariantId: optionalNullableString,
    ingredientId: optionalNullableString,
    packagingItemId: optionalNullableString,
    accountId: optionalNullableString,
    description: optionalNullableString,
    itemNameSnapshot: optionalNullableString,
    quantity: z.coerce.number().positive("Quantity must be greater than 0."),
    unitId: z.string().optional().default(""),
    unitCost: z.coerce.number().min(0, "Unit cost cannot be negative."),
    discountAmount: z.coerce.number().min(0, "Discount cannot be negative."),
    taxRateId: optionalNullableString,
  })
  .superRefine((value, context) => {
    if (!value.accountId) {
      context.addIssue({ code: "custom", message: "Account is required.", path: ["accountId"] });
    }

    if (!value.description) {
      context.addIssue({
        code: "custom",
        message: "Description is required.",
        path: ["description"],
      });
    }
  });

export const purchaseItemLineSchema = z.union([
  purchaseProductLineSchema,
  purchaseAccountLineSchema,
]);

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
  billDiscountAmount: z.coerce.number().min(0, "Bill discount cannot be negative.").optional(),
  notes: optionalNullableString,
});

export const purchaseReceiveSchema = z.object({
  branchId: z.string().min(1, "Branch is required."),
  supplierId: z.string().min(1, "Supplier is required."),
  purchaseOrderId: optionalNullableString,
  purchaseInvoiceId: optionalNullableString,
  receivedDate: z.string().min(1, "Received date is required."),
  items: z.array(purchaseProductLineSchema).min(1, "At least one item is required."),
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

export const supplierPaymentSchema = z.object({
  amount: z.coerce.number().positive("Payment amount must be greater than 0."),
  notes: optionalNullableString,
  paidAt: optionalNullableString,
  paymentMethodId: z.string().min(1, "Payment method is required."),
  referenceNumber: optionalNullableString,
});

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
export type PurchaseInvoiceFormValues = z.infer<typeof purchaseInvoiceSchema>;
export type PurchaseReceiveFormValues = z.infer<typeof purchaseReceiveSchema>;
export type SupplierPaymentInputValues = z.input<typeof supplierPaymentSchema>;
export type SupplierPaymentFormValues = z.infer<typeof supplierPaymentSchema>;
