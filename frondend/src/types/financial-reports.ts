export type FinancialReportGroupBy = "day" | "week" | "month";
export type FinancialReportSortOrder = "asc" | "desc";

export type FinancialReportFilters = {
  branchId?: string;
  dateFrom: string;
  dateTo: string;
  groupBy?: FinancialReportGroupBy;
  limit?: number;
  page?: number;
  paymentMethodId?: string;
  refundStatus?: string;
  sortBy?: string;
  sortOrder?: FinancialReportSortOrder;
  sourceType?: string;
  status?: string;
  timezone?: string;
};

export type FinancialSummary = {
  bankTransferCollected: number;
  cardCollected: number;
  cashCollected: number;
  grossSales: number;
  netCollected: number;
  outstandingCustomerBalance: number;
  paymentCount: number;
  purchaseTotal: number;
  refundCount: number;
  supplierPayableBalance: number;
  totalCollected: number;
  totalRefunded: number;
};

export type PaymentsReportRow = {
  amount: number;
  branchName: string;
  paidAt: string;
  paidByUserName: string;
  paymentId: string;
  paymentMethodName: string;
  paymentMethodType: string;
  referenceNumber: string;
  sourceNumber: string;
  sourceType: string;
  status: string;
};

export type PaymentMethodReportRow = {
  netCollected: number;
  paymentMethodId: string;
  paymentMethodName: string;
  paymentMethodType: string;
  totalCollected: number;
  totalRefunded: number;
  transactionCount: number;
};

export type RefundReportRow = {
  branchName: string;
  createdByUserName: string;
  refundAmount: number;
  refundId: string;
  refundReason: string;
  refundStatus: string;
  refundedAt: string;
  paymentMethodName: string;
  sourceNumber: string;
  sourceType: string;
};

export type OutstandingBalanceRow = {
  balanceAmount: number;
  branchName: string;
  customerName: string;
  dueDate: string;
  paidAmount: number;
  paymentStatus: string;
  sourceNumber: string;
  sourceType: string;
  totalAmount: number;
};

export type SupplierPayableRow = {
  invoiceCount: number;
  oldestDueDate: string;
  paidAmount: number;
  payableBalance: number;
  supplierId: string;
  supplierName: string;
  totalInvoiceAmount: number;
};

export type ReconciliationRow = {
  branchName: string;
  countedAmount: number;
  createdByUserName: string;
  differenceAmount: number;
  expectedAmount: number;
  paymentMethodName: string;
  reconciliationDate: string;
  reconciliationId: string;
  status: string;
};

export type PurchaseTotalsReport = {
  purchaseTotal: number;
};

export type FinancialTrendDataset = {
  data: number[];
  label: string;
};

export type FinancialTrendChart = {
  datasets: FinancialTrendDataset[];
  labels: string[];
};
