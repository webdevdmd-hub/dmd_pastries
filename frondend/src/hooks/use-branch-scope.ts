"use client";

import { useMemo } from "react";

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

  return useMemo(() => {
    const effectiveBranchId = user?.currentBranchId ?? user?.assignedBranchId ?? null;
    const effectiveBranchName = user?.currentBranchName ?? user?.assignedBranchName ?? null;
    const canAccessAllBranches = user?.canAccessAllBranches === true;
    const allowedBranchIds = uniqueNonEmpty([
      ...(user?.allowedBranchIds ?? []),
      user?.assignedBranchId,
      user?.currentBranchId,
    ]);

    const isBranchAllowed = (branchId: string): boolean => {
      if (branchId === "all") {
        return canAccessAllBranches;
      }

      return canAccessAllBranches || allowedBranchIds.includes(branchId);
    };

    const normalizeBranchId = (branchId: string): string => {
      if (branchId === "all") {
        return canAccessAllBranches ? "all" : (effectiveBranchId ?? "");
      }

      if (!branchId) {
        return effectiveBranchId ?? "";
      }

      return isBranchAllowed(branchId) ? branchId : (effectiveBranchId ?? "");
    };

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
    user?.allowedBranchIds,
    user?.assignedBranchId,
    user?.assignedBranchName,
    user?.canAccessAllBranches,
    user?.currentBranchId,
    user?.currentBranchName,
  ]);
}

export function useBranchQueryKey(): string {
  const branchScope = useBranchScope();

  return branchScope.effectiveBranchId ?? (branchScope.canAccessAllBranches ? "all" : "none");
}
