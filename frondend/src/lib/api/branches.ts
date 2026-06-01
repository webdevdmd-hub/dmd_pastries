import { apiRequest } from "@/lib/api/client";
import type {
  AssignUserBranchPayload,
  Branch,
  BranchStatus,
  CreateBranchPayload,
  UpdateBranchPayload,
  UpdateBranchStatusPayload,
} from "@/types/branch";
import type { User } from "@/types/user";

type BackendBranch = {
  id?: string;
  business_id?: string;
  branch_name?: string;
  name?: string;
  branch_code?: string;
  code?: string;
  address?: string;
  phone?: string | null;
  email?: string | null;
  manager_user_id?: string | null;
  address_line_1?: string;
  address_line_2?: string | null;
  city?: string;
  country?: string;
  timezone?: string;
  is_default?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendBranchPayload = {
  branch_name?: string;
  name?: string;
  branch_code?: string;
  code?: string;
  address?: string;
  phone?: string | null;
  email?: string | null;
  manager_user_id?: string | null;
  address_line_1?: string;
  address_line_2?: string | null;
  city?: string;
  country?: string;
  timezone?: string;
  status?: BranchStatus;
};

type BackendAssignUserBranchPayload = {
  branch_id: string | null;
};

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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBranchStatus(value: unknown): value is BranchStatus {
  return value === "active" || value === "inactive";
}

function parseBranch(value: unknown): Branch {
  if (!isObject(value)) {
    throw new Error("Backend branch payload is invalid.");
  }

  const backendBranch = value as BackendBranch;
  const id = typeof backendBranch.id === "string" ? backendBranch.id : "";
  const businessId = typeof backendBranch.business_id === "string" ? backendBranch.business_id : "";
  const name =
    typeof backendBranch.branch_name === "string"
      ? backendBranch.branch_name
      : typeof backendBranch.name === "string"
        ? backendBranch.name
        : "";
  const code =
    typeof backendBranch.branch_code === "string" && backendBranch.branch_code.length > 0
      ? backendBranch.branch_code
      : typeof backendBranch.code === "string"
        ? backendBranch.code
        : "";
  const address =
    typeof backendBranch.address === "string"
      ? backendBranch.address
      : typeof backendBranch.address_line_1 === "string"
        ? backendBranch.address_line_1
        : "";
  const timezone = typeof backendBranch.timezone === "string" ? backendBranch.timezone : "";
  const createdAt = typeof backendBranch.created_at === "string" ? backendBranch.created_at : "";
  const updatedAt = typeof backendBranch.updated_at === "string" ? backendBranch.updated_at : "";

  if (
    !id ||
    !businessId ||
    !name ||
    !code ||
    !createdAt ||
    !updatedAt ||
    !isBranchStatus(backendBranch.status)
  ) {
    throw new Error("Backend branch payload is missing required fields.");
  }

  return {
    id,
    businessId,
    name,
    code,
    managerUserId:
      typeof backendBranch.manager_user_id === "string" ? backendBranch.manager_user_id : null,
    phone: typeof backendBranch.phone === "string" ? backendBranch.phone : null,
    email: typeof backendBranch.email === "string" ? backendBranch.email : null,
    address,
    timezone,
    isDefault: typeof backendBranch.is_default === "boolean" ? backendBranch.is_default : false,
    status: backendBranch.status,
    createdAt,
    updatedAt,
  };
}

function parseBranches(value: unknown): Branch[] {
  if (!Array.isArray(value)) {
    throw new Error("Backend branches payload is invalid.");
  }

  return value.map(parseBranch);
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

function toBackendBranchPayload(
  payload: CreateBranchPayload | UpdateBranchPayload,
): BackendBranchPayload {
  const result: BackendBranchPayload = {};

  if (payload.name !== undefined) {
    result.branch_name = payload.name;
    result.name = payload.name;
  }

  if (payload.code !== undefined) {
    result.branch_code = payload.code;
    result.code = payload.code;
  }

  if (payload.address !== undefined) {
    result.address = payload.address;
    result.address_line_1 = payload.address;
  }

  if (payload.managerUserId !== undefined) {
    result.manager_user_id = payload.managerUserId;
  }

  if (payload.phone !== undefined) {
    result.phone = payload.phone;
  }

  if (payload.email !== undefined) {
    result.email = payload.email;
  }

  if (payload.timezone !== undefined) {
    result.timezone = payload.timezone;
  }

  if (payload.status !== undefined) {
    result.status = payload.status;
  }

  return result;
}

export async function getBranches(): Promise<Branch[]> {
  const response = await apiRequest<Branch[]>("/api/v1/branches", {
    authMode: "appwrite",
    parse: parseBranches,
  });

  return response.data;
}

export async function getBranchById(id: string): Promise<Branch> {
  const response = await apiRequest<Branch>(`/api/v1/branches/${id}`, {
    authMode: "appwrite",
    parse: parseBranch,
  });

  return response.data;
}

export async function createBranch(payload: CreateBranchPayload): Promise<Branch> {
  const response = await apiRequest<Branch, BackendBranchPayload>("/api/v1/branches", {
    method: "POST",
    body: toBackendBranchPayload(payload),
    authMode: "appwrite",
    parse: parseBranch,
  });

  return response.data;
}

export async function updateBranch(id: string, payload: UpdateBranchPayload): Promise<Branch> {
  const response = await apiRequest<Branch, BackendBranchPayload>(`/api/v1/branches/${id}`, {
    method: "PATCH",
    body: toBackendBranchPayload(payload),
    authMode: "appwrite",
    parse: parseBranch,
  });

  return response.data;
}

export async function updateBranchStatus(
  id: string,
  payload: UpdateBranchStatusPayload,
): Promise<Branch> {
  const response = await apiRequest<Branch, UpdateBranchStatusPayload>(
    `/api/v1/branches/${id}/status`,
    {
      method: "PATCH",
      body: payload,
      authMode: "appwrite",
      parse: parseBranch,
    },
  );

  return response.data;
}

export async function assignUserBranch(
  userId: string,
  payload: AssignUserBranchPayload,
): Promise<User> {
  const response = await apiRequest<User, BackendAssignUserBranchPayload>(
    `/api/v1/users/${userId}/branch`,
    {
      method: "PATCH",
      body: {
        branch_id: payload.branchId,
      },
      authMode: "appwrite",
      parse: parseUser,
    },
  );

  return response.data;
}
