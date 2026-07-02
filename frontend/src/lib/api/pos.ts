import { ApiError, apiRequest } from "@/lib/api/client";
import {
  type BackendDocumentChargePayload,
  parseDocumentCharges,
  toBackendDocumentChargePayload,
} from "@/lib/api/document-charges";
import type { ProductCategory, Unit } from "@/types/master-data";
import type {
  CartDiscountType,
  CartItem,
  CheckoutPayload,
  CheckoutResponse,
  HeldSale,
  HeldSaleResumeData,
  HeldSaleStatus,
  HoldSalePayload,
  PaymentInput,
  POSLookupParams,
  POSProduct,
  POSProductFilters,
  POSProductVariant,
  POSReferenceData,
  SaleReceipt,
} from "@/types/pos";
import {
  ITEM_STRUCTURES,
  type ItemStructure,
  PRODUCT_TYPES,
  type ProductType,
} from "@/types/product";
import type {
  PaymentMethod,
  ReceiptLayout,
  ReceiptLayoutConfig,
  ReceiptLayoutType,
  RecordStatus,
  SalesChannel,
  TaxRate,
} from "@/types/settings";

type BackendPOSProductVariant = {
  id?: string;
  product_id?: string;
  variant_name?: string;
  sku?: string | null;
  barcode?: string | null;
  sale_price?: number;
  current_stock_quantity?: number | null;
  current_quantity?: number | null;
  available_stock_quantity?: number | null;
  available_quantity?: number | null;
  image_url?: string | null;
  image_file_id?: string | null;
  status?: string;
};

type BackendPOSProduct = {
  id?: string;
  product_name?: string;
  product_code?: string;
  sku?: string | null;
  barcode?: string | null;
  category_id?: string | null;
  category?: string | { id?: string; category_name?: string } | null;
  category_name?: string;
  unit_id?: string | null;
  unit?: string | { unit_name?: string; symbol?: string } | null;
  unit_name?: string;
  tax_rate_id?: string | null;
  tax_rate?: string | { tax_name?: string; rate_percentage?: number } | null;
  tax_rate_name?: string | null;
  tax_rate_percentage?: number;
  product_type?: string;
  item_structure?: string;
  sale_price?: number;
  is_stock_tracked?: boolean;
  current_stock_quantity?: number | null;
  current_quantity?: number | null;
  available_stock_quantity?: number | null;
  available_quantity?: number | null;
  image_url?: string | null;
  image_file_id?: string | null;
  is_pos_visible?: boolean;
  variants?: unknown;
  status?: string;
};

type BackendPaymentPayload = {
  payment_method_id: string;
  amount: number;
  reference_number: string | null;
};

type BackendPOSPaymentMethod = {
  id?: string;
  business_id?: string;
  method_name?: string;
  method_type?: string;
  status?: string;
  show_in_pos?: boolean;
  allow_split_payment?: boolean;
  requires_reference?: boolean;
  is_default?: boolean;
  show_in_bakery_orders?: boolean;
  show_in_purchasing?: boolean;
  show_in_expenses?: boolean;
  show_in_dashboard_collection?: boolean;
  default_payment_account_id?: string | null;
  default_payment_account_name?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  created_at?: string;
  updated_at?: string;
};

