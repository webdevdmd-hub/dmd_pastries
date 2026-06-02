import type { PaymentMethod } from "@/types/settings";

export type RefundMode = "none" | "refund";
export type RestockAction = "restock" | "discard";
export type SalesReturnStatus = "draft" | "posted" | "cancelled" | "reversed";

export type ReturnableSaleItem = {
  saleItemId: string;
  productId: string | null;
  productVariantId: string | null;
  itemName: string;
  variantName: string | null;
  sku: string | null;
  soldQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type SalesReturnItem = {
  id: string;
  saleReturnId: string;
  saleItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  restockAction: RestockAction;
  stockLocationId: string | null;
  stockLocationName: string | null;
  reason: string | null;
};

export type SalesReturn = {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  saleId: string;
  saleNumber: string;
  returnNumber: string;
  returnDate: string;
  customerName: string | null;
  reason: string | null;
  refundMode: RefundMode;
  refundPaymentMethodId: string | null;
  refundPaymentMethodName: string | null;
  refundReferenceNumber: string | null;
  refundAmount: number;
  status: SalesReturnStatus;
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
  items: SalesReturnItem[];
};

export type SalesReturnFilters = {
  search: string;
  status: SalesReturnStatus | "all";
};

export type CreateSalesReturnItemPayload = {
  saleItemId: string;
  quantity: number;
  restockAction: RestockAction;
  stockLocationId?: string | null;
  reason?: string | null;
};

export type CreateSalesReturnPayload = {
  saleId: string;
  returnDate: string;
  reason: string;
  refundMode: RefundMode;
  refundPaymentMethodId?: string | null;
  refundReferenceNumber?: string | null;
  items: CreateSalesReturnItemPayload[];
};

export type ReverseSalesReturnPayload = {
  reason: string;
};

export type SalesReturnDraftFormItem = {
  saleItemId: string;
  quantity: number;
  restockAction: RestockAction;
  stockLocationId: string;
  reason: string;
};

export type ReturnPaymentMethod = Pick<
  PaymentMethod,
  "id" | "methodName" | "methodType" | "requiresReference" | "status"
>;
