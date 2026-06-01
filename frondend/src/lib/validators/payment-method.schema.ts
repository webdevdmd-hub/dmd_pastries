import { z } from "zod";

export const paymentMethodSchema = z.object({
  methodName: z.string().trim().min(2, "Method name must be at least 2 characters."),
  methodType: z.string().trim().min(2, "Method type is required."),
  isDefault: z.boolean(),
  allowSplitPayment: z.boolean(),
  requiresReference: z.boolean(),
  showInPos: z.boolean(),
  showInBakeryOrders: z.boolean(),
  showInPurchasing: z.boolean(),
  showInExpenses: z.boolean(),
  showInDashboardCollection: z.boolean(),
  defaultPaymentAccountId: z.string().nullable(),
});

export type PaymentMethodSchema = z.infer<typeof paymentMethodSchema>;
