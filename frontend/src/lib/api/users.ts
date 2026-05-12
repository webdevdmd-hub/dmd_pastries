import { apiRequest } from "@/lib/api/client";
import type {
  AssignUserBranchPayload,
  AssignUserBranchResult,
  CreateUserPayload,
  SoftDeleteUserResult,
  UpdateUserPayload,
  UpdateUserStatusPayload,
  User,
  UserFilters,
  UsersListResponse,
} from "@/types/user";

type BackendUser = {
  id?: string;
  appwrite_user_id?: string;
  business_id?: string;
  branch_id?: string | null;
  role_id?: string;
  role_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  status?: string;
  email_verified?: boolean;
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type BackendCreateUserPayload = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  role_id: string;
  branch_id: string | null;
  avatar_url?: string | null;
};

type BackendUpdateUserPayload = {
  full_name?: string;
  phone?: string;
  role_id?: string;
  branch_id?: string | null;
  avatar_url?: string | null;
};

type BackendUpdateUserStatusPayload = {
  status: UpdateUserStatusPayload["status"];
};

type BackendAssignUserBranchPayload = {
  branch_id: string;
};

type BackendAssignUserBranchResult = {
  id?: string;
  branch_id?: string;
  role_id?: string;
  full_name?: string;
  status?: string;
};

type BackendSoftDeleteUserResult = {
  id?: string;
  status?: string;
  deleted_at?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const hasPlusPrefix = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/[^\d]/g, "");

  return hasPlusPrefix ? `+${digitsOnly}` : digitsOnly;
}

function isUserStatus(value: unknown): value is User["status"] {
  return value === "active" || value === "inactive" || value === "suspended" || value === "invited";
}

function parseUser(value: unknown): User {
  if (!isObject(value)) {
    throw new Error("Backend user payload is invalid.");
  }

  const backendUser = value as BackendUser;
  const id = typeof backendUser.id === "string" ? backendUser.id : "";
  const appwriteUserId =
    typeof backendUser.appwrite_user_id === "string" ? backendUser.appwrite_user_id : "";
  const businessId = typeof backendUser.business_id === "string" ? backendUser.business_id : "";
  const roleId = typeof backendUser.role_id === "string" ? backendUser.role_id : "";
  const roleName = typeof backendUser.role_name === "string" ? backendUser.role_name : "";
  const fullName = typeof backendUser.full_name === "string" ? backendUser.full_name : "";
  const email = typeof backendUser.email === "string" ? backendUser.email : "";
  const phone = typeof backendUser.phone === "string" ? backendUser.phone : "";
  const createdAt = typeof backendUser.created_at === "string" ? backendUser.created_at : "";
  const updatedAt = typeof backendUser.updated_at === "string" ? backendUser.updated_at : "";

  if (
    !id ||
    !appwriteUserId ||
    !businessId ||
    !roleId ||
    !roleName ||
    !fullName ||
    !email ||
    !createdAt ||
    !updatedAt ||
    !isUserStatus(backendUser.status)
  ) {
    throw new Error("Backend user payload is missing required fields.");
  }

  return {
    id,
    appwriteUserId,
    businessId,
    branchId: typeof backendUser.branch_id === "string" ? backendUser.branch_id : null,
    roleId,
    roleName,
    fullName,
    email,
    phone,
    avatarUrl: typeof backendUser.avatar_url === "string" ? backendUser.avatar_url : null,
    status: backendUser.status,
    emailVerified:
      typeof backendUser.email_verified === "boolean" ? backendUser.email_verified : false,
    lastLoginAt: typeof backendUser.last_login_at === "string" ? backendUser.last_login_at : null,
    createdAt,
    updatedAt,
  };
}

function parseUsersList(value: unknown): UsersListResponse {
  if (!Array.isArray(value)) {
    throw new Error("Backend users list payload is invalid.");
  }

  return value.map(parseUser);
}

function parseAssignUserBranchResult(value: unknown): AssignUserBranchResult {
  if (!isObject(value)) {
    throw new Error("Backend user branch assignment payload is invalid.");
  }

  const result = value as BackendAssignUserBranchResult;
  const id = typeof result.id === "string" ? result.id : "";
  const branchId = typeof result.branch_id === "string" ? result.branch_id : "";
  const roleId = typeof result.role_id === "string" ? result.role_id : "";
  const fullName = typeof result.full_name === "string" ? result.full_name : "";

  if (!id || !branchId || !roleId || !fullName || !isUserStatus(result.status)) {
    throw new Error("Backend user branch assignment payload is missing required fields.");
  }

  return {
    id,
    branchId,
    roleId,
    fullName,
    status: result.status,
  };
}

