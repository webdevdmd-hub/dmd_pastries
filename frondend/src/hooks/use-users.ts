"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignUserBranch,
  createUser,
  getUserById,
  getUsers,
  restoreUser,
  softDeleteUser,
  updateUser,
  updateUserStatus,
} from "@/lib/api/users";
import type {
  AssignUserBranchPayload,
  AssignUserBranchResult,
  CreateUserPayload,
  SoftDeleteUserResult,
  UpdateUserPayload,
  UpdateUserStatusPayload,
  User,
  UserFilters,
} from "@/types/user";

const usersQueryKey = "users";

export function useUsers(filters: UserFilters, enabled = true) {
  return useQuery({
    queryKey: [usersQueryKey, filters],
    queryFn: async () => getUsers(filters),
    enabled,
  });
}

export function useUser(userId: string | null) {
  return useQuery({
    queryKey: [usersQueryKey, "detail", userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error("User ID is required.");
      }

      return getUserById(userId);
    },
    enabled: userId !== null,
  });
}

function invalidateUsers(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [usersQueryKey] }),
    queryClient.invalidateQueries({ queryKey: [usersQueryKey, "detail"] }),
  ]);
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, CreateUserPayload>({
    mutationFn: async (payload) => createUser(payload),
    onSuccess: async () => {
      await invalidateUsers(queryClient);
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation<
    User,
    Error,
    {
      id: string;
      payload: UpdateUserPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateUser(id, payload),
    onSuccess: async (updatedUser) => {
      queryClient.setQueryData([usersQueryKey, "detail", updatedUser.id], updatedUser);
      await invalidateUsers(queryClient);
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    User,
    Error,
    {
      id: string;
      payload: UpdateUserStatusPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateUserStatus(id, payload),
    onSuccess: async (updatedUser) => {
      queryClient.setQueryData([usersQueryKey, "detail", updatedUser.id], updatedUser);
      await invalidateUsers(queryClient);
    },
  });
}

export function useAssignUserBranch() {
  const queryClient = useQueryClient();

  return useMutation<
    AssignUserBranchResult,
    Error,
    {
      id: string;
      payload: AssignUserBranchPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => assignUserBranch(id, payload),
    onSuccess: async () => {
      await invalidateUsers(queryClient);
    },
  });
}

export function useSoftDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation<SoftDeleteUserResult, Error, string>({
    mutationFn: async (id) => softDeleteUser(id),
    onSuccess: async () => {
      await invalidateUsers(queryClient);
    },
  });
}

export function useRestoreUser() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, string>({
    mutationFn: async (id) => restoreUser(id),
    onSuccess: async (restoredUser) => {
      queryClient.setQueryData([usersQueryKey, "detail", restoredUser.id], restoredUser);
      await invalidateUsers(queryClient);
    },
  });
}
