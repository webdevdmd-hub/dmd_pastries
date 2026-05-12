export type PaymentStatus = "pending" | "completed" | "failed" | "refunded" | "partially_refunded";

export type RefundStatus = "pending" | "completed" | "failed" | "cancelled";
export type ReconciliationStatus = "draft" | "submitted" | "approved" | "rejected";

export type SalePayment = {
  id: string;
  businessId: string;
  branchId: string;
  saleId: string;
  saleNumber: string;
  paymentMethodId: string;
  paymentMethodNameSnapshot: string;
  paymentMethodTypeSnapshot: string;
  amount: number;
  referenceNumber: string | null;
  providerTransactionId: string | null;
  paymentStatus: PaymentStatus;
  paidByUserId: string | null;
  paidByUserName: string;
  paidAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentRefund = {
  id: string;
  businessId: string;
  branchId: string;
  saleId: string;
  saleNumber: string;
  salePaymentId: string;
  refundNumber: string;
  paymentMethodId: string;
  paymentMethodNameSnapshot: string;
  refundAmount: number;
  refundReason: string;
  refundStatus: RefundStatus;
  approvedByUserId: string | null;
  createdByUserId: string | null;
  createdByUserName: string;
  refundedAt: string | null;
  createdAt: string;
};

export type PaymentReconciliation = {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  reconciliationDate: string;
  paymentMethodId: string;
  paymentMethodName: string;
  expectedAmount: number;
  countedAmount: number;
  differenceAmount: number;
  status: ReconciliationStatus;
  createdByUserId: string | null;
  createdByUserName: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AddPaymentPayload = {
  paymentMethodId: string;
  amount: number;
  referenceNumber?: string | null;
  providerTransactionId?: string | null;
  notes?: string | null;
};

export type RefundPaymentPayload = {
  refundAmount: number;
  refundReason: string;
  approvedByUserId?: string | null;
};

export type CreateReconciliationPayload = {
  branchId: string;
  reconciliationDate: string;
  paymentMethodId: string;
  countedAmount: number;
  notes?: string | null;
};

export type PaymentFilters = {
  search: string;
  paymentMethodId: string;
  paymentStatus: PaymentStatus | "all";
  dateFrom: string;
  dateTo: string;
  branchId: string;
};

export type RefundFilters = {
  search: string;
  refundStatus: RefundStatus | "all";
  paymentMethodId: string;
  dateFrom: string;
  dateTo: string;
};

export type ReconciliationFilters = {
  paymentMethodId: string;
  dateFrom: string;
  dateTo: string;
  branchId: string;
};

export type PaymentSummaryParams = {
  branchId?: string | null;
  date?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export type DailyPaymentSummary = {
  totalCollected: number;
  totalRefunded: number;
  netCollected: number;
  transactionsCount: number;
};

export type PaymentMethodSummary = {
  paymentMethodId: string;
  paymentMethodName: string;
  collectedAmount: number;
  refundedAmount: number;
  netAmount: number;
  totalAmount: number;
  transactionsCount: number;
};
