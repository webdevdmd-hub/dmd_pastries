import { apiProbeRequest, apiRequest } from "@/lib/api/client";
import type { ApiProbeMode, ApiProbeResult, ApiRouteCatalogItem } from "@/types/api-monitor";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function probeModeValue(value: unknown): ApiProbeMode {
  return value === "safe_probe" ? "safe_probe" : "live_only";
}

function parseApiRoute(value: unknown): ApiRouteCatalogItem {
  if (!isObject(value)) {
    throw new Error("Backend returned an invalid API route item.");
  }

  return {
    apiName: stringValue(value.api_name),
    handler: stringValue(value.handler),
    method: stringValue(value.method),
    module: stringValue(value.module),
    path: stringValue(value.path),
    probeMode: probeModeValue(value.probe_mode),
  };
}

function parseApiRoutes(value: unknown): ApiRouteCatalogItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(parseApiRoute);
}

export async function getApiRouteCatalog(): Promise<ApiRouteCatalogItem[]> {
  const response = await apiRequest<ApiRouteCatalogItem[]>("/api/v1/system/api-routes", {
    authMode: "appwrite",
    parse: parseApiRoutes,
  });

  return response.data;
}

export async function runApiSafeProbe(
  route: ApiRouteCatalogItem,
  signal?: AbortSignal,
): Promise<ApiProbeResult> {
  return apiProbeRequest(route.path, signal);
}
