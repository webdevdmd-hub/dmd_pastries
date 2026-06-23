import type { BranchStatus } from "@/types/branch";
import type { ItemStructure, ProductType } from "@/types/product";

export type PurchaseOrderStatus =
  | "draft"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

export type PurchaseInvoiceStatus = "draft" | "posted" | "cancelled";

export type PurchasePaymentStatus = "unpaid" | "partial" | "paid" | "overdue";

export type PurchaseReceiptStatus = "draft" | "posted" | "cancelled";

export type PurchaseLineType = "product" | "account";

export type PurchaseItemType = "product" | "ingredient" | "packaging" | "account";

export type SupplierPaymentStatus = "completed" | "voided";

export type PurchaseReturnStatus = "draft" | "posted" | "cancelled" | "reversed";

export type PurchaseOrderItem = {
  id: string;
  lineType: PurchaseLineType;
  itemType: PurchaseItemType;
  productId: string | null;
  productVariantId: string | null;
  ingredientId: string | null;
  packagingItemId: string | null;
  accountId: string | null;
  accountName: string | null;
  accountCode: string | null;
  description: string | null;
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
  lineType: PurchaseLineType;
  itemType: PurchaseItemType;
  productId: string | null;
  productVariantId: string | null;
  ingredientId: string | null;
  packagingItemId: string | null;
  accountId: string | null;
  accountName: string | null;
  accountCode: string | null;
  description: string | null;
  itemNameSnapshot: string;
  quantity: number;
  quantityReceived: number;
  quantityRemaining: number;
  canReceive: boolean;
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
  productVariantId: string | null;
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

export type PurchaseReturnItem = {
  id: string;
  purchaseReceiptItemId: string;
  itemType: PurchaseItemType;
  productId: string | null;
  productVariantId: string | null;
  ingredientId: string | null;
  packagingItemId: string | null;
  itemNameSnapshot: string;
  quantity: number;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  unitCost: number;
  lineTotal: number;
  stockLocationId: string | null;
  stockLocationName: string | null;
  reason: string | null;
  stockMovementId: string | null;
};

export type ReturnablePurchaseReceiptItem = {
  purchaseReceiptItemId: string;
  itemType: PurchaseItemType;
  productId: string | null;
  productVariantId: string | null;
  ingredientId: string | null;
  packagingItemId: string | null;
  itemNameSnapshot: string;
  receivedQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  unitCost: number;
  batchNumber: string | null;
  expiryDate: string | null;
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
  purchaseOrderNumber: string | null;
  invoiceNumber: string;
  supplierBillNumber: string | null;
  invoiceDate: string;
  dueDate: string | null;
  status: PurchaseInvoiceStatus;
  paymentStatus: PurchasePaymentStatus;
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  billDiscountAmount: number;
  chargeAmount: number;
  chargeTaxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  receiveStatus: "not_received" | "partially_received" | "received";
  canReceiveStock: boolean;
  notes: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancelReason: string | null;
  cancelledReceiptId: string | null;
  reversalJournalEntryId: string | null;
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
  purchaseOrderNumber: string | null;
  purchaseInvoiceId: string | null;
  purchaseInvoiceNumber: string | null;
  receiptNumber: string;
  receivedDate: string;
  status: PurchaseReceiptStatus;
  receivedByUserName: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseReceiptItem[];
};

export type PurchaseReturn = {
  id: string;
  branchId: string;
  branchName: string;
  supplierId: string;
  supplierName: string;
  purchaseInvoiceId: string;
  purchaseInvoiceNumber: string;
  purchaseReceiptId: string;
  purchaseReceiptNumber: string;
  returnNumber: string;
  returnDate: string;
  status: PurchaseReturnStatus;
  reason: string | null;
  supplierReferenceNumber: string | null;
  returnTotal: number;
  appliedCreditAmount: number;
  openCreditAmount: number;
  journalEntryId: string | null;
  createdByUserName: string;
  postedAt: string | null;
  cancelledAt: string | null;
  reversedAt: string | null;
  reversedByUserId: string | null;
  reversedByUserName: string | null;
  originalReturnId: string | null;
  originalReturnNumber: string | null;
  reversalReturnId: string | null;
  reversalReturnNumber: string | null;
  reversalJournalEntryId: string | null;
  reversalReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseReturnItem[];
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
  sku: string | null;
  barcode: string | null;
  productType: ProductType;
  itemStructure: ItemStructure;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  costPrice: number | null;
  isStockTracked: boolean;
  variants: PurchasingProductVariantOption[];
};

export type PurchasingProductVariantOption = {
  id: string;
  variantName: string;
  sku: string | null;
  barcode: string | null;
  costPrice: number | null;
  status: "active" | "inactive";
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

export type SupplierPaymentFilters = {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  paidByUserId: string;
  paymentMethodId: string;
  paymentStatus: string;
  purchaseInvoiceId: string;
  search: string;
  sortBy: string;
  sortOrder: string;
  supplierId: string;
};

export type SupplierPaymentAllocation = {
  id: string;
  supplierPaymentId: string;
  purchaseInvoiceId: string;
  invoiceNumber: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseReturnFilters = {
  branchId: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  status: string;
  supplierId: string;
};

export type SupplierPayment = {
  id: string;
  purchaseInvoiceId: string | null;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  paymentMethodId: string;
  paymentMethodName: string;
  paymentMethodType: string;
  paidThroughAccountId: string | null;
  paidThroughAccountName: string | null;
  amount: number;
  allocatedAmount: number;
  unappliedAmount: number;
  paymentStatus: SupplierPaymentStatus;
  status: SupplierPaymentStatus;
  referenceNumber: string | null;
  paidByUserId: string;
  paidByUserName: string;
  paidAt: string;
  paymentDate: string;
  notes: string | null;
  allocations: SupplierPaymentAllocation[];
};

export type PurchaseItemLinePayload = {
  id?: string | undefined;
  lineType?: PurchaseLineType | undefined;
  itemType: PurchaseItemType;
  productId: string | null;
  productVariantId: string | null;
  ingredientId: string | null;
  packagingItemId: string | null;
  accountId?: string | null;
  description?: string | null;
  itemNameSnapshot?: string | null | undefined;
  quantity: number;
  unitId: string;
  unitCost: number;
  discountAmount: number;
  taxRateId: string | null;
  expiryDate?: string | null;
  batchNumber?: string | null;
};

export type PurchaseItemLineDraft = PurchaseItemLinePayload & {
  itemNameSnapshot?: string | null;
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

export type PurchaseOrderRevisionPaymentExcessAction =
  | "supplier_advance"
  | "vendor_credit"
  | "refund_receivable";

export type PurchaseOrderRevisionImpact = {
  originalTotal: number;
  revisedTotal: number;
  differenceAmount: number;
  extraQuantityToReceive: number;
  overReceivedQuantity: number;
  hasFinalizedHistory: boolean;
  postedReceiptCount: number;
  postedInvoiceCount: number;
  supplierPaymentCount: number;
  stockMovementCount: number;
  vendorCreditCount: number;
  inventoryImpact: string;
  billImpact: string;
  paymentImpact: string;
  accountingImpact: string;
  supplierBalanceImpact: string;
};

export type CreatePurchaseOrderRevisionPayload = UpdatePurchaseOrderPayload & {
  paymentExcessAction?: PurchaseOrderRevisionPaymentExcessAction;
  reason?: string | null;
};

export type PurchaseOrderRevision = {
  id: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  revisionNumber: number;
  status: "previewed" | "applied" | "failed";
  paymentExcessAction: PurchaseOrderRevisionPaymentExcessAction;
  reason: string | null;
  impact: PurchaseOrderRevisionImpact;
  order: PurchaseOrder;
  createdAt: string;
};

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
  billDiscountAmount?: number | undefined;
  notes: string | null;
};

export type UpdatePurchaseInvoicePayload = Partial<CreatePurchaseInvoicePayload>;

export type CancelPurchaseInvoicePayload = {
  reason: string;
};

export type ReceivePurchasePayload = {
  branchId: string;
  supplierId: string;
  purchaseOrderId: string | null;
  purchaseInvoiceId: string | null;
  receivedDate: string;
  items: PurchaseItemLinePayload[];
  notes: string | null;
};

export type ReceivePurchaseOrderItemPayload = {
  productId: string;
  productVariantId: string | null;
  quantityReceived: number;
  unitId: string;
  unitCost: number;
  batchNumber: string | null;
  expiryDate: string | null;
};

export type ReceivePurchaseOrderPayload = {
  receivedDate: string;
  notes: string | null;
  items?: ReceivePurchaseOrderItemPayload[];
};

export type AddSupplierPaymentPayload = {
  amount: number;
  notes: string | null;
  paidAt: string | null;
  paymentMethodId: string;
  paidThroughAccountId?: string | null;
  referenceNumber: string | null;
};

export type CreateSupplierPaymentPayload = {
  supplierId: string;
  branchId: string;
  paymentMethodId: string;
  paidThroughAccountId: string | null;
  amount: number;
  referenceNumber: string | null;
  paymentDate: string | null;
  notes: string | null;
  allocations: {
    purchaseInvoiceId: string;
    amount: number;
  }[];
};

export type UpdateSupplierPaymentPayload = CreateSupplierPaymentPayload;

export type ConvertPurchaseOrderToInvoicePayload = {
  dueDate?: string | null;
  invoiceDate?: string | null;
  notes?: string | null;
};

export type ConvertPurchaseOrderToBillPayload = {
  dueDate?: string | null;
  invoiceDate?: string | null;
  notes?: string | null;
};

export type ConvertPurchaseInvoiceToReceiptPayload = {
  notes?: string | null;
  receivedDate?: string | null;
};

export type PurchaseReturnItemPayload = {
  purchaseReceiptItemId: string;
  quantity: number;
  stockLocationId: string | null;
  reason: string | null;
};

export type CreatePurchaseReturnPayload = {
  purchaseReceiptId: string;
  reason: string;
  returnDate: string;
  supplierReferenceNumber: string | null;
  items: PurchaseReturnItemPayload[];
};

export type UpdatePurchaseReturnPayload = Partial<CreatePurchaseReturnPayload>;

export type ReversePurchaseReturnPayload = {
  reason: string;
};

export type PurchaseDocumentChain = {
  purchaseOrder: PurchaseOrder | null;
  purchaseInvoices: PurchaseInvoice[];
  purchaseReceipts: PurchaseReceipt[];
  purchaseReturns: PurchaseReturn[];
  supplierPayments: SupplierPayment[];
};