type BackendPOSProductCategory = {
  id?: string;
  business_id?: string;
  parent_category_id?: string | null;
  category_name?: string;
  category_code?: string;
  description?: string;
  image_url?: string | null;
  allowed_product_types?: unknown;
  sort_order?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendPOSUnit = {
  id?: string;
  business_id?: string | null;
  unit_category_id?: string;
  unit_category_name?: string;
  unit_name?: string;
  symbol?: string;
  base_unit_id?: string | null;
  conversion_factor?: number;
  decimal_precision?: number;
  is_system_default?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendPOSTaxRate = {
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

type BackendPOSSalesChannel = {
  id?: string;
  business_id?: string;
  channel_name?: string;
  channel_type?: string;
  requires_external_order_number?: boolean;
  default_payment_method_id?: string | null;
  default_payment_method_name?: string;
  commission_rate?: number | null;
  is_default?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendPOSReceiptLayout = {
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

type BackendPOSReferenceData = {
  product_categories?: unknown;
  units?: unknown;
  tax_rates?: unknown;
  sales_channels?: unknown;
  receipt_layouts?: unknown;
};

type BackendCheckoutPayload = {
  branch_id: string;
  customer_id: string | null;
  items: {
    product_id: string;
    product_variant_id: string | null;
    quantity: number;
    unit_price: number;
    discount_type: string | null;
    discount_value: number | null;
  }[];
  sale_discount_type: string | null;
  sale_discount_value: number | null;
  payments: BackendPaymentPayload[];
  charges: BackendDocumentChargePayload[];
  sales_channel_id: string | null;
  external_order_number: string | null;
  notes: string | null;
};

type BackendReceiptLine = {
  name?: string;
  item_name?: string;
  item_name_snapshot?: string;
  product_name?: string;
  product_name_snapshot?: string;
  product_variant_name?: string | null;
  product_variant_name_snapshot?: string | null;
  variant_name?: string | null;
  quantity?: number;
  unit_price?: number;
  line_total?: number;
};

type BackendReceipt = {
  business_name?: string;
  branch_name?: string;
  sale_id?: string;
  sale_number?: string;
  accounting_journal_entry_id?: string | null;
  cashier_name?: string;
  sold_at?: string;
  items?: unknown;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  charge_amount?: number;
  charge_tax_amount?: number;
  charges?: unknown;
  total?: number;
  payments?: unknown;
  paid_amount?: number;
  change_amount?: number;
  balance_amount?: number;
  balance_due?: number;
};

type BackendCheckoutResponse = {
  sale?: {
    id?: string;
    sale_number?: string;
    accounting_journal_entry_id?: string | null;
  };
  receipt?: unknown;
};

type BackendHeldSaleItem = {
  cart_item_id?: string;
  product_id?: string;
  product_variant_id?: string | null;
  product_name?: string;
  variant_name?: string | null;
  sku?: string | null;
  image_url?: string | null;
  image_file_id?: string | null;
  product_image_url?: string | null;
  product_image_file_id?: string | null;
  variant_image_url?: string | null;
  variant_image_file_id?: string | null;
  quantity?: number;
  unit_price?: number;
  discount_type?: string | null;
  discount_value?: number | null;
  tax_rate_percentage?: number;
  tax_rate_name?: string | null;
  line_subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  line_total?: number;
};

type BackendHeldSale = {
  id?: string;
  hold_number?: string;
  held_sale_number?: string;
  branch_id?: string;
  customer_id?: string | null;
  customer_name?: string | null;
  item_count?: number;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  charge_amount?: number;
  charge_tax_amount?: number;
  total?: number;
  estimated_subtotal?: number;
  estimated_discount_amount?: number;
  estimated_tax_amount?: number;
  estimated_total?: number;
  sale_discount_type?: string | null;
  sale_discount_value?: number | null;
  charges?: unknown;
  status?: string;
  notes?: string | null;
  held_at?: string;
  created_at?: string;
  updated_at?: string;
  items?: unknown;
};

type BackendHoldSalePayload = {
  branch_id: string;
  customer_id: string | null;
  items: {
    product_id: string;
    product_variant_id: string | null;
    product_name: string;
    variant_name: string | null;
    sku: string | null;
    quantity: number;
    unit_price: number;
    discount_type: string | null;
    discount_value: number | null;
    tax_rate_percentage: number;
    tax_rate_name: string | null;
  }[];
  sale_discount_type: string | null;
  sale_discount_value: number | null;
  charges: BackendDocumentChargePayload[];
  estimated_subtotal: number;
  estimated_discount_amount: number;
  estimated_tax_amount: number;
  estimated_total: number;
  notes: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requiredString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function requiredNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function optionalBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isRecordStatus(value: unknown): value is RecordStatus {
  return value === "active" || value === "inactive";
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

function booleanReceiptConfigField(
  value: Record<string, unknown>,
  key: ReceiptLayoutBooleanConfigKey,
): boolean {
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
    showLogo: booleanReceiptConfigField(value, "showLogo"),
    showBusinessName: booleanReceiptConfigField(value, "showBusinessName"),
    showBranchName: booleanReceiptConfigField(value, "showBranchName"),
    showAddress: booleanReceiptConfigField(value, "showAddress"),
    showPhone: booleanReceiptConfigField(value, "showPhone"),
    showTaxNumber: booleanReceiptConfigField(value, "showTaxNumber"),
    showCashier: booleanReceiptConfigField(value, "showCashier"),
    showCustomer: booleanReceiptConfigField(value, "showCustomer"),
    showUnitPrice: booleanReceiptConfigField(value, "showUnitPrice"),
    showDiscount: booleanReceiptConfigField(value, "showDiscount"),
    showTax: booleanReceiptConfigField(value, "showTax"),
    showPaymentMethod: booleanReceiptConfigField(value, "showPaymentMethod"),
    showQrCode: booleanReceiptConfigField(value, "showQrCode"),
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

function isProductType(value: unknown): value is ProductType {
  return PRODUCT_TYPES.includes(value as ProductType);
}

function parseAllowedProductTypes(value: unknown): ProductType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isProductType);
}

function isItemStructure(value: unknown): value is ItemStructure {
  return ITEM_STRUCTURES.includes(value as ItemStructure);
}

function isCartDiscountType(value: unknown): value is CartDiscountType {
  return value === "fixed" || value === "percentage";
}

function isHeldSaleStatus(value: unknown): value is HeldSaleStatus {
  return value === "held" || value === "resumed" || value === "cancelled";
}

function parseVariant(value: unknown): POSProductVariant {
  if (!isObject(value)) {
    throw new Error("Backend POS variant payload is invalid.");
  }

  const variant = value as BackendPOSProductVariant;

  return {
    id: requiredString(variant.id),
    productId: requiredString(variant.product_id),
    variantName: requiredString(variant.variant_name, "Variant"),
    sku: optionalString(variant.sku),
    barcode: optionalString(variant.barcode),
    salePrice: requiredNumber(variant.sale_price),
    currentStockQuantity: optionalNumber(
      variant.current_stock_quantity ?? variant.current_quantity,
    ),
    availableStockQuantity: optionalNumber(
      variant.available_stock_quantity ?? variant.available_quantity,
    ),
    imageUrl: optionalString(variant.image_url),
    imageFileId: optionalString(variant.image_file_id),
    status: isRecordStatus(variant.status) ? variant.status : "active",
  };
}

function getCategoryName(product: BackendPOSProduct): string {
  if (typeof product.category_name === "string") {
    return product.category_name;
  }

  if (typeof product.category === "string") {
    return product.category;
  }

  if (isObject(product.category) && typeof product.category.category_name === "string") {
    return product.category.category_name;
  }

  return "Uncategorized";
}

function getCategoryId(product: BackendPOSProduct): string | null {
  if (typeof product.category_id === "string") {
    return product.category_id;
  }

  if (isObject(product.category) && typeof product.category.id === "string") {
    return product.category.id;
  }

  return null;
}

function getUnitName(product: BackendPOSProduct): string {
  if (typeof product.unit_name === "string") {
    return product.unit_name;
  }

  if (typeof product.unit === "string") {
    return product.unit;
  }

  if (isObject(product.unit)) {
    const unitName = typeof product.unit.unit_name === "string" ? product.unit.unit_name : "";
    const symbol = typeof product.unit.symbol === "string" ? product.unit.symbol : "";
    return symbol ? `${unitName} (${symbol})` : unitName;
  }

  return "Unit";
}

function getTaxRateName(product: BackendPOSProduct): string | null {
  if (typeof product.tax_rate_name === "string") {
    return product.tax_rate_name;
  }

  if (typeof product.tax_rate === "string") {
    return product.tax_rate;
  }

  if (isObject(product.tax_rate) && typeof product.tax_rate.tax_name === "string") {
    return product.tax_rate.tax_name;
  }

  return null;
}

function getTaxRatePercentage(product: BackendPOSProduct): number {
  if (typeof product.tax_rate_percentage === "number") {
    return product.tax_rate_percentage;
  }

  if (isObject(product.tax_rate) && typeof product.tax_rate.rate_percentage === "number") {
    return product.tax_rate.rate_percentage;
  }

  return 0;
}

function parseProduct(value: unknown): POSProduct {
  if (!isObject(value)) {
    throw new Error("Backend POS product payload is invalid.");
  }

  const product = value as BackendPOSProduct;
  const variants = Array.isArray(product.variants) ? product.variants.map(parseVariant) : [];

  return {
    id: requiredString(product.id),
    productName: requiredString(product.product_name, "Product"),
    productCode: requiredString(product.product_code),
    sku: optionalString(product.sku),
    barcode: optionalString(product.barcode),
    categoryId: getCategoryId(product),
    categoryName: getCategoryName(product),
    unitId: optionalString(product.unit_id),
    unitName: getUnitName(product),
    taxRateId: optionalString(product.tax_rate_id),
    taxRateName: getTaxRateName(product),
    taxRatePercentage: getTaxRatePercentage(product),
    productType: isProductType(product.product_type) ? product.product_type : "finished_product",
    itemStructure: isItemStructure(product.item_structure) ? product.item_structure : "single",
    salePrice: requiredNumber(product.sale_price),
    isStockTracked: product.is_stock_tracked === true,
    currentStockQuantity: optionalNumber(
      product.current_stock_quantity ?? product.current_quantity,
    ),
    availableStockQuantity: optionalNumber(
      product.available_stock_quantity ?? product.available_quantity,
    ),
    imageUrl: optionalString(product.image_url),
    imageFileId: optionalString(product.image_file_id),
    isPosVisible: product.is_pos_visible !== false,
    variants,
    status: isRecordStatus(product.status) ? product.status : "active",
  };
}

function parseProductList(value: unknown): POSProduct[] {
  if (Array.isArray(value)) {
    return value.map(parseProduct);
  }

  if (isObject(value) && Array.isArray(value.items)) {
    return value.items.map(parseProduct);
  }

  throw new Error("Backend POS products payload is invalid.");
}

function parsePOSPaymentMethod(value: unknown): PaymentMethod {
  if (!isObject(value)) {
    throw new Error("Backend POS payment method payload is invalid.");
  }

  const method = value as BackendPOSPaymentMethod;

  return {
    id: requiredString(method.id),
    businessId: requiredString(method.business_id),
    methodName: requiredString(method.method_name, "Payment method"),
    methodType: requiredString(method.method_type, "other"),
    isDefault: optionalBoolean(method.is_default, false),
    allowSplitPayment: optionalBoolean(method.allow_split_payment, true),
    requiresReference: optionalBoolean(method.requires_reference, false),
    showInPos: optionalBoolean(method.show_in_pos, true),
    showInBakeryOrders: optionalBoolean(method.show_in_bakery_orders, false),
    showInPurchasing: optionalBoolean(method.show_in_purchasing, false),
    showInExpenses: optionalBoolean(method.show_in_expenses, false),
    showInDashboardCollection: optionalBoolean(method.show_in_dashboard_collection, false),
    defaultPaymentAccountId: optionalString(method.default_payment_account_id),
    defaultPaymentAccountName: requiredString(method.default_payment_account_name),
    branchId: optionalString(method.branch_id),
    branchName: optionalString(method.branch_name),
    status: isRecordStatus(method.status) ? method.status : "active",
    createdAt: requiredString(method.created_at),
    updatedAt: requiredString(method.updated_at),
  };
}

function parsePOSPaymentMethodList(value: unknown): PaymentMethod[] {
  if (Array.isArray(value)) {
    return value.map(parsePOSPaymentMethod);
  }

  if (isObject(value) && Array.isArray(value.items)) {
    return value.items.map(parsePOSPaymentMethod);
  }

  if (isObject(value) && Array.isArray(value.data)) {
    return value.data.map(parsePOSPaymentMethod);
  }

  throw new Error("Backend POS payment methods payload is invalid.");
}

function parsePOSProductCategory(value: unknown): ProductCategory {
  if (!isObject(value)) {
    throw new Error("Backend POS product category payload is invalid.");
  }

  const category = value as BackendPOSProductCategory;

  return {
    id: requiredString(category.id),
    businessId: requiredString(category.business_id),
    parentCategoryId: optionalString(category.parent_category_id),
    categoryName: requiredString(category.category_name, "Category"),
    categoryCode: requiredString(category.category_code),
    description: requiredString(category.description),
    imageUrl: requiredString(category.image_url),
    allowedProductTypes: parseAllowedProductTypes(category.allowed_product_types),
    sortOrder: requiredNumber(category.sort_order),
    status: isRecordStatus(category.status) ? category.status : "active",
    createdAt: requiredString(category.created_at),
    updatedAt: requiredString(category.updated_at),
  };
}

function parsePOSUnit(value: unknown): Unit {
  if (!isObject(value)) {
    throw new Error("Backend POS unit payload is invalid.");
  }

  const unit = value as BackendPOSUnit;
  const unitCategoryId = requiredString(unit.unit_category_id);

  return {
    id: requiredString(unit.id),
    businessId: optionalString(unit.business_id),
    unitCategoryId,
    unitCategory: {
      id: unitCategoryId,
      name: requiredString(unit.unit_category_name),
      description: "",
      createdAt: "",
      updatedAt: "",
    },
    unitName: requiredString(unit.unit_name, "Unit"),
    symbol: requiredString(unit.symbol),
    baseUnitId: optionalString(unit.base_unit_id),
    conversionFactor: requiredNumber(unit.conversion_factor, 1),
    decimalPrecision: requiredNumber(unit.decimal_precision),
    isSystemDefault: optionalBoolean(unit.is_system_default, false),
    status: isRecordStatus(unit.status) ? unit.status : "active",
    createdAt: requiredString(unit.created_at),
    updatedAt: requiredString(unit.updated_at),
  };
}

function parsePOSTaxRate(value: unknown): TaxRate {
  if (!isObject(value)) {
    throw new Error("Backend POS tax rate payload is invalid.");
  }

  const taxRate = value as BackendPOSTaxRate;

  return {
    id: requiredString(taxRate.id),
    businessId: requiredString(taxRate.business_id),
    taxName: requiredString(taxRate.tax_name, "Tax rate"),
    taxType: requiredString(taxRate.tax_type),
    ratePercentage: requiredNumber(taxRate.rate_percentage),
    isInclusive: optionalBoolean(taxRate.is_inclusive, false),
    country: requiredString(taxRate.country),
    region: requiredString(taxRate.region),
    isDefault: optionalBoolean(taxRate.is_default, false),
    status: isRecordStatus(taxRate.status) ? taxRate.status : "active",
    createdAt: requiredString(taxRate.created_at),
    updatedAt: requiredString(taxRate.updated_at),
  };
}

function parsePOSSalesChannel(value: unknown): SalesChannel {
  if (!isObject(value)) {
    throw new Error("Backend POS sales channel payload is invalid.");
  }

  const channel = value as BackendPOSSalesChannel;

  return {
    id: requiredString(channel.id),
    businessId: requiredString(channel.business_id),
    channelName: requiredString(channel.channel_name, "Sales channel"),
    channelType: requiredString(channel.channel_type, "other"),
    requiresExternalOrderNumber: optionalBoolean(channel.requires_external_order_number, false),
    defaultPaymentMethodId: optionalString(channel.default_payment_method_id),
    defaultPaymentMethodName: requiredString(channel.default_payment_method_name),
    commissionRate: optionalNumber(channel.commission_rate),
    isDefault: optionalBoolean(channel.is_default, false),
    status: isRecordStatus(channel.status) ? channel.status : "active",
    createdAt: requiredString(channel.created_at),
    updatedAt: requiredString(channel.updated_at),
  };
}

function parsePOSReceiptLayout(value: unknown): ReceiptLayout {
  if (!isObject(value)) {
    throw new Error("Backend POS receipt layout payload is invalid.");
  }

  const layout = value as BackendPOSReceiptLayout;
  const receiptType = isReceiptLayoutType(layout.receipt_type) ? layout.receipt_type : "80mm";

  return {
    id: requiredString(layout.id),
    businessId: requiredString(layout.business_id),
    branchId: optionalString(layout.branch_id),
    branchName: optionalString(layout.branch_name),
    layoutName: requiredString(layout.layout_name, "Receipt layout"),
    receiptType,
    printerType: optionalString(layout.printer_type),
    counterId: optionalString(layout.counter_id),
    isDefault: optionalBoolean(layout.is_default, false),
    status: isRecordStatus(layout.status) ? layout.status : "active",
    layoutConfig: parseReceiptLayoutConfig(layout.layout_config),
    createdAt: requiredString(layout.created_at),
    updatedAt: requiredString(layout.updated_at),
  };
}

function parsePOSReferenceData(value: unknown): POSReferenceData {
  if (!isObject(value)) {
    throw new Error("Backend POS reference data payload is invalid.");
  }

  const reference = value as BackendPOSReferenceData;

  return {
    productCategories: Array.isArray(reference.product_categories)
      ? reference.product_categories.map(parsePOSProductCategory)
      : [],
    units: Array.isArray(reference.units) ? reference.units.map(parsePOSUnit) : [],
    taxRates: Array.isArray(reference.tax_rates)
      ? reference.tax_rates.map(parsePOSTaxRate).filter((taxRate) => taxRate.status === "active")
      : [],
    salesChannels: Array.isArray(reference.sales_channels)
      ? reference.sales_channels.map(parsePOSSalesChannel)
      : [],
    receiptLayouts: Array.isArray(reference.receipt_layouts)
      ? reference.receipt_layouts.map(parsePOSReceiptLayout)
      : [],
  };
}

function parseLookupProduct(value: unknown): {
  product: POSProduct;
  variant: POSProductVariant | null;
} {
  if (isObject(value) && isObject(value.product)) {
    return {
      product: parseProduct(value.product),
      variant: isObject(value.variant) ? parseVariant(value.variant) : null,
    };
  }

  return {
    product: parseProduct(value),
    variant: null,
  };
}

function filterPOSProducts(products: POSProduct[], params: POSProductFilters): POSProduct[] {
  const normalizedSearch = params.search.trim().toLowerCase();

  return products
    .filter((product) => product.status === "active" && product.isPosVisible)
    .filter((product) => params.categoryId === "all" || product.categoryId === params.categoryId)
    .filter((product) => !params.itemStructure || product.itemStructure === params.itemStructure)
    .filter((product) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
        product.productName,
        product.productCode,
        product.sku ?? "",
        product.barcode ?? "",
        product.categoryName,
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    })
    .slice(0, params.limit);
}

function toQueryString(params: Record<string, string | number | boolean | null>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function toBackendCheckoutPayload(payload: CheckoutPayload): BackendCheckoutPayload {
  return {
    branch_id: payload.branchId,
    customer_id: payload.customerId,
    items: payload.items.map((item) => ({
      product_id: item.productId,
      product_variant_id: item.productVariantId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_type: item.discountType,
      discount_value: item.discountValue,
    })),
    sale_discount_type: payload.saleDiscountType,
    sale_discount_value: payload.saleDiscountValue,
    payments: payload.payments.map((payment) => ({
      payment_method_id: payment.paymentMethodId,
      amount: payment.amount,
      reference_number: payment.referenceNumber,
    })),
    charges: payload.charges.map(toBackendDocumentChargePayload),
    sales_channel_id: payload.salesChannelId,
    external_order_number: payload.externalOrderNumber,
    notes: payload.notes,
  };
}

function parsePayment(value: unknown): PaymentInput {
  if (!isObject(value)) {
    throw new Error("Backend receipt payment payload is invalid.");
  }

  return {
    paymentMethodId: requiredString(value.payment_method_id),
    paymentMethodName: requiredString(value.payment_method_name, "Payment"),
    amount: requiredNumber(value.amount),
    referenceNumber: optionalString(value.reference_number),
  };
}

function getReceiptLineName(line: BackendReceiptLine): string {
  const directName =
    optionalString(line.name) ??
    optionalString(line.item_name) ??
    optionalString(line.item_name_snapshot);

  if (directName) {
    return directName;
  }

  const productName =
    optionalString(line.product_name_snapshot) ?? optionalString(line.product_name);
  const variantName =
    optionalString(line.product_variant_name_snapshot) ??
    optionalString(line.product_variant_name) ??
    optionalString(line.variant_name);

  if (productName && variantName) {
    return `${productName} - ${variantName}`;
  }

  return productName ?? variantName ?? "Purchased item";
}

function parseReceipt(value: unknown): SaleReceipt {
  if (!isObject(value)) {
    throw new Error("Backend receipt payload is invalid.");
  }

  const receipt = value as BackendReceipt;
  const lines = Array.isArray(receipt.items) ? receipt.items : [];
  const payments = Array.isArray(receipt.payments) ? receipt.payments : [];
  const total = requiredNumber(receipt.total);
  const paidAmount = requiredNumber(receipt.paid_amount);
  const changeAmount = requiredNumber(receipt.change_amount);
  const balanceDue = Math.max(
    requiredNumber(receipt.balance_due ?? receipt.balance_amount, total - paidAmount),
    0,
  );

  return {
    businessName: requiredString(receipt.business_name, "Business"),
    branchName: requiredString(receipt.branch_name, "Branch"),
    saleId: requiredString(receipt.sale_id),
    saleNumber: requiredString(receipt.sale_number, "Sale"),
    accountingJournalEntryId: optionalString(receipt.accounting_journal_entry_id),
    cashierName: requiredString(receipt.cashier_name, "Cashier"),
    soldAt: requiredString(receipt.sold_at, new Date().toISOString()),
    items: lines.map((line): SaleReceipt["items"][number] => {
      if (!isObject(line)) {
        return { name: "Item", quantity: 1, unitPrice: 0, lineTotal: 0 };
      }

      const receiptLine = line as BackendReceiptLine;
      return {
        name: getReceiptLineName(receiptLine),
        quantity: requiredNumber(receiptLine.quantity, 1),
        unitPrice: requiredNumber(receiptLine.unit_price),
        lineTotal: requiredNumber(receiptLine.line_total),
      };
    }),
    subtotal: requiredNumber(receipt.subtotal),
    discountAmount: requiredNumber(receipt.discount_amount),
    taxAmount: requiredNumber(receipt.tax_amount),
    chargeAmount: requiredNumber(receipt.charge_amount),
    chargeTaxAmount: requiredNumber(receipt.charge_tax_amount),
    charges: parseDocumentCharges(receipt.charges),
    total,
    payments: payments.map(parsePayment),
    paidAmount,
    changeAmount,
    balanceDue,
  };
}

function parseCheckoutResponse(value: unknown): CheckoutResponse {
  if (!isObject(value)) {
    throw new Error("Backend checkout payload is invalid.");
  }

  const response = value as BackendCheckoutResponse;
  const receipt = parseReceipt(response.receipt);

  return {
    sale: {
      id: requiredString(response.sale?.id, receipt.saleId),
      saleNumber: requiredString(response.sale?.sale_number, receipt.saleNumber),
      accountingJournalEntryId: optionalString(response.sale?.accounting_journal_entry_id),
    },
    receipt,
  };
}

function toBackendHoldSalePayload(payload: HoldSalePayload): BackendHoldSalePayload {
  return {
    branch_id: payload.branchId,
    customer_id: payload.customerId,
    items: payload.items.map((item) => ({
      product_id: item.productId,
      product_variant_id: item.productVariantId,
      product_name: item.productName,
      variant_name: item.variantName,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_type: item.discountType,
      discount_value: item.discountValue,
      tax_rate_percentage: item.taxRatePercentage,
      tax_rate_name: item.taxRateName,
    })),
    sale_discount_type: payload.saleDiscountType,
    sale_discount_value: payload.saleDiscountValue,
    charges: payload.charges.map(toBackendDocumentChargePayload),
    estimated_subtotal: payload.totals.subtotal,
    estimated_discount_amount: payload.totals.discountAmount,
    estimated_tax_amount: payload.totals.taxAmount,
    estimated_total: payload.totals.total,
    notes: payload.notes,
  };
}

function parseHeldSale(value: unknown): HeldSale {
  if (!isObject(value)) {
    throw new Error("Backend held sale payload is invalid.");
  }

  const heldSale = value as BackendHeldSale;

  return {
    id: requiredString(heldSale.id),
    holdNumber: requiredString(heldSale.hold_number ?? heldSale.held_sale_number, "Held sale"),
    branchId: requiredString(heldSale.branch_id),
    customerId: optionalString(heldSale.customer_id),
    customerName: optionalString(heldSale.customer_name),
    itemCount: requiredNumber(heldSale.item_count),
    subtotal: requiredNumber(heldSale.subtotal ?? heldSale.estimated_subtotal),
    discountAmount: requiredNumber(heldSale.discount_amount ?? heldSale.estimated_discount_amount),
    taxAmount: requiredNumber(heldSale.tax_amount ?? heldSale.estimated_tax_amount),
    chargeAmount: requiredNumber(heldSale.charge_amount),
    chargeTaxAmount: requiredNumber(heldSale.charge_tax_amount),
    total: requiredNumber(heldSale.total ?? heldSale.estimated_total),
    status: isHeldSaleStatus(heldSale.status) ? heldSale.status : "held",
    notes: optionalString(heldSale.notes),
    heldAt: requiredString(heldSale.held_at ?? heldSale.created_at, new Date().toISOString()),
    updatedAt: requiredString(heldSale.updated_at, new Date().toISOString()),
  };
}

function parseHeldSaleList(value: unknown): HeldSale[] {
  if (Array.isArray(value)) {
    return value.map(parseHeldSale);
  }

  if (isObject(value) && Array.isArray(value.items)) {
    return value.items.map(parseHeldSale);
  }

  throw new Error("Backend held sales payload is invalid.");
}

function parseHeldSaleCartItem(value: unknown): CartItem {
  if (!isObject(value)) {
    throw new Error("Backend held sale item payload is invalid.");
  }

  const item = value as BackendHeldSaleItem;
  const productId = requiredString(item.product_id);
  const productVariantId = optionalString(item.product_variant_id);
  const unitPrice = requiredNumber(item.unit_price);
  const quantity = requiredNumber(item.quantity, 1);

  return {
    cartItemId: requiredString(item.cart_item_id, `${productId}:${productVariantId ?? "base"}`),
    productId,
    productVariantId,
    productName: requiredString(item.product_name, "Product"),
    variantName: optionalString(item.variant_name),
    sku: optionalString(item.sku),
    imageUrl: optionalString(item.variant_image_url ?? item.product_image_url ?? item.image_url),
    imageFileId: optionalString(
      item.variant_image_file_id ?? item.product_image_file_id ?? item.image_file_id,
    ),
    quantity,
    unitPrice,
    discountType: isCartDiscountType(item.discount_type) ? item.discount_type : null,
    discountValue: typeof item.discount_value === "number" ? item.discount_value : null,
    taxRatePercentage: requiredNumber(item.tax_rate_percentage),
    taxRateName: optionalString(item.tax_rate_name),
    lineSubtotal: requiredNumber(item.line_subtotal, quantity * unitPrice),
    discountAmount: requiredNumber(item.discount_amount),
    taxAmount: requiredNumber(item.tax_amount),
    lineTotal: requiredNumber(item.line_total, quantity * unitPrice),
  };
}

function parseHeldSaleResumeData(value: unknown): HeldSaleResumeData {
  if (!isObject(value)) {
    throw new Error("Backend held sale resume payload is invalid.");
  }

  const heldSaleValue = isObject(value.held_sale) ? value.held_sale : value;
  const heldSale = parseHeldSale(heldSaleValue);
  const itemSource = Array.isArray(value.items)
    ? value.items
    : isObject(heldSaleValue) && Array.isArray(heldSaleValue.items)
      ? heldSaleValue.items
      : [];
  const saleDiscountTypeSource = isObject(heldSaleValue)
    ? heldSaleValue.sale_discount_type
    : value.sale_discount_type;
  const chargeSource = isObject(heldSaleValue) ? heldSaleValue.charges : value.charges;

  return {
    heldSale,
    items: itemSource.map(parseHeldSaleCartItem),
    saleDiscountType: isCartDiscountType(saleDiscountTypeSource) ? saleDiscountTypeSource : null,
    saleDiscountValue:
      isObject(heldSaleValue) && typeof heldSaleValue.sale_discount_value === "number"
        ? heldSaleValue.sale_discount_value
        : null,
    charges: parseDocumentCharges(chargeSource),
    customerId: heldSale.customerId,
  };
}

export async function getPOSProducts(params: POSProductFilters): Promise<POSProduct[]> {
  const searchParams = new URLSearchParams();

  if (params.itemStructure) {
    searchParams.set("item_structure", params.itemStructure);
  }

  const query = searchParams.toString();
  const response = await apiRequest<POSProduct[]>(
    `/api/v1/products/pos${query ? `?${query}` : ""}`,
    {
      authMode: "appwrite",
      parse: parseProductList,
    },
  );

  return filterPOSProducts(response.data, params);
}

export async function lookupPOSProduct(params: POSLookupParams): Promise<POSProduct | null> {
  try {
    const response = await apiRequest<{ product: POSProduct; variant: POSProductVariant | null }>(
      `/api/v1/products/lookup${toQueryString({ barcode: params.query })}`,
      {
        authMode: "appwrite",
        parse: parseLookupProduct,
      },
    );

    if (response.data.variant) {
      return {
        ...response.data.product,
        variants: [response.data.variant],
      };
    }

    return response.data.product;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function lookupPOSProductByCode(params: POSLookupParams): Promise<POSProduct | null> {
  try {
    const response = await apiRequest<{ product: POSProduct; variant: POSProductVariant | null }>(
      `/api/v1/products/lookup${toQueryString({ product_code: params.query })}`,
      {
        authMode: "appwrite",
        parse: parseLookupProduct,
      },
    );

    return response.data.product;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function checkoutPOS(payload: CheckoutPayload): Promise<CheckoutResponse> {
  const response = await apiRequest<CheckoutResponse, BackendCheckoutPayload>(
    "/api/v1/pos/checkout",
    {
      method: "POST",
      authMode: "appwrite",
      body: toBackendCheckoutPayload(payload),
      parse: parseCheckoutResponse,
    },
  );

  return response.data;
}

export async function holdSalePOS(payload: HoldSalePayload): Promise<HeldSale> {
  const response = await apiRequest<HeldSale, BackendHoldSalePayload>("/api/v1/pos/held-sales", {
    method: "POST",
    authMode: "appwrite",
    body: toBackendHoldSalePayload(payload),
    parse: parseHeldSale,
  });

  return response.data;
}

export async function getHeldSales(): Promise<HeldSale[]> {
  const response = await apiRequest<HeldSale[]>("/api/v1/pos/held-sales", {
    authMode: "appwrite",
    parse: parseHeldSaleList,
  });

  return response.data;
}

export async function getHeldSaleById(id: string): Promise<HeldSaleResumeData> {
  const response = await apiRequest<HeldSaleResumeData>(`/api/v1/pos/held-sales/${id}`, {
    authMode: "appwrite",
    parse: parseHeldSaleResumeData,
  });

  return response.data;
}

export async function resumeHeldSale(id: string): Promise<HeldSaleResumeData> {
  const response = await apiRequest<HeldSaleResumeData>(`/api/v1/pos/held-sales/${id}/resume`, {
    method: "POST",
    authMode: "appwrite",
    parse: parseHeldSaleResumeData,
  });

  return response.data;
}

export async function cancelHeldSale(id: string): Promise<HeldSale> {
  const response = await apiRequest<HeldSale>(`/api/v1/pos/held-sales/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: parseHeldSale,
  });

  return response.data;
}

export async function getSaleReceipt(saleId: string): Promise<SaleReceipt> {
  const response = await apiRequest<SaleReceipt>(`/api/v1/pos/sales/${saleId}/receipt`, {
    authMode: "appwrite",
    parse: parseReceipt,
  });

  return response.data;
}

export async function getPOSPaymentMethods(branchId: string | null): Promise<PaymentMethod[]> {
  const response = await apiRequest<PaymentMethod[]>(
    `/api/v1/pos/payment-methods${toQueryString({ branch_id: branchId })}`,
    {
      authMode: "appwrite",
      parse: parsePOSPaymentMethodList,
    },
  );

  return response.data;
}

export async function getPOSReferenceData(branchId: string | null): Promise<POSReferenceData> {
  const response = await apiRequest<POSReferenceData>(
    `/api/v1/pos/reference-data${toQueryString({ branch_id: branchId })}`,
    {
      authMode: "appwrite",
      parse: parsePOSReferenceData,
    },
  );

  return response.data;
}
