export type ApiMonitorStatus =
  | "expected_validation"
  | "failed"
  | "healthy"
  | "not_tested"
  | "server_error"
  | "slow"
  | "unauthorized";

export type ApiProbeMode = "live_only" | "safe_probe";
export type ApiProbeCategory = "authenticated" | "parameter_required" | "public" | "unsupported";

export type ApiMonitorSource = "live" | "safe_probe";

export type ApiRouteCatalogItem = {
  apiName: string;
  expectedValidationMessages: string[];
  handler: string;
  method: string;
  module: string;
  path: string;
  probeCategory: ApiProbeCategory;
  probeMode: ApiProbeMode;
  probePath: string | null;
};

export type ApiMonitorEvent = {
  apiName: string;
  checkedAt: string;
  endpoint: string;
  errorMessage: string | null;
  id: string;
  method: string;
  module: string;
  responseTimeMs: number;
  routePath: string | null;
  source: ApiMonitorSource;
  status: ApiMonitorStatus;
  statusCode: number;
  success: boolean;
};

export type ApiMonitorRecordInput = {
  checkedAt?: string;
  endpoint: string;
  errorMessage?: string | null;
  method: string;
  responseTimeMs: number;
  source: ApiMonitorSource;
  status?: ApiMonitorStatus;
  statusCode: number;
  success: boolean;
};

export type ApiProbeResult = {
  endpoint: string;
  errorMessage: string | null;
  method: string;
  responseTimeMs: number;
  status: ApiMonitorStatus;
  statusCode: number;
  success: boolean;
};
