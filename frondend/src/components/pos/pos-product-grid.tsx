import { CalendarPlus, RefreshCw } from "lucide-react";
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
  canCreateOrder?: boolean;
  error: Error | null;
  isLoading: boolean;
  onCreateOrder?: () => void;
  onProductClick: (product: POSProduct) => void;
  onProductVariantsClick: (product: POSProduct) => void;
  onRetry: () => void;
  products: POSProduct[];
  showPrices: boolean;
  stockByProductId?: Map<string, POSProductStock>;
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
  stockByProductId,
}: POSProductGridProps): JSX.Element {
  if (isLoading) {
    return <POSProductGridSkeleton />;
  }

  if (error) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-800">
        <p className="font-semibold">Unable to load POS products</p>
        <p className="mt-1 text-sm">{error.message}</p>
        <Button
          className="mt-4 rounded-md border-red-200 bg-white text-red-800 hover:bg-red-50"
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
      <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-[#c8c5ca] bg-white p-8 text-center">
        <div>
          <p className="font-semibold text-[#09090b]">No POS products found.</p>
          <p className="mt-1 text-sm text-[#71717a]">
            Active POS-visible products will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => {
        const stock = stockByProductId?.get(product.id);

        return (
          <POSProductCard
            key={product.id}
            onAdd={onProductClick}
            onOpenVariants={onProductVariantsClick}
            product={product}
            showPrices={showPrices}
            {...(stock
              ? {
                  stockQuantity: stock.quantity,
                  stockUnitName: stock.unitName,
                }
              : {})}
          />
        );
      })}
      {canCreateOrder && onCreateOrder ? (
        <Button
          className="flex min-h-[14.5rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#a1a1aa] bg-[#fafafa] text-[#52525b] shadow-none hover:border-black hover:bg-white hover:text-black"
          onClick={onCreateOrder}
          type="button"
          variant="outline"
        >
          <CalendarPlus className="h-8 w-8" />
          <span className="text-sm font-black">Create Order</span>
        </Button>
      ) : null}
    </div>
  );
}
