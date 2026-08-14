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

export type ReportConsistencyWarning = {
  code: string;
  message: string;
  sourceType: string;
  missingCount: number;
};

export type FinancialSummary = {
  bankTransferCollected: number;
  cardCollected: number;
  cashCollected: number;
  consistencyWarnings: ReportConsistencyWarning[];
  grossSales: number;
  netCollected: number;
  outstandingCustomerBalance: number;
  paymentCount: number;
  purchaseTotal: number;
  refundCount: number;
  sourceOfTruth: string;
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
  grossTransactionCount: number;
  netCollected: number;
  netTransactionCount: number;
  paymentMethodId: string;
  paymentMethodName: string;
  paymentMethodType: string;
  refundTransactionCount: number;
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

/**
 * Control-account balance behind a receivables or payables report.
 *
 * The header is the ledger balance as of the report's end date, so it does
 * not equal the sum of the listed rows: the rows only cover documents dated
 * inside the report window. `operationalBalance` is the cross-check that
 * produces a drift warning, not the row total.
 */
export type ReportBalanceHeader = {
  ledgerBalance: number;
  operationalBalance: number;
};

export type OutstandingBalancesReport = {
  consistencyWarnings: ReportConsistencyWarning[];
  header: ReportBalanceHeader;
  rows: OutstandingBalanceRow[];
  sourceOfTruth: string;
};

export type SupplierPayablesReport = {
  consistencyWarnings: ReportConsistencyWarning[];
  header: ReportBalanceHeader;
  rows: SupplierPayableRow[];
  sourceOfTruth: string;
  supplierAdvances: number;
};

export type ReconciliationRow = {
  amount: number;
  branchName: string;
  createdByUserName: string;
  direction: string;
  paymentMethodName: string;
  sourceNumber: string;
  sourceType: string;
  status: string;
  transactionAt: string;
  transactionId: string;
  transactionType: string;
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
