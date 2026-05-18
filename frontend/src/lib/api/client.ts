import { createAppwriteJwt } from "@/lib/appwrite/auth";
import { notifySessionExpired } from "@/lib/auth/session-events";
import { getPublicEnvValue } from "@/lib/public-env";
import type { ApiFailure, ApiResponse, ApiSuccess, FieldErrorMap } from "@/types/api";

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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeErrors(value: unknown): FieldErrorMap | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const entries = Object.entries(value).reduce<FieldErrorMap>((accumulator, [key, item]) => {
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
    return { errors };
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

  if (success === false || ("error" in value && value.error !== undefined)) {
    const errors = normalizeErrors(value.errors) ?? backendError.errors;
    const errorDetails = isObject(value.errors) ? value.errors : undefined;
    const resolvedMessage =
      backendError.messageSuffix && backendError.messageSuffix !== message
        ? `${message}: ${backendError.messageSuffix}`
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
  const headers = await buildHeaders(options.authMode ?? "none");
  const requestInit: RequestInit = {
    method,
    headers,
    credentials: options.credentials ?? "omit",
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };
  const response = await fetch(url, requestInit);

  const responseText = await response.text();
  let payload: unknown = { success: true, message: "Request completed." };

  if (responseText.length > 0) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      const excerpt = responseText.slice(0, 240);
      throw new ApiError({
        message: excerpt
          ? `Backend returned a non-JSON response: ${excerpt}`
          : "Backend returned a non-JSON response.",
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

    throw new ApiError({
      message: normalized.message,
      status: response.status,
      ...(errors ? { errors } : {}),
      ...(errorDetails ? { errorDetails } : {}),
    });
  }

  return {
    ...normalized,
    data: options.parse(normalized.data),
  };
}

export async function apiBlobRequest<TBody = undefined>(
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<Blob> {
  const method = options.method ?? "GET";
  const url = `${getApiBaseUrl()}${path}`;
  const headers = await buildHeaders(options.authMode ?? "none");
  const requestInit: RequestInit = {
    method,
    headers,
    credentials: options.credentials ?? "omit",
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };
  const response = await fetch(url, requestInit);

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

    throw new ApiError({
      message,
      status: response.status,
      ...(errors ? { errors } : {}),
      ...(errorDetails ? { errorDetails } : {}),
    });
  }

  return response.blob();
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
