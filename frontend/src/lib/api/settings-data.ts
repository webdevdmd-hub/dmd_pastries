import { apiRequest } from "@/lib/api/client";
import type {
  CompanySettings,
  CreatePaymentMethodPayload,
  CreateTaxRatePayload,
  PaymentMethod,
  ReceiptLayout,
  ReceiptLayoutConfig,
  ReceiptLayoutPayload,
  ReceiptLayoutPreview,
  ReceiptLayoutType,
  RecordStatus,
  SettingsOverview,
  TaxRate,
  UpdateCompanySettingsPayload,
  UpdatePaymentMethodPayload,
  UpdateRecordStatusPayload,
  UpdateTaxRatePayload,
} from "@/types/settings";

type BackendCompanySettings = {
  id?: string;
  business_id?: string;
  business_display_name?: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  vat_number?: string;
  currency?: string;
  timezone?: string;
  invoice_footer?: string;
  receipt_footer?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendSettingsOverview = {
  company_profile_completed?: boolean;
  branch_count?: number;
  active_tax_rates_count?: number;
  active_payment_methods_count?: number;
  default_currency?: string;
  default_timezone?: string;
};

type BackendUpdateCompanySettingsPayload = {
  business_display_name: string;
  logo_url: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  vat_number: string;
  currency: string;
  timezone: string;
  invoice_footer: string;
  receipt_footer: string;
};

type BackendTaxRate = {
  id?: string;
  business_id?: string;
  tax_name?: string;
  tax_type?: string;
  rate_percentage?: number;
  is_inclusive?: boolean;
  country?: string;
  region?: string;
  is_default?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendTaxRatePayload = {
  tax_name?: string;
  tax_type?: string;
  rate_percentage?: number;
  is_inclusive?: boolean;
  country?: string;
  region?: string;
  is_default?: boolean;
};

type BackendPaymentMethod = {
  id?: string;
  business_id?: string;
  method_name?: string;
  method_type?: string;
  is_default?: boolean;
  allow_split_payment?: boolean;
  requires_reference?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendPaymentMethodPayload = {
  method_name?: string;
  method_type?: string;
  is_default?: boolean;
  allow_split_payment?: boolean;
  requires_reference?: boolean;
};

type BackendReceiptLayout = {
  id?: string;
  business_id?: string;
  branch_id?: string | null;
  branch_name?: string | null;
  layout_name?: string;
  receipt_type?: string;
  printer_type?: string | null;
  counter_id?: string | null;
  is_default?: boolean;
  status?: string;
  layout_config?: unknown;
  created_at?: string;
  updated_at?: string;
};

type BackendReceiptLayoutPayload = {
  branch_id?: string | null;
  layout_name?: string;
  receipt_type?: ReceiptLayoutType;
  printer_type?: string | null;
  counter_id?: string | null;
  status?: RecordStatus;
  layout_config?: ReceiptLayoutConfig;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecordStatus(value: unknown): value is RecordStatus {
  return value === "active" || value === "inactive";
}

function requiredString(value: unknown, message: string): string {
  if (typeof value !== "string") {
    throw new Error(message);
  }

  return value;
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isReceiptLayoutType(value: unknown): value is ReceiptLayoutType {
  return value === "58mm" || value === "80mm" || value === "a4" || value === "custom";
}

const defaultReceiptLayoutConfig: ReceiptLayoutConfig = {
  showLogo: true,
  showBusinessName: true,
  showBranchName: true,
  showAddress: true,
  showPhone: true,
  showTaxNumber: true,
  showCashier: true,
  showCustomer: true,
  showUnitPrice: true,
  showDiscount: true,
  showTax: true,
  showPaymentMethod: true,
  showQrCode: false,
  fontSize: "medium",
  alignment: "center",
  spacing: "normal",
  footerMessage: "Thank you for your purchase.",
  termsText: "",
};

type ReceiptLayoutBooleanConfigKey = {
  [TKey in keyof ReceiptLayoutConfig]: ReceiptLayoutConfig[TKey] extends boolean ? TKey : never;
}[keyof ReceiptLayoutConfig];

function booleanField(value: Record<string, unknown>, key: ReceiptLayoutBooleanConfigKey): boolean {
  return typeof value[key] === "boolean" ? value[key] : defaultReceiptLayoutConfig[key];
}

function parseReceiptLayoutConfig(value: unknown): ReceiptLayoutConfig {
  if (!isObject(value)) {
    return defaultReceiptLayoutConfig;
  }

  const fontSize =
    value.fontSize === "small" || value.fontSize === "medium" || value.fontSize === "large"
      ? value.fontSize
      : defaultReceiptLayoutConfig.fontSize;
  const alignment =
    value.alignment === "left" || value.alignment === "center"
      ? value.alignment
      : defaultReceiptLayoutConfig.alignment;
  const spacing =
    value.spacing === "compact" || value.spacing === "normal" || value.spacing === "relaxed"
      ? value.spacing
      : defaultReceiptLayoutConfig.spacing;

  return {
    showLogo: booleanField(value, "showLogo"),
    showBusinessName: booleanField(value, "showBusinessName"),
    showBranchName: booleanField(value, "showBranchName"),
    showAddress: booleanField(value, "showAddress"),
    showPhone: booleanField(value, "showPhone"),
    showTaxNumber: booleanField(value, "showTaxNumber"),
    showCashier: booleanField(value, "showCashier"),
    showCustomer: booleanField(value, "showCustomer"),
    showUnitPrice: booleanField(value, "showUnitPrice"),
    showDiscount: booleanField(value, "showDiscount"),
    showTax: booleanField(value, "showTax"),
    showPaymentMethod: booleanField(value, "showPaymentMethod"),
    showQrCode: booleanField(value, "showQrCode"),
    fontSize,
    alignment,
    spacing,
    footerMessage:
      typeof value.footerMessage === "string"
        ? value.footerMessage
        : defaultReceiptLayoutConfig.footerMessage,
    termsText:
      typeof value.termsText === "string" ? value.termsText : defaultReceiptLayoutConfig.termsText,
  };
}

function parseCompanySettings(value: unknown): CompanySettings {
  if (!isObject(value)) {
    throw new Error("Backend company settings payload is invalid.");
  }

  const settings = value as BackendCompanySettings;

  return {
    id: requiredString(settings.id, "Company settings ID is missing."),
    businessId: requiredString(settings.business_id, "Company settings business ID is missing."),
    businessDisplayName: requiredString(
      settings.business_display_name,
      "Company display name is missing.",
    ),
    logoUrl: optionalString(settings.logo_url),
    address: requiredString(settings.address, "Company address is missing."),
    phone: requiredString(settings.phone, "Company phone is missing."),
    email: requiredString(settings.email, "Company email is missing."),
    website: requiredString(settings.website, "Company website is missing."),
    vatNumber: requiredString(settings.vat_number, "Company VAT number is missing."),
    currency: requiredString(settings.currency, "Company currency is missing."),
    timezone: requiredString(settings.timezone, "Company timezone is missing."),
    invoiceFooter: requiredString(settings.invoice_footer, "Invoice footer is missing."),
    receiptFooter: requiredString(settings.receipt_footer, "Receipt footer is missing."),
    createdAt: requiredString(settings.created_at, "Company settings created date is missing."),
    updatedAt: requiredString(settings.updated_at, "Company settings updated date is missing."),
  };
}

function parseSettingsOverview(value: unknown): SettingsOverview {
  if (!isObject(value)) {
    throw new Error("Backend settings overview payload is invalid.");
  }

  const overview = value as BackendSettingsOverview;

  if (
    typeof overview.company_profile_completed !== "boolean" ||
    typeof overview.branch_count !== "number" ||
    typeof overview.active_tax_rates_count !== "number" ||
    typeof overview.active_payment_methods_count !== "number" ||
    typeof overview.default_currency !== "string" ||
    typeof overview.default_timezone !== "string"
  ) {
    throw new Error("Backend settings overview payload is missing required fields.");
  }

  return {
    companyProfileCompleted: overview.company_profile_completed,
    branchCount: overview.branch_count,
    activeTaxRatesCount: overview.active_tax_rates_count,
    activePaymentMethodsCount: overview.active_payment_methods_count,
    defaultCurrency: overview.default_currency,
    defaultTimezone: overview.default_timezone,
  };
}

function parseTaxRate(value: unknown): TaxRate {
  if (!isObject(value)) {
    throw new Error("Backend tax rate payload is invalid.");
  }

  const taxRate = value as BackendTaxRate;

  if (
    typeof taxRate.rate_percentage !== "number" ||
    typeof taxRate.is_inclusive !== "boolean" ||
    typeof taxRate.is_default !== "boolean" ||
    !isRecordStatus(taxRate.status)
  ) {
    throw new Error("Backend tax rate payload is missing required fields.");
  }

  return {
    id: requiredString(taxRate.id, "Tax rate ID is missing."),
    businessId: requiredString(taxRate.business_id, "Tax rate business ID is missing."),
    taxName: requiredString(taxRate.tax_name, "Tax rate name is missing."),
    taxType: requiredString(taxRate.tax_type, "Tax rate type is missing."),
    ratePercentage: taxRate.rate_percentage,
    isInclusive: taxRate.is_inclusive,
    country: requiredString(taxRate.country, "Tax rate country is missing."),
    region: requiredString(taxRate.region, "Tax rate region is missing."),
    isDefault: taxRate.is_default,
    status: taxRate.status,
    createdAt: requiredString(taxRate.created_at, "Tax rate created date is missing."),
    updatedAt: requiredString(taxRate.updated_at, "Tax rate updated date is missing."),
  };
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  if (!isObject(value)) {
    throw new Error("Backend payment method payload is invalid.");
  }

  const method = value as BackendPaymentMethod;

  if (
    typeof method.is_default !== "boolean" ||
    typeof method.allow_split_payment !== "boolean" ||
    typeof method.requires_reference !== "boolean" ||
    !isRecordStatus(method.status)
  ) {
    throw new Error("Backend payment method payload is missing required fields.");
  }

  return {
    id: requiredString(method.id, "Payment method ID is missing."),
    businessId: requiredString(method.business_id, "Payment method business ID is missing."),
    methodName: requiredString(method.method_name, "Payment method name is missing."),
    methodType: requiredString(method.method_type, "Payment method type is missing."),
    isDefault: method.is_default,
    allowSplitPayment: method.allow_split_payment,
    requiresReference: method.requires_reference,
    status: method.status,
    createdAt: requiredString(method.created_at, "Payment method created date is missing."),
    updatedAt: requiredString(method.updated_at, "Payment method updated date is missing."),
  };
}

function parseReceiptLayout(value: unknown): ReceiptLayout {
  if (!isObject(value)) {
    throw new Error("Backend receipt layout payload is invalid.");
  }

  const layout = value as BackendReceiptLayout;

  if (
    typeof layout.is_default !== "boolean" ||
    !isRecordStatus(layout.status) ||
    !isReceiptLayoutType(layout.receipt_type)
  ) {
    throw new Error("Backend receipt layout payload is missing required fields.");
  }

  return {
    id: requiredString(layout.id, "Receipt layout ID is missing."),
    businessId: requiredString(layout.business_id, "Receipt layout business ID is missing."),
    branchId: optionalNullableString(layout.branch_id),
    branchName: optionalNullableString(layout.branch_name),
    layoutName: requiredString(layout.layout_name, "Receipt layout name is missing."),
    receiptType: layout.receipt_type,
    printerType: optionalNullableString(layout.printer_type),
    counterId: optionalNullableString(layout.counter_id),
    isDefault: layout.is_default,
    status: layout.status,
    layoutConfig: parseReceiptLayoutConfig(layout.layout_config),
    createdAt: requiredString(layout.created_at, "Receipt layout created date is missing."),
    updatedAt: requiredString(layout.updated_at, "Receipt layout updated date is missing."),
  };
}

function parseReceiptLayoutPreview(value: unknown): ReceiptLayoutPreview {
  if (!isObject(value)) {
    return {
      previewHtml: null,
      previewText: null,
    };
  }

  return {
    previewHtml:
      typeof value.preview_html === "string"
        ? value.preview_html
        : typeof value.html === "string"
          ? value.html
          : null,
    previewText:
      typeof value.preview_text === "string"
        ? value.preview_text
        : typeof value.text === "string"
          ? value.text
          : null,
  };
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (!Array.isArray(value)) {
    throw new Error("Backend list payload is invalid.");
  }

  return value.map(parser);
}

export async function getCompanySettings(): Promise<CompanySettings> {
  const response = await apiRequest<CompanySettings>("/api/v1/settings/company", {
    authMode: "appwrite",
    parse: parseCompanySettings,
  });

  return response.data;
}

function toBackendCompanySettingsPayload(
  payload: UpdateCompanySettingsPayload,
): BackendUpdateCompanySettingsPayload {
  return {
    business_display_name: payload.businessDisplayName,
    logo_url: payload.logoUrl,
    address: payload.address,
    phone: payload.phone,
    email: payload.email,
    website: payload.website,
    vat_number: payload.vatNumber,
    currency: payload.currency.toUpperCase(),
    timezone: payload.timezone,
    invoice_footer: payload.invoiceFooter,
    receipt_footer: payload.receiptFooter,
  };
}

export async function updateCompanySettings(
  payload: UpdateCompanySettingsPayload,
): Promise<CompanySettings> {
  const response = await apiRequest<CompanySettings, BackendUpdateCompanySettingsPayload>(
    "/api/v1/settings/company",
    {
      method: "PATCH",
      authMode: "appwrite",
      body: toBackendCompanySettingsPayload(payload),
      parse: parseCompanySettings,
    },
  );

  return response.data;
}

export async function getSettingsOverview(): Promise<SettingsOverview> {
  const response = await apiRequest<SettingsOverview>("/api/v1/settings/overview", {
    authMode: "appwrite",
    parse: parseSettingsOverview,
  });

  return response.data;
}

export async function getTaxRates(): Promise<TaxRate[]> {
  const response = await apiRequest<TaxRate[]>("/api/v1/settings/tax-rates", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseTaxRate),
  });

  return response.data;
}

function toBackendTaxRatePayload(
  payload: CreateTaxRatePayload | UpdateTaxRatePayload,
): BackendTaxRatePayload {
  return {
    ...(payload.taxName !== undefined ? { tax_name: payload.taxName } : {}),
    ...(payload.taxType !== undefined ? { tax_type: payload.taxType } : {}),
    ...(payload.ratePercentage !== undefined ? { rate_percentage: payload.ratePercentage } : {}),
    ...(payload.isInclusive !== undefined ? { is_inclusive: payload.isInclusive } : {}),
    ...(payload.country !== undefined ? { country: payload.country } : {}),
    ...(payload.region !== undefined ? { region: payload.region } : {}),
    ...(payload.isDefault !== undefined ? { is_default: payload.isDefault } : {}),
  };
}

export async function getTaxRateById(id: string): Promise<TaxRate> {
  const response = await apiRequest<TaxRate>(`/api/v1/settings/tax-rates/${id}`, {
    authMode: "appwrite",
    parse: parseTaxRate,
  });

  return response.data;
}

export async function createTaxRate(payload: CreateTaxRatePayload): Promise<TaxRate> {
  const response = await apiRequest<TaxRate, BackendTaxRatePayload>("/api/v1/settings/tax-rates", {
    method: "POST",
    authMode: "appwrite",
    body: toBackendTaxRatePayload(payload),
    parse: parseTaxRate,
  });

  return response.data;
}

export async function updateTaxRate(id: string, payload: UpdateTaxRatePayload): Promise<TaxRate> {
  const response = await apiRequest<TaxRate, BackendTaxRatePayload>(
    `/api/v1/settings/tax-rates/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: toBackendTaxRatePayload(payload),
      parse: parseTaxRate,
    },
  );

  return response.data;
}

export async function updateTaxRateStatus(
  id: string,
  payload: UpdateRecordStatusPayload,
): Promise<TaxRate> {
  const response = await apiRequest<TaxRate, UpdateRecordStatusPayload>(
    `/api/v1/settings/tax-rates/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parseTaxRate,
    },
  );

  return response.data;
}

export async function deleteTaxRate(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/settings/tax-rates/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const response = await apiRequest<PaymentMethod[]>("/api/v1/settings/payment-methods", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parsePaymentMethod),
  });

  return response.data;
}

