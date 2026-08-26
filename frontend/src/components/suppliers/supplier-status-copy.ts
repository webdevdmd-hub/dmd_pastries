import type { SupplierStatus } from "@/types/supplier";

/**
 * What each status means for purchasing, in one place.
 *
 * "Deactivate" and "Block" used to sit next to each other in a dropdown with
 * nothing saying how they differ or what either does to an open purchase order.
 * Both read as "stop using this supplier"; only one of them also stops billing.
 * The form, the row menu and the confirm dialog all read these strings, so the
 * three cannot drift apart.
 */

type StatusCopy = {
  /** Sentence case, for the option row and the badge. */
  label: string;
  /** One line, what the state is for. */
  summary: string;
  /** The consequences, most surprising first. */
  effects: { allowed: boolean; text: string }[];
  /** Imperative, for the menu item and the confirm button. */
  verb: string;
};

export const SUPPLIER_STATUS_COPY: Record<SupplierStatus, StatusCopy> = {
  active: {
    label: "Active",
    summary: "The normal state. Everything is allowed.",
    effects: [
      { allowed: true, text: "New purchase orders" },
      { allowed: true, text: "New bills" },
      { allowed: true, text: "Shown in supplier pickers" },
    ],
    verb: "Activate",
  },
  inactive: {
    label: "Inactive",
    summary: "Dormant. You have stopped ordering, but the records stay.",
    effects: [
      { allowed: false, text: "New purchase orders" },
      { allowed: true, text: "Receiving and paying what is already open" },
      { allowed: false, text: "Shown in supplier pickers" },
    ],
    verb: "Deactivate",
  },
  blocked: {
    label: "Blocked",
    summary: "A hold: dispute, quality, or compliance. Stronger than inactive.",
    effects: [
      { allowed: false, text: "New purchase orders" },
      { allowed: false, text: "New bills" },
      { allowed: true, text: "Paying bills that are already posted" },
    ],
    verb: "Block",
  },
};

/** The one-line hint shown under the status control while it is selected. */
export function supplierStatusHint(status: SupplierStatus): string {
  return SUPPLIER_STATUS_COPY[status].summary;
}
