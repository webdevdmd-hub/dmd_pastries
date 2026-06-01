"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createRole,
  deleteRole,
  getRoleById,
  getRolePermissions,
  getRoles,
  updateRole,
  updateRolePermissions,
} from "@/lib/api/roles";
import type {
  CreateRolePayload,
  DeleteRoleResult,
  Role,
  UpdateRolePayload,
  UpdateRolePermissionsPayload,
} from "@/types/role";

const rolesQueryKey = "roles";

export function useRoles(enabled = true) {
  return useQuery({
    queryKey: [rolesQueryKey],
    queryFn: async () => getRoles(),
    enabled,
  });
}

export function useRole(roleId: string | null) {
  return useQuery({
    queryKey: [rolesQueryKey, "detail", roleId],
    queryFn: async () => {
      if (!roleId) {
        throw new Error("Role ID is required.");
      }

      return getRoleById(roleId);
    },
    enabled: roleId !== null,
  });
}

export function useRolePermissions(roleId: string | null) {
  return useQuery({
    queryKey: [rolesQueryKey, "permissions", roleId],
    queryFn: async () => {
      if (!roleId) {
        throw new Error("Role ID is required.");
      }

      return getRolePermissions(roleId);
    },
    enabled: roleId !== null,
  });
}

function invalidateRoles(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [rolesQueryKey] }),
    queryClient.invalidateQueries({ queryKey: [rolesQueryKey, "detail"] }),
    queryClient.invalidateQueries({ queryKey: [rolesQueryKey, "permissions"] }),
  ]);
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation<Role, Error, CreateRolePayload>({
    mutationFn: async (payload) => createRole(payload),
    onSuccess: async () => {
      await invalidateRoles(queryClient);
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation<
    Role,
    Error,
    {
      id: string;
      payload: UpdateRolePayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateRole(id, payload),
    onSuccess: async (updatedRole) => {
      queryClient.setQueryData([rolesQueryKey, "detail", updatedRole.id], updatedRole);
      await invalidateRoles(queryClient);
    },
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation<
    Role,
    Error,
    {
      id: string;
      payload: UpdateRolePermissionsPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateRolePermissions(id, payload),
    onSuccess: async (updatedRole) => {
      queryClient.setQueryData([rolesQueryKey, "detail", updatedRole.id], updatedRole);
      await invalidateRoles(queryClient);
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation<DeleteRoleResult, Error, string>({
    mutationFn: async (id) => deleteRole(id),
    onSuccess: async () => {
      await invalidateRoles(queryClient);
    },
  });
}
