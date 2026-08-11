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

  return (
    <article className="group relative flex min-h-[14.5rem] flex-col overflow-hidden rounded-lg border border-zinc-300 bg-white text-zinc-950 transition hover:border-zinc-500 focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2">
      <Button
        className="h-full flex-1 flex-col items-stretch justify-start rounded-none bg-white p-0 text-left text-zinc-950 shadow-none hover:bg-white disabled:opacity-60"
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
              className="h-32 w-full bg-zinc-100 object-cover"
              src={imageUrl}
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center bg-zinc-100 text-zinc-500">
              <PackagePlus className="h-8 w-8" />
            </div>
          )}
          <div className="flex flex-1 flex-col justify-between p-3">
            <p className="line-clamp-2 whitespace-normal text-sm font-black leading-tight tracking-tight">
              {product.productName}
            </p>
            <div className="mt-2 flex min-w-0 items-end justify-between gap-2">
              <span className="min-w-0 truncate text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {product.categoryName}
              </span>
              <span className="min-h-5 shrink-0 text-right font-mono text-sm font-black leading-none text-zinc-950">
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
      {isOutOfStock ? (
        <span className="absolute left-3 top-3 rounded-full bg-red-100 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-red-700">
          Out of stock
        </span>
      ) : null}
      {hasVariants ? (
        <Button
          className="absolute right-3 top-3 h-7 rounded-md bg-black px-2.5 font-mono text-[0.62rem] font-black uppercase tracking-[0.12em] text-white shadow-none hover:bg-zinc-900"
          onClick={(event) => {
            event.stopPropagation();
            openVariants();
          }}
          type="button"
          variant="default"
        >
          Variants
        </Button>
      ) : null}
    </article>
  );
}
