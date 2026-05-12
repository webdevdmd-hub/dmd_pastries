"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  assignCustomerTag,
  createCustomer,
  createCustomerNote,
  createCustomerTag,
  deleteCustomer,
  deleteCustomerNote,
  deleteCustomerTag,
  getCustomerAssignedTags,
  getCustomerById,
  getCustomerNotes,
  getCustomers,
  getCustomerStats,
  getCustomerTags,
  lookupCustomers,
  quickCreateCustomer,
  removeCustomerTag,
  updateCustomer,
  updateCustomerStatus,
  updateCustomerTag,
} from "@/lib/api/customers";
import type {
  AssignCustomerTagPayload,
  CreateCustomerNotePayload,
  CreateCustomerPayload,
  CreateCustomerTagPayload,
  Customer,
  CustomerFilters,
  CustomerNote,
  CustomerStats,
  CustomerTag,
  QuickCreateCustomerPayload,
  UpdateCustomerPayload,
  UpdateCustomerStatusPayload,
  UpdateCustomerTagPayload,
} from "@/types/customer";

const customersQueryKey = "customers";

export function useCustomers(filters: CustomerFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<Customer[]>({
    queryKey: [customersQueryKey, branchQueryKey, "list", filters],
    queryFn: async () => getCustomers(filters),
    enabled,
  });
}

export function useCustomer(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<Customer>({
    queryKey: [customersQueryKey, branchQueryKey, "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Customer ID is required.");
      }

      return getCustomerById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useCustomerLookup(search: string, enabled = true) {
  const branchQueryKey = useBranchQueryKey();
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  return useQuery<Customer[]>({
    queryKey: [customersQueryKey, branchQueryKey, "lookup", debouncedSearch],
    queryFn: async () => lookupCustomers({ search: debouncedSearch, limit: 10 }),
    enabled: enabled && debouncedSearch.length >= 2,
  });
}

export function useCustomerTags(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<CustomerTag[]>({
    queryKey: [customersQueryKey, branchQueryKey, "tags"],
    queryFn: async () => getCustomerTags(),
    enabled,
  });
}

export function useCustomerAssignedTags(customerId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<CustomerTag[]>({
    queryKey: [customersQueryKey, branchQueryKey, "assigned-tags", customerId],
    queryFn: async () => {
      if (!customerId) {
        throw new Error("Customer ID is required.");
      }

      return getCustomerAssignedTags(customerId);
    },
    enabled: enabled && customerId !== null,
  });
}

export function useCustomerNotes(customerId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<CustomerNote[]>({
    queryKey: [customersQueryKey, branchQueryKey, "notes", customerId],
    queryFn: async () => {
      if (!customerId) {
        throw new Error("Customer ID is required.");
      }

      return getCustomerNotes(customerId);
    },
    enabled: enabled && customerId !== null,
  });
}

export function useCustomerStats(customerId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<CustomerStats>({
    queryKey: [customersQueryKey, branchQueryKey, "stats", customerId],
    queryFn: async () => {
      if (!customerId) {
        throw new Error("Customer ID is required.");
      }

      return getCustomerStats(customerId);
    },
    enabled: enabled && customerId !== null,
  });
}

function invalidateCustomers(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([queryClient.invalidateQueries({ queryKey: [customersQueryKey] })]);
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, CreateCustomerPayload>({
    mutationFn: async (payload) => createCustomer(payload),
    onSuccess: async () => {
      await invalidateCustomers(queryClient);
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, { id: string; payload: UpdateCustomerPayload }>({
    mutationFn: async ({ id, payload }) => updateCustomer(id, payload),
    onSuccess: async () => {
      await invalidateCustomers(queryClient);
    },
  });
}

export function useUpdateCustomerStatus() {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, { id: string; payload: UpdateCustomerStatusPayload }>({
    mutationFn: async ({ id, payload }) => updateCustomerStatus(id, payload),
    onSuccess: async () => {
      await invalidateCustomers(queryClient);
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteCustomer(id),
    onSuccess: async () => {
      await invalidateCustomers(queryClient);
    },
  });
}

export function useQuickCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, QuickCreateCustomerPayload>({
    mutationFn: async (payload) => quickCreateCustomer(payload),
    onSuccess: async () => {
      await invalidateCustomers(queryClient);
    },
  });
}

export function useCreateCustomerTag() {
  const queryClient = useQueryClient();

  return useMutation<CustomerTag, Error, CreateCustomerTagPayload>({
    mutationFn: async (payload) => createCustomerTag(payload),
    onSuccess: async () => {
      await invalidateCustomers(queryClient);
    },
  });
}

export function useUpdateCustomerTag() {
  const queryClient = useQueryClient();

  return useMutation<CustomerTag, Error, { id: string; payload: UpdateCustomerTagPayload }>({
    mutationFn: async ({ id, payload }) => updateCustomerTag(id, payload),
    onSuccess: async () => {
      await invalidateCustomers(queryClient);
    },
  });
}

export function useDeleteCustomerTag() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteCustomerTag(id),
    onSuccess: async () => {
      await invalidateCustomers(queryClient);
    },
  });
}

export function useAssignCustomerTag() {
  const queryClient = useQueryClient();

  return useMutation<
    CustomerTag[],
    Error,
    {
      customerId: string;
      payload: AssignCustomerTagPayload;
    }
  >({
    mutationFn: async ({ customerId, payload }) => assignCustomerTag(customerId, payload),
    onSuccess: async () => {
      await invalidateCustomers(queryClient);
    },
  });
}

export function useRemoveCustomerTag() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { customerId: string; tagId: string }>({
    mutationFn: async ({ customerId, tagId }) => removeCustomerTag(customerId, tagId),
    onSuccess: async () => {
      await invalidateCustomers(queryClient);
    },
  });
}

export function useCreateCustomerNote() {
  const queryClient = useQueryClient();

  return useMutation<
    CustomerNote,
    Error,
    {
      customerId: string;
      payload: CreateCustomerNotePayload;
    }
  >({
    mutationFn: async ({ customerId, payload }) => createCustomerNote(customerId, payload),
    onSuccess: async () => {
      await invalidateCustomers(queryClient);
    },
  });
}

export function useDeleteCustomerNote() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { customerId: string; noteId: string }>({
    mutationFn: async ({ customerId, noteId }) => deleteCustomerNote(customerId, noteId),
    onSuccess: async () => {
      await invalidateCustomers(queryClient);
    },
  });
}
