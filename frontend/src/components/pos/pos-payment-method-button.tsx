import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import type { PaymentMethod } from "@/types/settings";

type POSPaymentMethodButtonProps = {
  disabled?: boolean;
  method: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  selected: boolean;
};

export function POSPaymentMethodButton({
  disabled = false,
  method,
  onSelect,
  selected,
}: POSPaymentMethodButtonProps): JSX.Element {
  return (
    <Button
      className={
        selected
          ? "h-10 rounded-md border-black bg-primary text-body font-medium text-primary-foreground hover:bg-primary"
          : "h-10 rounded-md border-border bg-card text-sm font-bold text-foreground hover:bg-muted"
      }
      disabled={disabled}
      onClick={() => onSelect(method)}
      type="button"
      variant="outline"
    >
      {method.methodName}
    </Button>
  );
}
