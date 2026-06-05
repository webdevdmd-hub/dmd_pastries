"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

import { getApiRouteCatalog } from "@/lib/api/api-monitor";
import {
  clearApiMonitorEvents,
  getApiMonitorSnapshot,
  setApiMonitorCatalog,
  subscribeApiMonitor,
} from "@/lib/api-monitor/store";

export function useApiRouteCatalog(enabled = true) {
  const query = useQuery({
    queryKey: ["api-monitor", "routes"],
    queryFn: async () => getApiRouteCatalog(),
    enabled,
  });

  useEffect(() => {
    if (query.data) {
      setApiMonitorCatalog(query.data);
    }
  }, [query.data]);

  return query;
}

export function useApiMonitorEvents() {
  return useSyncExternalStore(subscribeApiMonitor, getApiMonitorSnapshot, getApiMonitorSnapshot);
}

export function clearApiMonitorHistory(): void {
  clearApiMonitorEvents();
}
