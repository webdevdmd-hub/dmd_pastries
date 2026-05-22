import { ApiError, apiRequest } from "@/lib/api/client";
import { getProductCategories } from "@/lib/api/master-data";
import { getPaymentMethods as getSettingsPaymentMethods } from "@/lib/api/settings-data";
import type { ProductCategory } from "@/types/master-data";
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
  SaleReceipt,
} from "@/types/pos";
import type { ProductType } from "@/types/product";
import type { PaymentMethod, RecordStatus } from "@/types/settings";

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
  unit?: string | { unit_name?: string; symbol?: string } | null;
  unit_name?: string;
  tax_rate?: string | { tax_name?: string; rate_percentage?: number } | null;
  tax_rate_name?: string | null;
  tax_rate_percentage?: number;
  product_type?: string;
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
  payment_method_name: string;
  amount: number;
  reference_number: string | null;
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
  cashier_name?: string;
  sold_at?: string;
  items?: unknown;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
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
  total?: number;
  estimated_subtotal?: number;
  estimated_discount_amount?: number;
  estimated_tax_amount?: number;
  estimated_total?: number;
  sale_discount_type?: string | null;
  sale_discount_value?: number | null;
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

function isRecordStatus(value: unknown): value is RecordStatus {
  return value === "active" || value === "inactive";
}

function isProductType(value: unknown): value is ProductType {
  return (
    value === "ready_to_sell" ||
    value === "made_to_order" ||
    value === "manufactured" ||
    value === "retail" ||
    value === "service"
  );
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
    unitName: getUnitName(product),
    taxRateName: getTaxRateName(product),
    taxRatePercentage: getTaxRatePercentage(product),
    productType: isProductType(product.product_type) ? product.product_type : "ready_to_sell",
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
      payment_method_name: payment.paymentMethodName,
      amount: payment.amount,
      reference_number: payment.referenceNumber,
    })),
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

  return {
    heldSale,
    items: itemSource.map(parseHeldSaleCartItem),
    saleDiscountType: isCartDiscountType(saleDiscountTypeSource) ? saleDiscountTypeSource : null,
    saleDiscountValue:
      isObject(heldSaleValue) && typeof heldSaleValue.sale_discount_value === "number"
        ? heldSaleValue.sale_discount_value
        : null,
    customerId: heldSale.customerId,
  };
}

export async function getPOSProducts(params: POSProductFilters): Promise<POSProduct[]> {
  const response = await apiRequest<POSProduct[]>("/api/v1/products/pos", {
    authMode: "appwrite",
    parse: parseProductList,
  });

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

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return getSettingsPaymentMethods();
}

export async function getPOSCategories(): Promise<ProductCategory[]> {
  return getProductCategories();
}
