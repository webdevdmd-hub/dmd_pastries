import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";

type PaymentMethodBadgeProps = {
  methodName: string;
  methodType?: string;
};

export function PaymentMethodBadge({
  methodName,
  methodType,
}: PaymentMethodBadgeProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <Badge
        className="w-fit border-brand-caramel/30 bg-brand-latte text-brand-espresso"
        variant="outline"
      >
        {methodName}
      </Badge>
      {methodType ? <span className="text-xs text-brand-mocha">{methodType}</span> : null}
    </div>
  );
}
