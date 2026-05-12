"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createPaymentMethod,
  createReceiptLayout,
  createTaxRate,
  deletePaymentMethod,
  deleteReceiptLayout,
  deleteTaxRate,
  getCompanySettings,
  getPaymentMethodById,
  getPaymentMethods,
  getReceiptLayoutById,
  getReceiptLayouts,
  getSettingsOverview,
  getTaxRateById,
  getTaxRates,
  previewReceiptLayout,
  setDefaultReceiptLayout,
  updateCompanySettings,
  updatePaymentMethod,
  updatePaymentMethodStatus,
  updateReceiptLayout,
  updateTaxRate,
  updateTaxRateStatus,
} from "@/lib/api/settings-data";
import type {
  CompanySettings,
  CreatePaymentMethodPayload,
  CreateTaxRatePayload,
  PaymentMethod,
  ReceiptLayout,
  ReceiptLayoutPayload,
  ReceiptLayoutPreview,
  TaxRate,
  UpdateCompanySettingsPayload,
  UpdatePaymentMethodPayload,
  UpdateRecordStatusPayload,
  UpdateTaxRatePayload,
} from "@/types/settings";

const settingsDataQueryKey = "settings-data";

export function useCompanySettings(enabled = true) {
  return useQuery({
    queryKey: [settingsDataQueryKey, "company"],
    queryFn: async () => getCompanySettings(),
    enabled,
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation<CompanySettings, Error, UpdateCompanySettingsPayload>({
    mutationFn: async (payload) => updateCompanySettings(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [settingsDataQueryKey, "company"] }),
        queryClient.invalidateQueries({ queryKey: [settingsDataQueryKey, "overview"] }),
      ]);
    },
  });
}

export function useSettingsOverview(enabled = true) {
  return useQuery({
    queryKey: [settingsDataQueryKey, "overview"],
    queryFn: async () => getSettingsOverview(),
    enabled,
  });
}

export function useTaxRates(enabled = true) {
  return useQuery({
    queryKey: [settingsDataQueryKey, "tax-rates"],
    queryFn: async () => getTaxRates(),
    enabled,
  });
}

export function useTaxRate(id: string | null, enabled = true) {
  return useQuery({
    queryKey: [settingsDataQueryKey, "tax-rates", "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Tax rate ID is required.");
      }

      return getTaxRateById(id);
    },
    enabled: enabled && id !== null,
  });
}

function invalidateTaxRates(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [settingsDataQueryKey, "overview"] }),
    queryClient.invalidateQueries({ queryKey: [settingsDataQueryKey, "tax-rates"] }),
  ]);
}

export function useCreateTaxRate() {
  const queryClient = useQueryClient();

  return useMutation<TaxRate, Error, CreateTaxRatePayload>({
    mutationFn: async (payload) => createTaxRate(payload),
    onSuccess: async () => {
      await invalidateTaxRates(queryClient);
    },
  });
}

export function useUpdateTaxRate() {
  const queryClient = useQueryClient();

  return useMutation<
    TaxRate,
    Error,
    {
      id: string;
      payload: UpdateTaxRatePayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateTaxRate(id, payload),
    onSuccess: async (taxRate) => {
      queryClient.setQueryData([settingsDataQueryKey, "tax-rates", "detail", taxRate.id], taxRate);
      await invalidateTaxRates(queryClient);
    },
  });
}

export function useUpdateTaxRateStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    TaxRate,
    Error,
    {
      id: string;
      payload: UpdateRecordStatusPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateTaxRateStatus(id, payload),
    onSuccess: async (taxRate) => {
      queryClient.setQueryData([settingsDataQueryKey, "tax-rates", "detail", taxRate.id], taxRate);
      await invalidateTaxRates(queryClient);
    },
  });
}

export function useDeleteTaxRate() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteTaxRate(id),
    onSuccess: async () => {
      await invalidateTaxRates(queryClient);
    },
  });
}

export function usePaymentMethods(enabled = true) {
  return useQuery({
    queryKey: [settingsDataQueryKey, "payment-methods"],
    queryFn: async () => getPaymentMethods(),
    enabled,
  });
}

