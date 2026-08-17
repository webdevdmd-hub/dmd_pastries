import { PackagePlus } from "lucide-react";
import type { JSX } from "react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import type { POSProduct } from "@/types/pos";

type POSProductCardProps = {
  onAdd: (product: POSProduct) => void;
  onOpenVariants: (product: POSProduct) => void;
  product: POSProduct;
  showPrices: boolean;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

export function POSProductCard({
  onAdd,
  onOpenVariants,
  product,
  showPrices,
}: POSProductCardProps): JSX.Element {
  const longPressTimerRef = useRef<number | null>(null);
  const ignoreNextClickRef = useRef(false);
  const imageUrl = getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl;
  const hasVariants = product.variants.length > 0;
  const isOutOfStock =
    product.availableStockQuantity !== null && product.availableStockQuantity <= 0;

  const clearLongPressTimer = (): void => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openVariants = (): void => {
    clearLongPressTimer();
    onOpenVariants(product);
  };

  // Hover is a 1px lift plus --shadow-sm, not a border-colour change
  // (DESIGN.md §5). A darkening border on hover reads as a state change on the
  // object; a lift reads as "this is pressable".
  return (
    <article
      className={`group relative flex min-h-[14.5rem] flex-col overflow-hidden rounded-lg border border-border bg-card text-foreground transition duration-150 hover:-translate-y-px hover:shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
        isOutOfStock ? "opacity-55" : ""
      }`}
    >
      <Button
        className="h-full flex-1 flex-col items-stretch justify-start rounded-none bg-card p-0 text-left text-foreground shadow-none hover:bg-card disabled:opacity-60"
        disabled={isOutOfStock && !hasVariants}
        onClick={() => {
          if (ignoreNextClickRef.current) {
            ignoreNextClickRef.current = false;
            return;
          }
          onAdd(product);
        }}
        onPointerCancel={clearLongPressTimer}
        onPointerDown={() => {
          if (!hasVariants) {
            return;
          }
          clearLongPressTimer();
          longPressTimerRef.current = window.setTimeout(() => {
            ignoreNextClickRef.current = true;
            openVariants();
          }, 550);
        }}
        onPointerLeave={clearLongPressTimer}
        onPointerUp={clearLongPressTimer}
        type="button"
        variant="ghost"
      >
        <div className="flex h-full flex-col text-left">
          {imageUrl ? (
            <img
              alt={product.productName}
              className="h-32 w-full bg-muted object-cover"
              src={imageUrl}
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center bg-muted text-foreground-muted">
              <PackagePlus className="h-8 w-8" />
            </div>
          )}
          <div className="flex flex-1 flex-col justify-between p-3">
            <p className="text-body line-clamp-2 whitespace-normal font-medium leading-tight">
              {product.productName}
            </p>
            <div className="mt-2 flex min-w-0 items-end justify-between gap-2">
              {/* Out-of-stock replaces the category rather than overlaying the
                  tile. As an `absolute left-3 top-3` badge it collided with the
                  48px Variants button at `right-3 top-3` on a 146px tile
                  (TODOS T-L). Putting it in the content row removes the overlap
                  structurally instead of by nudging offsets — and when an item
                  cannot be sold, that fact outranks its category name. */}
              {isOutOfStock ? (
                <span className="text-meta inline-flex min-w-0 shrink items-center gap-1.5 rounded-full bg-danger-tint px-2 py-0.5 font-medium text-danger-text">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                  <span className="truncate">Out of stock</span>
                </span>
              ) : (
                <span className="text-meta min-w-0 truncate text-foreground-muted">
                  {product.categoryName}
                </span>
              )}
              <span className="text-body min-h-5 shrink-0 text-right font-mono font-medium leading-none tabular-nums text-foreground">
                {showPrices ? (
                  <span aria-label={`${product.productName} price`}>
                    {formatMoney(product.salePrice)}
                  </span>
                ) : null}
              </span>
            </div>
          </div>
        </div>
      </Button>
      {hasVariants ? (
        /* Variants is a secondary action on the tile — the primary action is
           tapping the tile itself. As a solid black fill it read as the primary,
           which is what made a mis-tap add the wrong item. It keeps the 48px
           target from A0.1 and gains a card fill so it stays legible over a
           product photograph. */
        <Button
          aria-label={`Choose a variant of ${product.productName}`}
          className="text-meta absolute right-3 top-3 h-12 min-w-12 rounded border border-border bg-card/95 px-3 font-medium text-foreground shadow-sm hover:bg-muted"
          onClick={(event) => {
            event.stopPropagation();
            openVariants();
          }}
          type="button"
          variant="outline"
        >
          Variants
        </Button>
      ) : null}
    </article>
  );
}
