import { apiRequest } from "@/lib/api/client";
import { getPaymentMethods as getSettingsPaymentMethods } from "@/lib/api/settings-data";
import type {
  AddPaymentPayload,
  CreateReconciliationPayload,
  CustomerPaymentType,
  DailyPaymentSummary,
  PaymentFilters,
  PaymentMethodSummary,
  PaymentReconciliation,
  PaymentRefund,
  PaymentSourceType,
  PaymentStatus,
  ReconciliationFilters,
  ReconciliationStatus,
  RefundFilters,
  RefundPaymentPayload,
  RefundStatus,
  SalePayment,
} from "@/types/payment";
import type { PaymentMethod } from "@/types/settings";

type BackendSalePayment = {
  id?: string;
  payment_id?: string;
  business_id?: string;
  branch_id?: string;
  branch_name?: string;
  sale_id?: string;
  sale_number?: string;
  source_type?: string;
  source_id?: string;
  source_number?: string;
  customer_name?: string | null;
  payment_method_id?: string;
  payment_method_name?: string;
  payment_method_name_snapshot?: string;
  payment_method_type?: string;
  payment_method_type_snapshot?: string;
  amount?: number;
  reference_number?: string | null;
  provider_transaction_id?: string | null;
  payment_status?: string;
  payment_type?: string | null;
  paid_by_user_id?: string | null;
  paid_by_user_name?: string;
  paid_at?: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

type BackendPaymentRefund = {
  id?: string;
  business_id?: string;
  branch_id?: string;
  sale_id?: string;
  sale_number?: string;
  sale_payment_id?: string;
  refund_number?: string;
  payment_method_id?: string;
  payment_method_name_snapshot?: string;
  refund_amount?: number;
  refund_reason?: string;
  refund_status?: string;
  approved_by_user_id?: string | null;
  created_by_user_id?: string | null;
  created_by_user_name?: string;
  refunded_at?: string | null;
  created_at?: string;
};

type BackendPaymentReconciliation = {
  id?: string;
  business_id?: string;
  branch_id?: string;
  branch_name?: string;
  reconciliation_date?: string;
  payment_method_id?: string;
  payment_method_name?: string;
  expected_amount?: number;
  counted_amount?: number;
  difference_amount?: number;
  status?: string;
  created_by_user_id?: string | null;
  created_by_user_name?: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

type BackendAddPaymentPayload = {
  payment_method_id: string;
  amount: number;
  reference_number?: string | null;
  provider_transaction_id?: string | null;
  notes?: string | null;
};

type BackendRefundPaymentPayload = {
  refund_amount: number;
  refund_reason: string;
  approved_by_user_id?: string | null;
};

type BackendCreateReconciliationPayload = {
  branch_id: string;
  reconciliation_date: string;
  payment_method_id: string;
  counted_amount: number;
  notes?: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requiredString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function requiredNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    value === "pending" ||
    value === "completed" ||
    value === "failed" ||
    value === "refunded" ||
    value === "partially_refunded"
  );
}

function isPaymentSourceType(value: unknown): value is PaymentSourceType {
  return value === "pos_sale" || value === "bakery_order";
}

function isCustomerPaymentType(value: unknown): value is CustomerPaymentType {
  return value === "deposit" || value === "balance" || value === "full";
}

function isRefundStatus(value: unknown): value is RefundStatus {
  return (
    value === "pending" || value === "completed" || value === "failed" || value === "cancelled"
  );
}

function isReconciliationStatus(value: unknown): value is ReconciliationStatus {
  return value === "draft" || value === "submitted" || value === "approved" || value === "rejected";
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) {
    return value.map(parser);
  }

  if (value === null || value === undefined) {
    return [];
  }

  if (isObject(value)) {
    const keys = [
      "items",
      "payments",
      "reconciliations",
      "refunds",
      "summaries",
      "records",
      "rows",
    ];

    for (const key of keys) {
      const nextValue = value[key];
      if (Array.isArray(nextValue)) {
        return nextValue.map(parser);
      }

      if (key in value && (nextValue === null || nextValue === undefined)) {
        return [];
      }

      if (isObject(nextValue)) {
        try {
          return parseList(nextValue, parser);
        } catch (error) {
          if (!(error instanceof Error) || error.message !== "Backend list payload is invalid.") {
            throw error;
          }
        }
      }
    }

    if ("data" in value) {
      return parseList(value.data, parser);
    }

    if ("pagination" in value || "total" in value || "total_pages" in value) {
      return [];
    }
  }

  throw new Error("Backend list payload is invalid.");
}

