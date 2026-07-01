import type { Permission } from "@/types/permission";

export type SafeUserProfile = {
  accountType: "tenant_user" | "platform_admin";
  id: string;
  businessId: string;
  fullName: string;
  email: string;
  businessName: string | null;
  phone: string | null;
  assignedBranchId: string | null;
  assignedBranchName: string | null;
  currentBranchId: string | null;
  currentBranchName: string | null;
  allowedBranchIds: string[];
  canAccessAllBranches: boolean;
  roles: string[];
  permissions: Permission[];
  subscriptionStatus: string | null;
  emailVerified: boolean;
  isPlatformAdmin: boolean;
};

export type UserStatus = "active" | "inactive" | "suspended" | "invited";
export type DeletedUserStatus = "deleted";

export type User = {
  id: string;
  appwriteUserId: string;
  businessId: string;
  branchId: string | null;
  roleId: string;
  roleName: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UsersListResponse = User[];

export type UserFilters = {
  branchId?: string;
  search: string;
  status: UserStatus | "all";
};

export type CreateUserPayload = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  roleId: string;
  branchId: string | null;
  avatarUrl?: string | null;
};

export type UpdateUserPayload = {
  fullName: string;
  phone: string;
  roleId: string | null;
  branchId?: string | null;
  avatarUrl?: string | null;
};

export type UpdateUserStatusPayload = {
  status: UserStatus;
};

export type AssignUserBranchPayload = {
  branchId: string;
};

export type AssignUserBranchResult = {
  id: string;
  branchId: string;
  roleId: string;
  fullName: string;
  status: UserStatus;
};

export type SoftDeleteUserResult = {
  id: string;
  status: DeletedUserStatus;
  deletedAt: string;
};

export type UserFormMode = "create" | "edit";

export type UserRoleOption = {
  id: string;
  name: string;
};
