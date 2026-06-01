export type StaffInvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

export type StaffInvitation = {
  id: string;
  businessId: string;
  branchId: string | null;
  roleId: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: StaffInvitationStatus;
  token?: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateStaffInvitationPayload = {
  fullName: string;
  email: string;
  phone: string | null;
  roleId: string;
  branchId: string | null;
};

export type AcceptStaffInvitationPayload = {
  token: string;
  password: string;
  confirmPassword: string;
};

export type AcceptStaffInvitationResult = {
  userId: string;
  appwriteUserId: string;
  businessId: string;
  branchId: string | null;
  roleId: string;
  status: "active";
};

export type StaffInvitationAction = {
  id: string;
  status: StaffInvitationStatus;
  token?: string;
  expiresAt: string | null;
  updatedAt: string;
};
