import { z } from "zod";

import { documentChargesSchema } from "@/lib/validators/document-charges.schema";

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
  checkoutReference: z.string().uuid("Checkout reference is invalid."),
  customerId: z.string().nullable(),
  items: z.array(cartItemSchema).min(1, "Cart must not be empty."),
  saleDiscountType: z.enum(["fixed", "percentage"]).nullable(),
  saleDiscountValue: z.coerce.number().min(0).nullable(),
  charges: documentChargesSchema,
  // No minimum. Whether a sale needs a tender depends on what it comes to,
  // which this schema cannot see: a comp, a staff meal or a 100%-off promotion
  // totals zero and takes no payment. "You must pay something" is a business
  // rule, and two places already enforce it against the actual total --
  // resolveCheckoutBlocker before submit ("Select payment"), and Checkout on
  // the server, which refuses an empty list only when TotalAmount > 0. A
  // blanket min(1) here just made a zero-total sale unsendable.
  //
  // Each payment still has to be a real tender: paymentSchema keeps
  // amount.positive(), and submitCheckout drops zero-amount lines rather than
  // sending them, because the server rejects a zero line.
  //
  // Regression: ISSUE-001 — a zero-total sale could not be completed.
  payments: z.array(paymentSchema),
  salesChannelId: z.string().nullable(),
  externalOrderNumber: z.string().nullable(),
  notes: z.string().nullable(),
  taxMode: z.enum(["inclusive", "exclusive", "no_tax"]).nullable(),
});

export type CheckoutSchema = z.infer<typeof checkoutSchema>;
