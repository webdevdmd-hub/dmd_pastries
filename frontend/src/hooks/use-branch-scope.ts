"use client";

import { useCallback, useMemo } from "react";

import { useAuth } from "@/hooks/use-auth";

type BranchScope = {
  allowedBranchIds: string[];
  canAccessAllBranches: boolean;
  defaultBranchId: string;
  effectiveBranchId: string | null;
  effectiveBranchName: string | null;
  hasBranchScope: boolean;
  isBranchAllowed: (branchId: string) => boolean;
  normalizeBranchId: (branchId: string) => string;
};

function uniqueNonEmpty(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function useBranchScope(): BranchScope {
  const { user } = useAuth();
  const assignedBranchId = user?.assignedBranchId ?? null;
  const assignedBranchName = user?.assignedBranchName ?? null;
  const currentBranchId = user?.currentBranchId ?? null;
  const currentBranchName = user?.currentBranchName ?? null;
  const effectiveBranchId = currentBranchId ?? assignedBranchId;
  const effectiveBranchName = currentBranchName ?? assignedBranchName;
  const canAccessAllBranches = user?.canAccessAllBranches === true;
  const allowedBranchIdsKey = (user?.allowedBranchIds ?? []).join("|");

  const allowedBranchIds = useMemo(() => {
    const profileBranchIds = allowedBranchIdsKey ? allowedBranchIdsKey.split("|") : [];

    return uniqueNonEmpty([...profileBranchIds, assignedBranchId, currentBranchId]);
  }, [allowedBranchIdsKey, assignedBranchId, currentBranchId]);

  const isBranchAllowed = useCallback(
    (branchId: string): boolean => {
      if (branchId === "all") return canAccessAllBranches;

      return canAccessAllBranches || allowedBranchIds.includes(branchId);
    },
    [allowedBranchIds, canAccessAllBranches],
  );

  const normalizeBranchId = useCallback(
    (branchId: string): string => {
      if (branchId === "all") {
        return canAccessAllBranches ? "all" : (effectiveBranchId ?? "");
      }

      if (!branchId) {
        return effectiveBranchId ?? "";
      }

      return isBranchAllowed(branchId) ? branchId : (effectiveBranchId ?? "");
    },
    [canAccessAllBranches, effectiveBranchId, isBranchAllowed],
  );

  return useMemo(() => {
    return {
      allowedBranchIds,
      canAccessAllBranches,
      defaultBranchId: canAccessAllBranches ? "all" : (effectiveBranchId ?? ""),
      effectiveBranchId,
      effectiveBranchName,
      hasBranchScope: canAccessAllBranches || Boolean(effectiveBranchId),
      isBranchAllowed,
      normalizeBranchId,
    };
  }, [
    allowedBranchIds,
    canAccessAllBranches,
    effectiveBranchId,
    effectiveBranchName,
    isBranchAllowed,
    normalizeBranchId,
  ]);
}

export function useBranchQueryKey(): string {
  const branchScope = useBranchScope();

  return branchScope.effectiveBranchId ?? (branchScope.canAccessAllBranches ? "all" : "none");
}
