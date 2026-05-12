import { apiRequest } from "@/lib/api/client";
import type {
  CreatePurchaseInvoicePayload,
  CreatePurchaseOrderPayload,
  PurchaseInvoice,
  PurchaseInvoiceItem,
  PurchaseInvoiceStatus,
  PurchaseItemLinePayload,
  PurchaseItemType,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchasePaymentStatus,
  PurchaseReceipt,
  PurchaseReceiptItem,
  PurchaseReceiptStatus,
  PurchasingBranchOption,
  PurchasingFilters,
  PurchasingIngredientOption,
  PurchasingProductOption,
  PurchasingSummary,
  PurchasingSupplierOption,
  PurchasingTaxRateOption,
  PurchasingUnitOption,
  ReceivePurchasePayload,
  UpdatePurchaseInvoicePayload,
  UpdatePurchaseOrderPayload,
  UpdatePurchaseOrderStatusPayload,
} from "@/types/purchasing";

type BackendLinePayload = {
  item_type: PurchaseItemType;
  product_id?: string | null;
  ingredient_id?: string | null;
  packaging_item_id?: string | null;
  quantity?: number;
  quantity_ordered?: number;
  quantity_received?: number;
  unit_id: string;
  unit_cost?: number;
  discount_amount?: number;
  tax_rate_id?: string | null;
  expiry_date?: string | null;
  batch_number?: string | null;
};

type BackendPurchaseOrderPayload = {
  branch_id?: string;
  supplier_id?: string;
  order_date?: string;
  expected_delivery_date?: string | null;
  items?: BackendLinePayload[];
  notes?: string | null;
};

type BackendPurchaseInvoicePayload = {
  branch_id?: string;
  supplier_id?: string;
  purchase_order_id?: string | null;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string | null;
  items?: BackendLinePayload[];
  notes?: string | null;
};

type BackendReceivePayload = {
  branch_id: string;
  supplier_id: string;
  purchase_order_id: string | null;
  purchase_invoice_id: string | null;
  received_date: string;
  items: BackendLinePayload[];
  notes: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) {
    return value.map(parser);
  }

  if (isObject(value)) {
    const keys = [
      "items",
      "orders",
      "invoices",
      "receipts",
      "data",
      "suppliers",
      "products",
      "ingredients",
    ];
    for (const key of keys) {
      const nextValue = value[key];
      if (Array.isArray(nextValue)) {
        return nextValue.map(parser);
      }
    }
  }

  throw new Error("Backend list payload is invalid.");
}

