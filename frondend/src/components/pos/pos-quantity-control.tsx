import { Minus, Plus } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type POSQuantityControlProps = {
  onChange: (quantity: number) => void;
  quantity: number;
};

export function POSQuantityControl({ onChange, quantity }: POSQuantityControlProps): JSX.Element {
  return (
    <div className="flex items-center gap-1">
      <Button
        aria-label="Decrease quantity"
        className="h-8 w-8 rounded-md border-[#d4d4d8] bg-white text-[#18181b] hover:bg-[#f4f4f5]"
        onClick={() => onChange(quantity - 1)}
        size="icon"
        type="button"
        variant="outline"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Input
        aria-label="Quantity"
        className="h-8 w-14 rounded-md border-[#d4d4d8] text-center font-mono text-sm"
        min={1}
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        value={String(quantity)}
      />
      <Button
        aria-label="Increase quantity"
        className="h-8 w-8 rounded-md border-[#d4d4d8] bg-white text-[#18181b] hover:bg-[#f4f4f5]"
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
