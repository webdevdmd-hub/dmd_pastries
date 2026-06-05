"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAccountTransfer,
  createChartAccount,
  createJournalEntry,
  createPaymentAccount,
  createPlatformSettlement,
  deleteChartAccount,
  deleteJournalEntry,
  deletePaymentAccount,
  getAccountingBackfillReadiness,
  getAccountingReconciliationAp,
  getAccountingReconciliationAr,
  getAccountingReconciliationHealthCheck,
  getAccountingReconciliationInventory,
  getAccountingReconciliationPaymentAccounts,
  getAccountingSettings,
  getAccountMappings,
  getAccountTransferById,
  getAccountTransfers,
  getBalanceSheetReport,
  getChartAccountById,
  getChartAccounts,
  getGeneralLedgerReport,
  getJournalEntries,
  getJournalEntryById,
  getLedgerDetails,
  getPaymentAccountById,
  getPaymentAccounts,
  getPlatformSettlementById,
  getPlatformSettlements,
  getProfitLossReport,
  getTrialBalanceReport,
  postJournalEntry,
  reverseJournalEntry,
  runAccountingBackfill,
  seedDefaultAccountMappings,
  seedDefaultChartAccounts,
  updateAccountingSettings,
  updateAccountMappings,
  updateChartAccount,
  updateChartAccountStatus,
  updateJournalEntry,
  updatePaymentAccount,
  updatePaymentAccountStatus,
} from "@/lib/api/accounting";
import type {
  AccountingBackfillFilters,
  AccountingBackfillPayload,
  AccountingBackfillReadinessResponse,
  AccountingBackfillResponse,
  AccountingReconciliationFilters,
  AccountingReconciliationResponse,
  AccountingSettings,
  AccountMappingsResponse,
  AccountTransfer,
  AccountTransferPayload,
  AccountTransfersFilters,
  AccountTransfersResponse,
  BalanceSheetFilters,
  BalanceSheetResponse,
  ChartAccount,
  ChartAccountsFilters,
  ChartAccountsResponse,
  CreateChartAccountPayload,
  CreateJournalEntryPayload,
  GeneralLedgerFilters,
  GeneralLedgerResponse,
  JournalEntriesFilters,
  JournalEntriesResponse,
  JournalEntry,
  LedgerDetailsFilters,
  LedgerDetailsResponse,
  PaymentAccount,
  PaymentAccountPayload,
  PaymentAccountsFilters,
  PaymentAccountsResponse,
  PlatformSettlement,
  PlatformSettlementPayload,
  PlatformSettlementsFilters,
  PlatformSettlementsResponse,
  ProfitLossFilters,
  ProfitLossResponse,
  TrialBalanceFilters,
  TrialBalanceResponse,
  UpdateAccountingSettingsPayload,
  UpdateAccountMappingsPayload,
  UpdateChartAccountPayload,
  UpdateChartAccountStatusPayload,
  UpdateJournalEntryPayload,
} from "@/types/accounting";

const accountingQueryKey = "accounting";

function invalidateAccounting(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([queryClient.invalidateQueries({ queryKey: [accountingQueryKey] })]);
}

export function useChartAccounts(filters: ChartAccountsFilters, enabled = true) {
  return useQuery<ChartAccountsResponse>({
    queryKey: [accountingQueryKey, "chart-of-accounts", filters],
    queryFn: async () => getChartAccounts(filters),
    enabled,
  });
}

