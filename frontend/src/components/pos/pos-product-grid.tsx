import { CalendarPlus, RefreshCw } from "lucide-react";
import type { JSX } from "react";

import { POSProductCard } from "@/components/pos/pos-product-card";
import { POSProductGridSkeleton } from "@/components/pos/pos-product-grid-skeleton";
import { Button } from "@/components/ui/button";
import type { POSProduct } from "@/types/pos";

type POSProductGridProps = {
  canCreateOrder?: boolean;
  error: Error | null;
  isLoading: boolean;
  onCreateOrder?: () => void;
  onProductClick: (product: POSProduct) => void;
  onProductVariantsClick: (product: POSProduct) => void;
  onRetry: () => void;
  products: POSProduct[];
  showPrices: boolean;
};

export function POSProductGrid({
  canCreateOrder = false,
  error,
  isLoading,
  onCreateOrder,
  onProductClick,
  onProductVariantsClick,
  onRetry,
  products,
  showPrices,
}: POSProductGridProps): JSX.Element {
  if (isLoading) {
    return <POSProductGridSkeleton />;
  }

  if (error) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-danger/30 bg-danger-tint p-8 text-center text-danger-text">
        <p className="font-semibold">Unable to load POS products</p>
        <p className="mt-1 text-sm">{error.message}</p>
        <Button
          className="mt-4 rounded-md border-danger/30 bg-card text-danger-text hover:bg-danger-tint"
          onClick={onRetry}
          type="button"
          variant="outline"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <div>
          <p className="font-semibold text-foreground">No POS products found.</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Active POS-visible products will appear here.
          </p>
        </div>
      </div>
    );
  }

  // Intrinsic columns, not breakpoints. The old sm/lg/xl column counts keyed
  // off the VIEWPORT, but this grid lives in the middle track of
  // `[144px_minmax(0,1fr)_480px]`, so the rail and the cart take 624px before it
  // gets anything. On a 1024x768 counter tablet -- the common iPad landscape
  // till -- that left 400px, and `lg:grid-cols-4` cut it into 82.8px tiles whose
  // product-name element collapsed to a 2px clientWidth. 1280 was no better:
  // 575px across `xl:grid-cols-5` gave 105px tiles.
  //
  // auto-fill with a minimum tile width fits as many columns as the column
  // ACTUALLY has, and never goes below a legible tile, at any width -- with no
  // container-query plugin (none is installed) and no breakpoint to keep in sync
  // with the shell. Measured after: ~177px at 1024, ~184px at 1280.
  //
  // Regression: ISSUE-002 — register tiles collapsed on a counter tablet
  // Found by /qa on 2026-09-14
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
      {products.map((product) => (
        <POSProductCard
          key={product.id}
          onAdd={onProductClick}
          onOpenVariants={onProductVariantsClick}
          product={product}
          showPrices={showPrices}
        />
      ))}
      {canCreateOrder && onCreateOrder ? (
        <Button
          className="flex min-h-[14.5rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted text-foreground-muted shadow-none hover:border-black hover:bg-card hover:text-foreground"
          onClick={onCreateOrder}
          type="button"
          variant="outline"
        >
          <CalendarPlus className="h-8 w-8" />
          <span className="text-body font-medium">Create Order</span>
        </Button>
      ) : null}
    </div>
  );
}
