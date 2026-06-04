import type { DocumentCharge, DocumentChargeDraft } from "@/types/document-charges";

export type OrderStatus =
  | "new"
  | "confirmed"
  | "in_production"
  | "ready"
  | "delivered"
  | "completed"
  | "cancelled";

export type OrderType = "pickup" | "delivery";

export type OrderPaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

export type OrderItemSource = "catalog" | "custom";

export type BakeryOrder = {
  id: string;
  branchId: string;
  branchName: string;
  orderNumber: string;
  customerId: string | null;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string | null;
  salesChannelId: string | null;
  salesChannelName: string;
  externalOrderNumber: string | null;
  orderType: OrderType;
  orderDate: string;
  eventDate: string;
  pickupTime: string | null;
  deliveryTime: string | null;
  deliveryAddress: string | null;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  chargeAmount: number;
  chargeTaxAmount: number;
  charges: DocumentCharge[];
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: OrderPaymentStatus;
  orderStatus: OrderStatus;
  notes: string | null;
  accountingJournalEntryId: string | null;
  createdByUserName: string;
  createdAt: string;
  updatedAt: string;
  items: BakeryOrderItem[];
};

export type BakeryOrderItem = {
  id: string;
  productId: string | null;
  productNameSnapshot: string;
  productVariantId: string | null;
  productVariantNameSnapshot: string | null;
  itemNameSnapshot: string;
  itemSource: OrderItemSource;
  quantity: number;
  unitId: string;
  unitName: string;
  weight: number | null;
  flavor: string | null;
  designNotes: string | null;
  messageText: string | null;
  customizationsJson: string | null;
  unitPrice: number;
  discountAmount: number;
  taxRateId: string | null;
  taxAmount: number;
  lineTotal: number;
};

export type BakeryOrderPayment = {
  id: string;
  paymentMethodId: string;
  paymentMethodName: string;
  amount: number;
  paymentType: "deposit" | "balance" | "full";
  referenceNumber: string | null;
  journalEntryId: string | null;
  paidAt: string;
};

export type BakeryOrderPackaging = {
  id: string;
  packagingItemId: string;
  packagingName: string;
  quantityRequired: number;
  createdAt: string;
};

export type BakeryOrderSummary = {
  totalOrders: number;
  pendingOrders: number;
  inProductionOrders: number;
  readyOrders: number;
  completedOrders: number;
  todayOrders: number;
};

export type BakeryOrderFilters = {
  search: string;
  status: OrderStatus | "all";
  orderType: OrderType | "all";
  dateFrom: string;
  dateTo: string;
};

export type CreateOrderItemPayload = {
  productId: string | null;
  productVariantId: string | null;
  itemName: string | null;
  quantity: number;
  unitId: string;
  weight: number | null;
  flavor: string | null;
  designNotes: string | null;
  messageText: string | null;
  customizationsJson: string | null;
  unitPrice: number;
  discountAmount: number;
  taxRateId: string | null;
};

export type UpdateOrderItemPayload = Partial<CreateOrderItemPayload>;

export type CreateOrderPayload = {
  branchId: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  salesChannelId: string | null;
  externalOrderNumber: string | null;
  orderType: OrderType;
  eventDate: string;
  pickupTime: string | null;
  deliveryTime: string | null;
  deliveryAddress: string | null;
  items: CreateOrderItemPayload[];
  charges: DocumentChargeDraft[];
  notes: string | null;
};

export type UpdateOrderPayload = Partial<CreateOrderPayload>;

export type UpdateOrderStatusPayload = {
  status: OrderStatus;
};

export type AddOrderPaymentPayload = {
  paymentMethodId: string;
  amount: number;
  paymentType: "deposit" | "balance" | "full";
  referenceNumber: string | null;
};

export type AssignOrderProductionPayload = {
  batchId: string;
};

export type UpdateOrderProductionStatusPayload = {
  productionStatus: string;
};

export type AddOrderPackagingPayload = {
  packagingItemId: string;
  quantityRequired: number;
  unitId: string;
};

export type ConvertOrderItemToProductPayload = {
  categoryId: string;
  productName: string;
  productCode: string | null;
  sku: string | null;
  barcode: string | null;
  salePrice: number;
  unitId: string;
  productType: "made_to_order";
  isStockTracked: boolean;
  isExpiryTracked: boolean;
  isCustomOrderAvailable: boolean;
  showInPos: boolean;
  description: string | null;
  status: "active";
};

export type ConvertOrderItemToVariantPayload = {
  productId: string;
  variantName: string;
  sku: string | null;
  barcode: string | null;
  salePrice: number;
  unitId: string;
  showInPos: boolean;
};