export function useChartAccount(id: string | null, enabled = true) {
  return useQuery<ChartAccount>({
    queryKey: [accountingQueryKey, "chart-of-accounts", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Chart account ID is required.");
      }

      return getChartAccountById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useSeedDefaultChartAccounts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => seedDefaultChartAccounts(),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useCreateChartAccount() {
  const queryClient = useQueryClient();

  return useMutation<ChartAccount, Error, CreateChartAccountPayload>({
    mutationFn: async (payload) => createChartAccount(payload),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useUpdateChartAccount() {
  const queryClient = useQueryClient();

  return useMutation<ChartAccount, Error, { id: string; payload: UpdateChartAccountPayload }>({
    mutationFn: async ({ id, payload }) => updateChartAccount(id, payload),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useUpdateChartAccountStatus() {
  const queryClient = useQueryClient();

  return useMutation<ChartAccount, Error, { id: string; payload: UpdateChartAccountStatusPayload }>(
    {
      mutationFn: async ({ id, payload }) => updateChartAccountStatus(id, payload),
      onSuccess: async () => {
        await invalidateAccounting(queryClient);
      },
    },
  );
}

export function useDeleteChartAccount() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteChartAccount(id),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useAccountingSettings(enabled = true) {
  return useQuery<AccountingSettings>({
    queryKey: [accountingQueryKey, "settings"],
    queryFn: async () => getAccountingSettings(),
    enabled,
  });
}

export function useUpdateAccountingSettings() {
  const queryClient = useQueryClient();

  return useMutation<AccountingSettings, Error, UpdateAccountingSettingsPayload>({
    mutationFn: async (payload) => updateAccountingSettings(payload),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useAccountMappings(enabled = true) {
  return useQuery<AccountMappingsResponse>({
    queryKey: [accountingQueryKey, "account-mappings"],
    queryFn: async () => getAccountMappings(),
    enabled,
  });
}

export function useSeedDefaultAccountMappings() {
  const queryClient = useQueryClient();

  return useMutation<AccountMappingsResponse>({
    mutationFn: async () => seedDefaultAccountMappings(),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useUpdateAccountMappings() {
  const queryClient = useQueryClient();

  return useMutation<AccountMappingsResponse, Error, UpdateAccountMappingsPayload>({
    mutationFn: async (payload) => updateAccountMappings(payload),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useAccountingReconciliationHealthCheck(
  filters: AccountingReconciliationFilters,
  enabled = true,
) {
  return useQuery<AccountingReconciliationResponse>({
    queryKey: [accountingQueryKey, "reconciliation", "health-check", filters],
    queryFn: async () => getAccountingReconciliationHealthCheck(filters),
    enabled,
  });
}

export function useAccountingReconciliationInventory(
  filters: AccountingReconciliationFilters,
  enabled = true,
) {
  return useQuery<AccountingReconciliationResponse>({
    queryKey: [accountingQueryKey, "reconciliation", "inventory", filters],
    queryFn: async () => getAccountingReconciliationInventory(filters),
    enabled,
  });
}

export function useAccountingReconciliationAp(
  filters: AccountingReconciliationFilters,
  enabled = true,
) {
  return useQuery<AccountingReconciliationResponse>({
    queryKey: [accountingQueryKey, "reconciliation", "ap", filters],
    queryFn: async () => getAccountingReconciliationAp(filters),
    enabled,
  });
}

export function useAccountingReconciliationAr(
  filters: AccountingReconciliationFilters,
  enabled = true,
) {
  return useQuery<AccountingReconciliationResponse>({
    queryKey: [accountingQueryKey, "reconciliation", "ar", filters],
    queryFn: async () => getAccountingReconciliationAr(filters),
    enabled,
  });
}

export function useAccountingReconciliationPaymentAccounts(
  filters: AccountingReconciliationFilters,
  enabled = true,
) {
  return useQuery<AccountingReconciliationResponse>({
    queryKey: [accountingQueryKey, "reconciliation", "payment-accounts", filters],
    queryFn: async () => getAccountingReconciliationPaymentAccounts(filters),
    enabled,
  });
}

export function useAccountingBackfillReadiness(filters: AccountingBackfillFilters, enabled = true) {
  return useQuery<AccountingBackfillReadinessResponse>({
    queryKey: [accountingQueryKey, "backfill", "readiness", filters],
    queryFn: async () => getAccountingBackfillReadiness(filters),
    enabled,
  });
}

export function useRunAccountingBackfill() {
  const queryClient = useQueryClient();

  return useMutation<AccountingBackfillResponse, Error, AccountingBackfillPayload>({
    mutationFn: async (payload) => runAccountingBackfill(payload),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useJournalEntries(filters: JournalEntriesFilters, enabled = true) {
  return useQuery<JournalEntriesResponse>({
    queryKey: [accountingQueryKey, "journal-entries", filters],
    queryFn: async () => getJournalEntries(filters),
    enabled,
  });
}

export function useJournalEntry(id: string | null, enabled = true) {
  return useQuery<JournalEntry>({
    queryKey: [accountingQueryKey, "journal-entries", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Journal entry ID is required.");
      }

      return getJournalEntryById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useGeneralLedgerReport(filters: GeneralLedgerFilters, enabled = true) {
  return useQuery<GeneralLedgerResponse>({
    queryKey: [accountingQueryKey, "reports", "general-ledger", filters],
    queryFn: async () => getGeneralLedgerReport(filters),
    enabled,
  });
}

export function useTrialBalanceReport(filters: TrialBalanceFilters, enabled = true) {
  return useQuery<TrialBalanceResponse>({
    queryKey: [accountingQueryKey, "reports", "trial-balance", filters],
    queryFn: async () => getTrialBalanceReport(filters),
    enabled,
  });
}

export function useProfitLossReport(filters: ProfitLossFilters, enabled = true) {
  return useQuery<ProfitLossResponse>({
    queryKey: [accountingQueryKey, "reports", "profit-loss", filters],
    queryFn: async () => getProfitLossReport(filters),
    enabled,
  });
}

export function useBalanceSheetReport(filters: BalanceSheetFilters, enabled = true) {
  return useQuery<BalanceSheetResponse>({
    queryKey: [accountingQueryKey, "reports", "balance-sheet", filters],
    queryFn: async () => getBalanceSheetReport(filters),
    enabled,
  });
}

export function useLedgerDetails(filters: LedgerDetailsFilters, enabled = true) {
  return useQuery<LedgerDetailsResponse>({
    queryKey: [accountingQueryKey, "ledger-details", filters],
    queryFn: async () => getLedgerDetails(filters),
    enabled: enabled && filters.accountId.length > 0,
  });
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation<JournalEntry, Error, CreateJournalEntryPayload>({
    mutationFn: async (payload) => createJournalEntry(payload),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useUpdateJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation<JournalEntry, Error, { id: string; payload: UpdateJournalEntryPayload }>({
    mutationFn: async ({ id, payload }) => updateJournalEntry(id, payload),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function usePostJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation<JournalEntry, Error, string>({
    mutationFn: async (id) => postJournalEntry(id),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useReverseJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation<JournalEntry, Error, string>({
    mutationFn: async (id) => reverseJournalEntry(id),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useDeleteJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteJournalEntry(id),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function usePaymentAccounts(filters: PaymentAccountsFilters, enabled = true) {
  return useQuery<PaymentAccountsResponse>({
    queryKey: [accountingQueryKey, "payment-accounts", filters],
    queryFn: async () => getPaymentAccounts(filters),
    enabled,
  });
}

export function usePaymentAccount(id: string | null, enabled = true) {
  return useQuery<PaymentAccount>({
    queryKey: [accountingQueryKey, "payment-accounts", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Payment account ID is required.");
      }

      return getPaymentAccountById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useCreatePaymentAccount() {
  const queryClient = useQueryClient();

  return useMutation<PaymentAccount, Error, PaymentAccountPayload>({
    mutationFn: async (payload) => createPaymentAccount(payload),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useUpdatePaymentAccount() {
  const queryClient = useQueryClient();

  return useMutation<
    PaymentAccount,
    Error,
    { id: string; payload: Partial<PaymentAccountPayload> }
  >({
    mutationFn: async ({ id, payload }) => updatePaymentAccount(id, payload),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useUpdatePaymentAccountStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    PaymentAccount,
    Error,
    { id: string; payload: UpdateChartAccountStatusPayload }
  >({
    mutationFn: async ({ id, payload }) => updatePaymentAccountStatus(id, payload),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useDeletePaymentAccount() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deletePaymentAccount(id),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function useAccountTransfers(filters: AccountTransfersFilters, enabled = true) {
  return useQuery<AccountTransfersResponse>({
    queryKey: [accountingQueryKey, "account-transfers", filters],
    queryFn: async () => getAccountTransfers(filters),
    enabled,
  });
}

export function useAccountTransfer(id: string | null, enabled = true) {
  return useQuery<AccountTransfer>({
    queryKey: [accountingQueryKey, "account-transfers", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Account transfer ID is required.");
      }

      return getAccountTransferById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useCreateAccountTransfer() {
  const queryClient = useQueryClient();

  return useMutation<AccountTransfer, Error, AccountTransferPayload>({
    mutationFn: async (payload) => createAccountTransfer(payload),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}

export function usePlatformSettlements(filters: PlatformSettlementsFilters, enabled = true) {
  return useQuery<PlatformSettlementsResponse>({
    queryKey: [accountingQueryKey, "platform-settlements", filters],
    queryFn: async () => getPlatformSettlements(filters),
    enabled,
  });
}

export function usePlatformSettlement(id: string | null, enabled = true) {
  return useQuery<PlatformSettlement>({
    queryKey: [accountingQueryKey, "platform-settlements", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Platform settlement ID is required.");
      }

      return getPlatformSettlementById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useCreatePlatformSettlement() {
  const queryClient = useQueryClient();

  return useMutation<PlatformSettlement, Error, PlatformSettlementPayload>({
    mutationFn: async (payload) => createPlatformSettlement(payload),
    onSuccess: async () => {
      await invalidateAccounting(queryClient);
    },
  });
}
