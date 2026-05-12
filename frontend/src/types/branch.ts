export type BranchStatus = "active" | "inactive";

export type Branch = {
  id: string;
  businessId: string;
  name: string;
  code: string;
  managerUserId: string | null;
  phone: string | null;
  email: string | null;
  address: string;
  timezone: string;
  isDefault: boolean;
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateBranchPayload = {
  name: string;
  code: string;
  managerUserId: string | null;
  phone: string | null;
  email: string | null;
  address: string;
  timezone: string;
  status: BranchStatus;
};

export type UpdateBranchPayload = Partial<CreateBranchPayload>;

export type UpdateBranchStatusPayload = {
  status: BranchStatus;
};

export type AssignUserBranchPayload = {
  branchId: string | null;
};
