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

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
