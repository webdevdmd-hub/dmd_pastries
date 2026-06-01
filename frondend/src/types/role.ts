import type { Permission, RolePermission } from "@/types/permission";

export type RoleStatus = "active" | "inactive";

export type Role = {
  id: string;
  businessId: string | null;
  roleName: string;
  description: string;
  isSystemDefault: boolean;
  status: RoleStatus;
  usersCount: number;
  createdAt: string;
  updatedAt: string;
  permissionKeys: Permission[];
};

export type RolesListResponse = Role[];

export type CreateRolePayload = {
  roleName: string;
  description: string;
  permissions: string[];
};

export type UpdateRolePayload = {
  roleName: string;
  description: string;
  status: RoleStatus;
};

export type UpdateRolePermissionsPayload = {
  permissions: {
    permissionId: string;
    allowed: boolean;
  }[];
};

export type RolePermissionListResponse = RolePermission[];

export type RoleFormMode = "create" | "edit";

export type DeleteRoleResult = {
  id: string;
};
