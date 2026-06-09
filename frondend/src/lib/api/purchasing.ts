import { apiRequest } from "@/lib/api/client";
import type { ItemStructure, ProductType } from "@/types/product";
import { ITEM_STRUCTURES, PRODUCT_TYPES } from "@/types/product";
import type {
  AddSupplierPaymentPayload,
  ConvertPurchaseInvoiceToReceiptPayload,
  ConvertPurchaseOrderToInvoicePayload,
  CreatePurchaseInvoicePayload,
  CreatePurchaseOrderPayload,
  CreatePurchaseReturnPayload,
  PurchaseDocumentChain,
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
  PurchaseReturn,
  PurchaseReturnFilters,
  PurchaseReturnItem,
  PurchaseReturnStatus,
  PurchasingBranchOption,
  PurchasingFilters,
  PurchasingIngredientOption,
  PurchasingProductOption,
  PurchasingSummary,
  PurchasingSupplierOption,
  PurchasingTaxRateOption,
  PurchasingUnitOption,
  ReceivePurchasePayload,
  ReturnablePurchaseReceiptItem,
  ReversePurchaseReturnPayload,
  SupplierPayment,
  SupplierPaymentFilters,
  SupplierPaymentStatus,
  UpdatePurchaseInvoicePayload,
  UpdatePurchaseOrderPayload,
  UpdatePurchaseOrderStatusPayload,
  UpdatePurchaseReturnPayload,
} from "@/types/purchasing";

