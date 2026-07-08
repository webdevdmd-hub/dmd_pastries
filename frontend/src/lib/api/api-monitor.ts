import { apiProbeRequest, apiRequest } from "@/lib/api/client";
import type {
  ApiProbeCategory,
  ApiProbeMode,
  ApiProbeResult,
  ApiRouteCatalogItem,
} from "@/types/api-monitor";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function probeModeValue(value: unknown): ApiProbeMode {
  return value === "safe_probe" ? "safe_probe" : "live_only";
}

function probeCategoryValue(value: unknown): ApiProbeCategory {
  switch (value) {
    case "authenticated":
    case "parameter_required":
    case "public":
    case "unsupported":
      return value;
    default:
      return "unsupported";
  }
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function parseApiRoute(value: unknown): ApiRouteCatalogItem {
  if (!isObject(value)) {
    throw new Error("Backend returned an invalid API route item.");
  }

  return {
    apiName: stringValue(value.api_name),
    expectedValidationMessages: stringArrayValue(value.expected_validation_messages),
    handler: stringValue(value.handler),
    method: stringValue(value.method),
    module: stringValue(value.module),
    path: stringValue(value.path),
    probeCategory: probeCategoryValue(value.probe_category),
    probeMode: probeModeValue(value.probe_mode),
    probePath: stringValue(value.probe_path) || null,
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
  return apiProbeRequest(route.probePath ?? route.path, signal, {
    expectedValidationMessages: route.expectedValidationMessages,
  });
}
