import { apiRequest } from "@/lib/api/client";
import type {
  SuperAdminAuditLog,
  SuperAdminBranchSummary,
  SuperAdminBusinessActionRequest,
  SuperAdminBusinessActionResponse,
  SuperAdminBusinessDetail,
  SuperAdminBusinessSummary,
  SuperAdminDiagnostic,
  SuperAdminHardDeletePreview,
  SuperAdminRelatedDataCount,
  SuperAdminRoleSummary,
  SuperAdminSubscription,
  SuperAdminTableColumn,
  SuperAdminTableDefinition,
  SuperAdminTableRow,
  SuperAdminTableRowActionResponse,
  SuperAdminTableRowsResponse,
  SuperAdminTableRowUpdateRequest,
  SuperAdminUserActionRequest,
  SuperAdminUserActionResponse,
  SuperAdminUserDetail,
  SuperAdminUserSummary,
} from "@/types/super-admin";
import type { SafeUserProfile } from "@/types/user";

type BackendSuperAdminProfile = {
  account_type?: string;
  appwrite_user_id?: string;
  full_name?: string;
  email?: string;
  email_verified?: boolean;
  permissions?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableStringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseSuperAdminProfile(value: unknown): SafeUserProfile {
  if (!isObject(value)) {
    throw new Error("Backend super admin payload is invalid.");
  }

  const profile = value as BackendSuperAdminProfile;
  const appwriteUserId =
    typeof profile.appwrite_user_id === "string" ? profile.appwrite_user_id : "";
  const fullName = typeof profile.full_name === "string" ? profile.full_name : "";
  const email = typeof profile.email === "string" ? profile.email : "";

  if (profile.account_type !== "platform_admin" || !appwriteUserId || !fullName || !email) {
    throw new Error("Backend super admin payload is missing required fields.");
  }

  return {
    accountType: "platform_admin",
    id: appwriteUserId,
    businessId: "",
    fullName,
    email,
    businessName: "Platform Administration",
    phone: null,
    assignedBranchId: null,
    assignedBranchName: null,
    currentBranchId: null,
    currentBranchName: null,
    allowedBranchIds: [],
    canAccessAllBranches: true,
    roles: ["Super Admin"],
    permissions: asStringArray(profile.permissions),
    subscriptionStatus: null,
    emailVerified: profile.email_verified === true,
    isPlatformAdmin: true,
  };
}

export async function getSuperAdminProfile(): Promise<SafeUserProfile> {
  const response = await apiRequest<SafeUserProfile>("/api/v1/super-admin/me", {
    authMode: "appwrite",
    parse: parseSuperAdminProfile,
  });

  return response.data;
}

function parseBusinessSummary(value: unknown): SuperAdminBusinessSummary {
  if (!isObject(value)) {
    throw new Error("Backend business payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessName: stringValue(value.business_name),
    ownerUserId: nullableStringValue(value.owner_user_id),
    ownerName: nullableStringValue(value.owner_name),
    ownerEmail: nullableStringValue(value.owner_email),
    currency: stringValue(value.currency),
    timezone: stringValue(value.timezone),
    vatNumber: stringValue(value.vat_number),
    status: stringValue(value.status),
    subscriptionStatus: nullableStringValue(value.subscription_status),
    planType: nullableStringValue(value.plan_type),
    usersCount: numberValue(value.users_count),
    branchesCount: numberValue(value.branches_count),
    rolesCount: numberValue(value.roles_count),
    createdAt: stringValue(value.created_at),
    deletedAt: nullableStringValue(value.deleted_at),
  };
}

function parseUserSummary(value: unknown): SuperAdminUserSummary {
  if (!isObject(value)) {
    throw new Error("Backend user payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    appwriteUserId: stringValue(value.appwrite_user_id),
    businessId: stringValue(value.business_id),
    businessName: stringValue(value.business_name),
    branchId: nullableStringValue(value.branch_id),
    branchName: nullableStringValue(value.branch_name),
    currentBranchId: nullableStringValue(value.current_branch_id),
    roleId: stringValue(value.role_id),
    roleName: stringValue(value.role_name),
    fullName: stringValue(value.full_name),
    email: stringValue(value.email),
    phone: stringValue(value.phone),
    status: stringValue(value.status),
    emailVerified: booleanValue(value.email_verified),
    canAccessAllBranches: booleanValue(value.can_access_all_branches),
    lastLoginAt: nullableStringValue(value.last_login_at),
    createdAt: stringValue(value.created_at),
    deletedAt: nullableStringValue(value.deleted_at),
  };
}

function parseBranchSummary(value: unknown): SuperAdminBranchSummary {
  if (!isObject(value)) {
    throw new Error("Backend branch payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    branchName: stringValue(value.branch_name),
    code: stringValue(value.code),
    status: stringValue(value.status),
    isDefault: booleanValue(value.is_default),
  };
}

function parseRoleSummary(value: unknown): SuperAdminRoleSummary {
  if (!isObject(value)) {
    throw new Error("Backend role payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    roleName: stringValue(value.role_name),
    description: stringValue(value.description),
    isSystemDefault: booleanValue(value.is_system_default),
    usersCount: numberValue(value.users_count),
    deletedAt: nullableStringValue(value.deleted_at),
  };
}

function parseSubscription(value: unknown): SuperAdminSubscription | null {
  if (!isObject(value)) {
    return null;
  }

  return {
    id: stringValue(value.id),
    planType: stringValue(value.plan_type),
    status: stringValue(value.status),
    userLimit: numberValue(value.user_limit),
    branchLimit: numberValue(value.branch_limit),
    trialEndsAt: nullableStringValue(value.trial_ends_at),
    renewalDate: nullableStringValue(value.renewal_date),
  };
}

function parseDiagnostic(value: unknown): SuperAdminDiagnostic {
  if (!isObject(value)) {
    throw new Error("Backend diagnostic payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    severity: stringValue(value.severity),
    category: stringValue(value.category),
    summary: stringValue(value.summary),
    businessId: nullableStringValue(value.business_id),
    userId: nullableStringValue(value.user_id),
  };
}

function parseAuditLog(value: unknown): SuperAdminAuditLog {
  if (!isObject(value)) {
    throw new Error("Backend audit log payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    eventType: stringValue(value.event_type),
    entityType: stringValue(value.entity_type),
    entityId: stringValue(value.entity_id),
    summary: stringValue(value.summary),
    actorUserId: stringValue(value.actor_user_id),
    createdAt: stringValue(value.created_at),
  };
}

function parseRelatedDataCount(value: unknown): SuperAdminRelatedDataCount {
  if (!isObject(value)) {
    throw new Error("Backend related data payload is invalid.");
  }

  return {
    module: stringValue(value.module),
    table: stringValue(value.table),
    count: numberValue(value.count),
  };
}

function parseBusinessList(value: unknown): SuperAdminBusinessSummary[] {
  return arrayValue(value).map(parseBusinessSummary);
}

function parseUserList(value: unknown): SuperAdminUserSummary[] {
  return arrayValue(value).map(parseUserSummary);
}

function parseDiagnosticList(value: unknown): SuperAdminDiagnostic[] {
  return arrayValue(value).map(parseDiagnostic);
}

function parseBusinessDetail(value: unknown): SuperAdminBusinessDetail {
  if (!isObject(value)) {
    throw new Error("Backend business detail payload is invalid.");
  }

  return {
    business: parseBusinessSummary(value.business),
    users: arrayValue(value.users).map(parseUserSummary),
    branches: arrayValue(value.branches).map(parseBranchSummary),
    roles: arrayValue(value.roles).map(parseRoleSummary),
    subscription: parseSubscription(value.subscription),
    warnings: arrayValue(value.warnings).map(parseDiagnostic),
  };
}

function parseBusinessActionResponse(value: unknown): SuperAdminBusinessActionResponse {
  if (!isObject(value)) {
    throw new Error("Backend business action payload is invalid.");
  }

  return {
    business: parseBusinessDetail(value.business),
    action: stringValue(value.action),
  };
}

function parseUserDetail(value: unknown): SuperAdminUserDetail {
  if (!isObject(value)) {
    throw new Error("Backend user detail payload is invalid.");
  }

  return {
    user: parseUserSummary(value.user),
    permissions: asStringArray(value.permissions),
    branchAccess: arrayValue(value.branch_access).map(parseBranchSummary),
    auditLogs: arrayValue(value.audit_logs).map(parseAuditLog),
    relatedDataCounts: arrayValue(value.related_data_counts).map(parseRelatedDataCount),
    warnings: arrayValue(value.warnings).map(parseDiagnostic),
  };
}

function parseUserActionResponse(value: unknown): SuperAdminUserActionResponse {
  if (!isObject(value)) {
    throw new Error("Backend user action payload is invalid.");
  }

  return {
    user: parseUserDetail(value.user),
    action: stringValue(value.action),
  };
}

function parseHardDeletePreview(value: unknown): SuperAdminHardDeletePreview {
  if (!isObject(value)) {
    throw new Error("Backend hard delete preview payload is invalid.");
  }

  return {
    userId: stringValue(value.user_id),
    email: stringValue(value.email),
    isSoftDeleted: booleanValue(value.is_soft_deleted),
    canHardDelete: booleanValue(value.can_hard_delete),
    requiresSoftDelete: booleanValue(value.requires_soft_delete),
    blockingCounts: arrayValue(value.blocking_counts).map(parseRelatedDataCount),
    cleanupCounts: arrayValue(value.cleanup_counts).map(parseRelatedDataCount),
    totalBlockingRows: numberValue(value.total_blocking_rows),
    totalCleanupRows: numberValue(value.total_cleanup_rows),
    decision: stringValue(value.decision),
    requiredConfirmText: stringValue(value.required_confirm_text),
  };
}

function parseTableColumn(value: unknown): SuperAdminTableColumn {
  if (!isObject(value)) {
    throw new Error("Backend table column payload is invalid.");
  }

  return {
    key: stringValue(value.key),
    label: stringValue(value.label),
    type: stringValue(value.type),
    editable: booleanValue(value.editable),
    masked: booleanValue(value.masked),
  };
}

function parseTableDefinition(value: unknown): SuperAdminTableDefinition {
  if (!isObject(value)) {
    throw new Error("Backend table definition payload is invalid.");
  }

  return {
    key: stringValue(value.key),
    label: stringValue(value.label),
    description: stringValue(value.description),
    columns: arrayValue(value.columns).map(parseTableColumn),
    canUpdate: booleanValue(value.can_update),
  };
}

function parseTableRow(value: unknown): SuperAdminTableRow {
  if (!isObject(value)) {
    throw new Error("Backend table row payload is invalid.");
  }

  return Object.entries(value).reduce<SuperAdminTableRow>((row, [key, item]) => {
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean" ||
      item === null
    ) {
      row[key] = item;
    } else {
      row[key] = null;
    }
    return row;
  }, {});
}

function parseTableRowsResponse(value: unknown): SuperAdminTableRowsResponse {
  if (!isObject(value)) {
    throw new Error("Backend table rows payload is invalid.");
  }

  return {
    table: parseTableDefinition(value.table),
    rows: arrayValue(value.rows).map(parseTableRow),
    page: numberValue(value.page),
    limit: numberValue(value.limit),
    totalRows: numberValue(value.total_rows),
    totalPages: numberValue(value.total_pages),
  };
}

function parseTableRowActionResponse(value: unknown): SuperAdminTableRowActionResponse {
  if (!isObject(value)) {
    throw new Error("Backend table row action payload is invalid.");
  }

  return {
    table: stringValue(value.table),
    rowId: stringValue(value.row_id),
    row: parseTableRow(value.row),
    action: stringValue(value.action),
  };
}

function queryString(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim().length > 0) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function getSuperAdminBusinesses(filters: {
  search?: string;
  status?: string;
}): Promise<SuperAdminBusinessSummary[]> {
  const response = await apiRequest<SuperAdminBusinessSummary[]>(
    `/api/v1/super-admin/businesses${queryString(filters)}`,
    {
      authMode: "appwrite",
      parse: parseBusinessList,
    },
  );

  return response.data;
}

export async function getSuperAdminBusiness(id: string): Promise<SuperAdminBusinessDetail> {
  const response = await apiRequest<SuperAdminBusinessDetail>(
    `/api/v1/super-admin/businesses/${id}`,
    {
      authMode: "appwrite",
      parse: parseBusinessDetail,
    },
  );

  return response.data;
}

export async function updateSuperAdminBusinessAction(
  id: string,
  body: SuperAdminBusinessActionRequest,
): Promise<SuperAdminBusinessActionResponse> {
  const response = await apiRequest<
    SuperAdminBusinessActionResponse,
    SuperAdminBusinessActionRequest
  >(`/api/v1/super-admin/businesses/${id}/actions`, {
    method: "PATCH",
    body,
    authMode: "appwrite",
    parse: parseBusinessActionResponse,
  });

  return response.data;
}

export async function getSuperAdminUsers(filters: {
  businessId?: string;
  search?: string;
  status?: string;
}): Promise<SuperAdminUserSummary[]> {
  const response = await apiRequest<SuperAdminUserSummary[]>(
    `/api/v1/super-admin/users${queryString({
      business_id: filters.businessId,
      search: filters.search,
      status: filters.status,
    })}`,
    {
      authMode: "appwrite",
      parse: parseUserList,
    },
  );

  return response.data;
}

export async function getSuperAdminUser(id: string): Promise<SuperAdminUserDetail> {
  const response = await apiRequest<SuperAdminUserDetail>(`/api/v1/super-admin/users/${id}`, {
    authMode: "appwrite",
    parse: parseUserDetail,
  });

  return response.data;
}

export async function getSuperAdminUserHardDeletePreview(
  id: string,
): Promise<SuperAdminHardDeletePreview> {
  const response = await apiRequest<SuperAdminHardDeletePreview>(
    `/api/v1/super-admin/users/${id}/hard-delete-preview`,
    {
      authMode: "appwrite",
      parse: parseHardDeletePreview,
    },
  );

  return response.data;
}

export async function updateSuperAdminUserAction(
  id: string,
  body: SuperAdminUserActionRequest,
): Promise<SuperAdminUserActionResponse> {
  const response = await apiRequest<SuperAdminUserActionResponse, SuperAdminUserActionRequest>(
    `/api/v1/super-admin/users/${id}/actions`,
    {
      method: "PATCH",
      body,
      authMode: "appwrite",
      parse: parseUserActionResponse,
    },
  );

  return response.data;
}

export async function getSuperAdminDiagnostics(): Promise<SuperAdminDiagnostic[]> {
  const response = await apiRequest<SuperAdminDiagnostic[]>("/api/v1/super-admin/diagnostics", {
    authMode: "appwrite",
    parse: parseDiagnosticList,
  });

  return response.data;
}

export async function getSuperAdminTables(): Promise<SuperAdminTableDefinition[]> {
  const response = await apiRequest<SuperAdminTableDefinition[]>("/api/v1/super-admin/tables", {
    authMode: "appwrite",
    parse: (value) => arrayValue(value).map(parseTableDefinition),
  });

  return response.data;
}

export async function getSuperAdminTableRows(filters: {
  table: string;
  businessId?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<SuperAdminTableRowsResponse> {
  const response = await apiRequest<SuperAdminTableRowsResponse>(
    `/api/v1/super-admin/tables/${encodeURIComponent(filters.table)}/rows${queryString({
      business_id: filters.businessId,
      search: filters.search,
      page: filters.page ? String(filters.page) : undefined,
      limit: filters.limit ? String(filters.limit) : undefined,
    })}`,
    {
      authMode: "appwrite",
      parse: parseTableRowsResponse,
    },
  );

  return response.data;
}

export async function updateSuperAdminTableRow(
  table: string,
  rowId: string,
  body: SuperAdminTableRowUpdateRequest,
): Promise<SuperAdminTableRowActionResponse> {
  const response = await apiRequest<
    SuperAdminTableRowActionResponse,
    SuperAdminTableRowUpdateRequest
  >(`/api/v1/super-admin/tables/${encodeURIComponent(table)}/rows/${encodeURIComponent(rowId)}`, {
    method: "PATCH",
    body,
    authMode: "appwrite",
    parse: parseTableRowActionResponse,
  });

  return response.data;
}
