"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  createExpense,
  deleteExpense,
  getExpenseById,
  getExpenses,
  updateExpense,
} from "@/lib/api/expenses";
import { invalidateExpenseData } from "@/lib/query-invalidation";
import type {
  CreateExpensePayload,
  Expense,
  ExpensesFilters,
  ExpensesResponse,
  UpdateExpensePayload,
} from "@/types/expenses";

const expensesQueryKey = "expenses";

function invalidateExpenses(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return invalidateExpenseData(queryClient);
}

export function useExpenses(filters: ExpensesFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ExpensesResponse>({
    queryKey: [expensesQueryKey, branchQueryKey, "list", filters],
    queryFn: async () => getExpenses(filters),
    enabled,
  });
}

export function useExpense(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<Expense>({
    queryKey: [expensesQueryKey, branchQueryKey, "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Expense ID is required.");
      }

      return getExpenseById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation<Expense, Error, CreateExpensePayload>({
    mutationFn: async (payload) => createExpense(payload),
    onSuccess: async () => {
      await invalidateExpenses(queryClient);
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation<Expense, Error, { id: string; payload: UpdateExpensePayload }>({
    mutationFn: async ({ id, payload }) => updateExpense(id, payload),
    onSuccess: async () => {
      await invalidateExpenses(queryClient);
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteExpense(id),
    onSuccess: async () => {
      await invalidateExpenses(queryClient);
    },
  });
}
