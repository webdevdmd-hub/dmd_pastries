import { classifyApiMonitorStatus, recordApiMonitorEvent } from "@/lib/api-monitor/store";
import { createAppwriteJwt } from "@/lib/appwrite/auth";
import { notifySessionExpired } from "@/lib/auth/session-events";
import { getPublicEnvValue } from "@/lib/public-env";
import type { ApiFailure, ApiResponse, ApiSuccess, FieldErrorMap } from "@/types/api";
import type { ApiProbeResult } from "@/types/api-monitor";

type RequestMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type AuthMode = "none" | "appwrite";

type RequestOptions<TBody> = {
  method?: RequestMethod;
  body?: TBody;
  authMode?: AuthMode;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
};

type ApiErrorOptions = {
  message: string;
  status: number;
  errors?: FieldErrorMap;
  errorDetails?: Record<string, unknown>;
};

export type ApiBlobResponse = {
  blob: Blob;
  contentType: string;
  filename: string | null;
};

export class ApiError extends Error {
  readonly status: number;
  readonly errors: FieldErrorMap | undefined;
  readonly errorDetails: Record<string, unknown> | undefined;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.errors = options.errors;
    this.errorDetails = options.errorDetails;
  }
}

function getApiBaseUrl(): string {
  const baseUrl = getPublicEnvValue("NEXT_PUBLIC_API_BASE_URL");

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is missing.");
  }

  try {
    const parsedUrl = new URL(baseUrl);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_API_BASE_URL must use http or https.");
    }

    return parsedUrl.toString().replace(/\/$/, "");
  } catch {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL must be a full absolute URL, for example http://localhost:8080.",
    );
  }
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function recordApiRequestEvent({
  endpoint,
  errorMessage,
  method,
  responseTimeMs,
  source,
  statusCode,
  success,
}: {
  endpoint: string;
  errorMessage?: string | null;
  method: RequestMethod;
  responseTimeMs: number;
  source: "live" | "safe_probe";
  statusCode: number;
  success: boolean;
}): ApiProbeResult {
  const roundedResponseTime = Math.max(0, Math.round(responseTimeMs));

  if (typeof window === "undefined") {
    return {
      endpoint,
      errorMessage: errorMessage ?? null,
      method,
      responseTimeMs: roundedResponseTime,
      status: classifyApiMonitorStatus(statusCode, roundedResponseTime, success),
      statusCode,
      success,
    };
  }

  const event = recordApiMonitorEvent({
    endpoint,
    errorMessage: errorMessage ?? null,
    method,
    responseTimeMs,
    source,
    statusCode,
    success,
  });

  return {
    endpoint: event.endpoint,
    errorMessage: event.errorMessage,
    method: event.method,
    responseTimeMs: event.responseTimeMs,
    status: event.status,
    statusCode: event.statusCode,
    success: event.success,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeErrors(value: unknown): FieldErrorMap | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const entries = Object.entries(value).reduce<FieldErrorMap>((accumulator, [key, item]) => {
    if (typeof item === "string" && item.length > 0) {
      accumulator[key] = [item];
      return accumulator;
    }

    if (Array.isArray(item)) {
      const messages = item.filter((entry): entry is string => typeof entry === "string");

      if (messages.length > 0) {
        accumulator[key] = messages;
      }
    }

    return accumulator;
  }, {});

  return Object.keys(entries).length > 0 ? entries : undefined;
}

function normalizeBackendError(value: unknown): {
  messageSuffix?: string;
  errors?: FieldErrorMap;
} {
  if (typeof value === "string" && value.length > 0) {
    return {
      messageSuffix: value,
    };
  }

  const errors = normalizeErrors(value);

  if (errors) {
    return {
      errors,
      messageSuffix: Object.values(errors).flat().join(", "),
    };
  }

  if (Array.isArray(value)) {
    const stringItems = value.filter((item): item is string => typeof item === "string");

    if (stringItems.length > 0) {
      return {
        messageSuffix: stringItems.join(", "),
      };
    }
  }

  return {};
}

function normalizeApiResponse(value: unknown): ApiResponse<unknown> {
  if (!isObject(value)) {
    throw new ApiError({
      message: "Backend returned an invalid response shape.",
      status: 500,
    });
  }

  const success = value.success;
  const message = typeof value.message === "string" ? value.message : "Request completed.";
  const backendError = normalizeBackendError("error" in value ? value.error : undefined);
  const backendErrors = normalizeBackendError("errors" in value ? value.errors : undefined);

  if (success === false || ("error" in value && value.error !== undefined)) {
    const errors = backendError.errors ?? backendErrors.errors;
    const errorDetails = isObject(value.errors) ? value.errors : undefined;
    const messageSuffix = backendError.messageSuffix ?? backendErrors.messageSuffix;
    const resolvedMessage =
      messageSuffix && messageSuffix !== message
        ? `${message}: ${messageSuffix}`
        : message;

    return {
      success: false,
      message: resolvedMessage,
      ...(errors ? { errors } : {}),
      ...(errorDetails ? { errorDetails } : {}),
    } satisfies ApiFailure;
  }

  return {
    success: true,
    message,
    data: "data" in value ? value.data : undefined,
  } satisfies ApiSuccess<unknown>;
}

function parseContentDispositionFilename(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const encodedFilename = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (encodedFilename?.[1]) {
    try {
      return decodeURIComponent(encodedFilename[1].trim());
    } catch {
      return encodedFilename[1].trim();
    }
  }

  const filename = /filename="?([^";]+)"?/i.exec(value);

  return filename?.[1]?.trim() ?? null;
}

