import { z } from "zod";

import { documentChargesSchema } from "@/lib/validators/document-charges.schema";

const nullableTrimmedString = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const nullableCoercedNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}, z.number().nullable());

export const orderItemSchema = z
  .object({
    productId: nullableTrimmedString,
    productVariantId: nullableTrimmedString,
    itemName: nullableTrimmedString,
    quantity: z.coerce.number().positive("Quantity must be greater than 0."),
    unitId: z.string().min(1, "Unit is required."),
    weight: nullableCoercedNumber,
    flavor: nullableTrimmedString,
    designNotes: nullableTrimmedString,
    messageText: nullableTrimmedString,
    customizationsJson: nullableTrimmedString,
    unitPrice: z.coerce.number().min(0, "Unit price cannot be negative."),
    discountAmount: z.coerce.number().min(0, "Discount cannot be negative."),
    taxRateId: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
  })
  .superRefine((value, context) => {
    if (!value.productId && !value.itemName) {
      context.addIssue({
        code: "custom",
        message: "Select a product or enter a custom item name.",
        path: ["itemName"],
      });
    }
  });

export const createOrderSchema = z.object({
  branchId: z.string().min(1, "Branch is required."),
  customerId: z.string().nullable(),
  customerName: nullableTrimmedString,
  customerPhone: nullableTrimmedString,
  salesChannelId: nullableTrimmedString,
  externalOrderNumber: nullableTrimmedString,
  orderType: z.enum(["pickup", "delivery"]),
  eventDate: z.string().min(1, "Event date is required."),
  pickupTime: nullableTrimmedString,
  deliveryTime: nullableTrimmedString,
  deliveryAddress: nullableTrimmedString,
  items: z.array(orderItemSchema).min(1, "At least one order item is required."),
  charges: documentChargesSchema,
  notes: nullableTrimmedString,
  taxMode: z.enum(["inclusive", "exclusive", "no_tax"]).nullable().optional(),
});

export const updateOrderSchema = createOrderSchema.partial();

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "new",
    "confirmed",
    "in_production",
    "ready",
    "delivered",
    "completed",
    "cancelled",
  ]),
});

export const orderPaymentSchema = z.object({
  paymentMethodId: z.string().min(1, "Payment method is required."),
  amount: z.coerce.number().positive("Payment amount must be greater than 0."),
  paymentType: z.enum(["deposit", "balance", "full"]),
  referenceNumber: nullableTrimmedString,
});

export const orderPackagingSchema = z.object({
  componentProductId: z.string().min(1, "Packaging product is required."),
  componentVariantId: nullableTrimmedString,
  quantityRequired: z.coerce.number().positive("Packaging quantity must be greater than 0."),
  unitId: z.string().min(1, "Unit is required."),
});

export type OrderItemFormValues = z.infer<typeof orderItemSchema>;
export type CreateOrderFormValues = z.infer<typeof createOrderSchema>;
export type OrderPaymentInputValues = z.input<typeof orderPaymentSchema>;
export type OrderPaymentFormValues = z.infer<typeof orderPaymentSchema>;
export type OrderPackagingFormValues = z.infer<typeof orderPackagingSchema>;
