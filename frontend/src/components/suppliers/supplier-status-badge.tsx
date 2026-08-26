"use client";

import type { JSX } from "react";

import { SUPPLIER_STATUS_COPY } from "@/components/suppliers/supplier-status-copy";
import { Badge } from "@/components/ui/badge";
import type { SupplierStatus } from "@/types/supplier";

/**
 * Status as a dotted semantic badge.
 *
 * This used to pass `variant="outline"` with hand-rolled `brand-*` classes.
 * `outline` is one of the badge's explicitly legacy, dotless variants, so
 * colour was the only thing carrying the state -- which DESIGN.md §9 forbids,
 * and which a colour-blind user cannot read at all. The semantic variants emit
 * the 5px dot; `draft` is the neutral one, and inactive is genuinely the
 * absence of a state rather than a state of its own.
 */
const variantByStatus: Record<SupplierStatus, "money" | "draft" | "danger"> = {
  active: "money",
  inactive: "draft",
  blocked: "danger",
};

export function SupplierStatusBadge({ status }: { status: SupplierStatus }): JSX.Element {
  return <Badge variant={variantByStatus[status]}>{SUPPLIER_STATUS_COPY[status].label}</Badge>;
}
