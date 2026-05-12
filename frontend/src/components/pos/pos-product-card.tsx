import { PackagePlus } from "lucide-react";
import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import type { POSProduct } from "@/types/pos";

type POSProductCardProps = {
  onAdd: (product: POSProduct) => void;
  product: POSProduct;
  stockQuantity?: number | null;
  stockUnitName?: string | null;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function formatStock(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function POSProductCard({
  onAdd,
  product,
  stockQuantity,
}: POSProductCardProps): JSX.Element {
  const imageUrl = getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl;
  const hasVariants = product.variants.length > 0;
  const resolvedStock =
    stockQuantity ?? product.availableStockQuantity ?? product.currentStockQuantity;
  const hasStock = resolvedStock !== null;
  const stockIsLow = hasStock && resolvedStock <= 0;

  return (
    <Button
      className="group h-auto min-h-40 flex-col items-stretch justify-between rounded-[1.35rem] border border-brand-cappuccino/75 bg-white p-2.5 text-left text-brand-espresso shadow-[0_14px_34px_rgba(59,42,34,0.06)] transition hover:-translate-y-0.5 hover:border-brand-caramel hover:bg-white hover:shadow-[0_18px_42px_rgba(59,42,34,0.1)]"
      onClick={() => onAdd(product)}
      type="button"
      variant="ghost"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        {imageUrl ? (
          <img
            alt=""
            className="aspect-square w-full rounded-[1rem] border border-brand-cappuccino/70 object-cover shadow-sm"
            src={imageUrl}
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-[1rem] border border-brand-cappuccino/70 bg-brand-latte text-brand-mocha shadow-sm">
            <PackagePlus className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <p className="line-clamp-2 whitespace-normal text-xs font-black leading-snug">
            {product.productName}
          </p>
          <p className="mt-0.5 line-clamp-1 text-[0.68rem] font-medium text-brand-mocha">
            {product.categoryName}
          </p>
        </div>
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap items-end justify-between gap-1.5">
        <div className="min-w-0">
          <p className="text-sm font-black text-brand-espresso">{formatMoney(product.salePrice)}</p>
          <p className="line-clamp-1 text-[0.68rem] text-brand-mocha">{product.unitName}</p>
        </div>
        {hasVariants ? (
          <Badge
            className="max-w-full rounded-full bg-brand-latte px-2 py-0.5 text-[0.68rem] text-brand-mocha"
            variant="secondary"
          >
            Variants
          </Badge>
        ) : (
          <>
            {hasStock ? (
              <span
                className={
                  stockIsLow
                    ? "max-w-full rounded-full bg-red-50 px-2.5 py-1 text-[0.68rem] font-black text-red-700"
                    : "max-w-full rounded-full bg-brand-caramel/15 px-2.5 py-1 text-[0.68rem] font-black text-brand-mocha"
                }
              >
                {formatStock(resolvedStock)}
              </span>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      aria-label="Stock is not linked"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-cappuccino bg-brand-latte text-xs font-black text-brand-mocha"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      role="button"
                      tabIndex={0}
                    >
                      ?
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Stock is not linked</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        )}
      </div>
    </Button>
  );
}