function toBackendPaymentMethodPayload(
  payload: CreatePaymentMethodPayload | UpdatePaymentMethodPayload,
): BackendPaymentMethodPayload {
  return {
    ...(payload.methodName !== undefined ? { method_name: payload.methodName } : {}),
    ...(payload.methodType !== undefined ? { method_type: payload.methodType } : {}),
    ...(payload.isDefault !== undefined ? { is_default: payload.isDefault } : {}),
    ...(payload.allowSplitPayment !== undefined
      ? { allow_split_payment: payload.allowSplitPayment }
      : {}),
    ...(payload.requiresReference !== undefined
      ? { requires_reference: payload.requiresReference }
      : {}),
  };
}

export async function getPaymentMethodById(id: string): Promise<PaymentMethod> {
  const response = await apiRequest<PaymentMethod>(`/api/v1/settings/payment-methods/${id}`, {
    authMode: "appwrite",
    parse: parsePaymentMethod,
  });

  return response.data;
}

export async function createPaymentMethod(
  payload: CreatePaymentMethodPayload,
): Promise<PaymentMethod> {
  const response = await apiRequest<PaymentMethod, BackendPaymentMethodPayload>(
    "/api/v1/settings/payment-methods",
    {
      method: "POST",
      authMode: "appwrite",
      body: toBackendPaymentMethodPayload(payload),
      parse: parsePaymentMethod,
    },
  );

  return response.data;
}