export function usePaymentMethod(id: string | null, enabled = true) {
  return useQuery({
    queryKey: [settingsDataQueryKey, "payment-methods", "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Payment method ID is required.");
      }

      return getPaymentMethodById(id);
    },
    enabled: enabled && id !== null,
  });
}

function invalidatePaymentMethods(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [settingsDataQueryKey, "overview"] }),
    queryClient.invalidateQueries({ queryKey: [settingsDataQueryKey, "payment-methods"] }),
  ]);
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation<PaymentMethod, Error, CreatePaymentMethodPayload>({
    mutationFn: async (payload) => createPaymentMethod(payload),
    onSuccess: async () => {
      await invalidatePaymentMethods(queryClient);
    },
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation<
    PaymentMethod,
    Error,
    {
      id: string;
      payload: UpdatePaymentMethodPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updatePaymentMethod(id, payload),
    onSuccess: async (paymentMethod) => {
      queryClient.setQueryData(
        [settingsDataQueryKey, "payment-methods", "detail", paymentMethod.id],
        paymentMethod,
      );
      await invalidatePaymentMethods(queryClient);
    },
  });
}

export function useUpdatePaymentMethodStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    PaymentMethod,
    Error,
    {
      id: string;
      payload: UpdateRecordStatusPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updatePaymentMethodStatus(id, payload),
    onSuccess: async (paymentMethod) => {
      queryClient.setQueryData(
        [settingsDataQueryKey, "payment-methods", "detail", paymentMethod.id],
        paymentMethod,
      );
      await invalidatePaymentMethods(queryClient);
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deletePaymentMethod(id),
    onSuccess: async () => {
      await invalidatePaymentMethods(queryClient);
    },
  });
}

function invalidateReceiptLayouts(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [settingsDataQueryKey, "overview"] }),
    queryClient.invalidateQueries({ queryKey: [settingsDataQueryKey, "receipt-layouts"] }),
  ]);
}

export function useReceiptLayouts(enabled = true) {
  return useQuery({
    queryKey: [settingsDataQueryKey, "receipt-layouts"],
    queryFn: async () => getReceiptLayouts(),
    enabled,
  });
}

export function useReceiptLayout(id: string | null, enabled = true) {
  return useQuery({
    queryKey: [settingsDataQueryKey, "receipt-layouts", "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Receipt layout ID is required.");
      }

      return getReceiptLayoutById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useCreateReceiptLayout() {
  const queryClient = useQueryClient();

  return useMutation<ReceiptLayout, Error, ReceiptLayoutPayload>({
    mutationFn: async (payload) => createReceiptLayout(payload),
    onSuccess: async () => {
      await invalidateReceiptLayouts(queryClient);
    },
  });
}

export function useUpdateReceiptLayout() {
  const queryClient = useQueryClient();

  return useMutation<
    ReceiptLayout,
    Error,
    {
      id: string;
      payload: Partial<ReceiptLayoutPayload>;
    }
  >({
    mutationFn: async ({ id, payload }) => updateReceiptLayout(id, payload),
    onSuccess: async (layout) => {
      queryClient.setQueryData(
        [settingsDataQueryKey, "receipt-layouts", "detail", layout.id],
        layout,
      );
      await invalidateReceiptLayouts(queryClient);
    },
  });
}

export function useDeleteReceiptLayout() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteReceiptLayout(id),
    onSuccess: async () => {
      await invalidateReceiptLayouts(queryClient);
    },
  });
}

export function useSetDefaultReceiptLayout() {
  const queryClient = useQueryClient();

  return useMutation<ReceiptLayout, Error, string>({
    mutationFn: async (id) => setDefaultReceiptLayout(id),
    onSuccess: async (layout) => {
      queryClient.setQueryData(
        [settingsDataQueryKey, "receipt-layouts", "detail", layout.id],
        layout,
      );
      await invalidateReceiptLayouts(queryClient);
    },
  });
}

export function usePreviewReceiptLayout() {
  return useMutation<ReceiptLayoutPreview, Error, string>({
    mutationFn: async (id) => previewReceiptLayout(id),
  });
}
