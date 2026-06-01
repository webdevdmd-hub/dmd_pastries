"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import {
  getBusinessProfile,
  getBusinessSettings,
  getOnboardingStatus,
  switchBranch,
  updateBusinessProfile,
  updateBusinessSettings,
} from "@/lib/api/business";
import type {
  BusinessProfile,
  BusinessSettings,
  SwitchBranchPayload,
  SwitchBranchResult,
  UpdateBusinessPayload,
  UpdateBusinessSettingsPayload,
} from "@/types/business";

const businessQueryKey = "business";
const onboardingQueryKey = "onboarding-status";
const settingsQueryKey = "business-settings";
const branchesQueryKey = "branches";
const usersQueryKey = "users";

export function useBusinessProfile(enabled = true) {
  return useQuery({
    queryKey: [businessQueryKey],
    queryFn: async () => getBusinessProfile(),
    enabled,
  });
}

export function useOnboardingStatus(enabled = true) {
  return useQuery({
    queryKey: [onboardingQueryKey],
    queryFn: async () => getOnboardingStatus(),
    enabled,
  });
}

export function useBusinessSettings(enabled = true) {
  return useQuery({
    queryKey: [settingsQueryKey],
    queryFn: async () => getBusinessSettings(),
    enabled,
  });
}

export function useUpdateBusinessProfile() {
  const queryClient = useQueryClient();

  return useMutation<BusinessProfile, Error, UpdateBusinessPayload>({
    mutationFn: async (payload) => updateBusinessProfile(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [businessQueryKey] }),
        queryClient.invalidateQueries({ queryKey: [onboardingQueryKey] }),
      ]);
    },
  });
}

export function useUpdateBusinessSettings() {
  const queryClient = useQueryClient();

  return useMutation<BusinessSettings, Error, UpdateBusinessSettingsPayload>({
    mutationFn: async (payload) => updateBusinessSettings(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [settingsQueryKey] }),
        queryClient.invalidateQueries({ queryKey: [onboardingQueryKey] }),
      ]);
    },
  });
}

export function useSwitchBranch() {
  const queryClient = useQueryClient();
  const { refreshProfile } = useAuth();

  return useMutation<SwitchBranchResult, Error, SwitchBranchPayload>({
    mutationFn: async (payload) => switchBranch(payload),
    onSuccess: async () => {
      await refreshProfile();
      await Promise.all([
        queryClient.invalidateQueries(),
        queryClient.invalidateQueries({ queryKey: [onboardingQueryKey] }),
        queryClient.invalidateQueries({ queryKey: [branchesQueryKey] }),
        queryClient.invalidateQueries({ queryKey: [usersQueryKey] }),
      ]);
    },
  });
}
