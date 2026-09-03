import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { Expense } from "@/types/expenses";

/**
 * Posted or voided. Lived inline in the list page, so the drawer, the cards and
 * the detail page each had to reinvent it or go without.
 */
export function ExpenseStatusBadge({ status }: { status: Expense["status"] }): JSX.Element {
  return (
    <Badge variant={status === "posted" ? "default" : "secondary"}>
      {status === "posted" ? "Posted" : "Voided"}
    </Badge>
  );
}
