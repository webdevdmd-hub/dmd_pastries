import { ROUTES } from "@/constants/routes";
import { apiRequest } from "@/lib/api/client";
import { createAppwriteJwt } from "@/lib/appwrite/auth";
import type {
  ForgotPasswordInput,
  LoginSyncResult,
  LogoutSyncResult,
  PasswordResetCompleteResult,
  PasswordResetRequestResult,
  RegisterOwnerInput,
  RegisterOwnerResult,
  ResetPasswordInput,
} from "@/types/auth";
import type { SafeUserProfile } from "@/types/user";

type RegisterOwnerApiResult = {
  business_id?: string;
  user_id?: string;
  appwrite_user_id?: string;
  role_id?: string;
  subscription_status?: string;
  redirectTo?: string;
  nextStep?: string;
  message?: string;
};

type BackendRegisterOwnerInput = {
  full_name: string;
  business_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
};

type BackendPasswordResetRequestInput = {
  email: string;
};

type BackendPasswordResetCompleteInput = {
  user_id: string;
  secret: string;
  password: string;
  confirm_password: string;
};

type BackendAuthProfile = {
  user_id?: string;
  appwrite_user_id?: string;
  business_id?: string;
  branch_id?: string | null;
  assigned_branch_id?: string | null;
  assigned_branch_name?: string | null;
  current_branch_id?: string | null;
  current_branch_name?: string | null;
  branch_name?: string | null;
  allowed_branch_ids?: unknown;
  can_access_all_branches?: boolean;
  role_id?: string;
  role_name?: string;
  permissions?: unknown;
  subscription_status?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status?: string;
  email_verified?: boolean;
  last_login_at?: string | null;
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function isPermission(value: string): value is SafeUserProfile["permissions"][number] {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value);
}

function parsePermissionList(value: unknown): SafeUserProfile["permissions"] {
  return asStringArray(value).filter(isPermission);
}

function parseSafeUserProfile(value: unknown): SafeUserProfile {
  if (!isObject(value)) {
    throw new Error("Backend user payload is invalid.");
  }

  const backendValue = value as BackendAuthProfile;

  const id = typeof backendValue.user_id === "string" ? backendValue.user_id : "";
  const businessId = typeof backendValue.business_id === "string" ? backendValue.business_id : "";
  const fullName = typeof backendValue.full_name === "string" ? backendValue.full_name : "";
  const email = typeof value.email === "string" ? value.email : "";
  const branchId = typeof backendValue.branch_id === "string" ? backendValue.branch_id : null;
  const branchName = typeof backendValue.branch_name === "string" ? backendValue.branch_name : null;
  const assignedBranchId =
    typeof backendValue.assigned_branch_id === "string"
      ? backendValue.assigned_branch_id
      : branchId;
  const currentBranchId =
    typeof backendValue.current_branch_id === "string" ? backendValue.current_branch_id : null;
  const assignedBranchName =
    typeof backendValue.assigned_branch_name === "string"
      ? backendValue.assigned_branch_name
      : branchName;
  const currentBranchName =
    typeof backendValue.current_branch_name === "string" ? backendValue.current_branch_name : null;

  if (!id || !businessId || !fullName || !email) {
    throw new Error("Backend user payload is missing required fields.");
  }

  return {
    id,
    businessId,
    fullName,
    email,
    businessName: null,
    phone: typeof value.phone === "string" ? value.phone : null,
    assignedBranchId,
    assignedBranchName,
    currentBranchId,
    currentBranchName,
    allowedBranchIds: asStringArray(backendValue.allowed_branch_ids),
    canAccessAllBranches:
      typeof backendValue.can_access_all_branches === "boolean"
        ? backendValue.can_access_all_branches
        : false,
    roles: typeof backendValue.role_name === "string" ? [backendValue.role_name] : [],
    permissions: parsePermissionList(backendValue.permissions),
    subscriptionStatus:
      typeof backendValue.subscription_status === "string"
        ? backendValue.subscription_status
        : null,
    emailVerified:
      typeof backendValue.email_verified === "boolean" ? backendValue.email_verified : false,
  };
}

