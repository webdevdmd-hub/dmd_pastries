import { apiRequest } from "@/lib/api/client";
import type {
  FinancialReportFilters,
  FinancialSummary,
  FinancialTrendChart,
  OutstandingBalanceRow,
  OutstandingBalancesReport,
  PaymentMethodReportRow,
  PaymentsReportRow,
  PurchaseTotalsReport,
  ReconciliationRow,
  RefundReportRow,
  ReportBalanceHeader,
  SupplierPayableRow,
  SupplierPayablesReport,
} from "@/types/financial-reports";

type BackendSummary = {
  bank_transfer_collected?: number;
  card_collected?: number;
  cash_collected?: number;
  consistency_warnings?: unknown;
  gross_sales?: number;
  net_collected?: number;
  outstanding_customer_balance?: number;
  payment_count?: number;
  purchase_total?: number;
  refund_count?: number;
  source_of_truth?: string;
  supplier_payable_balance?: number;
  total_collected?: number;
  total_refunded?: number;
};

type BackendConsistencyWarning = {
  code?: string;
  message?: string;
  missing_count?: number;
  source_type?: string;
};

type BackendPaymentRow = {
  amount?: number;
  branch_name?: string;
  paid_at?: string;
  paid_by_user_name?: string;
  payment_id?: string;
  payment_method_name?: string;
  payment_method_type?: string;
  reference_number?: string;
  source_number?: string;
  source_type?: string;
  status?: string;
};

type BackendPaymentMethodRow = {
  gross_transaction_count?: number;
  net_collected?: number;
  net_transaction_count?: number;
  payment_method_id?: string;
  payment_method_name?: string;
  payment_method_type?: string;
  refund_transaction_count?: number;
  total_collected?: number;
  total_refunded?: number;
  transaction_count?: number;
};

type BackendRefundRow = {
  branch_name?: string;
  created_by_user_name?: string;
  payment_method_name?: string;
  refund_amount?: number;
  refund_id?: string;
  refund_reason?: string;
  refund_status?: string;
  refunded_at?: string;
  source_number?: string;
  source_type?: string;
};

type BackendOutstandingBalanceRow = {
  balance_amount?: number;
  branch_name?: string;
  customer_name?: string;
  due_date?: string;
  paid_amount?: number;
  payment_status?: string;
  source_number?: string;
  source_type?: string;
  total_amount?: number;
};

type BackendSupplierPayableRow = {
  invoice_count?: number;
  oldest_due_date?: string;
  paid_amount?: number;
  payable_balance?: number;
  supplier_id?: string;
  supplier_name?: string;
  total_invoice_amount?: number;
};

type BackendReconciliationRow = {
  amount?: number;
  branch_name?: string;
  created_by_user_name?: string;
  payment_method_name?: string;
  direction?: string;
  source_number?: string;
  source_type?: string;
  status?: string;
  transaction_at?: string;
  transaction_id?: string;
  transaction_type?: string;
};

type BackendTrend = { datasets?: unknown; labels?: unknown };
type BackendTrendDataset = { data?: unknown; label?: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function listSource(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return [];
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.rows)) return value.rows;
  return [];
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  return listSource(value).map(parser);
}

function parseConsistencyWarnings(value: unknown) {
  const row = isObject(value) ? value : {};
  return Array.isArray(row.consistency_warnings)
    ? row.consistency_warnings.map(parseConsistencyWarning)
    : [];
}

function parseBalanceHeader(value: unknown): ReportBalanceHeader {
  const header = isObject(value) && isObject(value.header) ? value.header : {};
  return {
    ledgerBalance: numberOrZero(header.ledger_balance),
    operationalBalance: numberOrZero(header.operational_balance),
  };
}

function parseConsistencyWarning(value: unknown) {
  const row = isObject(value) ? (value as BackendConsistencyWarning) : {};
  return {
    code: stringOrEmpty(row.code),
    message: stringOrEmpty(row.message),
    missingCount: numberOrZero(row.missing_count),
    sourceType: stringOrEmpty(row.source_type),
  };
}

