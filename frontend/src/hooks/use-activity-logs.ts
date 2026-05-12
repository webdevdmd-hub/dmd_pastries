"use client";

import { useQuery } from "@tanstack/react-query";

import { getActivityLogs, getUserActivityLogs } from "@/lib/api/activity-logs";
import type { ActivityEntityType } from "@/types/activity-log";

const activityLogsQueryKey = "activity-logs";

type ActivityLogFilters = {
  entityType?: ActivityEntityType;
  limit?: number;
  cursor?: string | null;
};

export function useActivityLogs(filters: ActivityLogFilters = {}, enabled = true) {
  return useQuery({
    queryKey: [activityLogsQueryKey, filters],
    queryFn: async () => getActivityLogs(filters),
    enabled,
  });
}

export function useUserActivityLogs(
  userId: string | null,
  filters: Pick<ActivityLogFilters, "limit" | "cursor"> = {},
  enabled = true,
) {
  return useQuery({
    queryKey: [activityLogsQueryKey, "user", userId, filters],
    queryFn: async () => {
      if (!userId) {
        throw new Error("User ID is required.");
      }

      return getUserActivityLogs(userId, filters);
    },
    enabled: enabled && userId !== null,
  });
}
