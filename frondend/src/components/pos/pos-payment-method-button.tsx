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
          ? "h-10 rounded-md border-black bg-black text-sm font-black text-white hover:bg-[#18181b]"
          : "h-10 rounded-md border-[#d4d4d8] bg-white text-sm font-bold text-[#18181b] hover:bg-[#f4f4f5]"
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