function toSearchParams(filters: FinancialReportFilters): string {
  const params = new URLSearchParams();
  const entries: [string, number | string | undefined][] = [
    ["branch_id", filters.branchId],
    ["payment_method_id", filters.paymentMethodId],
    ["date_from", filters.dateFrom],
    ["date_to", filters.dateTo],
    ["timezone", filters.timezone],
    ["group_by", filters.groupBy],
    ["source_type", filters.sourceType],
    ["status", filters.status],
    ["refund_status", filters.refundStatus],
    ["page", filters.page],
    ["limit", filters.limit],
    ["sort_by", filters.sortBy],
    ["sort_order", filters.sortOrder],
  ];
  entries.forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

function parseSummary(value: unknown): FinancialSummary {
  const row = isObject(value) ? (value as BackendSummary) : {};
  return {
    bankTransferCollected: numberOrZero(row.bank_transfer_collected),
    cardCollected: numberOrZero(row.card_collected),
    cashCollected: numberOrZero(row.cash_collected),
    consistencyWarnings: Array.isArray(row.consistency_warnings)
      ? row.consistency_warnings.map(parseConsistencyWarning)
      : [],
    grossSales: numberOrZero(row.gross_sales),
    netCollected: numberOrZero(row.net_collected),
    outstandingCustomerBalance: numberOrZero(row.outstanding_customer_balance),
    paymentCount: numberOrZero(row.payment_count),
    purchaseTotal: numberOrZero(row.purchase_total),
    refundCount: numberOrZero(row.refund_count),
    sourceOfTruth: stringOrEmpty(row.source_of_truth),
    supplierPayableBalance: numberOrZero(row.supplier_payable_balance),
    totalCollected: numberOrZero(row.total_collected),
    totalRefunded: numberOrZero(row.total_refunded),
  };
}

function parsePaymentRow(value: unknown): PaymentsReportRow {
  const row = isObject(value) ? (value as BackendPaymentRow) : {};
  return {
    amount: numberOrZero(row.amount),
    branchName: stringOrEmpty(row.branch_name),
    paidAt: stringOrEmpty(row.paid_at),
    paidByUserName: stringOrEmpty(row.paid_by_user_name),
    paymentId: stringOrEmpty(row.payment_id),
    paymentMethodName: stringOrEmpty(row.payment_method_name),
    paymentMethodType: stringOrEmpty(row.payment_method_type),
    referenceNumber: stringOrEmpty(row.reference_number),
    sourceNumber: stringOrEmpty(row.source_number),
    sourceType: stringOrEmpty(row.source_type),
    status: stringOrEmpty(row.status),
  };
}

function parsePaymentMethodRow(value: unknown): PaymentMethodReportRow {
  const row = isObject(value) ? (value as BackendPaymentMethodRow) : {};
  const grossTransactionCount = numberOrZero(row.gross_transaction_count ?? row.transaction_count);
  const refundTransactionCount = numberOrZero(row.refund_transaction_count);
  const netTransactionCount = numberOrZero(
    row.net_transaction_count ?? Math.max(grossTransactionCount - refundTransactionCount, 0),
  );

  return {
    grossTransactionCount,
    netCollected: numberOrZero(row.net_collected),
    netTransactionCount,
    paymentMethodId: stringOrEmpty(row.payment_method_id),
    paymentMethodName: stringOrEmpty(row.payment_method_name),
    paymentMethodType: stringOrEmpty(row.payment_method_type),
    refundTransactionCount,
    totalCollected: numberOrZero(row.total_collected),
    totalRefunded: numberOrZero(row.total_refunded),
    transactionCount: grossTransactionCount,
  };
}

function parseRefundRow(value: unknown): RefundReportRow {
  const row = isObject(value) ? (value as BackendRefundRow) : {};
  return {
    branchName: stringOrEmpty(row.branch_name),
    createdByUserName: stringOrEmpty(row.created_by_user_name),
    paymentMethodName: stringOrEmpty(row.payment_method_name),
    refundAmount: numberOrZero(row.refund_amount),
    refundId: stringOrEmpty(row.refund_id),
    refundReason: stringOrEmpty(row.refund_reason),
    refundStatus: stringOrEmpty(row.refund_status),
    refundedAt: stringOrEmpty(row.refunded_at),
    sourceNumber: stringOrEmpty(row.source_number),
    sourceType: stringOrEmpty(row.source_type),
  };
}

function parseOutstandingBalanceRow(value: unknown): OutstandingBalanceRow {
  const row = isObject(value) ? (value as BackendOutstandingBalanceRow) : {};
  return {
    balanceAmount: numberOrZero(row.balance_amount),
    branchName: stringOrEmpty(row.branch_name),
    customerName: stringOrEmpty(row.customer_name),
    dueDate: stringOrEmpty(row.due_date),
    paidAmount: numberOrZero(row.paid_amount),
    paymentStatus: stringOrEmpty(row.payment_status),
    sourceNumber: stringOrEmpty(row.source_number),
    sourceType: stringOrEmpty(row.source_type),
    totalAmount: numberOrZero(row.total_amount),
  };
}

function parseSupplierPayableRow(value: unknown): SupplierPayableRow {
  const row = isObject(value) ? (value as BackendSupplierPayableRow) : {};
  return {
    invoiceCount: numberOrZero(row.invoice_count),
    oldestDueDate: stringOrEmpty(row.oldest_due_date),
    paidAmount: numberOrZero(row.paid_amount),
    payableBalance: numberOrZero(row.payable_balance),
    supplierId: stringOrEmpty(row.supplier_id),
    supplierName: stringOrEmpty(row.supplier_name),
    totalInvoiceAmount: numberOrZero(row.total_invoice_amount),
  };
}

function parseReconciliationRow(value: unknown): ReconciliationRow {
  const row = isObject(value) ? (value as BackendReconciliationRow) : {};
  return {
    amount: numberOrZero(row.amount),
    branchName: stringOrEmpty(row.branch_name),
    createdByUserName: stringOrEmpty(row.created_by_user_name),
    direction: stringOrEmpty(row.direction),
    paymentMethodName: stringOrEmpty(row.payment_method_name),
    sourceNumber: stringOrEmpty(row.source_number),
    sourceType: stringOrEmpty(row.source_type),
    status: stringOrEmpty(row.status),
    transactionAt: stringOrEmpty(row.transaction_at),
    transactionId: stringOrEmpty(row.transaction_id),
    transactionType: stringOrEmpty(row.transaction_type),
  };
}

function parsePurchaseTotals(value: unknown): PurchaseTotalsReport {
  const row = isObject(value) ? value : {};
  return {
    purchaseTotal: numberOrZero(row.purchase_total ?? row.total_purchase_amount),
  };
}

function parseTrend(value: unknown): FinancialTrendChart {
  const chart = isObject(value) ? (value as BackendTrend) : {};
  const labels = Array.isArray(chart.labels)
    ? chart.labels.filter((label): label is string => typeof label === "string")
    : [];
  const datasets = Array.isArray(chart.datasets)
    ? chart.datasets.filter(isObject).map((dataset) => {
        const typedDataset = dataset as BackendTrendDataset;
        return {
          data: Array.isArray(typedDataset.data)
            ? typedDataset.data.filter((item): item is number => typeof item === "number")
            : [],
          label: stringOrEmpty(typedDataset.label),
        };
      })
    : [];
  return {
    consistencyWarnings: parseConsistencyWarnings(value),
    datasets,
    labels,
    sourceOfTruth: isObject(value) ? stringOrEmpty(value.source_of_truth) : "",
  };
}

async function getReport<TResponse>(
  path: string,
  filters: FinancialReportFilters,
  parse: (value: unknown) => TResponse,
): Promise<TResponse> {
  const response = await apiRequest<TResponse>(`${path}${toSearchParams(filters)}`, {
    authMode: "appwrite",
    parse,
  });
  return response.data;
}

export async function getFinancialSummary(
  filters: FinancialReportFilters,
): Promise<FinancialSummary> {
  return getReport("/api/v1/reports/financial/summary", filters, parseSummary);
}

export async function getPaymentsReport(
  filters: FinancialReportFilters,
): Promise<PaymentsReportRow[]> {
  return getReport("/api/v1/reports/financial/payments", filters, (value) =>
    parseList(value, parsePaymentRow),
  );
}

export async function getPaymentMethodReport(
  filters: FinancialReportFilters,
): Promise<PaymentMethodReportRow[]> {
  return getReport("/api/v1/reports/financial/by-payment-method", filters, (value) =>
    parseList(value, parsePaymentMethodRow),
  );
}

export async function getRefundsReport(
  filters: FinancialReportFilters,
): Promise<RefundReportRow[]> {
  return getReport("/api/v1/reports/financial/refunds", filters, (value) =>
    parseList(value, parseRefundRow),
  );
}

export async function getOutstandingBalancesReport(
  filters: FinancialReportFilters,
): Promise<OutstandingBalancesReport> {
  return getReport("/api/v1/reports/financial/outstanding-balances", filters, (value) => ({
    consistencyWarnings: parseConsistencyWarnings(value),
    header: parseBalanceHeader(value),
    rows: parseList(value, parseOutstandingBalanceRow),
    sourceOfTruth: isObject(value) ? stringOrEmpty(value.source_of_truth) : "",
  }));
}

export async function getSupplierPayablesReport(
  filters: FinancialReportFilters,
): Promise<SupplierPayablesReport> {
  return getReport("/api/v1/reports/financial/supplier-payables", filters, (value) => ({
    consistencyWarnings: parseConsistencyWarnings(value),
    header: parseBalanceHeader(value),
    rows: parseList(value, parseSupplierPayableRow),
    sourceOfTruth: isObject(value) ? stringOrEmpty(value.source_of_truth) : "",
    supplierAdvances: isObject(value) ? numberOrZero(value.supplier_advances) : 0,
  }));
}

export async function getPurchaseTotalsReport(
  filters: FinancialReportFilters,
): Promise<PurchaseTotalsReport> {
  return getReport("/api/v1/reports/financial/purchase-totals", filters, parsePurchaseTotals);
}

export async function getReconciliationReport(
  filters: FinancialReportFilters,
): Promise<ReconciliationRow[]> {
  return getReport("/api/v1/reports/financial/reconciliation", filters, (value) =>
    parseList(value, parseReconciliationRow),
  );
}

export async function getFinancialTrend(
  filters: FinancialReportFilters,
): Promise<FinancialTrendChart> {
  return getReport("/api/v1/reports/financial/trend", filters, parseTrend);
}
