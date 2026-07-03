export type BakeryOrdersReportGroupBy = "day" | "week" | "month";
export type BakeryOrdersReportOrderType = "pickup" | "delivery";

export type BakeryOrdersReportFilters = {
  branchId?: string;
  customerId?: string;
  dateFrom: string;
  dateTo: string;
  groupBy?: BakeryOrdersReportGroupBy;
  limit?: number;
  orderStatus?: string;
  orderType?: BakeryOrdersReportOrderType;
  page?: number;
  paymentStatus?: string;
};

export type BakeryOrdersSummary = {
  balancePending: number;
  cancelledOrders: number;
  completedOrders: number;
  deliveryOrders: number;
  inProductionOrders: number;
  paidAmount: number;
  pendingOrders: number;
  pickupOrders: number;
  readyOrders: number;
  totalOrderValue: number;
  totalOrders: number;
};

export type UpcomingOrderRow = {
  balanceAmount: number;
  customerName: string;
  deliveryTime: string;
  eventDate: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  orderType: string;
  pickupTime: string;
  totalAmount: number;
};

export type OrderStatusRow = {
  orderStatus: string;
  ordersCount: number;
  totalOrderValue: number;
};

export type ProductionScheduleRow = {
  assignedBatchNumber: string;
  branchName: string;
  eventDate: string;
  hasProductionRecord: boolean;
  orderNumber: string;
  orderStatus: string;
  productName: string;
  productionBatchStatus: string;
  productionNote: string;
  productionStatus: string;
  quantity: number;
};

export type PendingPaymentRow = {
  balanceAmount: number;
  customerName: string;
  eventDate: string;
  orderNumber: string;
  paidAmount: number;
  paymentStatus: string;
  totalAmount: number;
};

export type DeliveryVsPickupReport = {
  deliveryOrders: {
    count: number;
    totalValue: number;
  };
  pickupOrders: {
    count: number;
    totalValue: number;
  };
};

export type BakeryOrdersTrendDataset = {
  data: number[];
  label: string;
};

export type BakeryOrdersTrendChart = {
  datasets: BakeryOrdersTrendDataset[];
  labels: string[];
};
