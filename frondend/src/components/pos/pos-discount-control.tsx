import type { JSX } from "react";

import { Input } from "@/components/ui/input";
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
      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-brand-mocha">
        {label}
      </span>
      <div className="grid grid-cols-[108px_1fr] gap-2">
        <Select
          onValueChange={(nextType) =>
            onChange(nextType === "none" ? null : (nextType as CartDiscountType), value)
          }
          value={type ?? "none"}
        >
          <SelectTrigger className="h-8 rounded-xl border-brand-cappuccino text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No discount</SelectItem>
            <SelectItem value="fixed">Fixed</SelectItem>
            <SelectItem value="percentage">Percent</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="h-8 rounded-xl border-brand-cappuccino text-xs"
          disabled={!type}
          min={0}
          onChange={(event) => onChange(type, Number(event.target.value))}
          placeholder="0.00"
          type="number"
          value={value === null ? "" : String(value)}
        />
      </div>
    </div>
  );
}
