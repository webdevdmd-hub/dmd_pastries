export type ActivityEntityType =
  | "auth"
  | "business"
  | "user"
  | "role"
  | "settings"
  | "branch"
  | "pos";

export type ActivityEventType =
  | "auth.login"
  | "auth.logout"
  | "business.updated"
  | "branch.created"
  | "branch.updated"
  | "user.branch_switched"
  | "user.invited"
  | "user.invitation_accepted"
  | "user.invitation_cancelled"
  | "user.invitation_resent"
  | "user.created"
  | "user.updated"
  | "user.status_changed"
  | "user.branch_assigned"
  | "user.soft_deleted"
  | "user.restored"
  | "role.created"
  | "role.updated"
  | "role.permissions_updated"
  | "settings.updated";

export type ActivityMetadataValue = string | number | boolean | null;

export type ActivityLog = {
  id: string;
  businessId: string;
  actorUserId: string | null;
  targetUserId: string | null;
  eventType: ActivityEventType;
  entityType: ActivityEntityType;
  entityId: string | null;
  summary: string;
  metadata: Record<string, ActivityMetadataValue>;
  createdAt: string;
};

export type ActivityLogsResponse = {
  items: ActivityLog[];
  nextCursor: string | null;
};
