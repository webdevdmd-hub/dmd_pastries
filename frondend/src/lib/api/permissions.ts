import { apiRequest } from "@/lib/api/client";
import type { Permission, PermissionDefinition, PermissionModuleName } from "@/types/permission";

type BackendPermission = {
  id?: string;
  moduleName?: string;
  module_name?: string;
  permissionKey?: string;
  permission_key?: string;
  description?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

type BackendPermissionGroup = {
  moduleName?: string;
  module_name?: string;
  permissions?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPermissionModuleName(value: unknown): value is PermissionModuleName {
  return typeof value === "string" && /^[a-z][a-z0-9_]*$/.test(value);
}

function isPermissionKey(value: unknown): value is Permission {
  return typeof value === "string" && /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value);
}

function parsePermission(
  value: unknown,
  fallbackModuleName?: PermissionModuleName,
): PermissionDefinition {
  if (!isObject(value)) {
    throw new Error("Backend permission payload is invalid.");
  }

  const backendPermission = value as BackendPermission;
  const id = typeof backendPermission.id === "string" ? backendPermission.id : "";
  const moduleName =
    backendPermission.module_name ?? backendPermission.moduleName ?? fallbackModuleName;
  const permissionKey = backendPermission.permission_key ?? backendPermission.permissionKey;
  const description =
    typeof backendPermission.description === "string"
      ? backendPermission.description
      : typeof permissionKey === "string"
        ? permissionKey
        : "";
  const createdAt =
    typeof backendPermission.created_at === "string"
      ? backendPermission.created_at
      : typeof backendPermission.createdAt === "string"
        ? backendPermission.createdAt
        : new Date(0).toISOString();
  const updatedAt =
    typeof backendPermission.updated_at === "string"
      ? backendPermission.updated_at
      : typeof backendPermission.updatedAt === "string"
        ? backendPermission.updatedAt
        : new Date(0).toISOString();

  if (!id || !isPermissionModuleName(moduleName) || !isPermissionKey(permissionKey)) {
    throw new Error("Backend permission payload is missing required fields.");
  }

  return {
    id,
    moduleName,
    permissionKey,
    description,
    createdAt,
    updatedAt,
  };
}

function parsePermissionGroup(value: unknown): PermissionDefinition[] {
  if (!isObject(value)) {
    throw new Error("Backend permission payload is invalid.");
  }

  const backendPermissionGroup = value as BackendPermissionGroup;
  const groupModuleName = backendPermissionGroup.module_name ?? backendPermissionGroup.moduleName;

  if (Array.isArray(backendPermissionGroup.permissions)) {
    if (!isPermissionModuleName(groupModuleName)) {
      throw new Error("Backend permission group is missing module_name.");
    }

    return backendPermissionGroup.permissions.map((permission) =>
      parsePermission(permission, groupModuleName),
    );
  }

  return [parsePermission(value)];
}

function parsePermissions(value: unknown): PermissionDefinition[] {
  if (!Array.isArray(value)) {
    throw new Error("Backend permissions payload is invalid.");
  }

  return value.flatMap(parsePermissionGroup).filter((permission) => {
    const keyParts = permission.permissionKey.split(".");
    return !(keyParts.length === 2 && keyParts[1] === "manage");
  });
}

export async function getPermissions(): Promise<PermissionDefinition[]> {
  const response = await apiRequest<PermissionDefinition[]>("/api/v1/permissions", {
    authMode: "appwrite",
    parse: parsePermissions,
  });

  return response.data;
}