export async function updatePaymentMethod(
  id: string,
  payload: UpdatePaymentMethodPayload,
): Promise<PaymentMethod> {
  const response = await apiRequest<PaymentMethod, BackendPaymentMethodPayload>(
    `/api/v1/settings/payment-methods/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: toBackendPaymentMethodPayload(payload),
      parse: parsePaymentMethod,
    },
  );

  return response.data;
}

export async function updatePaymentMethodStatus(
  id: string,
  payload: UpdateRecordStatusPayload,
): Promise<PaymentMethod> {
  const response = await apiRequest<PaymentMethod, UpdateRecordStatusPayload>(
    `/api/v1/settings/payment-methods/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parsePaymentMethod,
    },
  );

  return response.data;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/settings/payment-methods/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

function toBackendReceiptLayoutPayload(
  payload: ReceiptLayoutPayload | Partial<ReceiptLayoutPayload>,
): BackendReceiptLayoutPayload {
  return {
    ...(payload.branchId !== undefined ? { branch_id: payload.branchId } : {}),
    ...(payload.layoutName !== undefined ? { layout_name: payload.layoutName } : {}),
    ...(payload.receiptType !== undefined ? { receipt_type: payload.receiptType } : {}),
    ...(payload.printerType !== undefined ? { printer_type: payload.printerType } : {}),
    ...(payload.counterId !== undefined ? { counter_id: payload.counterId } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.layoutConfig !== undefined ? { layout_config: payload.layoutConfig } : {}),
  };
}