function parseSoftDeleteUserResult(value: unknown): SoftDeleteUserResult {
  if (!isObject(value)) {
    throw new Error("Backend soft-delete user payload is invalid.");
  }

  const result = value as BackendSoftDeleteUserResult;
  const id = typeof result.id === "string" ? result.id : "";
  const deletedAt = typeof result.deleted_at === "string" ? result.deleted_at : "";

  if (!id || !deletedAt || result.status !== "deleted") {
    throw new Error("Backend soft-delete user payload is missing required fields.");
  }

  return {
    id,
    status: "deleted",
    deletedAt,
  };
}

function toBackendCreateUserPayload(payload: CreateUserPayload): BackendCreateUserPayload {
  return {
    full_name: payload.fullName,
    email: payload.email,
    phone: normalizePhone(payload.phone),
    password: payload.password,
    role_id: payload.roleId,
    branch_id: payload.branchId,
    ...(payload.avatarUrl !== undefined ? { avatar_url: payload.avatarUrl } : {}),
  };
}

function toBackendUpdateUserPayload(payload: UpdateUserPayload): BackendUpdateUserPayload {
  const result: BackendUpdateUserPayload = {};

  if (payload.fullName.length > 0) {
    result.full_name = payload.fullName;
  }

  if (payload.phone.length > 0) {
    result.phone = normalizePhone(payload.phone);
  }

  if (payload.roleId) {
    result.role_id = payload.roleId;
  }

  if (payload.branchId !== undefined) {
    result.branch_id = payload.branchId;
  }

  if (payload.avatarUrl !== undefined) {
    result.avatar_url = payload.avatarUrl;
  }

  return result;
}

export async function getUsers(_filters: UserFilters): Promise<UsersListResponse> {
  // TODO: Switch search/status to backend query params when the users endpoint supports filtering.
  const response = await apiRequest<UsersListResponse>("/api/v1/users", {
    authMode: "appwrite",
    parse: parseUsersList,
  });

  return response.data;
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const response = await apiRequest<User, BackendCreateUserPayload>("/api/v1/users", {
    method: "POST",
    body: toBackendCreateUserPayload(payload),
    authMode: "appwrite",
    parse: parseUser,
  });

  return response.data;
}

export async function getUserById(id: string): Promise<User> {
  const response = await apiRequest<User>(`/api/v1/users/${id}`, {
    authMode: "appwrite",
    parse: parseUser,
  });

  return response.data;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
  const response = await apiRequest<User, BackendUpdateUserPayload>(`/api/v1/users/${id}`, {
    method: "PATCH",
    body: toBackendUpdateUserPayload(payload),
    authMode: "appwrite",
    parse: parseUser,
  });

  return response.data;
}

export async function updateUserStatus(
  id: string,
  payload: UpdateUserStatusPayload,
): Promise<User> {
  const response = await apiRequest<User, BackendUpdateUserStatusPayload>(
    `/api/v1/users/${id}/status`,
    {
      method: "PATCH",
      body: { status: payload.status },
      authMode: "appwrite",
      parse: parseUser,
    },
  );

  return response.data;
}

export async function assignUserBranch(
  id: string,
  payload: AssignUserBranchPayload,
): Promise<AssignUserBranchResult> {
  const response = await apiRequest<AssignUserBranchResult, BackendAssignUserBranchPayload>(
    `/api/v1/users/${id}/branch`,
    {
      method: "PATCH",
      body: {
        branch_id: payload.branchId,
      },
      authMode: "appwrite",
      parse: parseAssignUserBranchResult,
    },
  );

  return response.data;
}

export async function softDeleteUser(id: string): Promise<SoftDeleteUserResult> {
  const response = await apiRequest<SoftDeleteUserResult>(`/api/v1/users/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: parseSoftDeleteUserResult,
  });

  return response.data;
}

export async function restoreUser(id: string): Promise<User> {
  const response = await apiRequest<User>(`/api/v1/users/${id}/restore`, {
    method: "PATCH",
    authMode: "appwrite",
    parse: parseUser,
  });

  return response.data;
}
