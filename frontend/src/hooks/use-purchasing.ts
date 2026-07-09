"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  addSupplierInvoicePayment,
  cancelPurchaseInvoice,
  cancelPurchaseReceipt,
  cancelPurchaseReturn,
  convertPurchaseInvoiceToReceipt,
  convertPurchaseOrderToBill,
  convertPurchaseOrderToInvoice,
  createPurchaseInvoice,
  createPurchaseOrder,
  createPurchaseOrderRevision,
  createPurchaseReturn,
  createSupplierPayment,
  deletePurchaseOrder,
  deleteSupplierPayment,
  duplicatePurchaseOrder,
  getBranches,
  getIngredients,
  getProducts,
  getPurchaseInvoiceById,
  getPurchaseInvoices,
  getPurchaseOrderById,
  getPurchaseOrderDocumentChain,
  getPurchaseOrders,
  getPurchaseReceiptById,
  getPurchaseReceiptReturnableItems,
  getPurchaseReceiptReturns,
  getPurchaseReceipts,
  getPurchaseReturnById,
  getPurchaseReturns,
  getPurchasingPaymentMethods,
  getPurchasingSummary,
  getSupplierInvoicePayments,
  getSupplierPaymentById,
  getSupplierPayments,
  getTaxRates,
  getUnits,
  lookupSuppliers,
  postPurchaseInvoice,
  postPurchaseReceipt,
  postPurchaseReturn,
  receivePurchase,
  receivePurchaseOrder,
  reopenPurchaseOrder,
  reversePurchaseReturn,
  updatePurchaseInvoice,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  updatePurchaseReturn,
  updateSupplierPayment,
} from "@/lib/api/purchasing";
import { invalidatePurchasingData, invalidateReceiveStockData } from "@/lib/query-invalidation";
import type {
  AddSupplierPaymentPayload,
  CancelPurchaseInvoicePayload,
  ConvertPurchaseInvoiceToReceiptPayload,
  ConvertPurchaseOrderToBillPayload,
  ConvertPurchaseOrderToInvoicePayload,
  CreatePurchaseInvoicePayload,
  CreatePurchaseOrderPayload,
  CreatePurchaseOrderRevisionPayload,
  CreatePurchaseReturnPayload,
  CreateSupplierPaymentPayload,
  PurchaseDocumentChain,
  PurchaseInvoice,
  PurchaseOrder,
  PurchaseOrderRevision,
  PurchaseReceipt,
  PurchaseReturn,
  PurchaseReturnFilters,
  PurchasingBranchOption,
  PurchasingFilters,
  PurchasingIngredientOption,
  PurchasingProductOption,
  PurchasingSummary,
  PurchasingSupplierOption,
  PurchasingTaxRateOption,
  PurchasingUnitOption,
  ReceivePurchaseOrderPayload,
  ReceivePurchasePayload,
  ReturnablePurchaseReceiptItem,
  ReversePurchaseReturnPayload,
  SupplierPayment,
  SupplierPaymentFilters,
  UpdatePurchaseInvoicePayload,
  UpdatePurchaseOrderPayload,
  UpdatePurchaseOrderStatusPayload,
  UpdatePurchaseReturnPayload,
  UpdateSupplierPaymentPayload,
} from "@/types/purchasing";
import type { PaymentMethod } from "@/types/settings";

const purchasingQueryKey = "purchasing";

export function usePurchasingSummary(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PurchasingSummary>({
    queryKey: [purchasingQueryKey, branchQueryKey, "summary"],
    queryFn: async () => getPurchasingSummary(),
    enabled,
  });
}

export function usePurchaseOrders(filters: PurchasingFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PurchaseOrder[]>({
    queryKey: [purchasingQueryKey, branchQueryKey, "orders", filters],
    queryFn: async () => getPurchaseOrders(filters),
    enabled,
  });
}

