"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createChartAccount,
  createJournalEntry,
  deleteChartAccount,
  getBalanceSheetReport,
  getChartAccountById,
  getChartAccounts,
  getGeneralLedgerReport,
  getJournalEntries,
  getJournalEntryById,
  getLedgerDetails,
  getProfitLossReport,
  getTrialBalanceReport,
  postJournalEntry,
  reverseJournalEntry,
  seedDefaultChartAccounts,
  updateChartAccount,
  updateChartAccountStatus,
  updateJournalEntry,
} from "@/lib/api/accounting";
import type {
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
  ProfitLossFilters,
  ProfitLossResponse,
  TrialBalanceFilters,
  TrialBalanceResponse,
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
