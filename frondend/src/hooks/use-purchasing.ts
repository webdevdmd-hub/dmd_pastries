"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  addSupplierInvoicePayment,
  cancelPurchaseInvoice,
  cancelPurchaseReceipt,
  convertPurchaseInvoiceToReceipt,
  convertPurchaseOrderToInvoice,
  createPurchaseInvoice,
  createPurchaseOrder,
  deletePurchaseOrder,
  getBranches,
  getIngredients,
  getProducts,
  getPurchaseInvoiceById,
  getPurchaseInvoices,
  getPurchaseOrderById,
  getPurchaseOrderDocumentChain,
  getPurchaseOrders,
  getPurchaseReceiptById,
  getPurchaseReceipts,
  getPurchasingSummary,
  getSupplierInvoicePayments,
  getSupplierPayments,
  getTaxRates,
  getUnits,
  lookupSuppliers,
  postPurchaseInvoice,
  postPurchaseReceipt,
  receivePurchase,
  updatePurchaseInvoice,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
} from "@/lib/api/purchasing";
import type {
  AddSupplierPaymentPayload,
  ConvertPurchaseInvoiceToReceiptPayload,
  ConvertPurchaseOrderToInvoicePayload,
  CreatePurchaseInvoicePayload,
  CreatePurchaseOrderPayload,
  PurchaseDocumentChain,
  PurchaseInvoice,
  PurchaseOrder,
  PurchaseReceipt,
  PurchasingBranchOption,
  PurchasingFilters,
  PurchasingIngredientOption,
  PurchasingProductOption,
  PurchasingSummary,
  PurchasingSupplierOption,
  PurchasingTaxRateOption,
  PurchasingUnitOption,
  ReceivePurchasePayload,
  SupplierPayment,
  SupplierPaymentFilters,
  UpdatePurchaseInvoicePayload,
  UpdatePurchaseOrderPayload,
  UpdatePurchaseOrderStatusPayload,
} from "@/types/purchasing";

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

export function useSupplierPayments(filters: SupplierPaymentFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<SupplierPayment[]>({
    queryKey: [purchasingQueryKey, branchQueryKey, "supplier-payments", filters],
    queryFn: async () => getSupplierPayments(filters),
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
  return Promise.all([queryClient.invalidateQueries({ queryKey: [purchasingQueryKey] })]);
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

  return useMutation<PurchaseInvoice, Error, string>({
    mutationFn: async (id) => cancelPurchaseInvoice(id),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
    },
  });
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

export function useReceivePurchase() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseReceipt, Error, ReceivePurchasePayload>({
    mutationFn: async (payload) => receivePurchase(payload),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    },
  });
}

export function usePostPurchaseReceipt() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseReceipt, Error, string>({
    mutationFn: async (id) => postPurchaseReceipt(id),
    onSuccess: async () => {
      await invalidatePurchasing(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
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
