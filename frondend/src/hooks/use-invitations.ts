"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acceptStaffInvitation,
  cancelStaffInvitation,
  createStaffInvitation,
  getStaffInvitations,
  resendStaffInvitation,
} from "@/lib/api/invitations";
import type {
  AcceptStaffInvitationPayload,
  AcceptStaffInvitationResult,
  CreateStaffInvitationPayload,
  StaffInvitation,
  StaffInvitationAction,
  StaffInvitationStatus,
} from "@/types/invitation";

const invitationsQueryKey = "staff-invitations";
const usersQueryKey = "users";

export function useStaffInvitations(status?: StaffInvitationStatus, enabled = true) {
  return useQuery({
    queryKey: [invitationsQueryKey, status ?? "all"],
    queryFn: async () => getStaffInvitations(status),
    enabled,
  });
}

function invalidateInvitations(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [invitationsQueryKey] }),
    queryClient.invalidateQueries({ queryKey: [usersQueryKey] }),
  ]);
}

export function useCreateStaffInvitation() {
  const queryClient = useQueryClient();

  return useMutation<StaffInvitation, Error, CreateStaffInvitationPayload>({
    mutationFn: async (payload) => createStaffInvitation(payload),
    onSuccess: async () => {
      await invalidateInvitations(queryClient);
    },
  });
}

export function useResendStaffInvitation() {
  const queryClient = useQueryClient();

  return useMutation<StaffInvitationAction, Error, string>({
    mutationFn: async (id) => resendStaffInvitation(id),
    onSuccess: async () => {
      await invalidateInvitations(queryClient);
    },
  });
}

export function useCancelStaffInvitation() {
  const queryClient = useQueryClient();

  return useMutation<StaffInvitationAction, Error, string>({
    mutationFn: async (id) => cancelStaffInvitation(id),
    onSuccess: async () => {
      await invalidateInvitations(queryClient);
    },
  });
}

export function useAcceptStaffInvitation() {
  const queryClient = useQueryClient();

  return useMutation<AcceptStaffInvitationResult, Error, AcceptStaffInvitationPayload>({
    mutationFn: async (payload) => acceptStaffInvitation(payload),
    onSuccess: async () => {
      await invalidateInvitations(queryClient);
    },
  });
}
