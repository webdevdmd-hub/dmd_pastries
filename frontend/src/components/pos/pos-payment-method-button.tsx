import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import type { PaymentMethod } from "@/types/settings";

type POSPaymentMethodButtonProps = {
  method: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  selected: boolean;
};

export function POSPaymentMethodButton({
  method,
  onSelect,
  selected,
}: POSPaymentMethodButtonProps): JSX.Element {
  return (
    <Button
      className="h-9 rounded-2xl border-brand-cappuccino text-sm"
      onClick={() => onSelect(method)}
      type="button"
      variant={selected ? "default" : "outline"}
    >
      {method.methodName}
    </Button>
  );
}
