import { apiRequest } from "@/lib/api/client";
import type {
  ActivityEntityType,
  ActivityEventType,
  ActivityLog,
  ActivityLogsResponse,
  ActivityMetadataValue,
} from "@/types/activity-log";

type BackendActivityLog = {
  id?: string;
  business_id?: string;
  actor_user_id?: string | null;
  target_user_id?: string | null;
  event_type?: string;
  entity_type?: string;
  entity_id?: string | null;
  summary?: string;
  metadata?: unknown;
  created_at?: string;
};

type BackendActivityLogsResponse = {
  items?: unknown;
  next_cursor?: string | null;
};

type ActivityLogFilters = {
  entityType?: ActivityEntityType;
  limit?: number;
  cursor?: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isActivityEntityType(value: unknown): value is ActivityEntityType {
  return (
    value === "auth" ||
    value === "business" ||
    value === "user" ||
    value === "role" ||
    value === "settings" ||
    value === "branch" ||
    value === "pos"
  );
}

function isActivityEventType(value: unknown): value is ActivityEventType {
  return (
    value === "auth.login" ||
    value === "auth.logout" ||
    value === "business.updated" ||
    value === "branch.created" ||
    value === "branch.updated" ||
    value === "user.invited" ||
    value === "user.invitation_accepted" ||
    value === "user.invitation_cancelled" ||
    value === "user.invitation_resent" ||
    value === "user.created" ||
    value === "user.updated" ||
    value === "user.status_changed" ||
    value === "user.branch_assigned" ||
    value === "user.branch_switched" ||
    value === "user.soft_deleted" ||
    value === "user.restored" ||
    value === "role.created" ||
    value === "role.updated" ||
    value === "role.permissions_updated" ||
    value === "settings.updated"
  );
}

function isActivityMetadataValue(value: unknown): value is ActivityMetadataValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  );
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

  if (
    !id ||
    !businessId ||
    !summary ||
    !createdAt ||
    !isActivityEventType(backendActivity.event_type) ||
    !isActivityEntityType(backendActivity.entity_type)
  ) {
    throw new Error("Backend activity log payload is missing required fields.");
  }

  return {
    id,
    businessId,
    actorUserId:
      typeof backendActivity.actor_user_id === "string" ? backendActivity.actor_user_id : null,
    targetUserId:
      typeof backendActivity.target_user_id === "string" ? backendActivity.target_user_id : null,
    eventType: backendActivity.event_type,
    entityType: backendActivity.entity_type,
    entityId: typeof backendActivity.entity_id === "string" ? backendActivity.entity_id : null,
    summary,
    metadata: parseMetadata(backendActivity.metadata),
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
  filters: Pick<ActivityLogFilters, "limit" | "cursor"> = {},
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
