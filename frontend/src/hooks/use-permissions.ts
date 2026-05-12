"use client";

import { useQuery } from "@tanstack/react-query";

import { getPermissions } from "@/lib/api/permissions";

const permissionsQueryKey = "permissions";

export function usePermissions() {
  return useQuery({
    queryKey: [permissionsQueryKey],
    queryFn: async () => getPermissions(),
  });
}
