import type { BranchStatus } from "@/types/branch";

export type PurchaseOrderStatus =
  | "draft"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

export type PurchaseInvoiceStatus = "draft" | "posted" | "cancelled";

export type PurchasePaymentStatus = "unpaid" | "partial" | "paid" | "overdue";

export type PurchaseReceiptStatus = "draft" | "posted" | "cancelled";

export type PurchaseItemType = "product" | "ingredient" | "packaging";

export type PurchaseOrderItem = {
  id: string;
  itemType: PurchaseItemType;
  productId: string | null;
  ingredientId: string | null;
  packagingItemId: string | null;
  itemNameSnapshot: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  unitCost: number;
  discountAmount: number;
  taxRateId: string | null;
  taxAmount: number;
  lineTotal: number;
};

export type PurchaseInvoiceItem = {
  id: string;
  itemType: PurchaseItemType;
  productId: string | null;
  ingredientId: string | null;
  packagingItemId: string | null;
  itemNameSnapshot: string;
  quantity: number;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  unitCost: number;
  discountAmount: number;
  taxRateId: string | null;
  taxAmount: number;
  lineTotal: number;
  expiryDate: string | null;
  batchNumber: string | null;
};

export type PurchaseReceiptItem = {
  id: string;
  itemType: PurchaseItemType;
  productId: string | null;
  ingredientId: string | null;
  packagingItemId: string | null;
  inventoryItemId: string | null;
  itemNameSnapshot: string;
  quantityReceived: number;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  expiryDate: string | null;
  batchNumber: string | null;
  stockMovementId: string | null;
};

export type PurchaseOrder = {
  id: string;
  branchId: string;
  branchName: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderNumber: string;
  orderDate: string;
  expectedDeliveryDate: string | null;
  status: PurchaseOrderStatus;
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  notes: string | null;
  createdByUserName: string;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
};

export type PurchaseInvoice = {
  id: string;
  branchId: string;
  branchName: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  status: PurchaseInvoiceStatus;
  paymentStatus: PurchasePaymentStatus;
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  notes: string | null;
  createdByUserName: string;
  createdAt: string;
  updatedAt: string;
  items: PurchaseInvoiceItem[];
};

export type PurchaseReceipt = {
  id: string;
  branchId: string;
  branchName: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId: string | null;
  purchaseInvoiceId: string | null;
  receiptNumber: string;
  receivedDate: string;
  status: PurchaseReceiptStatus;
  receivedByUserName: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseReceiptItem[];
};

export type PurchasingSummary = {
  totalPurchaseOrders: number;
  openPurchaseOrders: number;
  totalInvoices: number;
  unpaidInvoiceAmount: number;
  purchasesThisMonth: number;
  receivedThisMonth: number;
};

export type PurchasingSupplierOption = {
  id: string;
  supplierName: string;
};

export type PurchasingProductOption = {
  id: string;
  productName: string;
  productCode: string;
};

export type PurchasingIngredientOption = {
  id: string;
  ingredientName: string;
  ingredientCode: string;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  costPerUnit: number;
};

export type PurchasingUnitOption = {
  id: string;
  unitName: string;
  symbol: string;
};

export type PurchasingTaxRateOption = {
  id: string;
  taxName: string;
  taxPercentage: number;
};

export type PurchasingBranchOption = {
  id: string;
  branchName: string;
  status: BranchStatus;
};

export type PurchasingFilters = {
  search: string;
  supplierId: string;
  branchId: string;
  status: string;
  paymentStatus?: string;
  dateFrom: string;
  dateTo: string;
};

export type PurchaseItemLinePayload = {
  itemType: PurchaseItemType;
  productId: string | null;
  ingredientId: string | null;
  packagingItemId: string | null;
  quantity: number;
  unitId: string;
  unitCost: number;
  discountAmount: number;
  taxRateId: string | null;
  expiryDate?: string | null;
  batchNumber?: string | null;
};

export type PurchaseItemLineDraft = PurchaseItemLinePayload & {
  lineId: string;
};

export type CreatePurchaseOrderPayload = {
  branchId: string;
  supplierId: string;
  orderDate: string;
  expectedDeliveryDate: string | null;
  items: PurchaseItemLinePayload[];
  notes: string | null;
};

export type UpdatePurchaseOrderPayload = Partial<CreatePurchaseOrderPayload>;

export type UpdatePurchaseOrderStatusPayload = {
  status: PurchaseOrderStatus;
};

export type CreatePurchaseInvoicePayload = {
  branchId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  items: PurchaseItemLinePayload[];
  notes: string | null;
};

export type UpdatePurchaseInvoicePayload = Partial<CreatePurchaseInvoicePayload>;

export type ReceivePurchasePayload = {
  branchId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  purchaseInvoiceId: string | null;
  receivedDate: string;
  items: PurchaseItemLinePayload[];
  notes: string | null;
};