function toQueryString(params: Record<string, string | number | null | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function isItemType(value: unknown): value is PurchaseItemType {
  return value === "product" || value === "ingredient" || value === "packaging";
}

function isOrderStatus(value: unknown): value is PurchaseOrderStatus {
  return (
    value === "draft" ||
    value === "ordered" ||
    value === "partially_received" ||
    value === "received" ||
    value === "cancelled"
  );
}

function isInvoiceStatus(value: unknown): value is PurchaseInvoiceStatus {
  return value === "draft" || value === "posted" || value === "cancelled";
}

function isPaymentStatus(value: unknown): value is PurchasePaymentStatus {
  return value === "unpaid" || value === "partial" || value === "paid" || value === "overdue";
}

function isReceiptStatus(value: unknown): value is PurchaseReceiptStatus {
  return value === "draft" || value === "posted" || value === "cancelled";
}

function branchStatus(value: unknown): "active" | "inactive" {
  return value === "inactive" ? "inactive" : "active";
}

function parseOrderItem(value: unknown): PurchaseOrderItem {
  if (!isObject(value)) {
    throw new Error("Backend purchase order item payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    itemType: isItemType(value.item_type) ? value.item_type : "product",
    productId: optionalString(value.product_id),
    ingredientId: optionalString(value.ingredient_id),
    packagingItemId: optionalString(value.packaging_item_id),
    itemNameSnapshot: stringValue(value.item_name_snapshot, "Purchase item"),
    quantityOrdered: numberValue(value.quantity_ordered),
    quantityReceived: numberValue(value.quantity_received),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
    unitCost: numberValue(value.unit_cost),
    discountAmount: numberValue(value.discount_amount),
    taxRateId: optionalString(value.tax_rate_id),
    taxAmount: numberValue(value.tax_amount),
    lineTotal: numberValue(value.line_total),
  };
}

function parseInvoiceItem(value: unknown): PurchaseInvoiceItem {
  if (!isObject(value)) {
    throw new Error("Backend purchase invoice item payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    itemType: isItemType(value.item_type) ? value.item_type : "product",
    productId: optionalString(value.product_id),
    ingredientId: optionalString(value.ingredient_id),
    packagingItemId: optionalString(value.packaging_item_id),
    itemNameSnapshot: stringValue(value.item_name_snapshot, "Purchase item"),
    quantity: numberValue(value.quantity),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
    unitCost: numberValue(value.unit_cost),
    discountAmount: numberValue(value.discount_amount),
    taxRateId: optionalString(value.tax_rate_id),
    taxAmount: numberValue(value.tax_amount),
    lineTotal: numberValue(value.line_total),
    expiryDate: optionalString(value.expiry_date),
    batchNumber: optionalString(value.batch_number),
  };
}

function parseReceiptItem(value: unknown): PurchaseReceiptItem {
  if (!isObject(value)) {
    throw new Error("Backend purchase receipt item payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    itemType: isItemType(value.item_type) ? value.item_type : "product",
    productId: optionalString(value.product_id),
    ingredientId: optionalString(value.ingredient_id),
    packagingItemId: optionalString(value.packaging_item_id),
    inventoryItemId: optionalString(value.inventory_item_id),
    itemNameSnapshot: stringValue(value.item_name_snapshot, "Receipt item"),
    quantityReceived: numberValue(value.quantity_received),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
    expiryDate: optionalString(value.expiry_date),
    batchNumber: optionalString(value.batch_number),
    stockMovementId: optionalString(value.stock_movement_id),
  };
}

function parseOrder(value: unknown): PurchaseOrder {
  if (!isObject(value)) {
    throw new Error("Backend purchase order payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    supplierId: stringValue(value.supplier_id),
    supplierName: stringValue(value.supplier_name, "Supplier"),
    purchaseOrderNumber: stringValue(value.purchase_order_number, "PO"),
    orderDate: stringValue(value.order_date),
    expectedDeliveryDate: optionalString(value.expected_delivery_date),
    status: isOrderStatus(value.status) ? value.status : "draft",
    subtotalAmount: numberValue(value.subtotal_amount),
    taxAmount: numberValue(value.tax_amount),
    discountAmount: numberValue(value.discount_amount),
    totalAmount: numberValue(value.total_amount),
    notes: optionalString(value.notes),
    createdByUserName: stringValue(value.created_by_user_name, "User"),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
    items: Array.isArray(value.items) ? value.items.map(parseOrderItem) : [],
  };
}

function parseInvoice(value: unknown): PurchaseInvoice {
  if (!isObject(value)) {
    throw new Error("Backend purchase invoice payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    supplierId: stringValue(value.supplier_id),
    supplierName: stringValue(value.supplier_name, "Supplier"),
    purchaseOrderId: optionalString(value.purchase_order_id),
    invoiceNumber: stringValue(value.invoice_number, "Invoice"),
    invoiceDate: stringValue(value.invoice_date),
    dueDate: optionalString(value.due_date),
    status: isInvoiceStatus(value.status) ? value.status : "draft",
    paymentStatus: isPaymentStatus(value.payment_status) ? value.payment_status : "unpaid",
    subtotalAmount: numberValue(value.subtotal_amount),
    taxAmount: numberValue(value.tax_amount),
    discountAmount: numberValue(value.discount_amount),
    totalAmount: numberValue(value.total_amount),
    paidAmount: numberValue(value.paid_amount),
    balanceAmount: numberValue(value.balance_amount),
    notes: optionalString(value.notes),
    createdByUserName: stringValue(value.created_by_user_name, "User"),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
    items: Array.isArray(value.items) ? value.items.map(parseInvoiceItem) : [],
  };
}

function parseReceipt(value: unknown): PurchaseReceipt {
  if (!isObject(value)) {
    throw new Error("Backend purchase receipt payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    supplierId: stringValue(value.supplier_id),
    supplierName: stringValue(value.supplier_name, "Supplier"),
    purchaseOrderId: optionalString(value.purchase_order_id),
    purchaseInvoiceId: optionalString(value.purchase_invoice_id),
    receiptNumber: stringValue(value.receipt_number, "Receipt"),
    receivedDate: stringValue(value.received_date),
    status: isReceiptStatus(value.status) ? value.status : "draft",
    receivedByUserName: stringValue(value.received_by_user_name, "User"),
    notes: optionalString(value.notes),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
    items: Array.isArray(value.items) ? value.items.map(parseReceiptItem) : [],
  };
}

function parseSummary(value: unknown): PurchasingSummary {
  if (!isObject(value)) {
    throw new Error("Backend purchasing summary payload is invalid.");
  }

  return {
    totalPurchaseOrders: numberValue(value.total_purchase_orders),
    openPurchaseOrders: numberValue(value.open_purchase_orders),
    totalInvoices: numberValue(value.total_invoices),
    unpaidInvoiceAmount: numberValue(value.unpaid_invoice_amount),
    purchasesThisMonth: numberValue(value.purchases_this_month),
    receivedThisMonth: numberValue(value.received_this_month),
  };
}

function parseSupplier(value: unknown): PurchasingSupplierOption {
  if (!isObject(value)) {
    throw new Error("Backend supplier lookup payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    supplierName: stringValue(value.supplier_name, "Supplier"),
  };
}

function parseProduct(value: unknown): PurchasingProductOption {
  if (!isObject(value)) {
    throw new Error("Backend product payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    productName: stringValue(value.product_name, "Product"),
    productCode: stringValue(value.product_code),
  };
}

function parseIngredient(value: unknown): PurchasingIngredientOption {
  if (!isObject(value)) {
    throw new Error("Backend ingredient payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    ingredientName: stringValue(value.ingredient_name, "Ingredient"),
    ingredientCode: stringValue(value.ingredient_code),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
    costPerUnit: numberValue(value.cost_per_unit),
  };
}

function parseUnit(value: unknown): PurchasingUnitOption {
  if (!isObject(value)) {
    throw new Error("Backend unit payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    unitName: stringValue(value.unit_name, "Unit"),
    symbol: stringValue(value.symbol),
  };
}

function parseTaxRate(value: unknown): PurchasingTaxRateOption {
  if (!isObject(value)) {
    throw new Error("Backend tax rate payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    taxName: stringValue(value.tax_name, "Tax"),
    taxPercentage: numberValue(value.tax_percentage),
  };
}

function parseBranch(value: unknown): PurchasingBranchOption {
  if (!isObject(value)) {
    throw new Error("Backend branch payload is invalid.");
  }

  const branchName = stringValue(value.branch_name, stringValue(value.name, "Branch"));
  const branchCode = stringValue(value.branch_code, stringValue(value.code));

  return {
    id: stringValue(value.id),
    branchName: branchCode ? `${branchName} (${branchCode})` : branchName,
    status: branchStatus(value.status),
  };
}

function linePayload(
  line: PurchaseItemLinePayload,
  quantityKey: "quantity" | "quantity_ordered" | "quantity_received",
): BackendLinePayload {
  const payload: BackendLinePayload = {
    item_type: line.itemType,
    product_id: line.productId,
    ingredient_id: line.ingredientId,
    packaging_item_id: line.packagingItemId,
    [quantityKey]: line.quantity,
    unit_id: line.unitId,
    unit_cost: line.unitCost,
    discount_amount: line.discountAmount,
    tax_rate_id: line.taxRateId,
  };

  if (line.expiryDate !== undefined) {
    payload.expiry_date = line.expiryDate;
  }

  if (line.batchNumber !== undefined) {
    payload.batch_number = line.batchNumber;
  }

  return payload;
}

function orderPayload(
  payload: CreatePurchaseOrderPayload | UpdatePurchaseOrderPayload,
): BackendPurchaseOrderPayload {
  const nextPayload: BackendPurchaseOrderPayload = {};

  if (payload.branchId !== undefined) nextPayload.branch_id = payload.branchId;
  if (payload.supplierId !== undefined) nextPayload.supplier_id = payload.supplierId;
  if (payload.orderDate !== undefined) nextPayload.order_date = payload.orderDate;
  if (payload.expectedDeliveryDate !== undefined) {
    nextPayload.expected_delivery_date = payload.expectedDeliveryDate;
  }
  if (payload.items !== undefined) {
    nextPayload.items = payload.items.map((line) => linePayload(line, "quantity_ordered"));
  }
  if (payload.notes !== undefined) nextPayload.notes = payload.notes;

  return nextPayload;
}

function invoicePayload(
  payload: CreatePurchaseInvoicePayload | UpdatePurchaseInvoicePayload,
): BackendPurchaseInvoicePayload {
  const nextPayload: BackendPurchaseInvoicePayload = {};

  if (payload.branchId !== undefined) nextPayload.branch_id = payload.branchId;
  if (payload.supplierId !== undefined) nextPayload.supplier_id = payload.supplierId;
  if (payload.purchaseOrderId !== undefined) {
    nextPayload.purchase_order_id = payload.purchaseOrderId;
  }
  if (payload.invoiceNumber !== undefined) nextPayload.invoice_number = payload.invoiceNumber;
  if (payload.invoiceDate !== undefined) nextPayload.invoice_date = payload.invoiceDate;
  if (payload.dueDate !== undefined) nextPayload.due_date = payload.dueDate;
  if (payload.items !== undefined) {
    nextPayload.items = payload.items.map((line) => linePayload(line, "quantity"));
  }
  if (payload.notes !== undefined) nextPayload.notes = payload.notes;

  return nextPayload;
}

function receivePayload(payload: ReceivePurchasePayload): BackendReceivePayload {
  return {
    branch_id: payload.branchId,
    supplier_id: payload.supplierId,
    purchase_order_id: payload.purchaseOrderId,
    purchase_invoice_id: payload.purchaseInvoiceId,
    received_date: payload.receivedDate,
    items: payload.items.map((line) => linePayload(line, "quantity_received")),
    notes: payload.notes,
  };
}

export async function getPurchasingSummary(): Promise<PurchasingSummary> {
  const response = await apiRequest<PurchasingSummary>("/api/v1/purchasing/summary", {
    authMode: "appwrite",
    parse: parseSummary,
  });

  return response.data;
}

export async function getPurchaseOrders(params: PurchasingFilters): Promise<PurchaseOrder[]> {
  const response = await apiRequest<PurchaseOrder[]>(
    `/api/v1/purchasing/orders${toQueryString({
      search: params.search,
      supplier_id: params.supplierId,
      branch_id: params.branchId,
      status: params.status,
      date_from: params.dateFrom,
      date_to: params.dateTo,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseOrder),
    },
  );

  return response.data;
}

export async function createPurchaseOrder(
  payload: CreatePurchaseOrderPayload,
): Promise<PurchaseOrder> {
  const response = await apiRequest<PurchaseOrder, BackendPurchaseOrderPayload>(
    "/api/v1/purchasing/orders",
    {
      method: "POST",
      authMode: "appwrite",
      body: orderPayload(payload),
      parse: parseOrder,
    },
  );

  return response.data;
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder> {
  const response = await apiRequest<PurchaseOrder>(`/api/v1/purchasing/orders/${id}`, {
    authMode: "appwrite",
    parse: parseOrder,
  });

  return response.data;
}

export async function updatePurchaseOrder(
  id: string,
  payload: UpdatePurchaseOrderPayload,
): Promise<PurchaseOrder> {
  const response = await apiRequest<PurchaseOrder, BackendPurchaseOrderPayload>(
    `/api/v1/purchasing/orders/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: orderPayload(payload),
      parse: parseOrder,
    },
  );

  return response.data;
}

export async function updatePurchaseOrderStatus(
  id: string,
  payload: UpdatePurchaseOrderStatusPayload,
): Promise<PurchaseOrder> {
  const response = await apiRequest<PurchaseOrder, { status: PurchaseOrderStatus }>(
    `/api/v1/purchasing/orders/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parseOrder,
    },
  );

  return response.data;
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/purchasing/orders/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function getPurchaseInvoices(params: PurchasingFilters): Promise<PurchaseInvoice[]> {
  const response = await apiRequest<PurchaseInvoice[]>(
    `/api/v1/purchasing/invoices${toQueryString({
      search: params.search,
      supplier_id: params.supplierId,
      branch_id: params.branchId,
      status: params.status,
      payment_status: params.paymentStatus,
      date_from: params.dateFrom,
      date_to: params.dateTo,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseInvoice),
    },
  );

  return response.data;
}

export async function createPurchaseInvoice(
  payload: CreatePurchaseInvoicePayload,
): Promise<PurchaseInvoice> {
  const response = await apiRequest<PurchaseInvoice, BackendPurchaseInvoicePayload>(
    "/api/v1/purchasing/invoices",
    {
      method: "POST",
      authMode: "appwrite",
      body: invoicePayload(payload),
      parse: parseInvoice,
    },
  );

  return response.data;
}

export async function getPurchaseInvoiceById(id: string): Promise<PurchaseInvoice> {
  const response = await apiRequest<PurchaseInvoice>(`/api/v1/purchasing/invoices/${id}`, {
    authMode: "appwrite",
    parse: parseInvoice,
  });

  return response.data;
}

export async function updatePurchaseInvoice(
  id: string,
  payload: UpdatePurchaseInvoicePayload,
): Promise<PurchaseInvoice> {
  const response = await apiRequest<PurchaseInvoice, BackendPurchaseInvoicePayload>(
    `/api/v1/purchasing/invoices/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: invoicePayload(payload),
      parse: parseInvoice,
    },
  );

  return response.data;
}

export async function postPurchaseInvoice(id: string): Promise<PurchaseInvoice> {
  const response = await apiRequest<PurchaseInvoice>(`/api/v1/purchasing/invoices/${id}/post`, {
    method: "POST",
    authMode: "appwrite",
    parse: parseInvoice,
  });

  return response.data;
}

export async function cancelPurchaseInvoice(id: string): Promise<PurchaseInvoice> {
  const response = await apiRequest<PurchaseInvoice>(`/api/v1/purchasing/invoices/${id}/cancel`, {
    method: "POST",
    authMode: "appwrite",
    parse: parseInvoice,
  });

  return response.data;
}

export async function receivePurchase(payload: ReceivePurchasePayload): Promise<PurchaseReceipt> {
  const response = await apiRequest<PurchaseReceipt, BackendReceivePayload>(
    "/api/v1/purchasing/receive",
    {
      method: "POST",
      authMode: "appwrite",
      body: receivePayload(payload),
      parse: parseReceipt,
    },
  );

  return response.data;
}

export async function getPurchaseReceipts(params: PurchasingFilters): Promise<PurchaseReceipt[]> {
  const response = await apiRequest<PurchaseReceipt[]>(
    `/api/v1/purchasing/receipts${toQueryString({
      search: params.search,
      supplier_id: params.supplierId,
      branch_id: params.branchId,
      status: params.status,
      date_from: params.dateFrom,
      date_to: params.dateTo,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseReceipt),
    },
  );

  return response.data;
}

export async function getPurchaseReceiptById(id: string): Promise<PurchaseReceipt> {
  const response = await apiRequest<PurchaseReceipt>(`/api/v1/purchasing/receipts/${id}`, {
    authMode: "appwrite",
    parse: parseReceipt,
  });

  return response.data;
}

export async function postPurchaseReceipt(id: string): Promise<PurchaseReceipt> {
  const response = await apiRequest<PurchaseReceipt>(`/api/v1/purchasing/receipts/${id}/post`, {
    method: "POST",
    authMode: "appwrite",
    parse: parseReceipt,
  });

  return response.data;
}

export async function cancelPurchaseReceipt(id: string): Promise<PurchaseReceipt> {
  const response = await apiRequest<PurchaseReceipt>(`/api/v1/purchasing/receipts/${id}/cancel`, {
    method: "POST",
    authMode: "appwrite",
    parse: parseReceipt,
  });

  return response.data;
}

export async function lookupSuppliers(search = ""): Promise<PurchasingSupplierOption[]> {
  const response = await apiRequest<PurchasingSupplierOption[]>(
    `/api/v1/suppliers/lookup${toQueryString({ search, limit: 20 })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseSupplier),
    },
  );

  return response.data;
}

export async function getProducts(): Promise<PurchasingProductOption[]> {
  const response = await apiRequest<PurchasingProductOption[]>("/api/v1/products?limit=100", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseProduct),
  });

  return response.data;
}

export async function getIngredients(): Promise<PurchasingIngredientOption[]> {
  const response = await apiRequest<PurchasingIngredientOption[]>("/api/v1/ingredients?limit=100", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseIngredient),
  });

  return response.data;
}

export async function getUnits(): Promise<PurchasingUnitOption[]> {
  const response = await apiRequest<PurchasingUnitOption[]>("/api/v1/master-data/units", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseUnit),
  });

  return response.data;
}

export async function getTaxRates(): Promise<PurchasingTaxRateOption[]> {
  const response = await apiRequest<PurchasingTaxRateOption[]>("/api/v1/settings/tax-rates", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseTaxRate),
  });

  return response.data;
}

export async function getBranches(): Promise<PurchasingBranchOption[]> {
  const response = await apiRequest<PurchasingBranchOption[]>("/api/v1/branches", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseBranch),
  });

  return response.data;
}
