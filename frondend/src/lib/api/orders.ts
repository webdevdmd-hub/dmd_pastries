import { apiRequest } from "@/lib/api/client";
import type {
  AddOrderPackagingPayload,
  AddOrderPaymentPayload,
  AssignOrderProductionPayload,
  BakeryOrder,
  BakeryOrderFilters,
  BakeryOrderItem,
  BakeryOrderPackaging,
  BakeryOrderPayment,
  BakeryOrderSummary,
  ConvertOrderItemToProductPayload,
  ConvertOrderItemToVariantPayload,
  CreateOrderItemPayload,
  CreateOrderPayload,
  OrderItemSource,
  OrderPaymentStatus,
  OrderStatus,
  OrderType,
  UpdateOrderItemPayload,
  UpdateOrderPayload,
  UpdateOrderProductionStatusPayload,
  UpdateOrderStatusPayload,
} from "@/types/orders";

type BackendOrderPayload = {
  branch_id?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  sales_channel_id?: string;
  external_order_number?: string;
  order_type?: OrderType;
  event_date?: string;
  pickup_time?: string;
  delivery_time?: string;
  delivery_address?: string;
  items?: BackendOrderItemPayload[];
  notes?: string;
};

type BackendOrderItemPayload = {
  product_id?: string;
  product_variant_id?: string;
  item_name?: string;
  quantity?: number;
  unit_id?: string;
  weight?: number | null;
  flavor?: string;
  design_notes?: string;
  message_text?: string;
  customizations_json?: string;
  unit_price?: number;
  discount_amount?: number;
  tax_rate_id?: string | null;
};

type BackendOrderPaymentPayload = {
  payment_method_id: string;
  amount: number;
  payment_type: "deposit" | "balance" | "full";
  reference_number: string;
};

type BackendOrderPackagingPayload = {
  packaging_item_id: string;
  quantity_required: number;
  unit_id: string;
};

type BackendOrderItemProductConversionPayload = {
  category_id: string;
  product_name: string;
  product_code?: string;
  sku?: string;
  barcode?: string;
  sale_price: number;
  unit_id: string;
  product_type: "made_to_order";
  is_stock_tracked: boolean;
  is_expiry_tracked: boolean;
  is_custom_order_available: boolean;
  show_in_pos: boolean;
  description?: string;
  status: "active";
};

type BackendOrderItemVariantConversionPayload = {
  product_id: string;
  variant_name: string;
  sku?: string;
  barcode?: string;
  sale_price: number;
  unit_id: string;
  show_in_pos: boolean;
};

type BackendProductionPayload = {
  production_batch_id: string;
};

type BackendProductionStatusPayload = {
  production_status: string;
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

function requestString(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function optionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === "new" ||
    value === "confirmed" ||
    value === "in_production" ||
    value === "ready" ||
    value === "delivered" ||
    value === "completed" ||
    value === "cancelled"
  );
}

function isOrderType(value: unknown): value is OrderType {
  return value === "pickup" || value === "delivery";
}

function isPaymentStatus(value: unknown): value is OrderPaymentStatus {
  return value === "unpaid" || value === "partial" || value === "paid" || value === "refunded";
}

function isOrderItemSource(value: unknown): value is OrderItemSource {
  return value === "catalog" || value === "custom";
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) {
    return value.map(parser);
  }

  if (isObject(value)) {
    const keys = ["items", "orders", "payments", "packaging", "data"];

    for (const key of keys) {
      const item = value[key];

      if (Array.isArray(item)) {
        return item.map(parser);
      }
    }
  }

  throw new Error("Backend list payload is invalid.");
}