type BackendLinePayload = {
  item_type: "product";
  product_id?: string | null;
  product_variant_id?: string | null;
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

type BackendSupplierPaymentPayload = {
  amount: number;
  notes: string | null;
  paid_at: string | null;
  payment_method_id: string;
  reference_number: string | null;
};

type BackendConvertPurchaseOrderToInvoicePayload = {
  due_date?: string | null;
  invoice_date?: string | null;
  notes?: string | null;
};

type BackendConvertPurchaseInvoiceToReceiptPayload = {
  notes?: string | null;
  received_date?: string | null;
};

type BackendPurchaseReturnItemPayload = {
  purchase_receipt_item_id: string;
  quantity: number;
  reason: string | null;
  stock_location_id: string | null;
};

type BackendPurchaseReturnPayload = {
  items?: BackendPurchaseReturnItemPayload[];
  purchase_receipt_id?: string;
  reason?: string;
  return_date?: string;
  supplier_reference_number?: string | null;
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

  if (value === null || value === undefined) {
    return [];
  }

  if (isObject(value)) {
    const keys = [
      "items",
      "orders",
      "invoices",
      "receipts",
      "returns",
      "purchase_returns",
      "suppliers",
      "products",
      "ingredients",
      "payments",
      "supplier_payments",
      "supplierPayments",
      "records",
      "rows",
    ];
    for (const key of keys) {
      const nextValue = value[key];
      if (Array.isArray(nextValue)) {
        return nextValue.map(parser);
      }

      if (key in value && (nextValue === null || nextValue === undefined)) {
        return [];
      }

      if (isObject(nextValue)) {
        try {
          return parseList(nextValue, parser);
        } catch (error) {
          if (!(error instanceof Error) || error.message !== "Backend list payload is invalid.") {
            throw error;
          }
        }
      }
    }

    if ("data" in value) {
      return parseList(value.data, parser);
    }

    if ("pagination" in value || "total" in value || "total_pages" in value) {
      return [];
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

function isProductType(value: unknown): value is ProductType {
  return PRODUCT_TYPES.includes(value as ProductType);
}

function isItemStructure(value: unknown): value is ItemStructure {
  return ITEM_STRUCTURES.includes(value as ItemStructure);
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

function isSupplierPaymentStatus(value: unknown): value is SupplierPaymentStatus {
  return value === "completed" || value === "pending" || value === "failed";
}

function isPurchaseReturnStatus(value: unknown): value is PurchaseReturnStatus {
  return value === "draft" || value === "posted" || value === "cancelled" || value === "reversed";
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
    productVariantId: optionalString(value.product_variant_id),
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
    productVariantId: optionalString(value.product_variant_id),
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
    productVariantId: optionalString(value.product_variant_id),
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

function parsePurchaseReturnItem(value: unknown): PurchaseReturnItem {
  if (!isObject(value)) {
    throw new Error("Backend purchase return item payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    ingredientId: optionalString(value.ingredient_id),
    itemNameSnapshot: stringValue(value.item_name_snapshot, "Returned item"),
    itemType: isItemType(value.item_type) ? value.item_type : "product",
    lineTotal: numberValue(value.line_total),
    packagingItemId: optionalString(value.packaging_item_id),
    productId: optionalString(value.product_id),
    productVariantId: optionalString(value.product_variant_id),
    purchaseReceiptItemId: stringValue(value.purchase_receipt_item_id),
    quantity: numberValue(value.quantity),
    reason: optionalString(value.reason),
    stockLocationId: optionalString(value.stock_location_id),
    stockLocationName: optionalString(value.stock_location_name),
    stockMovementId: optionalString(value.stock_movement_id),
    unitCost: numberValue(value.unit_cost),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
  };
}

function parseReturnablePurchaseReceiptItem(value: unknown): ReturnablePurchaseReceiptItem {
  if (!isObject(value)) {
    throw new Error("Backend returnable purchase receipt item payload is invalid.");
  }

  return {
    batchNumber: optionalString(value.batch_number),
    expiryDate: optionalString(value.expiry_date),
    ingredientId: optionalString(value.ingredient_id),
    itemNameSnapshot: stringValue(value.item_name_snapshot, "Receipt item"),
    itemType: isItemType(value.item_type) ? value.item_type : "product",
    packagingItemId: optionalString(value.packaging_item_id),
    productId: optionalString(value.product_id),
    productVariantId: optionalString(value.product_variant_id),
    purchaseReceiptItemId: stringValue(value.purchase_receipt_item_id, stringValue(value.id)),
    receivedQuantity: numberValue(value.received_quantity, numberValue(value.quantity_received)),
    returnableQuantity: numberValue(
      value.returnable_quantity,
      numberValue(value.remaining_quantity),
    ),
    returnedQuantity: numberValue(value.returned_quantity),
    unitCost: numberValue(value.unit_cost),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
  };
}

function parsePurchaseReturn(value: unknown): PurchaseReturn {
  if (!isObject(value)) {
    throw new Error("Backend purchase return payload is invalid.");
  }

  return {
    appliedCreditAmount: numberValue(value.applied_credit_amount),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    cancelledAt: optionalString(value.cancelled_at),
    createdAt: stringValue(value.created_at),
    createdByUserName: stringValue(value.created_by_user_name, "User"),
    id: stringValue(value.id),
    items: Array.isArray(value.items) ? value.items.map(parsePurchaseReturnItem) : [],
    journalEntryId: optionalString(value.journal_entry_id),
    openCreditAmount: numberValue(value.open_credit_amount),
    postedAt: optionalString(value.posted_at),
    purchaseInvoiceId: stringValue(value.purchase_invoice_id),
    purchaseInvoiceNumber: stringValue(value.purchase_invoice_number, "Invoice"),
    purchaseReceiptId: stringValue(value.purchase_receipt_id),
    purchaseReceiptNumber: stringValue(value.purchase_receipt_number, "Receipt"),
    reason: optionalString(value.reason),
    returnDate: stringValue(value.return_date),
    returnNumber: stringValue(value.return_number, "Vendor credit"),
    returnTotal: numberValue(value.return_total, numberValue(value.total_amount)),
    status: isPurchaseReturnStatus(value.status) ? value.status : "draft",
    supplierId: stringValue(value.supplier_id),
    supplierName: stringValue(value.supplier_name, "Supplier"),
    supplierReferenceNumber: optionalString(value.supplier_reference_number),
    reversedAt: optionalString(value.reversed_at),
    reversedByUserId: optionalString(value.reversed_by_user_id),
    reversedByUserName: optionalString(value.reversed_by_user_name),
    originalReturnId: optionalString(value.original_return_id),
    originalReturnNumber: optionalString(value.original_return_number),
    reversalReturnId: optionalString(value.reversal_return_id),
    reversalReturnNumber: optionalString(value.reversal_return_number),
    reversalJournalEntryId: optionalString(value.reversal_journal_entry_id),
    reversalReason: optionalString(value.reversal_reason),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseSupplierPayment(value: unknown): SupplierPayment {
  if (!isObject(value)) {
    throw new Error("Backend supplier payment payload is invalid.");
  }

  return {
    id: stringValue(value.payment_id, stringValue(value.id)),
    purchaseInvoiceId: stringValue(value.purchase_invoice_id),
    invoiceNumber: stringValue(value.invoice_number, "Invoice"),
    supplierId: stringValue(value.supplier_id),
    supplierName: stringValue(value.supplier_name, "Supplier"),
    branchId: stringValue(value.branch_id),
    branchName: stringValue(value.branch_name, "Branch"),
    paymentMethodId: stringValue(value.payment_method_id),
    paymentMethodName: stringValue(value.payment_method_name, "Payment method"),
    paymentMethodType: stringValue(value.payment_method_type),
    amount: numberValue(value.amount),
    paymentStatus: isSupplierPaymentStatus(value.payment_status)
      ? value.payment_status
      : "completed",
    referenceNumber: optionalString(value.reference_number),
    paidByUserId: stringValue(value.paid_by_user_id),
    paidByUserName: stringValue(value.paid_by_user_name, "User"),
    paidAt: stringValue(value.paid_at),
    notes: optionalString(value.notes),
  };
}

function parseDocumentChain(value: unknown): PurchaseDocumentChain {
  const source = isObject(value) && isObject(value.data) ? value.data : value;

  if (!isObject(source)) {
    throw new Error("Backend purchasing document chain payload is invalid.");
  }

  return {
    purchaseInvoices: Array.isArray(source.purchase_invoices)
      ? source.purchase_invoices.map(parseDocumentChainInvoice)
      : [],
    purchaseOrder: isObject(source.purchase_order)
      ? parseDocumentChainOrder(source.purchase_order)
      : null,
    purchaseReceipts: Array.isArray(source.purchase_receipts)
      ? source.purchase_receipts.map(parseDocumentChainReceipt)
      : [],
    purchaseReturns: Array.isArray(source.purchase_returns)
      ? source.purchase_returns.map(parseDocumentChainPurchaseReturn)
      : [],
    supplierPayments: Array.isArray(source.supplier_payments)
      ? source.supplier_payments.map(parseDocumentChainSupplierPayment)
      : [],
  };
}

function parseDocumentChainOrder(value: unknown): PurchaseOrder {
  if (!isObject(value)) {
    throw new Error("Backend purchase order chain payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    branchId: "",
    branchName: "",
    createdAt: "",
    createdByUserName: "User",
    discountAmount: 0,
    expectedDeliveryDate: null,
    items: [],
    notes: null,
    orderDate: stringValue(value.date, stringValue(value.order_date)),
    purchaseOrderNumber: stringValue(
      value.document_number,
      stringValue(value.purchase_order_number, "PO"),
    ),
    status: isOrderStatus(value.status) ? value.status : "draft",
    subtotalAmount: 0,
    supplierId: "",
    supplierName: "",
    taxAmount: 0,
    totalAmount: numberValue(value.total_amount),
    updatedAt: "",
  };
}

function parseDocumentChainInvoice(value: unknown): PurchaseInvoice {
  if (!isObject(value)) {
    throw new Error("Backend purchase invoice chain payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    balanceAmount: 0,
    branchId: "",
    branchName: "",
    createdAt: "",
    createdByUserName: "User",
    discountAmount: 0,
    dueDate: null,
    invoiceDate: stringValue(value.date, stringValue(value.invoice_date)),
    invoiceNumber: stringValue(value.document_number, stringValue(value.invoice_number, "Invoice")),
    items: [],
    notes: null,
    paidAmount: 0,
    paymentStatus: isPaymentStatus(value.payment_status) ? value.payment_status : "unpaid",
    purchaseOrderId: optionalString(value.purchase_order_id),
    status: isInvoiceStatus(value.status) ? value.status : "draft",
    subtotalAmount: 0,
    supplierId: "",
    supplierName: "",
    taxAmount: 0,
    totalAmount: numberValue(value.total_amount),
    updatedAt: "",
  };
}

function parseDocumentChainReceipt(value: unknown): PurchaseReceipt {
  if (!isObject(value)) {
    throw new Error("Backend purchase receipt chain payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    branchId: "",
    branchName: "",
    createdAt: "",
    items: [],
    notes: null,
    purchaseInvoiceId: optionalString(value.purchase_invoice_id),
    purchaseOrderId: optionalString(value.purchase_order_id),
    receiptNumber: stringValue(value.document_number, stringValue(value.receipt_number, "Receipt")),
    receivedByUserName: "User",
    receivedDate: stringValue(value.date, stringValue(value.received_date)),
    status: isReceiptStatus(value.status) ? value.status : "draft",
    supplierId: "",
    supplierName: "",
    updatedAt: "",
  };
}

function parseDocumentChainPurchaseReturn(value: unknown): PurchaseReturn {
  if (!isObject(value)) {
    throw new Error("Backend purchase return chain payload is invalid.");
  }

  return {
    appliedCreditAmount: numberValue(value.applied_credit_amount),
    branchId: "",
    branchName: "",
    cancelledAt: null,
    createdAt: "",
    createdByUserName: "User",
    id: stringValue(value.id),
    items: [],
    journalEntryId: optionalString(value.journal_entry_id),
    openCreditAmount: numberValue(value.open_credit_amount),
    postedAt: optionalString(value.posted_at),
    purchaseInvoiceId: stringValue(value.purchase_invoice_id),
    purchaseInvoiceNumber: stringValue(value.purchase_invoice_number, "Invoice"),
    purchaseReceiptId: stringValue(value.purchase_receipt_id),
    purchaseReceiptNumber: stringValue(value.purchase_receipt_number, "Receipt"),
    reason: optionalString(value.reason),
    returnDate: stringValue(value.date, stringValue(value.return_date)),
    returnNumber: stringValue(
      value.document_number,
      stringValue(value.return_number, "Vendor credit"),
    ),
    returnTotal: numberValue(value.total_amount, numberValue(value.return_total)),
    status: isPurchaseReturnStatus(value.status) ? value.status : "draft",
    supplierId: "",
    supplierName: "",
    supplierReferenceNumber: optionalString(value.supplier_reference_number),
    reversedAt: optionalString(value.reversed_at),
    reversedByUserId: optionalString(value.reversed_by_user_id),
    reversedByUserName: optionalString(value.reversed_by_user_name),
    originalReturnId: optionalString(value.original_return_id),
    originalReturnNumber: optionalString(value.original_return_number),
    reversalReturnId: optionalString(value.reversal_return_id),
    reversalReturnNumber: optionalString(value.reversal_return_number),
    reversalJournalEntryId: optionalString(value.reversal_journal_entry_id),
    reversalReason: optionalString(value.reversal_reason),
    updatedAt: "",
  };
}

function parseDocumentChainSupplierPayment(value: unknown): SupplierPayment {
  if (!isObject(value)) {
    throw new Error("Backend supplier payment chain payload is invalid.");
  }

  return {
    id: stringValue(value.payment_id, stringValue(value.id)),
    amount: numberValue(value.total_amount, numberValue(value.amount)),
    branchId: "",
    branchName: "",
    invoiceNumber: stringValue(
      value.document_number,
      stringValue(value.invoice_number, "Supplier payment"),
    ),
    notes: null,
    paidAt: stringValue(value.date, stringValue(value.paid_at)),
    paidByUserId: "",
    paidByUserName: "User",
    paymentMethodId: "",
    paymentMethodName: "Supplier payment",
    paymentMethodType: "",
    paymentStatus: isSupplierPaymentStatus(value.status) ? value.status : "completed",
    purchaseInvoiceId: stringValue(value.purchase_invoice_id),
    referenceNumber: null,
    supplierId: "",
    supplierName: "",
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

  const productType = isProductType(value.product_type) ? value.product_type : "finished_product";
  const itemStructure = isItemStructure(value.item_structure) ? value.item_structure : "single";
  const unit = isObject(value.unit) ? value.unit : {};
  const variants = Array.isArray(value.variants) ? value.variants : [];

  return {
    id: stringValue(value.id),
    productName: stringValue(value.product_name, "Product"),
    productCode: stringValue(value.product_code, stringValue(value.sku)),
    barcode: optionalString(value.barcode),
    costPrice: typeof value.cost_price === "number" ? value.cost_price : null,
    isStockTracked: value.is_stock_tracked === true,
    itemStructure,
    productType,
    sku: optionalString(value.sku),
    unitId: stringValue(value.unit_id, stringValue(unit.id)),
    unitName: stringValue(value.unit_name, stringValue(unit.unit_name, "Unit")),
    unitSymbol: stringValue(value.unit_symbol, stringValue(unit.symbol)),
    variants: variants.filter(isObject).map((variant) => ({
      barcode: optionalString(variant.barcode),
      costPrice: typeof variant.cost_price === "number" ? variant.cost_price : null,
      id: stringValue(variant.id),
      sku: optionalString(variant.sku),
      status: variant.status === "inactive" ? "inactive" : "active",
      variantName: stringValue(variant.variant_name, "Variant"),
    })),
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
    item_type: "product",
    product_id: line.productId,
    product_variant_id: line.productVariantId,
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

function supplierPaymentPayload(payload: AddSupplierPaymentPayload): BackendSupplierPaymentPayload {
  return {
    amount: payload.amount,
    notes: payload.notes,
    paid_at: payload.paidAt,
    payment_method_id: payload.paymentMethodId,
    reference_number: payload.referenceNumber,
  };
}

function convertOrderToInvoicePayload(
  payload: ConvertPurchaseOrderToInvoicePayload = {},
): BackendConvertPurchaseOrderToInvoicePayload {
  const nextPayload: BackendConvertPurchaseOrderToInvoicePayload = {};

  if (payload.invoiceDate !== undefined) nextPayload.invoice_date = payload.invoiceDate;
  if (payload.dueDate !== undefined) nextPayload.due_date = payload.dueDate;
  if (payload.notes !== undefined) nextPayload.notes = payload.notes;

  return nextPayload;
}

function convertInvoiceToReceiptPayload(
  payload: ConvertPurchaseInvoiceToReceiptPayload = {},
): BackendConvertPurchaseInvoiceToReceiptPayload {
  const nextPayload: BackendConvertPurchaseInvoiceToReceiptPayload = {};

  if (payload.receivedDate !== undefined) nextPayload.received_date = payload.receivedDate;
  if (payload.notes !== undefined) nextPayload.notes = payload.notes;

  return nextPayload;
}

function purchaseReturnPayload(
  payload: CreatePurchaseReturnPayload | UpdatePurchaseReturnPayload,
): BackendPurchaseReturnPayload {
  const nextPayload: BackendPurchaseReturnPayload = {};

  if (payload.purchaseReceiptId !== undefined) {
    nextPayload.purchase_receipt_id = payload.purchaseReceiptId;
  }
  if (payload.returnDate !== undefined) nextPayload.return_date = payload.returnDate;
  if (payload.reason !== undefined) nextPayload.reason = payload.reason;
  if (payload.supplierReferenceNumber !== undefined) {
    nextPayload.supplier_reference_number = payload.supplierReferenceNumber;
  }
  if (payload.items !== undefined) {
    nextPayload.items = payload.items.map((item) => ({
      purchase_receipt_item_id: item.purchaseReceiptItemId,
      quantity: item.quantity,
      reason: item.reason,
      stock_location_id: item.stockLocationId,
    }));
  }

  return nextPayload;
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

export async function convertPurchaseOrderToInvoice(
  id: string,
  payload: ConvertPurchaseOrderToInvoicePayload = {},
): Promise<PurchaseInvoice> {
  const response = await apiRequest<PurchaseInvoice, BackendConvertPurchaseOrderToInvoicePayload>(
    `/api/v1/purchasing/orders/${id}/convert-to-invoice`,
    {
      authMode: "appwrite",
      body: convertOrderToInvoicePayload(payload),
      method: "POST",
      parse: parseInvoice,
    },
  );

  return response.data;
}

export async function getPurchaseOrderDocumentChain(id: string): Promise<PurchaseDocumentChain> {
  const response = await apiRequest<PurchaseDocumentChain>(
    `/api/v1/purchasing/orders/${id}/document-chain`,
    {
      authMode: "appwrite",
      parse: parseDocumentChain,
    },
  );

  return response.data;
}

export async function getPurchaseDocumentChainByOrder(
  orderId: string,
): Promise<PurchaseDocumentChain> {
  const response = await apiRequest<PurchaseDocumentChain>(
    `/api/v1/purchasing/document-chain${toQueryString({ purchase_order_id: orderId })}`,
    {
      authMode: "appwrite",
      parse: parseDocumentChain,
    },
  );

  return response.data;
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

export async function convertPurchaseInvoiceToReceipt(
  id: string,
  payload: ConvertPurchaseInvoiceToReceiptPayload = {},
): Promise<PurchaseReceipt> {
  const response = await apiRequest<PurchaseReceipt, BackendConvertPurchaseInvoiceToReceiptPayload>(
    `/api/v1/purchasing/invoices/${id}/convert-to-receipt`,
    {
      authMode: "appwrite",
      body: convertInvoiceToReceiptPayload(payload),
      method: "POST",
      parse: parseReceipt,
    },
  );

  return response.data;
}

export async function getSupplierPayments(
  params: SupplierPaymentFilters,
): Promise<SupplierPayment[]> {
  const response = await apiRequest<SupplierPayment[]>(
    `/api/v1/purchasing/payments${toQueryString({
      branch_id: params.branchId,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      paid_by_user_id: params.paidByUserId,
      payment_method_id: params.paymentMethodId,
      payment_status: params.paymentStatus,
      purchase_invoice_id: params.purchaseInvoiceId,
      search: params.search,
      sort_by: params.sortBy,
      sort_order: params.sortOrder,
      supplier_id: params.supplierId,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseSupplierPayment),
    },
  );

  return response.data;
}

export async function getSupplierInvoicePayments(invoiceId: string): Promise<SupplierPayment[]> {
  const response = await apiRequest<SupplierPayment[]>(
    `/api/v1/purchasing/invoices/${invoiceId}/payments`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseSupplierPayment),
    },
  );

  return response.data;
}

export async function addSupplierInvoicePayment(
  invoiceId: string,
  payload: AddSupplierPaymentPayload,
): Promise<SupplierPayment> {
  const response = await apiRequest<SupplierPayment, BackendSupplierPaymentPayload>(
    `/api/v1/purchasing/invoices/${invoiceId}/payments`,
    {
      authMode: "appwrite",
      body: supplierPaymentPayload(payload),
      method: "POST",
      parse: parseSupplierPayment,
    },
  );

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

export async function getPurchaseReturns(params: PurchaseReturnFilters): Promise<PurchaseReturn[]> {
  const response = await apiRequest<PurchaseReturn[]>(
    `/api/v1/purchasing/returns${toQueryString({
      branch_id: params.branchId,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      search: params.search,
      status: params.status,
      supplier_id: params.supplierId,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parsePurchaseReturn),
    },
  );

  return response.data;
}

export async function createPurchaseReturn(
  payload: CreatePurchaseReturnPayload,
): Promise<PurchaseReturn> {
  const response = await apiRequest<PurchaseReturn, BackendPurchaseReturnPayload>(
    "/api/v1/purchasing/returns",
    {
      authMode: "appwrite",
      body: purchaseReturnPayload(payload),
      method: "POST",
      parse: parsePurchaseReturn,
    },
  );

  return response.data;
}

export async function getPurchaseReturnById(id: string): Promise<PurchaseReturn> {
  const response = await apiRequest<PurchaseReturn>(`/api/v1/purchasing/returns/${id}`, {
    authMode: "appwrite",
    parse: parsePurchaseReturn,
  });

  return response.data;
}

export async function updatePurchaseReturn(
  id: string,
  payload: UpdatePurchaseReturnPayload,
): Promise<PurchaseReturn> {
  const response = await apiRequest<PurchaseReturn, BackendPurchaseReturnPayload>(
    `/api/v1/purchasing/returns/${id}`,
    {
      authMode: "appwrite",
      body: purchaseReturnPayload(payload),
      method: "PATCH",
      parse: parsePurchaseReturn,
    },
  );

  return response.data;
}

export async function postPurchaseReturn(id: string): Promise<PurchaseReturn> {
  const response = await apiRequest<PurchaseReturn>(`/api/v1/purchasing/returns/${id}/post`, {
    authMode: "appwrite",
    method: "POST",
    parse: parsePurchaseReturn,
  });

  return response.data;
}

export async function cancelPurchaseReturn(id: string): Promise<PurchaseReturn> {
  const response = await apiRequest<PurchaseReturn>(`/api/v1/purchasing/returns/${id}/cancel`, {
    authMode: "appwrite",
    method: "POST",
    parse: parsePurchaseReturn,
  });

  return response.data;
}

export async function reversePurchaseReturn(
  id: string,
  payload: ReversePurchaseReturnPayload,
): Promise<PurchaseReturn> {
  const response = await apiRequest<PurchaseReturn, { reason: string }>(
    `/api/v1/purchasing/returns/${id}/reverse`,
    {
      authMode: "appwrite",
      body: {
        reason: payload.reason,
      },
      method: "POST",
      parse: parsePurchaseReturn,
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

export async function getPurchaseReceiptReturnableItems(
  receiptId: string,
): Promise<ReturnablePurchaseReceiptItem[]> {
  const response = await apiRequest<ReturnablePurchaseReceiptItem[]>(
    `/api/v1/purchasing/receipts/${receiptId}/returnable-items`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseReturnablePurchaseReceiptItem),
    },
  );

  return response.data;
}

export async function getPurchaseReceiptReturns(receiptId: string): Promise<PurchaseReturn[]> {
  const response = await apiRequest<PurchaseReturn[]>(
    `/api/v1/purchasing/receipts/${receiptId}/returns`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parsePurchaseReturn),
    },
  );

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
  const response = await apiRequest<PurchasingProductOption[]>(
    "/api/v1/products?status=active&limit=100",
    {
      authMode: "appwrite",
      parse: (data) =>
        parseList(data, parseProduct).filter((product) =>
          [
            "ingredient",
            "packaging",
            "raw_material",
            "semi_finished",
            "consumable",
            "equipment",
          ].includes(product.productType),
        ),
    },
  );

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