export async function getReceiptLayouts(): Promise<ReceiptLayout[]> {
  const response = await apiRequest<ReceiptLayout[]>("/api/v1/settings/receipt-layouts", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseReceiptLayout),
  });

  return response.data;
}

export async function getReceiptLayoutById(id: string): Promise<ReceiptLayout> {
  const response = await apiRequest<ReceiptLayout>(`/api/v1/settings/receipt-layouts/${id}`, {
    authMode: "appwrite",
    parse: parseReceiptLayout,
  });

  return response.data;
}

export async function createReceiptLayout(payload: ReceiptLayoutPayload): Promise<ReceiptLayout> {
  const response = await apiRequest<ReceiptLayout, BackendReceiptLayoutPayload>(
    "/api/v1/settings/receipt-layouts",
    {
      method: "POST",
      authMode: "appwrite",
      body: toBackendReceiptLayoutPayload(payload),
      parse: parseReceiptLayout,
    },
  );

  return response.data;
}

export async function updateReceiptLayout(
  id: string,
  payload: Partial<ReceiptLayoutPayload>,
): Promise<ReceiptLayout> {
  const response = await apiRequest<ReceiptLayout, BackendReceiptLayoutPayload>(
    `/api/v1/settings/receipt-layouts/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: toBackendReceiptLayoutPayload(payload),
      parse: parseReceiptLayout,
    },
  );

  return response.data;
}

export async function deleteReceiptLayout(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/settings/receipt-layouts/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function setDefaultReceiptLayout(id: string): Promise<ReceiptLayout> {
  const response = await apiRequest<ReceiptLayout>(
    `/api/v1/settings/receipt-layouts/${id}/default`,
    {
      method: "PATCH",
      authMode: "appwrite",
      parse: parseReceiptLayout,
    },
  );

  return response.data;
}

export async function previewReceiptLayout(id: string): Promise<ReceiptLayoutPreview> {
  const response = await apiRequest<ReceiptLayoutPreview>(
    `/api/v1/settings/receipt-layouts/${id}/preview`,
    {
      method: "POST",
      authMode: "appwrite",
      parse: parseReceiptLayoutPreview,
    },
  );

  return response.data;
}
