export type ActivityEntityType = string;

export type ActivityEventType = string;

export type ActivityMetadataPrimitive = string | number | boolean | null;

export type ActivityMetadataValue =
  | ActivityMetadataPrimitive
  | ActivityMetadataPrimitive[]
  | Record<string, ActivityMetadataPrimitive>;

export type ActivityLog = {
  id: string;
  businessId: string;
  actorUserId: string | null;
  actorUserName: string;
  actorUserEmail: string;
  targetUserId: string | null;
  targetUserName: string;
  targetUserEmail: string;
  eventType: ActivityEventType;
  entityType: ActivityEntityType;
  entityId: string | null;
  moduleLabel: string;
  actionLabel: string;
  recordLabel: string;
  summary: string;
  metadata: Record<string, ActivityMetadataValue>;
  createdAt: string;
};

export type ActivityLogsResponse = {
  items: ActivityLog[];
  nextCursor: string | null;
};
