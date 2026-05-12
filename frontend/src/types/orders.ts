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

export type BakeryOrder = {
  id: string;
  branchId: string;
  branchName: string;
  orderNumber: string;
  customerId: string | null;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string | null;
  orderType: OrderType;
  orderDate: string;
  eventDate: string;
  pickupTime: string | null;
  deliveryTime: string | null;
  deliveryAddress: string | null;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: OrderPaymentStatus;
  orderStatus: OrderStatus;
  notes: string | null;
  createdByUserName: string;
  createdAt: string;
  updatedAt: string;
  items: BakeryOrderItem[];
};

export type BakeryOrderItem = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  unitId: string;
  unitName: string;
  weight: string | null;
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
  productId: string;
  quantity: number;
  unitId: string;
  weight: string | null;
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
  orderType: OrderType;
  eventDate: string;
  pickupTime: string | null;
  deliveryTime: string | null;
  deliveryAddress: string | null;
  items: CreateOrderItemPayload[];
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
