import { ApiError, apiRequest } from "@/lib/api/client";
import { getPermissions } from "@/lib/api/permissions";
import type { Permission, PermissionDefinition, RolePermission } from "@/types/permission";
import type {
  CreateRolePayload,
  DeleteRoleResult,
  Role,
  RolePermissionListResponse,
  RolesListResponse,
  UpdateRolePayload,
  UpdateRolePermissionsPayload,
} from "@/types/role";

type BackendRole = {
  id?: string;
  business_id?: string | null;
  role_name?: string;
  description?: string;
  is_system_default?: boolean;
  permission_keys?: unknown;
  created_at?: string;
  updated_at?: string;
};

type BackendCreateOrUpdateRolePayload = {
  role_name?: string;
  description?: string;
  permission_keys?: string[];
};

type BackendRolePermissions = {
  id?: string;
  role_id?: string;
  roleId?: string;
  role_name?: string;
  roleName?: string;
  is_system_default?: boolean;
  isSystemDefault?: boolean;
  permission_keys?: unknown;
  permissionKeys?: unknown;
  permissions?: unknown;
};

type ParsedRolePermissions = {
  role_id: string;
  permission_keys: Permission[];
};

type BackendUpdateRolePermissionsPayload = {
  permission_keys: string[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPermissionKey(value: unknown): value is Permission {
  return typeof value === "string" && /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value);
}

function parsePermissionKeys(value: unknown): Permission[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isPermissionKey);
}

function getRolePermissionResponseRoleId(
  value: BackendRolePermissions,
  fallbackRoleId: string,
): string {
  if (typeof value.role_id === "string" && value.role_id.length > 0) {
    return value.role_id;
  }

  if (typeof value.roleId === "string" && value.roleId.length > 0) {
    return value.roleId;
  }

  if (typeof value.id === "string" && value.id.length > 0) {
    return value.id;
  }

  return fallbackRoleId;
}

function getRolePermissionResponseKeys(value: BackendRolePermissions): Permission[] {
  const directKeys = parsePermissionKeys(value.permission_keys);

  if (directKeys.length > 0) {
    return directKeys;
  }

  const camelKeys = parsePermissionKeys(value.permissionKeys);

  if (camelKeys.length > 0) {
    return camelKeys;
  }

  if (Array.isArray(value.permissions)) {
    return value.permissions.flatMap((permission) => {
      if (isPermissionKey(permission)) {
        return [permission];
      }

      if (!isObject(permission)) {
        return [];
      }

      const permissionKey = permission.permission_key ?? permission.permissionKey;
      return isPermissionKey(permissionKey) ? [permissionKey] : [];
    });
  }

  return [];
}

function parseRolePermissionsPayload(
  value: unknown,
  fallbackRoleId: string,
): ParsedRolePermissions {
  if (!isObject(value)) {
    throw new Error("Backend role permissions payload is invalid.");
  }

  const backendValue = value as BackendRolePermissions;

  return {
    role_id: getRolePermissionResponseRoleId(backendValue, fallbackRoleId),
    permission_keys: getRolePermissionResponseKeys(backendValue),
  };
}

function parseRole(value: unknown): Role {
  if (!isObject(value)) {
    throw new Error("Backend role payload is invalid.");
  }

  const backendRole = value as BackendRole;
  const id = typeof backendRole.id === "string" ? backendRole.id : "";
  const roleName = typeof backendRole.role_name === "string" ? backendRole.role_name : "";
  const description = typeof backendRole.description === "string" ? backendRole.description : "";
  const createdAt =
    typeof backendRole.created_at === "string" ? backendRole.created_at : new Date(0).toISOString();
  const updatedAt = typeof backendRole.updated_at === "string" ? backendRole.updated_at : createdAt;
  const isSystemDefault =
    typeof backendRole.is_system_default === "boolean" ? backendRole.is_system_default : false;

  if (!id || !roleName) {
    throw new Error("Backend role payload is missing required fields.");
  }

  return {
    id,
    businessId: typeof backendRole.business_id === "string" ? backendRole.business_id : null,
    roleName,
    description,
    isSystemDefault,
    status: "active",
    usersCount: 0,
    createdAt,
    updatedAt,
    permissionKeys: parsePermissionKeys(backendRole.permission_keys),
  };
}

