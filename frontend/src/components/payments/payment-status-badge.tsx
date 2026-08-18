import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import {
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
  RECONCILIATION_STATUS_LABELS,
  type ReconciliationStatus,
  REFUND_STATUS_LABELS,
  type RefundStatus,
} from "@/types/payment";

type AnyPaymentStatus = PaymentStatus | RefundStatus | ReconciliationStatus;

type PaymentStatusBadgeProps = {
  status: AnyPaymentStatus;
};

type BadgeTone = "money" | "warning" | "danger" | "info" | "draft";

// Tones follow the DESIGN.md §3.3 table: money for settled, info for in-flight,
// warning for needs-attention, danger for broken, and neutral draft for states
// that are the absence of a state rather than a state.
const STATUS_TONE: Record<AnyPaymentStatus, BadgeTone> = {
  completed: "money",
  approved: "money",
  pending: "info",
  submitted: "info",
  failed: "danger",
  rejected: "danger",
  partially_refunded: "warning",
  refunded: "draft",
  cancelled: "draft",
  draft: "draft",
};

// One lookup across all three status unions. This component previously rendered
// `status.replaceAll("_", " ")` for every value, which put "partially refunded"
// on screen in raw lowercase — the same defect fixed in the filters, missed
// during QA only because an empty ledger never rendered a badge.
const STATUS_LABEL: Record<AnyPaymentStatus, string> = {
  ...PAYMENT_STATUS_LABELS,
  ...REFUND_STATUS_LABELS,
  ...RECONCILIATION_STATUS_LABELS,
};

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps): JSX.Element {
  return <Badge variant={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
