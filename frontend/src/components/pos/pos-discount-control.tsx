import type { JSX } from "react";

import { POSNumberInput } from "@/components/pos/pos-number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CartDiscountType } from "@/types/pos";

type POSDiscountControlProps = {
  label: string;
  onChange: (type: CartDiscountType | null, value: number | null) => void;
  type: CartDiscountType | null;
  value: number | null;
};

export function POSDiscountControl({
  label,
  onChange,
  type,
  value,
}: POSDiscountControlProps): JSX.Element {
  return (
    <div className="grid gap-1">
      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[#71717a]">
        {label}
      </span>
      <div className="grid grid-cols-[108px_1fr] gap-2">
        <Select
          onValueChange={(nextType) =>
            onChange(nextType === "none" ? null : (nextType as CartDiscountType), value)
          }
          value={type ?? "none"}
        >
          <SelectTrigger className="h-8 rounded-md border-[#d4d4d8] bg-white text-xs shadow-none focus:ring-black">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No discount</SelectItem>
            <SelectItem value="fixed">Fixed</SelectItem>
            <SelectItem value="percentage">Percent</SelectItem>
          </SelectContent>
        </Select>
        <POSNumberInput
          className="h-8 rounded-md border-[#d4d4d8] bg-white text-xs shadow-none focus-visible:ring-black"
          disabled={!type}
          onValueChange={(nextValue) => onChange(type, nextValue)}
          placeholder="0.00"
          value={value}
        />
      </div>
    </div>
  );
}
