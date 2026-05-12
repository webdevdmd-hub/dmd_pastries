import { RefreshCw } from "lucide-react";
import type { JSX } from "react";

import { POSProductCard } from "@/components/pos/pos-product-card";
import { POSProductGridSkeleton } from "@/components/pos/pos-product-grid-skeleton";
import { Button } from "@/components/ui/button";
import type { POSProduct } from "@/types/pos";

type POSProductStock = {
  quantity: number;
  unitName: string;
};

type POSProductGridProps = {
  error: Error | null;
  isLoading: boolean;
  onProductClick: (product: POSProduct) => void;
  onRetry: () => void;
  products: POSProduct[];
  stockByProductId?: Map<string, POSProductStock>;
};

export function POSProductGrid({
  error,
  isLoading,
  onProductClick,
  onRetry,
  products,
  stockByProductId,
}: POSProductGridProps): JSX.Element {
  if (isLoading) {
    return <POSProductGridSkeleton />;
  }

  if (error) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-800">
        <p className="font-semibold">Unable to load POS products</p>
        <p className="mt-1 text-sm">{error.message}</p>
        <Button className="mt-4" onClick={onRetry} type="button" variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-3xl border border-dashed border-brand-cappuccino bg-white/70 p-8 text-center">
        <div>
          <p className="font-semibold text-brand-espresso">No POS products found.</p>
          <p className="mt-1 text-sm text-brand-mocha">
            Active POS-visible products will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(8.25rem,1fr))] gap-3">
      {products.map((product) => {
        const stock = stockByProductId?.get(product.id);

        return (
          <POSProductCard
            key={product.id}
            onAdd={onProductClick}
            product={product}
            {...(stock
              ? {
                  stockQuantity: stock.quantity,
                  stockUnitName: stock.unitName,
                }
              : {})}
          />
        );
      })}
    </div>
  );
}
