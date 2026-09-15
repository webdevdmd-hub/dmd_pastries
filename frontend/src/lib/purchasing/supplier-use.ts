import type { PurchasingSupplierOption } from "@/types/purchasing";
import type { SupplierStatus } from "@/types/supplier";

/**
 * What a supplier picker is choosing a supplier FOR.
 *
 * Mirrors supplierAllows in backend/internal/modules/purchasing/service.go,
 * which transcribes the supplier status dialogs:
 *
 *   Deactivate  "New purchase orders: not allowed.
 *                Receiving and paying what is already open: allowed."
 *   Block       "New purchase orders: not allowed. New bills: not allowed.
 *                Paying bills that are already posted: allowed."
 *
 * A picker that offers fewer suppliers than the server accepts hides a
 * permitted action; one that offers more invites a refusal. Both happened.
 */
export type SupplierUse =
  /** A purchase order, or a bill, receipt or expense not linked to an order. */
  | "new_document"
  /** Receiving or billing a purchase order that already exists. */
  | "open_document"
  /** Paying posted bills. An advance still needs an active supplier; the server says so. */
  | "payment"
  /** Filtering history, and returns against goods already received. */
  | "history";

export function supplierAllows(status: SupplierStatus, use: SupplierUse): boolean {
  switch (use) {
    case "history":
    case "payment":
      // Every status: a status never hides history or a debt already owed.
      return true;
    case "open_document":
      return status === "active" || status === "inactive";
    case "new_document":
      return status === "active";
  }
}

/**
 * The suppliers a picker may offer for a use. The supplier already on the
 * document is always kept, so opening an existing document never blanks its
 * supplier field just because that supplier has since been deactivated.
 */
export function supplierOptionsFor(
  suppliers: PurchasingSupplierOption[],
  use: SupplierUse,
  selectedId = "",
): PurchasingSupplierOption[] {
  return suppliers.filter(
    (supplier) =>
      supplierAllows(supplier.status, use) || (selectedId !== "" && supplier.id === selectedId),
  );
}

/** A filter label that marks a supplier that is not active. */
export function supplierFilterLabel(supplier: PurchasingSupplierOption): string {
  const note = supplierStatusNote(supplier.status);
  return note ? `${supplier.supplierName} (${note})` : supplier.supplierName;
}

/** Shown beside a supplier that is not active, so the picker explains itself. */
export function supplierStatusNote(status: SupplierStatus): string | null {
  if (status === "inactive") return "Inactive";
  if (status === "blocked") return "Blocked";
  return null;
}
