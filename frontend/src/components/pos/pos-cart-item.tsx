import { Minus, PackagePlus, Plus, X } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import type { CartItem } from "@/types/pos";

type POSCartItemProps = {
  item: CartItem;
  onQuantityChange: (cartItemId: string, quantity: number) => void;
  onRemove: (cartItemId: string) => void;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

/**
 * One cart line: thumbnail, what it is, what it costs, how many.
 *
 * The remove control sits on the thumbnail corner rather than in the row, so
 * the quantity stepper owns the right edge and the two are never adjacent --
 * at a counter, "one fewer" and "none at all" must not be neighbours.
 */
export function POSCartItem({ item, onQuantityChange, onRemove }: POSCartItemProps): JSX.Element {
  const imageUrl = getProductImagePreviewUrl(item.imageFileId) ?? item.imageUrl;

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="relative shrink-0">
        {imageUrl ? (
          <img alt="" className="h-14 w-14 rounded-md bg-muted object-cover" src={imageUrl} />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-foreground-muted">
            <PackagePlus className="h-5 w-5" />
          </div>
        )}
        <Button
          aria-label={`Remove ${item.productName}`}
          className="absolute -bottom-1 -left-1 h-6 w-6 rounded-full border border-border bg-card p-0 text-danger-text shadow-sm hover:bg-danger-tint"
          onClick={() => onRemove(item.cartItemId)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-body truncate font-medium text-foreground">{item.productName}</p>
        {item.variantName ? (
          <p className="text-meta truncate text-foreground-muted">{item.variantName}</p>
        ) : null}
        <p className="text-body font-mono font-medium tabular-nums text-foreground">
          {formatMoney(item.lineTotal)}
        </p>
      </div>

      {/* 48px per control, the counter minimum, with the count between them so
          a mis-tap lands on a number rather than the other direction. */}
      <div className="flex shrink-0 items-center rounded-md border border-border bg-card">
        <Button
          aria-label={`Reduce ${item.productName} quantity`}
          className="h-12 w-12 rounded-l-md rounded-r-none text-foreground-muted hover:bg-muted hover:text-foreground"
          disabled={item.quantity <= 1}
          onClick={() => onQuantityChange(item.cartItemId, item.quantity - 1)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span
          aria-label={`${item.productName} quantity`}
          className="text-body w-8 text-center font-mono font-medium tabular-nums text-foreground"
        >
          {item.quantity}
        </span>
        <Button
          aria-label={`Increase ${item.productName} quantity`}
          className="h-12 w-12 rounded-l-none rounded-r-md text-foreground-muted hover:bg-muted hover:text-foreground"
          onClick={() => onQuantityChange(item.cartItemId, item.quantity + 1)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