function parsePayment(value: unknown): SalePayment {
  if (!isObject(value)) {
    throw new Error("Backend payment payload is invalid.");
  }

  const payment = value as BackendSalePayment;
  const sourceType: PaymentSourceType = isPaymentSourceType(payment.source_type)
    ? payment.source_type
    : "pos_sale";
  const sourceId = requiredString(payment.source_id, requiredString(payment.sale_id));
  const sourceNumber = requiredString(
    payment.source_number,
    requiredString(payment.sale_number, "Payment"),
  );
  const paymentMethodName = requiredString(
    payment.payment_method_name,
    requiredString(payment.payment_method_name_snapshot, "Payment"),
  );
  const paymentMethodType = requiredString(
    payment.payment_method_type,
    requiredString(payment.payment_method_type_snapshot, "method"),
  );

  return {
    id: requiredString(payment.payment_id, requiredString(payment.id)),
    businessId: requiredString(payment.business_id),
    branchId: requiredString(payment.branch_id),
    branchName: requiredString(payment.branch_name, "Branch"),
    saleId: sourceType === "pos_sale" ? sourceId : "",
    saleNumber: sourceType === "pos_sale" ? sourceNumber : "",
    sourceType,
    sourceId,
    sourceNumber,
    customerName: optionalString(payment.customer_name),
    paymentMethodId: requiredString(payment.payment_method_id),
    paymentMethodNameSnapshot: paymentMethodName,
    paymentMethodTypeSnapshot: paymentMethodType,
    amount: requiredNumber(payment.amount),
    referenceNumber: optionalString(payment.reference_number),
    providerTransactionId: optionalString(payment.provider_transaction_id),
    paymentStatus: isPaymentStatus(payment.payment_status) ? payment.payment_status : "pending",
    paymentType: isCustomerPaymentType(payment.payment_type) ? payment.payment_type : null,
    paidByUserId: optionalString(payment.paid_by_user_id),
    paidByUserName: requiredString(payment.paid_by_user_name, "Cashier"),
    paidAt: requiredString(payment.paid_at),
    notes: optionalString(payment.notes),
    createdAt: requiredString(payment.created_at),
    updatedAt: requiredString(payment.updated_at),
  };
}

function parseRefund(value: unknown): PaymentRefund {
  if (!isObject(value)) {
    throw new Error("Backend refund payload is invalid.");
  }

  const refund = value as BackendPaymentRefund;

  return {
    id: requiredString(refund.id),
    businessId: requiredString(refund.business_id),
    branchId: requiredString(refund.branch_id),
    saleId: requiredString(refund.sale_id),
    saleNumber: requiredString(refund.sale_number, "Sale"),
    salePaymentId: requiredString(refund.sale_payment_id),
    refundNumber: requiredString(refund.refund_number, "Refund"),
    paymentMethodId: requiredString(refund.payment_method_id),
    paymentMethodNameSnapshot: requiredString(refund.payment_method_name_snapshot, "Payment"),
    refundAmount: requiredNumber(refund.refund_amount),
    refundReason: requiredString(refund.refund_reason),
    refundStatus: isRefundStatus(refund.refund_status) ? refund.refund_status : "pending",
    approvedByUserId: optionalString(refund.approved_by_user_id),
    createdByUserId: optionalString(refund.created_by_user_id),
    createdByUserName: requiredString(refund.created_by_user_name, "User"),
    refundedAt: optionalString(refund.refunded_at),
    createdAt: requiredString(refund.created_at),
  };
}

