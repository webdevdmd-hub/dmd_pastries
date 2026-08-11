import { Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";

import { POSDiscountControl } from "@/components/pos/pos-discount-control";
import { POSQuantityControl } from "@/components/pos/pos-quantity-control";
import { Button } from "@/components/ui/button";
import type { CartDiscountType, CartItem } from "@/types/pos";

type POSCartItemProps = {
  item: CartItem;
  onDiscountChange: (
    cartItemId: string,
    type: CartDiscountType | null,
    value: number | null,
  ) => void;
  onQuantityChange: (cartItemId: string, quantity: number) => void;
  onRemove: (cartItemId: string) => void;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

export function POSCartItem({
  item,
  onDiscountChange,
  onQuantityChange,
  onRemove,
}: POSCartItemProps): JSX.Element {
  const [discountOpen, setDiscountOpen] = useState(item.discountType !== null);
  const discountLabel =
    item.discountAmount > 0 ? `Discount ${formatMoney(item.discountAmount)}` : "Discount";

  return (
    <div className="rounded-lg border border-zinc-300 bg-white p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-zinc-950">{item.productName}</p>
          {item.variantName ? (
            <p className="truncate text-[0.68rem] text-zinc-500">{item.variantName}</p>
          ) : null}
        </div>
        <Button
          aria-label={`Remove ${item.productName}`}
          className="h-7 w-7 rounded-md text-red-700 hover:bg-red-50"
          onClick={() => onRemove(item.cartItemId)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Button
          className="h-7 justify-self-start rounded-md px-2 text-[0.68rem] text-zinc-600 hover:bg-zinc-100"
          onClick={() => setDiscountOpen((current) => !current)}
          type="button"
          variant="ghost"
        >
          {discountLabel}
        </Button>
        <POSQuantityControl
          onChange={(quantity) => onQuantityChange(item.cartItemId, quantity)}
          quantity={item.quantity}
        />
        <p className="font-mono text-right text-xs font-black text-zinc-950">
          {formatMoney(item.lineTotal)}
        </p>
      </div>
      {discountOpen ? (
        <div className="mt-1.5">
          <POSDiscountControl
            label="Line discount"
            onChange={(type, value) => onDiscountChange(item.cartItemId, type, value)}
            type={item.discountType}
            value={item.discountValue}
          />
        </div>
      ) : null}
    </div>
  );
}