async function buildHeaders(authMode: AuthMode): Promise<HeadersInit> {
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (authMode === "appwrite") {
    const jwt = await createAppwriteJwt();

    if (!jwt) {
      notifySessionExpired();

      throw new ApiError({
        message: "Unable to create an Appwrite JWT for the backend request.",
        status: 401,
      });
    }

    headers.set("Authorization", `Bearer ${jwt}`);
  }

  return headers;
}

export async function apiRequest<TResponse, TBody = undefined>(
  path: string,
  options: RequestOptions<TBody> & {
    parse: (data: unknown) => TResponse;
  },
): Promise<ApiSuccess<TResponse>> {
  const method = options.method ?? "GET";
  const url = `${getApiBaseUrl()}${path}`;
  const startedAt = nowMs();
  let headers: HeadersInit;

  try {
    headers = await buildHeaders(options.authMode ?? "none");
  } catch (error) {
    if (error instanceof ApiError) {
      recordApiRequestEvent({
        endpoint: path,
        errorMessage: error.message,
        method,
        responseTimeMs: nowMs() - startedAt,
        source: "live",
        statusCode: error.status,
        success: false,
      });
    }

    throw error;
  }

  const requestInit: RequestInit = {
    method,
    headers,
    credentials: options.credentials ?? "omit",
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };
  let response: Response;

  try {
    response = await fetch(url, requestInit);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    recordApiRequestEvent({
      endpoint: path,
      errorMessage:
        "Unable to reach the backend API. Check that the backend server is running and CORS is configured.",
      method,
      responseTimeMs: nowMs() - startedAt,
      source: "live",
      statusCode: 0,
      success: false,
    });

    throw new ApiError({
      message:
        "Unable to reach the backend API. Check that the backend server is running and CORS is configured.",
      status: 0,
    });
  }

  const responseText = await response.text();
  let payload: unknown = { success: true, message: "Request completed." };

  if (responseText.length > 0) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      const excerpt = responseText.slice(0, 240);
      const message = excerpt
        ? `Backend returned a non-JSON response: ${excerpt}`
        : "Backend returned a non-JSON response.";
      recordApiRequestEvent({
        endpoint: path,
        errorMessage: message,
        method,
        responseTimeMs: nowMs() - startedAt,
        source: "live",
        statusCode: response.status,
        success: false,
      });
      throw new ApiError({
        message,
        status: response.status,
      });
    }
  }
  const normalized = normalizeApiResponse(payload);

  if (!response.ok || !normalized.success) {
    const errors = normalized.success ? undefined : normalized.errors;
    const errorDetails = normalized.success ? undefined : normalized.errorDetails;
    if (response.status === 401) {
      notifySessionExpired();
    }

    recordApiRequestEvent({
      endpoint: path,
      errorMessage: normalized.message,
      method,
      responseTimeMs: nowMs() - startedAt,
      source: "live",
      statusCode: response.status,
      success: false,
    });

    throw new ApiError({
      message: normalized.message,
      status: response.status,
      ...(errors ? { errors } : {}),
      ...(errorDetails ? { errorDetails } : {}),
    });
  }

  recordApiRequestEvent({
    endpoint: path,
    method,
    responseTimeMs: nowMs() - startedAt,
    source: "live",
    statusCode: response.status,
    success: true,
  });

  return {
    ...normalized,
    data: options.parse(normalized.data),
  };
}

