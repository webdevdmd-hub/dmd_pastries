"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  addPaymentToSale,
  createReconciliation,
  getDailyPaymentSummary,
  getPaymentById,
  getPaymentMethods,
  getPayments,
  getPaymentSummaryByMethod,
  getReconciliationById,
  getReconciliations,
  getRefundById,
  getRefunds,
  getSalePayments,
  refundPayment,
} from "@/lib/api/payments";
import { invalidatePosTransactionData } from "@/lib/query-invalidation";
import type {
  AddPaymentPayload,
  CreateReconciliationPayload,
  DailyPaymentSummary,
  PaymentFilters,
  PaymentMethodSummary,
  PaymentReconciliation,
  PaymentRefund,
  PaymentSummaryParams,
  ReconciliationFilters,
  RefundFilters,
  RefundPaymentPayload,
  SalePayment,
} from "@/types/payment";
import type { PaymentMethod } from "@/types/settings";

const paymentsQueryKey = "payments";

export function usePayments(filters: PaymentFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<SalePayment[]>({
    queryKey: [paymentsQueryKey, branchQueryKey, "list", filters],
    queryFn: async () => getPayments(filters),
    enabled,
  });
}

export function usePayment(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<SalePayment>({
    queryKey: [paymentsQueryKey, branchQueryKey, "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Payment ID is required.");
      }

      return getPaymentById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useSalePayments(saleId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<SalePayment[]>({
    queryKey: [paymentsQueryKey, branchQueryKey, "sale", saleId],
    queryFn: async () => {
      if (!saleId) {
        throw new Error("Sale ID is required.");
      }

      return getSalePayments(saleId);
    },
    enabled: enabled && saleId !== null,
  });
}

export function useRefunds(filters: RefundFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PaymentRefund[]>({
    queryKey: [paymentsQueryKey, branchQueryKey, "refunds", filters],
    queryFn: async () => getRefunds(filters),
    enabled,
  });
}

export function useRefund(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PaymentRefund>({
    queryKey: [paymentsQueryKey, branchQueryKey, "refund", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Refund ID is required.");
      }

      return getRefundById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useDailyPaymentSummary(params: PaymentSummaryParams, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<DailyPaymentSummary>({
    queryKey: [paymentsQueryKey, branchQueryKey, "summary", "daily", params],
    queryFn: async () => getDailyPaymentSummary(params),
    enabled,
  });
}

export function usePaymentSummaryByMethod(params: PaymentSummaryParams, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PaymentMethodSummary[]>({
    queryKey: [paymentsQueryKey, branchQueryKey, "summary", "by-method", params],
    queryFn: async () => getPaymentSummaryByMethod(params),
    enabled,
  });
}

export function useReconciliations(filters: ReconciliationFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PaymentReconciliation[]>({
    queryKey: [paymentsQueryKey, branchQueryKey, "reconciliations", filters],
    queryFn: async () => getReconciliations(filters),
    enabled,
  });
}

export function useReconciliation(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PaymentReconciliation>({
    queryKey: [paymentsQueryKey, branchQueryKey, "reconciliation", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Reconciliation ID is required.");
      }

      return getReconciliationById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function usePaymentMethods(enabled = true) {
  return useQuery<PaymentMethod[]>({
    queryKey: [paymentsQueryKey, "methods"],
    queryFn: async () => getPaymentMethods(),
    enabled,
  });
}

function invalidatePaymentData(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return invalidatePosTransactionData(queryClient);
}

export function useAddPaymentToSale() {
  const queryClient = useQueryClient();

  return useMutation<
    SalePayment,
    Error,
    {
      saleId: string;
      payload: AddPaymentPayload;
    }
  >({
    mutationFn: async ({ saleId, payload }) => addPaymentToSale(saleId, payload),
    onSuccess: async () => {
      await invalidatePaymentData(queryClient);
    },
  });
}

export function useRefundPayment() {
  const queryClient = useQueryClient();

  return useMutation<
    PaymentRefund,
    Error,
    {
      paymentId: string;
      payload: RefundPaymentPayload;
    }
  >({
    mutationFn: async ({ paymentId, payload }) => refundPayment(paymentId, payload),
    onSuccess: async () => {
      await invalidatePaymentData(queryClient);
    },
  });
}

export function useCreateReconciliation() {
  const queryClient = useQueryClient();

  return useMutation<PaymentReconciliation, Error, CreateReconciliationPayload>({
    mutationFn: async (payload) => createReconciliation(payload),
    onSuccess: async () => {
      await invalidatePaymentData(queryClient);
    },
  });
}
