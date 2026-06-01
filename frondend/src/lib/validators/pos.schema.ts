import { z } from "zod";

export const discountSchema = z.object({
  type: z.enum(["fixed", "percentage"]).nullable(),
  value: z.coerce.number().min(0).nullable(),
});

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  productVariantId: z.string().nullable(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  discountType: z.enum(["fixed", "percentage"]).nullable(),
  discountValue: z.coerce.number().min(0).nullable(),
});

export const paymentSchema = z.object({
  paymentMethodId: z.string().min(1, "Select a payment method."),
  paymentMethodName: z.string().min(1),
  amount: z.coerce.number().positive("Payment amount must be greater than zero."),
  referenceNumber: z.string().nullable(),
});

export const checkoutSchema = z.object({
  branchId: z.string().min(1, "Branch is required."),
  customerId: z.string().nullable(),
  items: z.array(cartItemSchema).min(1, "Cart must not be empty."),
  saleDiscountType: z.enum(["fixed", "percentage"]).nullable(),
  saleDiscountValue: z.coerce.number().min(0).nullable(),
  payments: z.array(paymentSchema).min(1, "At least one payment is required."),
  salesChannelId: z.string().nullable(),
  externalOrderNumber: z.string().nullable(),
  notes: z.string().nullable(),
});

export type CheckoutSchema = z.infer<typeof checkoutSchema>;
