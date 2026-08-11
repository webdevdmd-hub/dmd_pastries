import { apiRequest } from "@/lib/api/client";
import type {
  ActivityChange,
  ActivityLog,
  ActivityLogFilters,
  ActivityLogsResponse,
  ActivityMetadataPrimitive,
  ActivityMetadataValue,
} from "@/types/activity-log";

type BackendActivityLog = {
  id?: string;
  business_id?: string;
  actor_user_id?: string | null;
  actor_user_name?: string;
  actor_user_email?: string;
  target_user_id?: string | null;
  target_user_name?: string;
  target_user_email?: string;
  event_type?: string;
  entity_type?: string;
  entity_id?: string | null;
  module_label?: string;
  action_label?: string;
  record_label?: string;
  summary?: string;
  metadata?: unknown;
  changes?: unknown;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
};

type BackendActivityLogsResponse = {
  items?: unknown;
  next_cursor?: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isActivityMetadataPrimitive(value: unknown): value is ActivityMetadataPrimitive {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  );
}

function isActivityMetadataValue(value: unknown): value is ActivityMetadataValue {
  if (isActivityMetadataPrimitive(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isActivityMetadataPrimitive);
  }

  if (!isObject(value)) {
    return false;
  }

  return Object.values(value).every(isActivityMetadataPrimitive);
}

function parseMetadata(value: unknown): Record<string, ActivityMetadataValue> {
  if (!isObject(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, ActivityMetadataValue>>(
    (metadata, [key, item]) => {
      if (isActivityMetadataValue(item)) {
        metadata[key] = item;
      }

      return metadata;
    },
    {},
  );
}

function parseActivityChange(value: unknown): ActivityChange | null {
  if (!isObject(value)) {
    return null;
  }

  const field = typeof value.field === "string" ? value.field : "";
  const label = typeof value.label === "string" ? value.label : field;
  const oldValue = isActivityMetadataPrimitive(value.old_value) ? value.old_value : null;
  const newValue = isActivityMetadataPrimitive(value.new_value) ? value.new_value : null;

  if (!field && !label) {
    return null;
  }

  return {
    field,
    label: label || field,
    oldValue,
    newValue,
  };
}

function parseActivityChanges(value: unknown): ActivityChange[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<ActivityChange[]>((changes, item) => {
    const change = parseActivityChange(item);
    if (change !== null) {
      changes.push(change);
    }
    return changes;
  }, []);
}

function parseActivityLog(value: unknown): ActivityLog {
  if (!isObject(value)) {
    throw new Error("Backend activity log payload is invalid.");
  }

  const backendActivity = value as BackendActivityLog;
  const id = typeof backendActivity.id === "string" ? backendActivity.id : "";
  const businessId =
    typeof backendActivity.business_id === "string" ? backendActivity.business_id : "";
  const summary = typeof backendActivity.summary === "string" ? backendActivity.summary : "";
  const createdAt =
    typeof backendActivity.created_at === "string" ? backendActivity.created_at : "";
  const eventType =
    typeof backendActivity.event_type === "string" && backendActivity.event_type.trim()
      ? backendActivity.event_type
      : "unknown.event";
  const entityType =
    typeof backendActivity.entity_type === "string" && backendActivity.entity_type.trim()
      ? backendActivity.entity_type
      : "unknown";

  if (!id || !businessId || !summary || !createdAt) {
    throw new Error("Backend activity log payload is missing required fields.");
  }

  return {
    id,
    businessId,
    actorUserId:
      typeof backendActivity.actor_user_id === "string" ? backendActivity.actor_user_id : null,
    actorUserName:
      typeof backendActivity.actor_user_name === "string"
        ? backendActivity.actor_user_name
        : "Unknown user",
    actorUserEmail:
      typeof backendActivity.actor_user_email === "string" ? backendActivity.actor_user_email : "",
    targetUserId:
      typeof backendActivity.target_user_id === "string" ? backendActivity.target_user_id : null,
    targetUserName:
      typeof backendActivity.target_user_name === "string" ? backendActivity.target_user_name : "",
    targetUserEmail:
      typeof backendActivity.target_user_email === "string"
        ? backendActivity.target_user_email
        : "",
    eventType,
    entityType,
    entityId: typeof backendActivity.entity_id === "string" ? backendActivity.entity_id : null,
    moduleLabel:
      typeof backendActivity.module_label === "string" && backendActivity.module_label.trim()
        ? backendActivity.module_label
        : entityType,
    actionLabel:
      typeof backendActivity.action_label === "string" && backendActivity.action_label.trim()
        ? backendActivity.action_label
        : summary,
    recordLabel:
      typeof backendActivity.record_label === "string" && backendActivity.record_label.trim()
        ? backendActivity.record_label
        : "Unknown record",
    summary,
    metadata: parseMetadata(backendActivity.metadata),
    changes: parseActivityChanges(backendActivity.changes),
    ipAddress: typeof backendActivity.ip_address === "string" ? backendActivity.ip_address : "",
    userAgent: typeof backendActivity.user_agent === "string" ? backendActivity.user_agent : "",
    createdAt,
  };
}

function parseActivityLogsResponse(value: unknown): ActivityLogsResponse {
  if (!isObject(value)) {
    throw new Error("Backend activity logs payload is invalid.");
  }

  const response = value as BackendActivityLogsResponse;

  if (!Array.isArray(response.items)) {
    throw new Error("Backend activity logs items payload is invalid.");
  }

  return {
    items: response.items.map(parseActivityLog),
    nextCursor: typeof response.next_cursor === "string" ? response.next_cursor : null,
  };
}

function buildActivityLogSearchParams(filters: ActivityLogFilters): string {
  const params = new URLSearchParams();

  if (filters.entityType) {
    params.set("entity_type", filters.entityType);
  }

  if (typeof filters.limit === "number") {
    params.set("limit", String(filters.limit));
  }

  if (filters.cursor) {
    params.set("cursor", filters.cursor);
  }

  if (filters.dateFrom) {
    params.set("date_from", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("date_to", filters.dateTo);
  }

  if (filters.timezone) {
    params.set("timezone", filters.timezone);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function getActivityLogs(
  filters: ActivityLogFilters = {},
): Promise<ActivityLogsResponse> {
  const response = await apiRequest<ActivityLogsResponse>(
    `/api/v1/activity-logs${buildActivityLogSearchParams(filters)}`,
    {
      authMode: "appwrite",
      parse: parseActivityLogsResponse,
    },
  );

  return response.data;
}

export async function getUserActivityLogs(
  userId: string,
  filters: Omit<ActivityLogFilters, "entityType"> = {},
): Promise<ActivityLogsResponse> {
  const response = await apiRequest<ActivityLogsResponse>(
    `/api/v1/users/${userId}/activity${buildActivityLogSearchParams(filters)}`,
    {
      authMode: "appwrite",
      parse: parseActivityLogsResponse,
    },
  );

  return response.data;
}
