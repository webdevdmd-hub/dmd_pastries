import type { PurchaseInvoiceFormInitialValues } from "@/components/purchasing/purchase-invoice-form-dialog";
import { createUuid } from "@/lib/uuid";
import type { PurchaseItemLineDraft, PurchaseOrder } from "@/types/purchasing";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function purchaseOrderItemToBillLine(item: PurchaseOrder["items"][number]): PurchaseItemLineDraft {
  if (item.lineType === "account") {
    return {
      accountId: item.accountId,
      description: item.description ?? item.itemNameSnapshot,
      discountAmount: item.discountAmount,
      ingredientId: null,
      itemNameSnapshot: item.itemNameSnapshot,
      itemType: "account",
      lineId: createUuid(),
      lineType: "account",
      packagingItemId: null,
      productId: null,
      productVariantId: null,
      quantity: item.quantityOrdered,
      taxRateId: item.taxRateId,
      unitCost: item.unitCost,
      unitId: "",
    };
  }

  return {
    batchNumber: null,
    discountAmount: item.discountAmount,
    expiryDate: null,
    ingredientId: item.ingredientId,
    itemNameSnapshot: item.itemNameSnapshot,
    itemType: "product",
    lineId: createUuid(),
    lineType: "product",
    packagingItemId: item.packagingItemId,
    productId: item.productId,
    productVariantId: item.productVariantId,
    quantity: item.quantityOrdered,
    taxRateId: item.taxRateId,
    unitCost: item.unitCost,
    unitId: item.unitId,
  };
}

export function purchaseOrderToBillInitialValues(
  order: PurchaseOrder,
): PurchaseInvoiceFormInitialValues {
  return {
    billDiscountAmount: 0,
    branchId: order.branchId,
    dueDate: null,
    invoiceDate: today(),
    invoiceNumber: "",
    items: order.items.map(purchaseOrderItemToBillLine),
    notes: `Created from ${order.purchaseOrderNumber}`,
    purchaseOrderId: order.id,
    purchaseOrderNumber: order.purchaseOrderNumber,
    supplierId: order.supplierId,
  };
}
