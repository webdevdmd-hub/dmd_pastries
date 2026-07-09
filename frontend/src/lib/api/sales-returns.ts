import { apiRequest } from "@/lib/api/client";
import type {
  CreateSalesReturnPayload,
  RefundMode,
  RestockAction,
  ReturnableSaleItem,
  ReverseSalesReturnPayload,
  SalesReturn,
  SalesReturnFilters,
  SalesReturnItem,
  SalesReturnStatus,
} from "@/types/sales-return";

type BackendCreateSalesReturnItemPayload = {
  sale_item_id: string;
  quantity: number;
  restock_action: RestockAction;
  stock_location_id?: string | null;
  reason?: string | null;
};

type BackendCreateSalesReturnPayload = {
  sale_id: string;
  return_date: string;
  reason: string;
  refund_mode: RefundMode;
  refund_payment_method_id?: string | null;
  refund_reference_number?: string | null;
  items: BackendCreateSalesReturnItemPayload[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRefundMode(value: unknown): value is RefundMode {
  return value === "none" || value === "refund";
}

function isRestockAction(value: unknown): value is RestockAction {
  return value === "restock" || value === "discard";
}

function isSalesReturnStatus(value: unknown): value is SalesReturnStatus {
  return value === "draft" || value === "posted" || value === "cancelled" || value === "reversed";
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) {
    return value.map(parser);
  }

  if (value === null || value === undefined) {
    return [];
  }

  if (isObject(value)) {
    for (const key of ["items", "sales_returns", "returns", "records", "rows"]) {
      const nextValue = value[key];
      if (Array.isArray(nextValue)) {
        return nextValue.map(parser);
      }

      if (key in value && (nextValue === null || nextValue === undefined)) {
        return [];
      }
    }

    if ("data" in value) {
      return parseList(value.data, parser);
    }

    if ("pagination" in value || "total" in value || "total_pages" in value) {
      return [];
    }
  }

  throw new Error("Backend sales return list payload is invalid.");
}

function parseReturnableItem(value: unknown): ReturnableSaleItem {
  if (!isObject(value)) {
    throw new Error("Backend returnable sale item payload is invalid.");
  }

  const productName =
    nullableString(value.item_name) ??
    nullableString(value.item_name_snapshot) ??
    nullableString(value.product_name_snapshot) ??
    nullableString(value.product_name) ??
    "Sale item";
  const variantName =
    nullableString(value.product_variant_name_snapshot) ??
    nullableString(value.product_variant_name) ??
    nullableString(value.variant_name);
  const saleItemId = stringValue(value.sale_item_id, stringValue(value.id));
  const soldQuantity = numberValue(value.sold_quantity ?? value.quantity);
  const returnedQuantity = numberValue(
    value.returned_quantity ?? value.already_returned_quantity,
  );
  const returnableQuantity = numberValue(
    value.returnable_quantity ?? value.remaining_quantity,
    Math.max(soldQuantity - returnedQuantity, 0),
  );

  return {
    saleItemId,
    productId: nullableString(value.product_id),
    productVariantId: nullableString(value.product_variant_id),
    itemName: variantName ? `${productName} - ${variantName}` : productName,
    variantName,
    sku: nullableString(value.sku ?? value.product_sku ?? value.variant_sku),
    soldQuantity,
    returnedQuantity,
    returnableQuantity,
    unitPrice: numberValue(value.unit_price),
    discountAmount: numberValue(value.discount_amount),
    taxRateId: nullableString(value.tax_rate_id),
    taxRateName: nullableString(value.tax_rate_name_snapshot ?? value.tax_rate_name),
    taxRatePercentage: numberValue(
      value.tax_rate_percentage_snapshot ?? value.tax_rate_percentage,
    ),
    taxAmount: numberValue(value.tax_amount),
    lineSubtotal: numberValue(value.line_subtotal),
    lineTotal: numberValue(value.line_total),
  };
}

function parseSalesReturnItem(value: unknown): SalesReturnItem {
  if (!isObject(value)) {
    throw new Error("Backend sales return item payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    saleReturnId: stringValue(value.sales_return_id ?? value.sale_return_id),
    saleItemId: stringValue(value.sale_item_id),
    itemName:
      nullableString(value.item_name) ??
      nullableString(value.item_name_snapshot) ??
      nullableString(value.product_name_snapshot) ??
      nullableString(value.product_name) ??
      "Returned item",
    quantity: numberValue(value.quantity),
    unitPrice: numberValue(value.unit_price),
    lineTotal: numberValue(value.line_total),
    restockAction: isRestockAction(value.restock_action) ? value.restock_action : "discard",
    stockLocationId: nullableString(value.stock_location_id),
    stockLocationName: nullableString(value.stock_location_name),
    reason: nullableString(value.reason),
  };
}

function parseSalesReturn(value: unknown): SalesReturn {
  if (!isObject(value)) {
    throw new Error("Backend sales return payload is invalid.");
  }

  const items = Array.isArray(value.items) ? value.items.map(parseSalesReturnItem) : [];

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    saleId: stringValue(value.sale_id),
    saleNumber: stringValue(value.sale_number, "Sale"),
    returnNumber: stringValue(
      value.return_number ?? value.sales_return_number ?? value.credit_note_number,
      "Credit note",
    ),
    returnDate: stringValue(value.return_date),
    customerName: nullableString(value.customer_name),
    reason: nullableString(value.reason),
    refundMode: isRefundMode(value.refund_mode) ? value.refund_mode : "none",
    refundPaymentMethodId: nullableString(value.refund_payment_method_id),
    refundPaymentMethodName: nullableString(value.refund_payment_method_name),
    refundReferenceNumber: nullableString(value.refund_reference_number),
    refundAmount: numberValue(value.refund_amount ?? value.total_amount),
    status: isSalesReturnStatus(value.status) ? value.status : "draft",
    createdByUserName: stringValue(value.created_by_user_name, "User"),
    postedAt: nullableString(value.posted_at),
    cancelledAt: nullableString(value.cancelled_at),
    reversedAt: nullableString(value.reversed_at),
    reversedByUserId: nullableString(value.reversed_by_user_id),
    reversedByUserName: nullableString(value.reversed_by_user_name),
    originalReturnId: nullableString(value.original_return_id),
    originalReturnNumber: nullableString(value.original_return_number),
    reversalReturnId: nullableString(value.reversal_return_id),
    reversalReturnNumber: nullableString(value.reversal_return_number),
    reversalJournalEntryId: nullableString(value.reversal_journal_entry_id),
    reversalReason: nullableString(value.reversal_reason),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
    items,
  };
}

function toQueryString(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function toBackendPayload(payload: CreateSalesReturnPayload): BackendCreateSalesReturnPayload {
  return {
    sale_id: payload.saleId,
    return_date: payload.returnDate,
    reason: payload.reason,
    refund_mode: payload.refundMode,
    refund_payment_method_id: payload.refundPaymentMethodId ?? null,
    refund_reference_number: payload.refundReferenceNumber ?? null,
    items: payload.items.map((item) => ({
      sale_item_id: item.saleItemId,
      quantity: item.quantity,
      restock_action: item.restockAction,
      stock_location_id: item.stockLocationId ?? null,
      reason: item.reason ?? null,
    })),
  };
}

export async function getSalesReturns(filters: SalesReturnFilters): Promise<SalesReturn[]> {
  const response = await apiRequest<SalesReturn[]>(
    `/api/v1/sales-returns${toQueryString({
      search: filters.search,
      status: filters.status,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseSalesReturn),
    },
  );

  return response.data;
}

export async function getSalesReturnById(id: string): Promise<SalesReturn> {
  const response = await apiRequest<SalesReturn>(`/api/v1/sales-returns/${id}`, {
    authMode: "appwrite",
    parse: parseSalesReturn,
  });

  return response.data;
}

export async function createSalesReturn(payload: CreateSalesReturnPayload): Promise<SalesReturn> {
  const response = await apiRequest<SalesReturn, BackendCreateSalesReturnPayload>(
    "/api/v1/sales-returns",
    {
      method: "POST",
      authMode: "appwrite",
      body: toBackendPayload(payload),
      parse: parseSalesReturn,
    },
  );

  return response.data;
}

export async function updateSalesReturn(
  id: string,
  payload: CreateSalesReturnPayload,
): Promise<SalesReturn> {
  const response = await apiRequest<SalesReturn, BackendCreateSalesReturnPayload>(
    `/api/v1/sales-returns/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: toBackendPayload(payload),
      parse: parseSalesReturn,
    },
  );

  return response.data;
}

export async function postSalesReturn(id: string): Promise<SalesReturn> {
  const response = await apiRequest<SalesReturn>(`/api/v1/sales-returns/${id}/post`, {
    method: "POST",
    authMode: "appwrite",
    parse: parseSalesReturn,
  });

  return response.data;
}

export async function cancelSalesReturn(id: string): Promise<SalesReturn> {
  const response = await apiRequest<SalesReturn>(`/api/v1/sales-returns/${id}/cancel`, {
    method: "POST",
    authMode: "appwrite",
    parse: parseSalesReturn,
  });

  return response.data;
}

export async function reverseSalesReturn(
  id: string,
  payload: ReverseSalesReturnPayload,
): Promise<SalesReturn> {
  const response = await apiRequest<SalesReturn, { reason: string }>(
    `/api/v1/sales-returns/${id}/reverse`,
    {
      method: "POST",
      authMode: "appwrite",
      body: {
        reason: payload.reason,
      },
      parse: parseSalesReturn,
    },
  );

  return response.data;
}

export async function getReturnableSaleItems(saleId: string): Promise<ReturnableSaleItem[]> {
  const response = await apiRequest<ReturnableSaleItem[]>(
    `/api/v1/pos/sales/${saleId}/returnable-items`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseReturnableItem),
    },
  );

  return response.data;
}

export async function getSaleSalesReturns(saleId: string): Promise<SalesReturn[]> {
  const response = await apiRequest<SalesReturn[]>(`/api/v1/pos/sales/${saleId}/sales-returns`, {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseSalesReturn),
  });

  return response.data;
}