function parseRoles(value: unknown): RolesListResponse {
  if (!Array.isArray(value)) {
    throw new Error("Backend roles payload is invalid.");
  }

  return value.map(parseRole);
}

async function mapPermissionIdsToKeys(permissionIds: string[]): Promise<string[]> {
  const permissions = await getPermissions();
  const permissionMap = new Map<string, PermissionDefinition>();

  permissions.forEach((permission) => {
    permissionMap.set(permission.id, permission);
  });

  const resolvedKeys = permissionIds.flatMap((permissionId) => {
    const permission = permissionMap.get(permissionId);
    return permission ? [permission.permissionKey] : [];
  });

  return Array.from(new Set(resolvedKeys));
}

export async function getRoles(): Promise<RolesListResponse> {
  const response = await apiRequest<RolesListResponse>("/api/v1/roles", {
    authMode: "appwrite",
    parse: parseRoles,
  });

  return response.data;
}

export async function getRoleById(id: string): Promise<Role> {
  const roles = await getRoles();
  const role = roles.find((candidate) => candidate.id === id);

  if (!role) {
    throw new ApiError({
      message: "Role not found.",
      status: 404,
    });
  }

  return role;
}

export async function createRole(payload: CreateRolePayload): Promise<Role> {
  const permissionKeys = await mapPermissionIdsToKeys(payload.permissions);
  const response = await apiRequest<Role, BackendCreateOrUpdateRolePayload>("/api/v1/roles", {
    method: "POST",
    body: {
      role_name: payload.roleName,
      description: payload.description,
      permission_keys: permissionKeys,
    },
    authMode: "appwrite",
    parse: parseRole,
  });

  return response.data;
}

export async function updateRole(id: string, payload: UpdateRolePayload): Promise<Role> {
  const response = await apiRequest<Role, BackendCreateOrUpdateRolePayload>(`/api/v1/roles/${id}`, {
    method: "PATCH",
    body: {
      role_name: payload.roleName,
      description: payload.description,
    },
    authMode: "appwrite",
    parse: parseRole,
  });

  return {
    ...response.data,
    status: payload.status,
  };
}

export async function getRolePermissions(roleId: string): Promise<RolePermissionListResponse> {
  const [response, permissions] = await Promise.all([
    apiRequest<ParsedRolePermissions>(`/api/v1/roles/${roleId}/permissions`, {
      authMode: "appwrite",
      parse: (value) => parseRolePermissionsPayload(value, roleId),
    }),
    getPermissions(),
  ]);
  const allowedKeys = new Set(response.data.permission_keys);

  return permissions.map<RolePermission>((permission) => ({
    roleId,
    permissionId: permission.id,
    allowed: allowedKeys.has(permission.permissionKey),
  }));
}

export async function updateRolePermissions(
  id: string,
  payload: UpdateRolePermissionsPayload,
): Promise<Role> {
  const allowedPermissionIds = payload.permissions
    .filter((permission) => permission.allowed)
    .map((permission) => permission.permissionId);
  const permissionKeys = await mapPermissionIdsToKeys(allowedPermissionIds);
  await apiRequest<ParsedRolePermissions, BackendUpdateRolePermissionsPayload>(
    `/api/v1/roles/${id}/permissions`,
    {
      method: "PATCH",
      body: {
        permission_keys: permissionKeys,
      },
      authMode: "appwrite",
      parse: (value) => parseRolePermissionsPayload(value, id),
    },
  );

  return getRoleById(id);
}

export async function deleteRole(id: string): Promise<DeleteRoleResult> {
  await apiRequest<null>(`/api/v1/roles/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => null,
  });

  return { id };
}
