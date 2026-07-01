import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getSuperAdminBusiness,
  getSuperAdminBusinesses,
  getSuperAdminDiagnostics,
  getSuperAdminProfile,
  getSuperAdminTableRows,
  getSuperAdminTables,
  getSuperAdminUser,
  getSuperAdminUserHardDeletePreview,
  getSuperAdminUsers,
  updateSuperAdminBusinessAction,
  updateSuperAdminTableRow,
  updateSuperAdminUserAction,
} from "@/lib/api/super-admin";
import type {
  SuperAdminBusinessActionRequest,
  SuperAdminBusinessActionResponse,
  SuperAdminBusinessDetail,
  SuperAdminBusinessSummary,
  SuperAdminDiagnostic,
  SuperAdminHardDeletePreview,
  SuperAdminTableDefinition,
  SuperAdminTableRowActionResponse,
  SuperAdminTableRowsResponse,
  SuperAdminTableRowUpdateRequest,
  SuperAdminUserActionRequest,
  SuperAdminUserActionResponse,
  SuperAdminUserDetail,
  SuperAdminUserSummary,
} from "@/types/super-admin";
import type { SafeUserProfile } from "@/types/user";

export function useSuperAdminProfile(enabled: boolean) {
  return useQuery<SafeUserProfile>({
    queryKey: ["super-admin", "me"],
    queryFn: async () => getSuperAdminProfile(),
    enabled,
  });
}

export function useSuperAdminBusinesses(filters: { search: string; status: string }) {
  return useQuery<SuperAdminBusinessSummary[]>({
    queryKey: ["super-admin", "businesses", filters],
    queryFn: async () => getSuperAdminBusinesses(filters),
  });
}

export function useSuperAdminBusiness(id: string) {
  return useQuery<SuperAdminBusinessDetail>({
    queryKey: ["super-admin", "business", id],
    queryFn: async () => getSuperAdminBusiness(id),
    enabled: id.length > 0,
  });
}

export function useUpdateSuperAdminBusinessAction(id: string) {
  const queryClient = useQueryClient();

  return useMutation<SuperAdminBusinessActionResponse, Error, SuperAdminBusinessActionRequest>({
    mutationFn: async (body) => updateSuperAdminBusinessAction(id, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["super-admin", "business", id] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin", "businesses"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin", "users"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin", "diagnostics"] }),
      ]);
    },
  });
}

export function useSuperAdminUsers(filters: {
  businessId?: string;
  search: string;
  status: string;
}) {
  return useQuery<SuperAdminUserSummary[]>({
    queryKey: ["super-admin", "users", filters],
    queryFn: async () => getSuperAdminUsers(filters),
  });
}

export function useSuperAdminUser(id: string) {
  return useQuery<SuperAdminUserDetail>({
    queryKey: ["super-admin", "user", id],
    queryFn: async () => getSuperAdminUser(id),
    enabled: id.length > 0,
  });
}

export function useSuperAdminUserHardDeletePreview(id: string) {
  return useQuery<SuperAdminHardDeletePreview>({
    queryKey: ["super-admin", "user", id, "hard-delete-preview"],
    queryFn: async () => getSuperAdminUserHardDeletePreview(id),
    enabled: id.length > 0,
  });
}

export function useSuperAdminDiagnostics() {
  return useQuery<SuperAdminDiagnostic[]>({
    queryKey: ["super-admin", "diagnostics"],
    queryFn: async () => getSuperAdminDiagnostics(),
  });
}

export function useSuperAdminTables() {
  return useQuery<SuperAdminTableDefinition[]>({
    queryKey: ["super-admin", "tables"],
    queryFn: async () => getSuperAdminTables(),
  });
}

export function useSuperAdminTableRows(filters: {
  table: string;
  businessId?: string;
  search: string;
  page: number;
  limit: number;
}) {
  return useQuery<SuperAdminTableRowsResponse>({
    queryKey: ["super-admin", "tables", filters],
    queryFn: async () => getSuperAdminTableRows(filters),
    enabled: filters.table.length > 0,
  });
}

export function useUpdateSuperAdminTableRow(table: string) {
  const queryClient = useQueryClient();

  return useMutation<
    SuperAdminTableRowActionResponse,
    Error,
    { rowId: string; body: SuperAdminTableRowUpdateRequest }
  >({
    mutationFn: async ({ rowId, body }) => updateSuperAdminTableRow(table, rowId, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["super-admin", "tables"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin", "tables", { table }] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin", "businesses"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin", "users"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin", "diagnostics"] }),
      ]);
    },
  });
}

export function useUpdateSuperAdminUserAction(id: string) {
  const queryClient = useQueryClient();

  return useMutation<SuperAdminUserActionResponse, Error, SuperAdminUserActionRequest>({
    mutationFn: async (body) => updateSuperAdminUserAction(id, body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["super-admin", "user", id] }),
        queryClient.invalidateQueries({
          queryKey: ["super-admin", "user", id, "hard-delete-preview"],
        }),
        queryClient.invalidateQueries({ queryKey: ["super-admin", "users"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin", "businesses"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin", "diagnostics"] }),
      ]);
    },
  });
}