function queryString(params: Record<string, string | number | null | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function parseOrderItem(value: unknown): BakeryOrderItem {
  if (!isObject(value)) {
    throw new Error("Backend order item payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    productId: optionalString(value.product_id),
    productNameSnapshot: stringValue(value.product_name_snapshot, "Order item"),
    productVariantId: optionalString(value.product_variant_id),
    productVariantNameSnapshot: optionalString(value.product_variant_name_snapshot),
    itemNameSnapshot: stringValue(
      value.item_name_snapshot,
      stringValue(value.product_name_snapshot, "Order item"),
    ),
    itemSource: isOrderItemSource(value.item_source) ? value.item_source : "catalog",
    quantity: numberValue(value.quantity),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    weight: optionalNumber(value.weight),
    flavor: optionalString(value.flavor),
    designNotes: optionalString(value.design_notes),
    messageText: optionalString(value.message_text),
    customizationsJson: optionalString(value.customizations_json),
    unitPrice: numberValue(value.unit_price),
    discountAmount: numberValue(value.discount_amount),
    taxRateId: optionalString(value.tax_rate_id),
    taxAmount: numberValue(value.tax_amount),
    lineTotal: numberValue(value.line_total),
  };
}

function parseConvertedOrderItem(value: unknown, itemId: string): BakeryOrderItem {
  if (isObject(value)) {
    if (isObject(value.item)) {
      return parseOrderItem(value.item);
    }

    const itemsValue = value.items;
    if (Array.isArray(itemsValue)) {
      for (const item of itemsValue) {
        if (isObject(item) && stringValue(item.id) === itemId) {
          return parseOrderItem(item);
        }
      }
    }
  }

  return parseOrderItem(value);
}

function parseOrder(value: unknown): BakeryOrder {
  if (!isObject(value)) {
    throw new Error("Backend bakery order payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    orderNumber: stringValue(value.order_number, "Order"),
    customerId: optionalString(value.customer_id),
    customerNameSnapshot: stringValue(value.customer_name_snapshot, "Walk-in customer"),
    customerPhoneSnapshot: optionalString(value.customer_phone_snapshot),
    salesChannelId: optionalString(value.sales_channel_id),
    salesChannelName: stringValue(value.sales_channel_name, "Default channel"),
    externalOrderNumber: optionalString(value.external_order_number),
    orderType: isOrderType(value.order_type) ? value.order_type : "pickup",
    orderDate: stringValue(value.order_date),
    eventDate: stringValue(value.event_date),
    pickupTime: optionalString(value.pickup_time),
    deliveryTime: optionalString(value.delivery_time),
    deliveryAddress: optionalString(value.delivery_address),
    subtotalAmount: numberValue(value.subtotal_amount),
    discountAmount: numberValue(value.discount_amount),
    taxAmount: numberValue(value.tax_amount),
    totalAmount: numberValue(value.total_amount),
    paidAmount: numberValue(value.paid_amount),
    balanceAmount: numberValue(value.balance_amount),
    paymentStatus: isPaymentStatus(value.payment_status) ? value.payment_status : "unpaid",
    orderStatus: isOrderStatus(value.order_status) ? value.order_status : "new",
    notes: optionalString(value.notes),
    accountingJournalEntryId: optionalString(value.accounting_journal_entry_id),
    createdByUserName: stringValue(value.created_by_user_name, "User"),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
    items: Array.isArray(value.items) ? value.items.map(parseOrderItem) : [],
  };
}

function parsePayment(value: unknown): BakeryOrderPayment {
  if (!isObject(value)) {
    throw new Error("Backend order payment payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    paymentMethodId: stringValue(value.payment_method_id),
    paymentMethodName: stringValue(value.payment_method_name, "Payment method"),
    amount: numberValue(value.amount),
    referenceNumber: optionalString(value.reference_number),
    journalEntryId: optionalString(value.journal_entry_id),
    paymentType:
      value.payment_type === "deposit" ||
      value.payment_type === "balance" ||
      value.payment_type === "full"
        ? value.payment_type
        : "balance",
    paidAt: stringValue(value.paid_at),
  };
}

function parsePackaging(value: unknown): BakeryOrderPackaging {
  if (!isObject(value)) {
    throw new Error("Backend order packaging payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    packagingItemId: stringValue(value.packaging_item_id),
    packagingName: stringValue(value.packaging_name, "Packaging item"),
    quantityRequired: numberValue(value.quantity_required),
    createdAt: stringValue(value.created_at),
  };
}

function parseSummary(value: unknown): BakeryOrderSummary {
  if (!isObject(value)) {
    throw new Error("Backend order summary payload is invalid.");
  }

  return {
    totalOrders: numberValue(value.total_orders),
    pendingOrders: numberValue(value.pending_orders),
    inProductionOrders: numberValue(value.in_production_orders),
    readyOrders: numberValue(value.ready_orders),
    completedOrders: numberValue(value.completed_orders),
    todayOrders: numberValue(value.today_orders),
  };
}

function itemPayload(
  payload: CreateOrderItemPayload | UpdateOrderItemPayload,
): BackendOrderItemPayload {
  return {
    ...(payload.productId !== undefined && payload.productId !== null
      ? { product_id: payload.productId }
      : {}),
    ...(payload.productVariantId !== undefined && payload.productVariantId !== null
      ? { product_variant_id: payload.productVariantId }
      : {}),
    ...(payload.itemName !== undefined && payload.itemName !== null
      ? { item_name: requestString(payload.itemName) }
      : {}),
    ...(payload.quantity !== undefined ? { quantity: payload.quantity } : {}),
    ...(payload.unitId !== undefined ? { unit_id: payload.unitId } : {}),
    ...(payload.weight !== undefined ? { weight: payload.weight } : {}),
    ...(payload.flavor !== undefined ? { flavor: requestString(payload.flavor) } : {}),
    ...(payload.designNotes !== undefined
      ? { design_notes: requestString(payload.designNotes) }
      : {}),
    ...(payload.messageText !== undefined
      ? { message_text: requestString(payload.messageText) }
      : {}),
    ...(payload.customizationsJson !== undefined
      ? { customizations_json: requestString(payload.customizationsJson) }
      : {}),
    ...(payload.unitPrice !== undefined ? { unit_price: payload.unitPrice } : {}),
    ...(payload.discountAmount !== undefined ? { discount_amount: payload.discountAmount } : {}),
    ...(payload.taxRateId !== undefined ? { tax_rate_id: payload.taxRateId } : {}),
  };
}

function optionalRequestString(value: string | null | undefined): string | undefined {
  const nextValue = value?.trim() ?? "";
  return nextValue.length > 0 ? nextValue : undefined;
}

function productConversionPayload(
  payload: ConvertOrderItemToProductPayload,
): BackendOrderItemProductConversionPayload {
  const nextPayload: BackendOrderItemProductConversionPayload = {
    category_id: payload.categoryId,
    product_name: payload.productName,
    sale_price: payload.salePrice,
    unit_id: payload.unitId,
    product_type: payload.productType,
    is_stock_tracked: payload.isStockTracked,
    is_expiry_tracked: payload.isExpiryTracked,
    is_custom_order_available: payload.isCustomOrderAvailable,
    show_in_pos: payload.showInPos,
    status: payload.status,
  };
  const productCode = optionalRequestString(payload.productCode);
  const sku = optionalRequestString(payload.sku);
  const barcode = optionalRequestString(payload.barcode);
  const description = optionalRequestString(payload.description);

  if (productCode) {
    nextPayload.product_code = productCode;
  }
  if (sku) {
    nextPayload.sku = sku;
  }
  if (barcode) {
    nextPayload.barcode = barcode;
  }
  if (description) {
    nextPayload.description = description;
  }

  return nextPayload;
}

function variantConversionPayload(
  payload: ConvertOrderItemToVariantPayload,
): BackendOrderItemVariantConversionPayload {
  const nextPayload: BackendOrderItemVariantConversionPayload = {
    product_id: payload.productId,
    variant_name: payload.variantName,
    sale_price: payload.salePrice,
    unit_id: payload.unitId,
    show_in_pos: payload.showInPos,
  };
  const sku = optionalRequestString(payload.sku);
  const barcode = optionalRequestString(payload.barcode);

  if (sku) {
    nextPayload.sku = sku;
  }
  if (barcode) {
    nextPayload.barcode = barcode;
  }

  return nextPayload;
}

function orderPayload(payload: CreateOrderPayload | UpdateOrderPayload): BackendOrderPayload {
  return {
    ...(payload.branchId !== undefined ? { branch_id: payload.branchId } : {}),
    ...(payload.customerId !== undefined ? { customer_id: requestString(payload.customerId) } : {}),
    ...(payload.customerName !== undefined
      ? { customer_name: requestString(payload.customerName) }
      : {}),
    ...(payload.customerPhone !== undefined
      ? { customer_phone: requestString(payload.customerPhone) }
      : {}),
    ...(payload.salesChannelId !== undefined && payload.salesChannelId !== null
      ? { sales_channel_id: payload.salesChannelId }
      : {}),
    ...(payload.externalOrderNumber !== undefined && payload.externalOrderNumber !== null
      ? { external_order_number: requestString(payload.externalOrderNumber) }
      : {}),
    ...(payload.orderType !== undefined ? { order_type: payload.orderType } : {}),
    ...(payload.eventDate !== undefined ? { event_date: payload.eventDate } : {}),
    ...(payload.pickupTime !== undefined ? { pickup_time: requestString(payload.pickupTime) } : {}),
    ...(payload.deliveryTime !== undefined
      ? { delivery_time: requestString(payload.deliveryTime) }
      : {}),
    ...(payload.deliveryAddress !== undefined
      ? { delivery_address: requestString(payload.deliveryAddress) }
      : {}),
    ...(payload.items !== undefined ? { items: payload.items.map(itemPayload) } : {}),
    ...(payload.notes !== undefined ? { notes: requestString(payload.notes) } : {}),
  };
}

export async function getOrders(params: BakeryOrderFilters): Promise<BakeryOrder[]> {
  const response = await apiRequest<BakeryOrder[]>(
    `/api/v1/bakery-orders${queryString({
      search: params.search,
      status: params.status,
      order_type: params.orderType,
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

export async function createOrder(payload: CreateOrderPayload): Promise<BakeryOrder> {
  const response = await apiRequest<BakeryOrder, BackendOrderPayload>("/api/v1/bakery-orders", {
    authMode: "appwrite",
    method: "POST",
    body: orderPayload(payload),
    parse: parseOrder,
  });

  return response.data;
}

export async function getOrderById(id: string): Promise<BakeryOrder> {
  const response = await apiRequest<BakeryOrder>(`/api/v1/bakery-orders/${id}`, {
    authMode: "appwrite",
    parse: parseOrder,
  });

  return response.data;
}

export async function updateOrder(id: string, payload: UpdateOrderPayload): Promise<BakeryOrder> {
  const response = await apiRequest<BakeryOrder, BackendOrderPayload>(
    `/api/v1/bakery-orders/${id}`,
    {
      authMode: "appwrite",
      method: "PATCH",
      body: orderPayload(payload),
      parse: parseOrder,
    },
  );

  return response.data;
}

export async function updateOrderStatus(
  id: string,
  payload: UpdateOrderStatusPayload,
): Promise<BakeryOrder> {
  const response = await apiRequest<BakeryOrder, { status: OrderStatus }>(
    `/api/v1/bakery-orders/${id}/status`,
    {
      authMode: "appwrite",
      method: "PATCH",
      body: payload,
      parse: parseOrder,
    },
  );

  return response.data;
}

export async function deleteOrder(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/bakery-orders/${id}`, {
    authMode: "appwrite",
    method: "DELETE",
    parse: () => undefined,
  });
}

export async function addOrderItem(
  orderId: string,
  payload: CreateOrderItemPayload,
): Promise<BakeryOrderItem> {
  const response = await apiRequest<BakeryOrderItem, BackendOrderItemPayload>(
    `/api/v1/bakery-orders/${orderId}/items`,
    {
      authMode: "appwrite",
      method: "POST",
      body: itemPayload(payload),
      parse: parseOrderItem,
    },
  );

  return response.data;
}

export async function updateOrderItem(
  orderId: string,
  itemId: string,
  payload: UpdateOrderItemPayload,
): Promise<BakeryOrderItem> {
  const response = await apiRequest<BakeryOrderItem, BackendOrderItemPayload>(
    `/api/v1/bakery-orders/${orderId}/items/${itemId}`,
    {
      authMode: "appwrite",
      method: "PATCH",
      body: itemPayload(payload),
      parse: parseOrderItem,
    },
  );

  return response.data;
}

export async function deleteOrderItem(orderId: string, itemId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/bakery-orders/${orderId}/items/${itemId}`, {
    authMode: "appwrite",
    method: "DELETE",
    parse: () => undefined,
  });
}

export async function convertOrderItemToProduct(
  orderId: string,
  itemId: string,
  payload: ConvertOrderItemToProductPayload,
): Promise<BakeryOrderItem> {
  const response = await apiRequest<BakeryOrderItem, BackendOrderItemProductConversionPayload>(
    `/api/v1/bakery-orders/${orderId}/items/${itemId}/convert-to-product`,
    {
      authMode: "appwrite",
      method: "POST",
      body: productConversionPayload(payload),
      parse: (data) => parseConvertedOrderItem(data, itemId),
    },
  );

  return response.data;
}

export async function convertOrderItemToVariant(
  orderId: string,
  itemId: string,
  payload: ConvertOrderItemToVariantPayload,
): Promise<BakeryOrderItem> {
  const response = await apiRequest<BakeryOrderItem, BackendOrderItemVariantConversionPayload>(
    `/api/v1/bakery-orders/${orderId}/items/${itemId}/convert-to-variant`,
    {
      authMode: "appwrite",
      method: "POST",
      body: variantConversionPayload(payload),
      parse: (data) => parseConvertedOrderItem(data, itemId),
    },
  );

  return response.data;
}

export async function getOrderPayments(orderId: string): Promise<BakeryOrderPayment[]> {
  const response = await apiRequest<BakeryOrderPayment[]>(
    `/api/v1/bakery-orders/${orderId}/payments`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parsePayment),
    },
  );

  return response.data;
}

export async function addOrderPayment(
  orderId: string,
  payload: AddOrderPaymentPayload,
): Promise<BakeryOrderPayment> {
  const response = await apiRequest<BakeryOrderPayment, BackendOrderPaymentPayload>(
    `/api/v1/bakery-orders/${orderId}/payments`,
    {
      authMode: "appwrite",
      method: "POST",
      body: {
        amount: payload.amount,
        payment_method_id: payload.paymentMethodId,
        payment_type: payload.paymentType,
        reference_number: requestString(payload.referenceNumber),
      },
      parse: parsePayment,
    },
  );

  return response.data;
}

export async function assignOrderProduction(
  orderId: string,
  payload: AssignOrderProductionPayload,
): Promise<BakeryOrder> {
  const response = await apiRequest<BakeryOrder, BackendProductionPayload>(
    `/api/v1/bakery-orders/${orderId}/assign-production`,
    {
      authMode: "appwrite",
      method: "POST",
      body: { production_batch_id: payload.batchId },
      parse: parseOrder,
    },
  );

  return response.data;
}

export async function updateOrderProductionStatus(
  orderId: string,
  payload: UpdateOrderProductionStatusPayload,
): Promise<BakeryOrder> {
  const response = await apiRequest<BakeryOrder, BackendProductionStatusPayload>(
    `/api/v1/bakery-orders/${orderId}/production-status`,
    {
      authMode: "appwrite",
      method: "PATCH",
      body: { production_status: payload.productionStatus },
      parse: parseOrder,
    },
  );

  return response.data;
}

export async function getOrderPackaging(orderId: string): Promise<BakeryOrderPackaging[]> {
  const response = await apiRequest<BakeryOrderPackaging[]>(
    `/api/v1/bakery-orders/${orderId}/packaging`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parsePackaging),
    },
  );

  return response.data;
}

export async function addOrderPackaging(
  orderId: string,
  payload: AddOrderPackagingPayload,
): Promise<BakeryOrderPackaging> {
  const response = await apiRequest<BakeryOrderPackaging, BackendOrderPackagingPayload>(
    `/api/v1/bakery-orders/${orderId}/packaging`,
    {
      authMode: "appwrite",
      method: "POST",
      body: {
        packaging_item_id: payload.packagingItemId,
        quantity_required: payload.quantityRequired,
        unit_id: payload.unitId,
      },
      parse: parsePackaging,
    },
  );

  return response.data;
}

export async function getOrderSummary(): Promise<BakeryOrderSummary> {
  const response = await apiRequest<BakeryOrderSummary>("/api/v1/bakery-orders/summary", {
    authMode: "appwrite",
    parse: parseSummary,
  });

  return response.data;
}