function parseRegisterOwnerResult(value: unknown): RegisterOwnerApiResult {
  if (!isObject(value)) {
    return {};
  }

  const result: RegisterOwnerApiResult = {};

  if (typeof value.business_id === "string") {
    result.business_id = value.business_id;
  }

  if (typeof value.user_id === "string") {
    result.user_id = value.user_id;
  }

  if (typeof value.appwrite_user_id === "string") {
    result.appwrite_user_id = value.appwrite_user_id;
  }

  if (typeof value.role_id === "string") {
    result.role_id = value.role_id;
  }

  if (typeof value.subscription_status === "string") {
    result.subscription_status = value.subscription_status;
  }

  if (typeof value.redirectTo === "string") {
    result.redirectTo = value.redirectTo;
  }

  if (typeof value.nextStep === "string") {
    result.nextStep = value.nextStep;
  }

  if (typeof value.message === "string") {
    result.message = value.message;
  }

  return result;
}

function toBackendRegisterOwnerInput(input: RegisterOwnerInput): BackendRegisterOwnerInput {
  return {
    full_name: input.fullName,
    business_name: input.businessName,
    email: input.email,
    phone: normalizePhone(input.phone),
    password: input.password,
    confirm_password: input.confirmPassword,
  };
}

function normalizeRegisterRedirect(data: RegisterOwnerApiResult): string {
  if (typeof data.redirectTo === "string" && data.redirectTo.length > 0) {
    return data.redirectTo;
  }

  if (data.nextStep === "dashboard") {
    return ROUTES.dashboard;
  }

  return ROUTES.login;
}

function parsePasswordResetRequestResult(value: unknown): PasswordResetRequestResult {
  if (!isObject(value)) {
    throw new Error("Backend password reset request payload is invalid.");
  }

  if (typeof value.sent !== "boolean") {
    throw new Error("Backend password reset request payload is missing required fields.");
  }

  return {
    sent: value.sent,
  };
}

function parsePasswordResetCompleteResult(value: unknown): PasswordResetCompleteResult {
  if (!isObject(value)) {
    throw new Error("Backend password reset complete payload is invalid.");
  }

  if (typeof value.reset !== "boolean") {
    throw new Error("Backend password reset complete payload is missing required fields.");
  }

  return {
    reset: value.reset,
  };
}

function parseLogoutSyncResult(value: unknown): LogoutSyncResult {
  if (!isObject(value)) {
    throw new Error("Backend logout sync payload is invalid.");
  }

  if (typeof value.logged_out !== "boolean") {
    throw new Error("Backend logout sync payload is missing required fields.");
  }

  return {
    loggedOut: value.logged_out,
  };
}

export async function registerOwner(input: RegisterOwnerInput): Promise<RegisterOwnerResult> {
  const response = await apiRequest<RegisterOwnerApiResult, BackendRegisterOwnerInput>(
    "/api/v1/auth/register-owner",
    {
      method: "POST",
      body: toBackendRegisterOwnerInput(input),
      parse: parseRegisterOwnerResult,
    },
  );

  return {
    user: null,
    redirectTo: normalizeRegisterRedirect(response.data),
    message: response.message,
  };
}

export async function loginSync(): Promise<LoginSyncResult> {
  const jwt = await createAppwriteJwt();

  const response = await apiRequest<SafeUserProfile, { jwt: string }>("/api/v1/auth/login-sync", {
    method: "POST",
    body: { jwt },
    parse: parseSafeUserProfile,
  });

  return {
    user: response.data,
    message: response.message,
  };
}

export async function getCurrentProfile(): Promise<SafeUserProfile> {
  const response = await apiRequest<SafeUserProfile>("/api/v1/auth/me", {
    authMode: "appwrite",
    parse: parseSafeUserProfile,
  });

  return response.data;
}

export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<PasswordResetRequestResult> {
  const response = await apiRequest<PasswordResetRequestResult, BackendPasswordResetRequestInput>(
    "/api/v1/auth/password-reset/request",
    {
      method: "POST",
      body: {
        email: input.email,
      },
      parse: parsePasswordResetRequestResult,
    },
  );

  return response.data;
}

export async function completePasswordReset(
  input: ResetPasswordInput,
): Promise<PasswordResetCompleteResult> {
  const response = await apiRequest<PasswordResetCompleteResult, BackendPasswordResetCompleteInput>(
    "/api/v1/auth/password-reset/complete",
    {
      method: "POST",
      body: {
        user_id: input.userId,
        secret: input.secret,
        password: input.password,
        confirm_password: input.confirmPassword,
      },
      parse: parsePasswordResetCompleteResult,
    },
  );

  return response.data;
}

export async function logoutSync(): Promise<LogoutSyncResult> {
  const response = await apiRequest<LogoutSyncResult>("/api/v1/auth/logout-sync", {
    method: "POST",
    authMode: "appwrite",
    parse: parseLogoutSyncResult,
  });

  return response.data;
}
