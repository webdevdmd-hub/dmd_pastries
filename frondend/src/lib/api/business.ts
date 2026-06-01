import { apiRequest } from "@/lib/api/client";
import type {
  BusinessProfile,
  BusinessSettings,
  BusinessStatus,
  OnboardingStatus,
  OnboardingStep,
  OnboardingStepKey,
  SwitchBranchPayload,
  SwitchBranchResult,
  UpdateBusinessPayload,
  UpdateBusinessSettingsPayload,
} from "@/types/business";

type BackendBusinessProfile = {
  id?: string;
  business_name?: string;
  owner_user_id?: string | null;
  currency?: string;
  timezone?: string;
  vat_number?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendBusinessSettings = {
  id?: string;
  business_id?: string;
  receipt_footer?: string;
  allow_negative_stock?: boolean;
  default_tax_rate?: number;
  price_includes_tax?: boolean;
  low_stock_alert?: boolean;
  default_language?: string;
  date_format?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendOnboardingStep = {
  key?: string;
  label?: string;
  complete?: boolean;
  required?: boolean;
};

type BackendOnboardingStatus = {
  business_id?: string;
  complete?: boolean;
  completion_percent?: number;
  current_branch_id?: string | null;
  steps?: unknown;
};

type BackendUpdateBusinessPayload = {
  business_name?: string;
  currency?: string;
  timezone?: string;
  vat_number?: string;
  status?: BusinessStatus;
};

type BackendUpdateBusinessSettingsPayload = {
  receipt_footer?: string;
  allow_negative_stock?: boolean;
  default_tax_rate?: number;
  price_includes_tax?: boolean;
  low_stock_alert?: boolean;
  default_language?: string;
  date_format?: string;
};

type BackendSwitchBranchPayload = {
  branch_id: string;
};

type BackendSwitchBranchResult = {
  user_id?: string;
  business_id?: string;
  current_branch_id?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBusinessStatus(value: unknown): value is BusinessStatus {
  return value === "active" || value === "inactive" || value === "suspended";
}

function isOnboardingStepKey(value: unknown): value is OnboardingStepKey {
  return (
    value === "business_profile" ||
    value === "default_roles" ||
    value === "first_branch" ||
    value === "business_settings" ||
    value === "staff_ready"
  );
}

function parseBusinessProfile(value: unknown): BusinessProfile {
  if (!isObject(value)) {
    throw new Error("Backend business payload is invalid.");
  }

  const business = value as BackendBusinessProfile;
  const id = typeof business.id === "string" ? business.id : "";
  const businessName = typeof business.business_name === "string" ? business.business_name : "";
  const currency = typeof business.currency === "string" ? business.currency : "";
  const timezone = typeof business.timezone === "string" ? business.timezone : "";
  const vatNumber = typeof business.vat_number === "string" ? business.vat_number : "";
  const createdAt = typeof business.created_at === "string" ? business.created_at : "";
  const updatedAt = typeof business.updated_at === "string" ? business.updated_at : "";

  if (
    !id ||
    !businessName ||
    !currency ||
    !timezone ||
    !createdAt ||
    !updatedAt ||
    !isBusinessStatus(business.status)
  ) {
    throw new Error("Backend business payload is missing required fields.");
  }

  return {
    id,
    businessName,
    ownerUserId: typeof business.owner_user_id === "string" ? business.owner_user_id : null,
    currency,
    timezone,
    vatNumber,
    status: business.status,
    createdAt,
    updatedAt,
  };
}

function parseBusinessSettings(value: unknown): BusinessSettings {
  if (!isObject(value)) {
    throw new Error("Backend settings payload is invalid.");
  }

  const settings = value as BackendBusinessSettings;
  const id = typeof settings.id === "string" ? settings.id : "";
  const businessId = typeof settings.business_id === "string" ? settings.business_id : "";
  const receiptFooter = typeof settings.receipt_footer === "string" ? settings.receipt_footer : "";
  const defaultLanguage =
    typeof settings.default_language === "string" ? settings.default_language : "";
  const dateFormat = typeof settings.date_format === "string" ? settings.date_format : "";
  const createdAt = typeof settings.created_at === "string" ? settings.created_at : "";
  const updatedAt = typeof settings.updated_at === "string" ? settings.updated_at : "";

  if (
    !id ||
    !businessId ||
    !defaultLanguage ||
    !dateFormat ||
    !createdAt ||
    !updatedAt ||
    typeof settings.allow_negative_stock !== "boolean" ||
    typeof settings.default_tax_rate !== "number" ||
    typeof settings.price_includes_tax !== "boolean" ||
    typeof settings.low_stock_alert !== "boolean"
  ) {
    throw new Error("Backend settings payload is missing required fields.");
  }

  return {
    id,
    businessId,
    receiptFooter,
    allowNegativeStock: settings.allow_negative_stock,
    defaultTaxRate: settings.default_tax_rate,
    priceIncludesTax: settings.price_includes_tax,
    lowStockAlert: settings.low_stock_alert,
    defaultLanguage,
    dateFormat,
    createdAt,
    updatedAt,
  };
}

function parseOnboardingStep(value: unknown): OnboardingStep {
  if (!isObject(value)) {
    throw new Error("Backend onboarding step payload is invalid.");
  }

  const step = value as BackendOnboardingStep;
  const label = typeof step.label === "string" ? step.label : "";

  if (
    !isOnboardingStepKey(step.key) ||
    !label ||
    typeof step.complete !== "boolean" ||
    typeof step.required !== "boolean"
  ) {
    throw new Error("Backend onboarding step payload is missing required fields.");
  }

  return {
    key: step.key,
    label,
    complete: step.complete,
    required: step.required,
  };
}

function parseOnboardingStatus(value: unknown): OnboardingStatus {
  if (!isObject(value)) {
    throw new Error("Backend onboarding payload is invalid.");
  }

  const status = value as BackendOnboardingStatus;
  const businessId = typeof status.business_id === "string" ? status.business_id : "";

  if (
    !businessId ||
    typeof status.complete !== "boolean" ||
    typeof status.completion_percent !== "number" ||
    !Array.isArray(status.steps)
  ) {
    throw new Error("Backend onboarding payload is missing required fields.");
  }

  return {
    businessId,
    complete: status.complete,
    completionPercent: status.completion_percent,
    currentBranchId: typeof status.current_branch_id === "string" ? status.current_branch_id : null,
    steps: status.steps.map(parseOnboardingStep),
  };
}

function parseSwitchBranchResult(value: unknown): SwitchBranchResult {
  if (!isObject(value)) {
    throw new Error("Backend branch switch payload is invalid.");
  }

  const result = value as BackendSwitchBranchResult;
  const userId = typeof result.user_id === "string" ? result.user_id : "";
  const businessId = typeof result.business_id === "string" ? result.business_id : "";
  const currentBranchId =
    typeof result.current_branch_id === "string" ? result.current_branch_id : "";

  if (!userId || !businessId || !currentBranchId) {
    throw new Error("Backend branch switch payload is missing required fields.");
  }

  return {
    userId,
    businessId,
    currentBranchId,
  };
}

function toBackendBusinessPayload(payload: UpdateBusinessPayload): BackendUpdateBusinessPayload {
  return {
    ...(payload.businessName !== undefined ? { business_name: payload.businessName } : {}),
    ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
    ...(payload.timezone !== undefined ? { timezone: payload.timezone } : {}),
    ...(payload.vatNumber !== undefined ? { vat_number: payload.vatNumber } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
  };
}

function toBackendSettingsPayload(
  payload: UpdateBusinessSettingsPayload,
): BackendUpdateBusinessSettingsPayload {
  return {
    ...(payload.receiptFooter !== undefined ? { receipt_footer: payload.receiptFooter } : {}),
    ...(payload.allowNegativeStock !== undefined
      ? { allow_negative_stock: payload.allowNegativeStock }
      : {}),
    ...(payload.defaultTaxRate !== undefined ? { default_tax_rate: payload.defaultTaxRate } : {}),
    ...(payload.priceIncludesTax !== undefined
      ? { price_includes_tax: payload.priceIncludesTax }
      : {}),
    ...(payload.lowStockAlert !== undefined ? { low_stock_alert: payload.lowStockAlert } : {}),
    ...(payload.defaultLanguage !== undefined ? { default_language: payload.defaultLanguage } : {}),
    ...(payload.dateFormat !== undefined ? { date_format: payload.dateFormat } : {}),
  };
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const response = await apiRequest<BusinessProfile>("/api/v1/business", {
    authMode: "appwrite",
    parse: parseBusinessProfile,
  });

  return response.data;
}

export async function updateBusinessProfile(
  payload: UpdateBusinessPayload,
): Promise<BusinessProfile> {
  const response = await apiRequest<BusinessProfile, BackendUpdateBusinessPayload>(
    "/api/v1/business",
    {
      method: "PATCH",
      authMode: "appwrite",
      body: toBackendBusinessPayload(payload),
      parse: parseBusinessProfile,
    },
  );

  return response.data;
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const response = await apiRequest<OnboardingStatus>("/api/v1/business/onboarding-status", {
    authMode: "appwrite",
    parse: parseOnboardingStatus,
  });

  return response.data;
}

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const response = await apiRequest<BusinessSettings>("/api/v1/settings", {
    authMode: "appwrite",
    parse: parseBusinessSettings,
  });

  return response.data;
}

export async function updateBusinessSettings(
  payload: UpdateBusinessSettingsPayload,
): Promise<BusinessSettings> {
  const response = await apiRequest<BusinessSettings, BackendUpdateBusinessSettingsPayload>(
    "/api/v1/settings",
    {
      method: "PATCH",
      authMode: "appwrite",
      body: toBackendSettingsPayload(payload),
      parse: parseBusinessSettings,
    },
  );

  return response.data;
}

export async function switchBranch(payload: SwitchBranchPayload): Promise<SwitchBranchResult> {
  const response = await apiRequest<SwitchBranchResult, BackendSwitchBranchPayload>(
    "/api/v1/auth/switch-branch",
    {
      method: "POST",
      authMode: "appwrite",
      body: {
        branch_id: payload.branchId,
      },
      parse: parseSwitchBranchResult,
    },
  );

  return response.data;
}
