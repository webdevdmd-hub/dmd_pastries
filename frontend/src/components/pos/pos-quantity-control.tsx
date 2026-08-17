import { Minus, Plus } from "lucide-react";
import type { JSX } from "react";

import { POSNumberInput } from "@/components/pos/pos-number-input";
import { Button } from "@/components/ui/button";

type POSQuantityControlProps = {
  onChange: (quantity: number) => void;
  quantity: number;
};

export function POSQuantityControl({ onChange, quantity }: POSQuantityControlProps): JSX.Element {
  return (
    <div className="flex items-center gap-1">
      <Button
        aria-label="Decrease quantity"
        className="h-8 w-8 rounded-md border-border bg-card text-foreground hover:bg-muted"
        onClick={() => onChange(quantity - 1)}
        size="icon"
        type="button"
        variant="outline"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <POSNumberInput
        aria-label="Quantity"
        className="h-8 w-14 rounded-md border-border text-center font-mono text-sm"
        onValueChange={(nextQuantity) => {
          if (nextQuantity !== null) {
            onChange(nextQuantity);
          }
        }}
        value={quantity}
      />
      <Button
        aria-label="Increase quantity"
        className="h-8 w-8 rounded-md border-border bg-card text-foreground hover:bg-muted"
        onClick={() => onChange(quantity + 1)}
        size="icon"
        type="button"
        variant="outline"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
