import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { PurchaseOrderStatus } from "@/types/purchasing";

const labels: Record<PurchaseOrderStatus, string> = {
  cancelled: "Cancelled",
  draft: "Draft",
  ordered: "Ordered",
  partially_received: "Partially received",
  received: "Received",
};

/**
 * Every status gets its own semantic variant, and every variant carries the 5px
 * dot (DESIGN.md §6). Before this, four of the five rendered as the same
 * neutral outline pill and the fifth carried a hand-rolled danger tint with no
 * dot -- so a buyer scanning the ledger could not tell a draft from a half-
 * arrived order, and Cancelled was signalled by colour alone.
 *
 * Draft stays neutral on purpose: DESIGN.md calls it "the absence of a state,
 * not a state", so it must not borrow a semantic colour.
 */
const variantByStatus: Record<
  PurchaseOrderStatus,
  "draft" | "info" | "warning" | "money" | "danger"
> = {
  cancelled: "danger",
  draft: "draft",
  ordered: "info",
  partially_received: "warning",
  received: "money",
};

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }): JSX.Element {
  return <Badge variant={variantByStatus[status]}>{labels[status]}</Badge>;
}