export function usePurchaseOrder(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PurchaseOrder>({
    queryKey: [purchasingQueryKey, branchQueryKey, "order", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Purchase order ID is required.");
      }

      return getPurchaseOrderById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function usePurchaseOrderDocumentChain(orderId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PurchaseDocumentChain>({
    queryKey: [purchasingQueryKey, branchQueryKey, "order-document-chain", orderId],
    queryFn: async () => {
      if (!orderId) {
        throw new Error("Purchase order ID is required.");
      }

      return getPurchaseOrderDocumentChain(orderId);
    },
    enabled: enabled && orderId !== null,
  });
}

export function usePurchaseInvoices(filters: PurchasingFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PurchaseInvoice[]>({
    queryKey: [purchasingQueryKey, branchQueryKey, "invoices", filters],
    queryFn: async () => getPurchaseInvoices(filters),
    enabled,
  });
}

export function usePurchaseInvoice(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PurchaseInvoice>({
    queryKey: [purchasingQueryKey, branchQueryKey, "invoice", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Purchase invoice ID is required.");
      }

      return getPurchaseInvoiceById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function usePurchaseReceipts(filters: PurchasingFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PurchaseReceipt[]>({
    queryKey: [purchasingQueryKey, branchQueryKey, "receipts", filters],
    queryFn: async () => getPurchaseReceipts(filters),
    enabled,
  });
}

export function usePurchaseReceipt(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PurchaseReceipt>({
    queryKey: [purchasingQueryKey, branchQueryKey, "receipt", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Purchase receipt ID is required.");
      }

      return getPurchaseReceiptById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function usePurchaseReturns(filters: PurchaseReturnFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PurchaseReturn[]>({
    queryKey: [purchasingQueryKey, branchQueryKey, "returns", filters],
    queryFn: async () => getPurchaseReturns(filters),
    enabled,
  });
}

export function usePurchaseReturn(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PurchaseReturn>({
    queryKey: [purchasingQueryKey, branchQueryKey, "return", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Purchase return ID is required.");
      }

      return getPurchaseReturnById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function usePurchaseReceiptReturnableItems(receiptId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ReturnablePurchaseReceiptItem[]>({
    queryKey: [purchasingQueryKey, branchQueryKey, "receipt-returnable-items", receiptId],
    queryFn: async () => {
      if (!receiptId) {
        throw new Error("Purchase receipt ID is required.");
      }

      return getPurchaseReceiptReturnableItems(receiptId);
    },
    enabled: enabled && receiptId !== null,
  });
}

export function usePurchaseReceiptReturns(receiptId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PurchaseReturn[]>({
    queryKey: [purchasingQueryKey, branchQueryKey, "receipt-returns", receiptId],
    queryFn: async () => {
      if (!receiptId) {
        throw new Error("Purchase receipt ID is required.");
      }

      return getPurchaseReceiptReturns(receiptId);
    },
    enabled: enabled && receiptId !== null,
  });
}

export function useSupplierPayments(filters: SupplierPaymentFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<SupplierPayment[]>({
    queryKey: [purchasingQueryKey, branchQueryKey, "supplier-payments", filters],
    queryFn: async () => getSupplierPayments(filters),
    enabled,
  });
}

export function usePurchasingPaymentMethods(branchId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PaymentMethod[]>({
    queryKey: [purchasingQueryKey, branchQueryKey, "payment-methods", branchId ?? "current"],
    queryFn: async () => getPurchasingPaymentMethods(branchId),
    enabled,
  });
}

export function useSupplierInvoicePayments(invoiceId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<SupplierPayment[]>({
    queryKey: [purchasingQueryKey, branchQueryKey, "invoice-payments", invoiceId],
    queryFn: async () => {
      if (!invoiceId) {
        throw new Error("Purchase invoice ID is required.");
      }

      return getSupplierInvoicePayments(invoiceId);
    },
    enabled: enabled && invoiceId !== null,
  });
}

export function useSupplierPayment(paymentId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<SupplierPayment>({
    queryKey: [purchasingQueryKey, branchQueryKey, "supplier-payment", paymentId],
    queryFn: async () => {
      if (!paymentId) {
        throw new Error("Supplier payment ID is required.");
      }

      return getSupplierPaymentById(paymentId);
    },
    enabled: enabled && paymentId !== null,
  });
}

export function usePurchasingSuppliers(search: string, enabled = true) {
  const branchQueryKey = useBranchQueryKey();
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  return useQuery<PurchasingSupplierOption[]>({
    queryKey: [purchasingQueryKey, branchQueryKey, "suppliers", debouncedSearch],
    queryFn: async () => lookupSuppliers(debouncedSearch),
    enabled,
  });
}

export function usePurchasingProducts(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PurchasingProductOption[]>({
    queryKey: [purchasingQueryKey, branchQueryKey, "products"],
    queryFn: async () => getProducts(),
    enabled,
  });
}

export function usePurchasingIngredients(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PurchasingIngredientOption[]>({
    queryKey: [purchasingQueryKey, branchQueryKey, "ingredients"],
    queryFn: async () => getIngredients(),
    enabled,
  });
}

export function usePurchasingUnits(enabled = true) {
  return useQuery<PurchasingUnitOption[]>({
    queryKey: [purchasingQueryKey, "units"],
    queryFn: async () => getUnits(),
    enabled,
  });
}

export function usePurchasingTaxRates(enabled = true) {
  return useQuery<PurchasingTaxRateOption[]>({
    queryKey: [purchasingQueryKey, "tax-rates"],
    queryFn: async () => getTaxRates(),
    enabled,
  });
}

export function usePurchasingBranches(enabled = true) {
  return useQuery<PurchasingBranchOption[]>({
    queryKey: [purchasingQueryKey, "branches"],
    queryFn: async () => getBranches(),
    enabled,
  });
}

function invalidatePurchasing(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return invalidatePurchasingData(queryClient);
}

function invalidatePurchaseStockImpact(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<unknown[]> {
  return invalidateReceiveStockData(queryClient);
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseOrder, Error, CreatePurchaseOrderPayload>({
    mutationFn: async (payload) => createPurchaseOrder(payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseOrder, Error, { id: string; payload: UpdatePurchaseOrderPayload }>({
    mutationFn: async ({ id, payload }) => updatePurchaseOrder(id, payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useCreatePurchaseOrderRevision() {
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseOrderRevision,
    Error,
    { id: string; payload: CreatePurchaseOrderRevisionPayload }
  >({
    mutationFn: async ({ id, payload }) => createPurchaseOrderRevision(id, payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useUpdatePurchaseOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseOrder,
    Error,
    { id: string; payload: UpdatePurchaseOrderStatusPayload }
  >({
    mutationFn: async ({ id, payload }) => updatePurchaseOrderStatus(id, payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deletePurchaseOrder(id),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useReopenPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseOrder, Error, string>({
    mutationFn: async (id) => reopenPurchaseOrder(id),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useDuplicatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseOrder, Error, string>({
    mutationFn: async (id) => duplicatePurchaseOrder(id),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useConvertPurchaseOrderToInvoice() {
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseInvoice,
    Error,
    { id: string; payload?: ConvertPurchaseOrderToInvoicePayload }
  >({
    mutationFn: async ({ id, payload }) => convertPurchaseOrderToInvoice(id, payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useConvertPurchaseOrderToBill() {
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseInvoice,
    Error,
    { id: string; payload: ConvertPurchaseOrderToBillPayload }
  >({
    mutationFn: async ({ id, payload }) => convertPurchaseOrderToBill(id, payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useCreatePurchaseInvoice() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseInvoice, Error, CreatePurchaseInvoicePayload>({
    mutationFn: async (payload) => createPurchaseInvoice(payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useUpdatePurchaseInvoice() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseInvoice, Error, { id: string; payload: UpdatePurchaseInvoicePayload }>(
    {
      mutationFn: async ({ id, payload }) => updatePurchaseInvoice(id, payload),
      onSuccess: async () => {
        await invalidatePurchasing(queryClient);
      },
    },
  );
}

export function usePostPurchaseInvoice() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseInvoice, Error, string>({
    mutationFn: async (id) => postPurchaseInvoice(id),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useCancelPurchaseInvoice() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseInvoice, Error, { id: string; payload: CancelPurchaseInvoicePayload }>(
    {
      mutationFn: async ({ id, payload }) => cancelPurchaseInvoice(id, payload),
      onSuccess: async () => {
        await invalidatePurchasing(queryClient);
      },
    },
  );
}

export function useConvertPurchaseInvoiceToReceipt() {
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseReceipt,
    Error,
    { id: string; payload?: ConvertPurchaseInvoiceToReceiptPayload }
  >({
    mutationFn: async ({ id, payload }) => convertPurchaseInvoiceToReceipt(id, payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useAddSupplierInvoicePayment() {
  const queryClient = useQueryClient();

  return useMutation<
    SupplierPayment,
    Error,
    { invoiceId: string; payload: AddSupplierPaymentPayload }
  >({
    mutationFn: async ({ invoiceId, payload }) => addSupplierInvoicePayment(invoiceId, payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useCreateSupplierPayment() {
  const queryClient = useQueryClient();

  return useMutation<SupplierPayment, Error, CreateSupplierPaymentPayload>({
    mutationFn: async (payload) => createSupplierPayment(payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useUpdateSupplierPayment() {
  const queryClient = useQueryClient();

  return useMutation<
    SupplierPayment,
    Error,
    { paymentId: string; payload: UpdateSupplierPaymentPayload }
  >({
    mutationFn: async ({ paymentId, payload }) => updateSupplierPayment(paymentId, payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useDeleteSupplierPayment() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (paymentId) => deleteSupplierPayment(paymentId),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useReceivePurchase() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseReceipt, Error, ReceivePurchasePayload>({
    mutationFn: async (payload) => receivePurchase(payload),
    onSuccess: async () => {
      await invalidatePurchaseStockImpact(queryClient);
    },
  });
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseReceipt, Error, { id: string; payload: ReceivePurchaseOrderPayload }>({
    mutationFn: async ({ id, payload }) => receivePurchaseOrder(id, payload),
    onSuccess: async () => {
      await invalidatePurchaseStockImpact(queryClient);
    },
  });
}

export function usePostPurchaseReceipt() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseReceipt, Error, string>({
    mutationFn: async (id) => postPurchaseReceipt(id),
    onSuccess: async () => {
      await invalidatePurchaseStockImpact(queryClient);
    },
  });
}

export function useCancelPurchaseReceipt() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseReceipt, Error, string>({
    mutationFn: async (id) => cancelPurchaseReceipt(id),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useCreatePurchaseReturn() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseReturn, Error, CreatePurchaseReturnPayload>({
    mutationFn: async (payload) => createPurchaseReturn(payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useUpdatePurchaseReturn() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseReturn, Error, { id: string; payload: UpdatePurchaseReturnPayload }>({
    mutationFn: async ({ id, payload }) => updatePurchaseReturn(id, payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function usePostPurchaseReturn() {
  const queryClient = useQueryClient();
  const branchQueryKey = useBranchQueryKey();

  return useMutation<PurchaseReturn, Error, string>({
    mutationFn: async (id) => postPurchaseReturn(id),
    onSuccess: async (purchaseReturn) => {
      queryClient.setQueryData(
        [purchasingQueryKey, branchQueryKey, "return", purchaseReturn.id],
        purchaseReturn,
      );
      await invalidatePurchaseStockImpact(queryClient);
    },
  });
}

export function useCancelPurchaseReturn() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseReturn, Error, string>({
    mutationFn: async (id) => cancelPurchaseReturn(id),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
}

export function useReversePurchaseReturn() {
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseReturn,
    Error,
    {
      id: string;
      payload: ReversePurchaseReturnPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => reversePurchaseReturn(id, payload),
    onSuccess: async () => {
      await invalidatePurchaseStockImpact(queryClient);
    },
  });
}
