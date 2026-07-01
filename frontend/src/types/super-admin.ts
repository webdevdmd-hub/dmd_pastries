export type SuperAdminBusinessSummary = {
  id: string;
  businessName: string;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  currency: string;
  timezone: string;
  vatNumber: string;
  status: string;
  subscriptionStatus: string | null;
  planType: string | null;
  usersCount: number;
  branchesCount: number;
  rolesCount: number;
  createdAt: string;
  deletedAt: string | null;
};

export type SuperAdminUserSummary = {
  id: string;
  appwriteUserId: string;
  businessId: string;
  businessName: string;
  branchId: string | null;
  branchName: string | null;
  currentBranchId: string | null;
  roleId: string;
  roleName: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  emailVerified: boolean;
  canAccessAllBranches: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type SuperAdminBranchSummary = {
  id: string;
  branchName: string;
  code: string;
  status: string;
  isDefault: boolean;
};

export type SuperAdminRoleSummary = {
  id: string;
  roleName: string;
  description: string;
  isSystemDefault: boolean;
  usersCount: number;
  deletedAt: string | null;
};

export type SuperAdminSubscription = {
  id: string;
  planType: string;
  status: string;
  userLimit: number;
  branchLimit: number;
  trialEndsAt: string | null;
  renewalDate: string | null;
};

export type SuperAdminDiagnostic = {
  id: string;
  severity: string;
  category: string;
  summary: string;
  businessId: string | null;
  userId: string | null;
};

export type SuperAdminBusinessDetail = {
  business: SuperAdminBusinessSummary;
  users: SuperAdminUserSummary[];
  branches: SuperAdminBranchSummary[];
  roles: SuperAdminRoleSummary[];
  subscription: SuperAdminSubscription | null;
  warnings: SuperAdminDiagnostic[];
};

export type SuperAdminBusinessActionRequest = {
  reason: string;
  business_name?: string;
  currency?: string;
  timezone?: string;
  vat_number?: string;
  status?: string;
  owner_user_id?: string;
};

export type SuperAdminBusinessActionResponse = {
  business: SuperAdminBusinessDetail;
  action: string;
};

export type SuperAdminAuditLog = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorUserId: string;
  createdAt: string;
};

export type SuperAdminRelatedDataCount = {
  module: string;
  table: string;
  count: number;
};

export type SuperAdminUserDetail = {
  user: SuperAdminUserSummary;
  permissions: string[];
  branchAccess: SuperAdminBranchSummary[];
  auditLogs: SuperAdminAuditLog[];
  relatedDataCounts: SuperAdminRelatedDataCount[];
  warnings: SuperAdminDiagnostic[];
};

export type SuperAdminUserActionRequest = {
  reason: string;
  operation?: string;
  confirmation_text?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status?: string;
  role_id?: string;
  branch_id?: string;
  can_access_all_branches?: boolean;
  branch_access_ids?: string[];
};

export type SuperAdminUserActionResponse = {
  user: SuperAdminUserDetail;
  action: string;
};

export type SuperAdminHardDeletePreview = {
  userId: string;
  email: string;
  isSoftDeleted: boolean;
  canHardDelete: boolean;
  requiresSoftDelete: boolean;
  blockingCounts: SuperAdminRelatedDataCount[];
  cleanupCounts: SuperAdminRelatedDataCount[];
  totalBlockingRows: number;
  totalCleanupRows: number;
  decision: string;
  requiredConfirmText: string;
};

export type SuperAdminTableColumn = {
  key: string;
  label: string;
  type: string;
  editable: boolean;
  masked: boolean;
};

export type SuperAdminTableDefinition = {
  key: string;
  label: string;
  description: string;
  columns: SuperAdminTableColumn[];
  canUpdate: boolean;
};

export type SuperAdminTableRow = Record<string, string | number | boolean | null>;

export type SuperAdminTableRowsResponse = {
  table: SuperAdminTableDefinition;
  rows: SuperAdminTableRow[];
  page: number;
  limit: number;
  totalRows: number;
  totalPages: number;
};

export type SuperAdminTableRowUpdateRequest = {
  reason: string;
  values: Record<string, string | number | boolean | null>;
};

export type SuperAdminTableRowActionResponse = {
  table: string;
  rowId: string;
  row: SuperAdminTableRow;
  action: string;
};
