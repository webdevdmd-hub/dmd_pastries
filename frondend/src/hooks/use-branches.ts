"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignUserBranch,
  createBranch,
  getBranchById,
  getBranches,
  updateBranch,
  updateBranchStatus,
} from "@/lib/api/branches";
import type {
  AssignUserBranchPayload,
  Branch,
  CreateBranchPayload,
  UpdateBranchPayload,
  UpdateBranchStatusPayload,
} from "@/types/branch";
import type { User } from "@/types/user";

const branchesQueryKey = "branches";
const usersQueryKey = "users";

export function useBranches(enabled = true) {
  return useQuery({
    queryKey: [branchesQueryKey],
    queryFn: async () => getBranches(),
    enabled,
  });
}

export function useBranch(id: string | null, enabled = true) {
  return useQuery({
    queryKey: [branchesQueryKey, "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Branch ID is required.");
      }

      return getBranchById(id);
    },
    enabled: enabled && id !== null,
  });
}

function invalidateBranches(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([queryClient.invalidateQueries({ queryKey: [branchesQueryKey] })]);
}

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation<Branch, Error, CreateBranchPayload>({
    mutationFn: async (payload) => createBranch(payload),
    onSuccess: async () => {
      await invalidateBranches(queryClient);
    },
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();

  return useMutation<
    Branch,
    Error,
    {
      id: string;
      payload: UpdateBranchPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateBranch(id, payload),
    onSuccess: async () => {
      await invalidateBranches(queryClient);
    },
  });
}

export function useUpdateBranchStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    Branch,
    Error,
    {
      id: string;
      payload: UpdateBranchStatusPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateBranchStatus(id, payload),
    onSuccess: async () => {
      await invalidateBranches(queryClient);
    },
  });
}

export function useAssignUserBranch() {
  const queryClient = useQueryClient();

  return useMutation<
    User,
    Error,
    {
      userId: string;
      payload: AssignUserBranchPayload;
    }
  >({
    mutationFn: async ({ userId, payload }) => assignUserBranch(userId, payload),
    onSuccess: async (updatedUser) => {
      queryClient.setQueryData([usersQueryKey, "detail", updatedUser.id], updatedUser);
      await queryClient.invalidateQueries({ queryKey: [usersQueryKey] });
    },
  });
}
