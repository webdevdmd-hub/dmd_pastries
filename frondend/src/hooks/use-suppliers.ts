"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  createSupplier,
  createSupplierContact,
  createSupplierNote,
  deleteSupplier,
  deleteSupplierContact,
  deleteSupplierNote,
  getSupplierById,
  getSupplierContacts,
  getSupplierNotes,
  getSuppliers,
  getSupplierStats,
  lookupSuppliers,
  updateSupplier,
  updateSupplierContact,
  updateSupplierStatus,
} from "@/lib/api/suppliers";
import type {
  CreateSupplierContactPayload,
  CreateSupplierNotePayload,
  CreateSupplierPayload,
  Supplier,
  SupplierContact,
  SupplierFilters,
  SupplierNote,
  SupplierStats,
  UpdateSupplierContactPayload,
  UpdateSupplierPayload,
  UpdateSupplierStatusPayload,
} from "@/types/supplier";

const suppliersQueryKey = "suppliers";

export function useSuppliers(filters: SupplierFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<Supplier[]>({
    queryKey: [suppliersQueryKey, branchQueryKey, "list", filters],
    queryFn: async () => getSuppliers(filters),
    enabled,
  });
}

export function useSupplier(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<Supplier>({
    queryKey: [suppliersQueryKey, branchQueryKey, "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Supplier ID is required.");
      }

      return getSupplierById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useSupplierLookup(search: string, enabled = true) {
  const branchQueryKey = useBranchQueryKey();
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  return useQuery<Supplier[]>({
    queryKey: [suppliersQueryKey, branchQueryKey, "lookup", debouncedSearch],
    queryFn: async () => lookupSuppliers({ search: debouncedSearch, limit: 10 }),
    enabled: enabled && debouncedSearch.length >= 2,
  });
}

export function useSupplierContacts(supplierId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<SupplierContact[]>({
    queryKey: [suppliersQueryKey, branchQueryKey, "contacts", supplierId],
    queryFn: async () => {
      if (!supplierId) {
        throw new Error("Supplier ID is required.");
      }

      return getSupplierContacts(supplierId);
    },
    enabled: enabled && supplierId !== null,
  });
}

export function useSupplierNotes(supplierId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<SupplierNote[]>({
    queryKey: [suppliersQueryKey, branchQueryKey, "notes", supplierId],
    queryFn: async () => {
      if (!supplierId) {
        throw new Error("Supplier ID is required.");
      }

      return getSupplierNotes(supplierId);
    },
    enabled: enabled && supplierId !== null,
  });
}

export function useSupplierStats(supplierId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<SupplierStats>({
    queryKey: [suppliersQueryKey, branchQueryKey, "stats", supplierId],
    queryFn: async () => {
      if (!supplierId) {
        throw new Error("Supplier ID is required.");
      }

      return getSupplierStats(supplierId);
    },
    enabled: enabled && supplierId !== null,
  });
}

function invalidateSuppliers(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([queryClient.invalidateQueries({ queryKey: [suppliersQueryKey] })]);
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation<Supplier, Error, CreateSupplierPayload>({
    mutationFn: async (payload) => createSupplier(payload),
    onSuccess: async () => {
      await invalidateSuppliers(queryClient);
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation<Supplier, Error, { id: string; payload: UpdateSupplierPayload }>({
    mutationFn: async ({ id, payload }) => updateSupplier(id, payload),
    onSuccess: async () => {
      await invalidateSuppliers(queryClient);
    },
  });
}

export function useUpdateSupplierStatus() {
  const queryClient = useQueryClient();

  return useMutation<Supplier, Error, { id: string; payload: UpdateSupplierStatusPayload }>({
    mutationFn: async ({ id, payload }) => updateSupplierStatus(id, payload),
    onSuccess: async () => {
      await invalidateSuppliers(queryClient);
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteSupplier(id),
    onSuccess: async () => {
      await invalidateSuppliers(queryClient);
    },
  });
}

export function useCreateSupplierContact() {
  const queryClient = useQueryClient();

  return useMutation<
    SupplierContact,
    Error,
    { supplierId: string; payload: CreateSupplierContactPayload }
  >({
    mutationFn: async ({ supplierId, payload }) => createSupplierContact(supplierId, payload),
    onSuccess: async () => {
      await invalidateSuppliers(queryClient);
    },
  });
}

export function useUpdateSupplierContact() {
  const queryClient = useQueryClient();

  return useMutation<
    SupplierContact,
    Error,
    { supplierId: string; contactId: string; payload: UpdateSupplierContactPayload }
  >({
    mutationFn: async ({ supplierId, contactId, payload }) =>
      updateSupplierContact(supplierId, contactId, payload),
    onSuccess: async () => {
      await invalidateSuppliers(queryClient);
    },
  });
}

export function useDeleteSupplierContact() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { supplierId: string; contactId: string }>({
    mutationFn: async ({ supplierId, contactId }) => deleteSupplierContact(supplierId, contactId),
    onSuccess: async () => {
      await invalidateSuppliers(queryClient);
    },
  });
}

export function useCreateSupplierNote() {
  const queryClient = useQueryClient();

  return useMutation<
    SupplierNote,
    Error,
    { supplierId: string; payload: CreateSupplierNotePayload }
  >({
    mutationFn: async ({ supplierId, payload }) => createSupplierNote(supplierId, payload),
    onSuccess: async () => {
      await invalidateSuppliers(queryClient);
    },
  });
}

export function useDeleteSupplierNote() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { supplierId: string; noteId: string }>({
    mutationFn: async ({ supplierId, noteId }) => deleteSupplierNote(supplierId, noteId),
    onSuccess: async () => {
      await invalidateSuppliers(queryClient);
    },
  });
}
