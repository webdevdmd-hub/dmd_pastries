import { ApiError, getErrorMessage } from "@/lib/api/client";

const PURCHASE_INVOICE_UPDATE_CONFLICT_MESSAGES: Record<string, string> = {
  purchase_invoice_has_payments: "This posted bill has supplier payments and cannot be edited.",
  purchase_invoice_has_receipts:
    "This posted bill has received stock history and cannot be edited.",
  purchase_invoice_has_vendor_credits: "This posted bill has vendor credits and cannot be edited.",
};

export function getPurchaseInvoiceUpdateErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const reason = error.errorDetails?.reason;

    if (typeof reason === "string") {
      return PURCHASE_INVOICE_UPDATE_CONFLICT_MESSAGES[reason] ?? error.message;
    }
  }

  return getErrorMessage(error);
}
