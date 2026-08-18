import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";

type PaymentMethodBadgeProps = {
  methodName: string;
};

/**
 * The payment method, as one chip.
 *
 * This used to stack the raw `method_type` underneath the name, so every row
 * read "Card / card" and "Bank Transfer / bank_transfer" — a duplicate of the
 * label and a raw enum at the same time. It also made table rows two lines
 * tall, which defeated the 44px density the ledger table is built around.
 * Invisible until the ledger had data in it.
 */
export function PaymentMethodBadge({ methodName }: PaymentMethodBadgeProps): JSX.Element {
  return (
    <Badge className="w-fit" variant="secondary">
      {methodName}
    </Badge>
  );
}