function parseReconciliation(value: unknown): PaymentReconciliation {
  if (!isObject(value)) {
    throw new Error("Backend reconciliation payload is invalid.");
  }

  const reconciliation = value as BackendPaymentReconciliation;

  return {
    id: requiredString(reconciliation.id),
    businessId: requiredString(reconciliation.business_id),
    branchId: requiredString(reconciliation.branch_id),
    branchName: requiredString(reconciliation.branch_name, "Branch"),
    reconciliationDate: requiredString(reconciliation.reconciliation_date),
    paymentMethodId: requiredString(reconciliation.payment_method_id),
    paymentMethodName: requiredString(reconciliation.payment_method_name, "Payment"),
    expectedAmount: requiredNumber(reconciliation.expected_amount),
    countedAmount: requiredNumber(reconciliation.counted_amount),
    differenceAmount: requiredNumber(reconciliation.difference_amount),
    status: isReconciliationStatus(reconciliation.status) ? reconciliation.status : "draft",
    createdByUserId: optionalString(reconciliation.created_by_user_id),
    createdByUserName: requiredString(reconciliation.created_by_user_name, "User"),
    notes: optionalString(reconciliation.notes),
    createdAt: requiredString(reconciliation.created_at),
    updatedAt: requiredString(reconciliation.updated_at),
  };
}

function parseDailySummary(value: unknown): DailyPaymentSummary {
  if (!isObject(value)) {
    throw new Error("Backend daily payment summary payload is invalid.");
  }

  return {
    totalCollected: requiredNumber(value.total_collected),
    totalRefunded: requiredNumber(value.total_refunded),
    netCollected: requiredNumber(value.net_collected),
    posCollected: requiredNumber(value.pos_collected),
    bakeryCollected: requiredNumber(value.bakery_collected),
    depositCollected: requiredNumber(value.deposit_collected),
    balanceCollected: requiredNumber(value.balance_collected),
    fullCollected: requiredNumber(value.full_collected),
    transactionsCount: requiredNumber(value.transactions_count, requiredNumber(value.payments_count)),
  };
}

function parseMethodSummary(value: unknown): PaymentMethodSummary {
  if (!isObject(value)) {
    throw new Error("Backend payment method summary payload is invalid.");
  }

  return {
    paymentMethodId: requiredString(value.payment_method_id),
    paymentMethodName: requiredString(value.payment_method_name, "Payment"),
    collectedAmount: requiredNumber(value.collected_amount ?? value.total_collected),
    refundedAmount: requiredNumber(value.refunded_amount ?? value.total_refunded),
    netAmount: requiredNumber(value.net_amount ?? value.net_collected ?? value.total_amount),
    totalAmount: requiredNumber(value.total_amount ?? value.net_amount ?? value.net_collected),
    transactionsCount: requiredNumber(value.transactions_count),
  };
}

