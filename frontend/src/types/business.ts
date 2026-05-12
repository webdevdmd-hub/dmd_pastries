export type BusinessStatus = "active" | "inactive" | "suspended";

export type BusinessProfile = {
  id: string;
  businessName: string;
  ownerUserId: string | null;
  currency: string;
  timezone: string;
  vatNumber: string;
  status: BusinessStatus;
  createdAt: string;
  updatedAt: string;
};

export type UpdateBusinessPayload = {
  businessName?: string;
  currency?: string;
  timezone?: string;
  vatNumber?: string;
  status?: BusinessStatus;
};

export type BusinessSettings = {
  id: string;
  businessId: string;
  receiptFooter: string;
  allowNegativeStock: boolean;
  defaultTaxRate: number;
  priceIncludesTax: boolean;
  lowStockAlert: boolean;
  defaultLanguage: string;
  dateFormat: string;
  createdAt: string;
  updatedAt: string;
};

export type UpdateBusinessSettingsPayload = Partial<
  Pick<
    BusinessSettings,
    | "receiptFooter"
    | "allowNegativeStock"
    | "defaultTaxRate"
    | "priceIncludesTax"
    | "lowStockAlert"
    | "defaultLanguage"
    | "dateFormat"
  >
>;

export type OnboardingStepKey =
  | "business_profile"
  | "default_roles"
  | "first_branch"
  | "business_settings"
  | "staff_ready";

export type OnboardingStep = {
  key: OnboardingStepKey;
  label: string;
  complete: boolean;
  required: boolean;
};

export type OnboardingStatus = {
  businessId: string;
  complete: boolean;
  completionPercent: number;
  currentBranchId: string | null;
  steps: OnboardingStep[];
};

export type SwitchBranchPayload = {
  branchId: string;
};

export type SwitchBranchResult = {
  userId: string;
  businessId: string;
  currentBranchId: string;
};
