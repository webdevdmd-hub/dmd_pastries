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
  stockQuantity?: number | null;
  stockUnitName?: string | null;
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
  stockQuantity,
}: POSProductCardProps): JSX.Element {
  const longPressTimerRef = useRef<number | null>(null);
  const ignoreNextClickRef = useRef(false);
  const imageUrl = getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl;
  const hasVariants = product.variants.length > 0;
  void stockQuantity;

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
    <article className="group flex min-h-[13.25rem] flex-col rounded-[1.15rem] border border-brand-cappuccino/70 bg-white p-2 text-brand-espresso shadow-[0_12px_28px_rgba(59,42,34,0.055)] transition hover:-translate-y-0.5 hover:border-brand-caramel hover:shadow-[0_16px_36px_rgba(59,42,34,0.1)]">
      <Button
        className="h-full flex-1 flex-col items-stretch justify-start p-0 text-left text-brand-espresso hover:bg-transparent"
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
              alt=""
              className="h-32 w-full rounded-[0.9rem] bg-brand-latte object-cover shadow-sm"
              src={imageUrl}
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center rounded-[0.9rem] bg-brand-latte text-brand-mocha shadow-sm">
              <PackagePlus className="h-6 w-6" />
            </div>
          )}
          <div className="mt-2 min-w-0">
            <p className="line-clamp-2 whitespace-normal text-[0.74rem] font-black leading-tight">
              {product.productName}
            </p>
          </div>
          <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2">
            <span className="max-w-[56%] truncate rounded-full bg-brand-latte px-2 py-0.5 text-[0.53rem] font-bold text-brand-mocha">
              {product.categoryName}
            </span>
            <span className="min-h-5 shrink-0 text-right text-sm font-black leading-none text-brand-espresso">
              {showPrices ? (
                <span aria-label={`${product.productName} price`}>
                  {formatMoney(product.salePrice)}
                </span>
              ) : null}
            </span>
          </div>
        </div>
      </Button>
    </article>
  );
}
