import { apiRequest } from "@/lib/api/client";
import type {
  AcceptStaffInvitationPayload,
  AcceptStaffInvitationResult,
  CreateStaffInvitationPayload,
  StaffInvitation,
  StaffInvitationAction,
  StaffInvitationStatus,
} from "@/types/invitation";

type BackendStaffInvitation = {
  id?: string;
  business_id?: string;
  branch_id?: string | null;
  role_id?: string;
  full_name?: string;
  email?: string;
  phone?: string | null;
  status?: string;
  token?: string;
  expires_at?: string;
  accepted_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type BackendStaffInvitationAction = {
  id?: string;
  status?: string;
  token?: string;
  expires_at?: string | null;
  updated_at?: string;
};

type BackendCreateStaffInvitationPayload = {
  full_name: string;
  email: string;
  phone: string | null;
  role_id: string;
  branch_id: string | null;
};

type BackendAcceptStaffInvitationPayload = {
  token: string;
  password: string;
  confirm_password: string;
};

type BackendAcceptStaffInvitationResult = {
  user_id?: string;
  appwrite_user_id?: string;
  business_id?: string;
  branch_id?: string | null;
  role_id?: string;
  status?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStaffInvitationStatus(value: unknown): value is StaffInvitationStatus {
  return (
    value === "pending" || value === "accepted" || value === "expired" || value === "cancelled"
  );
}

function normalizePhone(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const hasPlusPrefix = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/[^\d]/g, "");

  return hasPlusPrefix ? `+${digitsOnly}` : digitsOnly;
}

function parseStaffInvitation(value: unknown): StaffInvitation {
  if (!isObject(value)) {
    throw new Error("Backend staff invitation payload is invalid.");
  }

  const backendInvitation = value as BackendStaffInvitation;
  const id = typeof backendInvitation.id === "string" ? backendInvitation.id : "";
  const businessId =
    typeof backendInvitation.business_id === "string" ? backendInvitation.business_id : "";
  const roleId = typeof backendInvitation.role_id === "string" ? backendInvitation.role_id : "";
  const fullName =
    typeof backendInvitation.full_name === "string" ? backendInvitation.full_name : "";
  const email = typeof backendInvitation.email === "string" ? backendInvitation.email : "";
  const expiresAt =
    typeof backendInvitation.expires_at === "string" ? backendInvitation.expires_at : "";
  const createdAt =
    typeof backendInvitation.created_at === "string" ? backendInvitation.created_at : "";
  const updatedAt =
    typeof backendInvitation.updated_at === "string" ? backendInvitation.updated_at : "";

  if (
    !id ||
    !businessId ||
    !roleId ||
    !fullName ||
    !email ||
    !expiresAt ||
    !createdAt ||
    !updatedAt ||
    !isStaffInvitationStatus(backendInvitation.status)
  ) {
    throw new Error("Backend staff invitation payload is missing required fields.");
  }

  return {
    id,
    businessId,
    branchId: typeof backendInvitation.branch_id === "string" ? backendInvitation.branch_id : null,
    roleId,
    fullName,
    email,
    phone: typeof backendInvitation.phone === "string" ? backendInvitation.phone : null,
    status: backendInvitation.status,
    ...(typeof backendInvitation.token === "string" ? { token: backendInvitation.token } : {}),
    expiresAt,
    acceptedAt:
      typeof backendInvitation.accepted_at === "string" ? backendInvitation.accepted_at : null,
    createdAt,
    updatedAt,
  };
}

function parseStaffInvitationAction(value: unknown): StaffInvitationAction {
  if (!isObject(value)) {
    throw new Error("Backend staff invitation action payload is invalid.");
  }

  const backendAction = value as BackendStaffInvitationAction;
  const id = typeof backendAction.id === "string" ? backendAction.id : "";
  const updatedAt = typeof backendAction.updated_at === "string" ? backendAction.updated_at : "";

  if (!id || !updatedAt || !isStaffInvitationStatus(backendAction.status)) {
    throw new Error("Backend staff invitation action payload is missing required fields.");
  }

  return {
    id,
    status: backendAction.status,
    ...(typeof backendAction.token === "string" ? { token: backendAction.token } : {}),
    expiresAt: typeof backendAction.expires_at === "string" ? backendAction.expires_at : null,
    updatedAt,
  };
}

function parseStaffInvitations(value: unknown): StaffInvitation[] {
  if (!Array.isArray(value)) {
    throw new Error("Backend staff invitations payload is invalid.");
  }

  return value.map(parseStaffInvitation);
}

function parseAcceptStaffInvitationResult(value: unknown): AcceptStaffInvitationResult {
  if (!isObject(value)) {
    throw new Error("Backend accept invitation payload is invalid.");
  }

  const result = value as BackendAcceptStaffInvitationResult;
  const userId = typeof result.user_id === "string" ? result.user_id : "";
  const appwriteUserId = typeof result.appwrite_user_id === "string" ? result.appwrite_user_id : "";
  const businessId = typeof result.business_id === "string" ? result.business_id : "";
  const roleId = typeof result.role_id === "string" ? result.role_id : "";

  if (!userId || !appwriteUserId || !businessId || !roleId || result.status !== "active") {
    throw new Error("Backend accept invitation payload is missing required fields.");
  }

  return {
    userId,
    appwriteUserId,
    businessId,
    branchId: typeof result.branch_id === "string" ? result.branch_id : null,
    roleId,
    status: "active",
  };
}

function buildInvitationSearchParams(status?: StaffInvitationStatus): string {
  if (!status) {
    return "";
  }

  return `?status=${encodeURIComponent(status)}`;
}

export async function createStaffInvitation(
  payload: CreateStaffInvitationPayload,
): Promise<StaffInvitation> {
  const response = await apiRequest<StaffInvitation, BackendCreateStaffInvitationPayload>(
    "/api/v1/users/invitations",
    {
      method: "POST",
      body: {
        full_name: payload.fullName,
        email: payload.email,
        phone: normalizePhone(payload.phone),
        role_id: payload.roleId,
        branch_id: payload.branchId,
      },
      authMode: "appwrite",
      parse: parseStaffInvitation,
    },
  );

  return response.data;
}

export async function getStaffInvitations(
  status?: StaffInvitationStatus,
): Promise<StaffInvitation[]> {
  const response = await apiRequest<StaffInvitation[]>(
    `/api/v1/users/invitations${buildInvitationSearchParams(status)}`,
    {
      authMode: "appwrite",
      parse: parseStaffInvitations,
    },
  );

  return response.data;
}

export async function resendStaffInvitation(id: string): Promise<StaffInvitationAction> {
  const response = await apiRequest<StaffInvitationAction>(
    `/api/v1/users/invitations/${id}/resend`,
    {
      method: "POST",
      authMode: "appwrite",
      parse: parseStaffInvitationAction,
    },
  );

  return response.data;
}

export async function cancelStaffInvitation(id: string): Promise<StaffInvitationAction> {
  const response = await apiRequest<StaffInvitationAction>(
    `/api/v1/users/invitations/${id}/cancel`,
    {
      method: "PATCH",
      authMode: "appwrite",
      parse: parseStaffInvitationAction,
    },
  );

  return response.data;
}

export async function acceptStaffInvitation(
  payload: AcceptStaffInvitationPayload,
): Promise<AcceptStaffInvitationResult> {
  const response = await apiRequest<
    AcceptStaffInvitationResult,
    BackendAcceptStaffInvitationPayload
  >("/api/v1/auth/accept-invitation", {
    method: "POST",
    body: {
      token: payload.token,
      password: payload.password,
      confirm_password: payload.confirmPassword,
    },
    authMode: "none",
    parse: parseAcceptStaffInvitationResult,
  });

  return response.data;
}
