import { Check } from "lucide-react";
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
      aria-pressed={selected}
      className={
        selected
          ? "min-h-tap rounded-md border-ring bg-primary text-body font-medium text-primary-foreground hover:bg-primary"
          : "min-h-tap rounded-md border-border bg-card text-body font-medium text-foreground hover:bg-muted"
      }
      disabled={disabled}
      onClick={() => onSelect(method)}
      type="button"
      variant="outline"
    >
      {selected ? <Check aria-hidden className="h-4 w-4" /> : null}
      {method.methodName}
    </Button>
  );
}