export async function apiBlobRequest<TBody = undefined>(
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<ApiBlobResponse> {
  const method = options.method ?? "GET";
  const url = `${getApiBaseUrl()}${path}`;
  const startedAt = nowMs();
  let headers: HeadersInit;

  try {
    headers = await buildHeaders(options.authMode ?? "none");
  } catch (error) {
    if (error instanceof ApiError) {
      recordApiRequestEvent({
        endpoint: path,
        errorMessage: error.message,
        method,
        responseTimeMs: nowMs() - startedAt,
        source: "live",
        statusCode: error.status,
        success: false,
      });
    }

    throw error;
  }

  const requestInit: RequestInit = {
    method,
    headers,
    credentials: options.credentials ?? "omit",
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };
  let response: Response;

  try {
    response = await fetch(url, requestInit);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    recordApiRequestEvent({
      endpoint: path,
      errorMessage:
        "Unable to reach the backend API. Check that the backend server is running and CORS is configured.",
      method,
      responseTimeMs: nowMs() - startedAt,
      source: "live",
      statusCode: 0,
      success: false,
    });

    throw new ApiError({
      message:
        "Unable to reach the backend API. Check that the backend server is running and CORS is configured.",
      status: 0,
    });
  }

  if (!response.ok) {
    const responseText = await response.text();
    let message = "Backend request failed.";
    let errors: FieldErrorMap | undefined;
    let errorDetails: Record<string, unknown> | undefined;

    if (responseText.length > 0) {
      try {
        const payload = JSON.parse(responseText) as unknown;
        const normalized = normalizeApiResponse(payload);
        message = normalized.message;
        errors = normalized.success ? undefined : normalized.errors;
        errorDetails = normalized.success ? undefined : normalized.errorDetails;
      } catch {
        message = responseText.slice(0, 240);
      }
    }

    if (response.status === 401) {
      notifySessionExpired();
    }

    recordApiRequestEvent({
      endpoint: path,
      errorMessage: message,
      method,
      responseTimeMs: nowMs() - startedAt,
      source: "live",
      statusCode: response.status,
      success: false,
    });

    throw new ApiError({
      message,
      status: response.status,
      ...(errors ? { errors } : {}),
      ...(errorDetails ? { errorDetails } : {}),
    });
  }

  recordApiRequestEvent({
    endpoint: path,
    method,
    responseTimeMs: nowMs() - startedAt,
    source: "live",
    statusCode: response.status,
    success: true,
  });

  const blob = await response.blob();

  return {
    blob,
    contentType: response.headers.get("Content-Type") ?? blob.type,
    filename: parseContentDispositionFilename(response.headers.get("Content-Disposition")),
  };
}

export async function apiProbeRequest(path: string, signal?: AbortSignal): Promise<ApiProbeResult> {
  const method: RequestMethod = "GET";
  const url = `${getApiBaseUrl()}${path}`;
  const startedAt = nowMs();
  let headers: HeadersInit;

  try {
    headers = await buildHeaders("appwrite");
  } catch (error) {
    if (error instanceof ApiError) {
      return recordApiRequestEvent({
        endpoint: path,
        errorMessage: error.message,
        method,
        responseTimeMs: nowMs() - startedAt,
        source: "safe_probe",
        statusCode: error.status,
        success: false,
      });
    }

    throw error;
  }

  try {
    const response = await fetch(url, {
      headers,
      method,
      ...(signal ? { signal } : {}),
    });
    let errorMessage: string | null = null;

    if (!response.ok) {
      const responseText = await response.text();
      errorMessage = "Backend request failed.";

      if (responseText.length > 0) {
        try {
          const payload = JSON.parse(responseText) as unknown;
          const normalized = normalizeApiResponse(payload);
          errorMessage = normalized.message;
        } catch {
          errorMessage = responseText.slice(0, 240);
        }
      }
    }

    return recordApiRequestEvent({
      endpoint: path,
      errorMessage,
      method,
      responseTimeMs: nowMs() - startedAt,
      source: "safe_probe",
      statusCode: response.status,
      success: response.ok,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    return recordApiRequestEvent({
      endpoint: path,
      errorMessage:
        "Unable to reach the backend API. Check that the backend server is running and CORS is configured.",
      method,
      responseTimeMs: nowMs() - startedAt,
      source: "safe_probe",
      statusCode: 0,
      success: false,
    });
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
