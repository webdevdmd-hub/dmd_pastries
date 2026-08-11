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
          ? "h-10 rounded-md border-black bg-black text-sm font-black text-white hover:bg-zinc-900"
          : "h-10 rounded-md border-zinc-300 bg-white text-sm font-bold text-zinc-900 hover:bg-zinc-100"
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
