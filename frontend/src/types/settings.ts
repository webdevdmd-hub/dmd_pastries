import type { Permission } from "@/types/permission";

export type SettingsSectionStatus = "available" | "coming_soon" | "disabled";
export type SettingsSectionCategory = "system" | "master_data";

export type SettingsIconName =
  | "Activity"
  | "Archive"
  | "BadgeDollarSign"
  | "Bell"
  | "Building2"
  | "CreditCard"
  | "Gift"
  | "ListChecks"
  | "Package"
  | "Percent"
  | "Printer"
  | "Receipt"
  | "Scale"
  | "Store"
  | "Truck"
  | "WalletCards"
  | "Wheat";

export type SettingsSection = {
  id: string;
  title: string;
  description: string;
  iconName: SettingsIconName;
  permission: Permission;
  managePermission: Permission;
  route: string;
  status: SettingsSectionStatus;
  category: SettingsSectionCategory;
  actionLabel: string;
};

export type RecordStatus = "active" | "inactive";

export type CompanySettings = {
  id: string;
  businessId: string;
  businessDisplayName: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  vatNumber: string;
  currency: string;
  timezone: string;
  invoiceFooter: string;
  receiptFooter: string;
  createdAt: string;
  updatedAt: string;
};

export type UpdateCompanySettingsPayload = {
  businessDisplayName: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  vatNumber: string;
  currency: string;
  timezone: string;
  invoiceFooter: string;
  receiptFooter: string;
};

export type SettingsOverview = {
  companyProfileCompleted: boolean;
  branchCount: number;
  activeTaxRatesCount: number;
  activePaymentMethodsCount: number;
  defaultCurrency: string;
  defaultTimezone: string;
};

export type TaxRate = {
  id: string;
  businessId: string;
  taxName: string;
  taxType: string;
  ratePercentage: number;
  isInclusive: boolean;
  country: string;
  region: string;
  isDefault: boolean;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaxRatePayload = {
  taxName: string;
  taxType: string;
  ratePercentage: number;
  isInclusive: boolean;
  country: string;
  region: string;
  isDefault: boolean;
};

export type UpdateTaxRatePayload = Partial<CreateTaxRatePayload>;

export type UpdateRecordStatusPayload = {
  status: RecordStatus;
};

export type PaymentMethod = {
  id: string;
  businessId: string;
  methodName: string;
  methodType: string;
  isDefault: boolean;
  allowSplitPayment: boolean;
  requiresReference: boolean;
  showInPos: boolean;
  showInBakeryOrders: boolean;
  showInPurchasing: boolean;
  showInExpenses: boolean;
  showInDashboardCollection: boolean;
  defaultPaymentAccountId: string | null;
  defaultPaymentAccountName: string;
  branchId: string | null;
  branchName: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreatePaymentMethodPayload = {
  methodName: string;
  methodType: string;
  isDefault: boolean;
  allowSplitPayment: boolean;
  requiresReference: boolean;
  showInPos: boolean;
  showInBakeryOrders: boolean;
  showInPurchasing: boolean;
  showInExpenses: boolean;
  showInDashboardCollection: boolean;
  defaultPaymentAccountId: string | null;
};

export type UpdatePaymentMethodPayload = Partial<CreatePaymentMethodPayload>;

export type SalesChannel = {
  id: string;
  businessId: string;
  channelName: string;
  channelType: string;
  requiresExternalOrderNumber: boolean;
  defaultPaymentMethodId: string | null;
  defaultPaymentMethodName: string;
  commissionRate: number | null;
  isDefault: boolean;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type SalesChannelPayload = {
  channelName: string;
  channelType: string;
  requiresExternalOrderNumber: boolean;
  defaultPaymentMethodId: string | null;
  commissionRate: number | null;
  isDefault: boolean;
  status: RecordStatus;
};

export type ReceiptLayoutType = "58mm" | "80mm" | "a4" | "custom";

export type ReceiptLayoutConfig = {
  showLogo: boolean;
  showBusinessName: boolean;
  showBranchName: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showTaxNumber: boolean;
  showCashier: boolean;
  showCustomer: boolean;
  showUnitPrice: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showPaymentMethod: boolean;
  showQrCode: boolean;
  fontSize: "small" | "medium" | "large";
  alignment: "left" | "center";
  spacing: "compact" | "normal" | "relaxed";
  footerMessage: string;
  termsText: string;
};

export type ReceiptLayout = {
  id: string;
  businessId: string;
  branchId: string | null;
  branchName: string | null;
  layoutName: string;
  receiptType: ReceiptLayoutType;
  printerType: string | null;
  counterId: string | null;
  isDefault: boolean;
  status: RecordStatus;
  layoutConfig: ReceiptLayoutConfig;
  createdAt: string;
  updatedAt: string;
};

export type ReceiptLayoutPayload = {
  branchId: string | null;
  layoutName: string;
  receiptType: ReceiptLayoutType;
  printerType: string | null;
  counterId: string | null;
  isDefault: boolean;
  status: RecordStatus;
  layoutConfig: ReceiptLayoutConfig;
};

export type ReceiptLayoutPreview = {
  previewHtml: string | null;
  previewText: string | null;
};