function toQueryString(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function toBackendAddPaymentPayload(payload: AddPaymentPayload): BackendAddPaymentPayload {
  return {
    payment_method_id: payload.paymentMethodId,
    amount: payload.amount,
    reference_number: payload.referenceNumber ?? null,
    provider_transaction_id: payload.providerTransactionId ?? null,
    notes: payload.notes ?? null,
  };
}

function toBackendRefundPayload(payload: RefundPaymentPayload): BackendRefundPaymentPayload {
  return {
    refund_amount: payload.refundAmount,
    refund_reason: payload.refundReason,
    approved_by_user_id: payload.approvedByUserId ?? null,
  };
}

function toBackendReconciliationPayload(
  payload: CreateReconciliationPayload,
): BackendCreateReconciliationPayload {
  return {
    branch_id: payload.branchId,
    reconciliation_date: payload.reconciliationDate,
    payment_method_id: payload.paymentMethodId,
    counted_amount: payload.countedAmount,
    notes: payload.notes ?? null,
  };
}

export async function getPayments(params: PaymentFilters): Promise<SalePayment[]> {
  const response = await apiRequest<SalePayment[]>(
    `/api/v1/payments${toQueryString({
      search: params.search,
      payment_method_id: params.paymentMethodId,
      payment_status: params.paymentStatus,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      branch_id: params.branchId,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parsePayment),
    },
  );

  return response.data;
}

export async function getPaymentById(id: string): Promise<SalePayment> {
  const response = await apiRequest<SalePayment>(`/api/v1/payments/${id}`, {
    authMode: "appwrite",
    parse: parsePayment,
  });

  return response.data;
}

export async function getSalePayments(saleId: string): Promise<SalePayment[]> {
  const response = await apiRequest<SalePayment[]>(`/api/v1/payments/sale/${saleId}`, {
    authMode: "appwrite",
    parse: (data) => parseList(data, parsePayment),
  });

  return response.data;
}

export async function addPaymentToSale(
  saleId: string,
  payload: AddPaymentPayload,
): Promise<SalePayment> {
  const response = await apiRequest<SalePayment, BackendAddPaymentPayload>(
    `/api/v1/payments/sale/${saleId}/add-payment`,
    {
      method: "POST",
      authMode: "appwrite",
      body: toBackendAddPaymentPayload(payload),
      parse: parsePayment,
    },
  );

  return response.data;
}

export async function refundPayment(
  paymentId: string,
  payload: RefundPaymentPayload,
): Promise<PaymentRefund> {
  const response = await apiRequest<PaymentRefund, BackendRefundPaymentPayload>(
    `/api/v1/payments/${paymentId}/refund`,
    {
      method: "POST",
      authMode: "appwrite",
      body: toBackendRefundPayload(payload),
      parse: parseRefund,
    },
  );

  return response.data;
}

export async function getRefunds(params: RefundFilters): Promise<PaymentRefund[]> {
  const response = await apiRequest<PaymentRefund[]>(
    `/api/v1/payments/refunds${toQueryString({
      search: params.search,
      refund_status: params.refundStatus,
      payment_method_id: params.paymentMethodId,
      date_from: params.dateFrom,
      date_to: params.dateTo,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseRefund),
    },
  );

  return response.data;
}

export async function getRefundById(id: string): Promise<PaymentRefund> {
  const response = await apiRequest<PaymentRefund>(`/api/v1/payments/refunds/${id}`, {
    authMode: "appwrite",
    parse: parseRefund,
  });

  return response.data;
}

export async function getDailyPaymentSummary(
  params: Record<string, string | null | undefined>,
): Promise<DailyPaymentSummary> {
  const response = await apiRequest<DailyPaymentSummary>(
    `/api/v1/payments/summary/daily${toQueryString(params)}`,
    {
      authMode: "appwrite",
      parse: parseDailySummary,
    },
  );

  return response.data;
}

export async function getPaymentSummaryByMethod(
  params: Record<string, string | null | undefined>,
): Promise<PaymentMethodSummary[]> {
  const response = await apiRequest<PaymentMethodSummary[]>(
    `/api/v1/payments/summary/by-method${toQueryString(params)}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseMethodSummary),
    },
  );

  return response.data;
}

export async function createReconciliation(
  payload: CreateReconciliationPayload,
): Promise<PaymentReconciliation> {
  const response = await apiRequest<PaymentReconciliation, BackendCreateReconciliationPayload>(
    "/api/v1/payments/reconciliations",
    {
      method: "POST",
      authMode: "appwrite",
      body: toBackendReconciliationPayload(payload),
      parse: parseReconciliation,
    },
  );

  return response.data;
}

export async function getReconciliations(
  params: ReconciliationFilters,
): Promise<PaymentReconciliation[]> {
  const response = await apiRequest<PaymentReconciliation[]>(
    `/api/v1/payments/reconciliations${toQueryString({
      payment_method_id: params.paymentMethodId,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      branch_id: params.branchId,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseReconciliation),
    },
  );

  return response.data;
}

export async function getReconciliationById(id: string): Promise<PaymentReconciliation> {
  const response = await apiRequest<PaymentReconciliation>(
    `/api/v1/payments/reconciliations/${id}`,
    {
      authMode: "appwrite",
      parse: parseReconciliation,
    },
  );

  return response.data;
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return getSettingsPaymentMethods();
}
