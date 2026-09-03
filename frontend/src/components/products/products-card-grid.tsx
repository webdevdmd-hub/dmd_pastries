"use client";

import type { JSX } from "react";

import { ProductActionsMenu } from "@/components/products/product-actions-menu";
import { ProductStatusBadge } from "@/components/products/product-status-badge";
import {
  formatProductCurrency,
  latestPurchasePrice,
  ProductAvailability,
  productInitials,
  type ProductsListProps,
  QuantityValue,
} from "@/components/products/products-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";

/**
 * The catalogue as cards, for phones: an eight-column table has no honest
 * layout below md. Clicking a card opens the details drawer; the kebab stops
 * the click so it does not also open the drawer.
 */
export function ProductsCardGrid({
  canManage,
  inventoryAvailable,
  inventoryByProduct,
  onDelete,
  onEdit,
  onManageVariants,
  onStatusChange,
  onView,
  products,
}: ProductsListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {products.map((product) => {
        const inventory = inventoryByProduct.get(product.id);
        const purchasePrice = latestPurchasePrice(product);

        return (
          <Card
            className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
            key={product.id}
            onClick={() => onView(product)}
          >
            <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
              <button
                className="flex min-w-0 items-center gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(product);
                }}
                type="button"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    alt={product.productName}
                    src={getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl ?? ""}
                  />
                  <AvatarFallback className="bg-brand-cappuccino text-brand-espresso">
                    {productInitials(product.productName)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{product.productName}</span>
                  <span className="block truncate text-meta text-foreground-muted">
                    <span className="font-mono">{product.productCode}</span> ·{" "}
                    {product.categoryName}
                  </span>
                </span>
              </button>
              <div
                className="flex shrink-0 items-center gap-2"
                onClick={(event) => event.stopPropagation()}
              >
                <ProductStatusBadge status={product.status} />
                <ProductActionsMenu
                  canManage={canManage}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onManageVariants={onManageVariants}
                  onStatusChange={onStatusChange}
                  product={product}
                />
              </div>
            </div>

            <div className="px-4 py-3">
              <ProductAvailability product={product} />
            </div>

            <div className="grid grid-cols-3 border-t border-workspace-border bg-brand-latte/30">
              <div className="min-w-0 border-r border-workspace-border px-3 py-3">
                <p className="text-meta text-foreground-muted">Current qty</p>
                <div className="mt-1">
                  <QuantityValue
                    inventoryAvailable={inventoryAvailable}
                    product={product}
                    summary={inventory}
                  />
                </div>
              </div>
              <div className="min-w-0 border-r border-workspace-border px-3 py-3">
                <p className="text-meta text-foreground-muted">Latest purchase</p>
                <p className="mt-1 break-words text-cell font-medium tabular-nums">
                  {purchasePrice === null ? "—" : formatProductCurrency(purchasePrice)}
                </p>
              </div>
              <div className="min-w-0 px-3 py-3">
                <p className="text-meta text-foreground-muted">Sale price</p>
                <p className="mt-1 break-words text-cell font-medium tabular-nums">
                  {formatProductCurrency(product.salePrice)}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
