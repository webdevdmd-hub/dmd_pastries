import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

export const addPaymentSchema = z.object({
  saleId: z.string().trim().min(1, "Sale ID is required."),
  paymentMethodId: z.string().trim().min(1, "Payment method is required."),
  amount: z.coerce.number().positive("Amount must be greater than 0."),
  referenceNumber: optionalText,
  providerTransactionId: optionalText,
  notes: optionalText,
});

export const refundPaymentSchema = z.object({
  refundAmount: z.coerce.number().positive("Refund amount must be greater than 0."),
  refundReason: z.string().trim().min(2, "Refund reason is required."),
  approvedByUserId: optionalText,
});

export const createReconciliationSchema = z.object({
  branchId: z.string().trim().min(1, "Branch is required."),
  reconciliationDate: z.string().trim().min(1, "Reconciliation date is required."),
  paymentMethodId: z.string().trim().min(1, "Payment method is required."),
  countedAmount: z.coerce.number().min(0, "Counted amount cannot be negative."),
  notes: optionalText,
});

export const paymentFiltersSchema = z.object({
  search: z.string(),
  paymentMethodId: z.string(),
  paymentStatus: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
  branchId: z.string(),
});

export const refundFiltersSchema = z.object({
  search: z.string(),
  refundStatus: z.string(),
  paymentMethodId: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export const reconciliationFiltersSchema = z.object({
  branchId: z.string(),
  paymentMethodId: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export type AddPaymentSchema = z.infer<typeof addPaymentSchema>;
export type RefundPaymentSchema = z.infer<typeof refundPaymentSchema>;
export type CreateReconciliationSchema = z.infer<typeof createReconciliationSchema>;
export type PaymentFiltersSchema = z.infer<typeof paymentFiltersSchema>;
export type RefundFiltersSchema = z.infer<typeof refundFiltersSchema>;
export type ReconciliationFiltersSchema = z.infer<typeof reconciliationFiltersSchema>;
