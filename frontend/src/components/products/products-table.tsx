"use client";

import { Check, PackageSearch, X } from "lucide-react";
import type { JSX } from "react";

import { ProductActionsMenu } from "@/components/products/product-actions-menu";
import { ProductStatusBadge } from "@/components/products/product-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import { isPosSelectableProduct } from "@/lib/selectors/eligibility";
import type { Product, ProductStatus } from "@/types/product";

export type ProductInventorySummary = {
  availableQuantity: number;
  currentQuantity: number;
  unitSymbol: string;
};

export type ProductsListProps = {
  canManage: boolean;
  inventoryAvailable: boolean;
  inventoryByProduct: ReadonlyMap<string, ProductInventorySummary>;
  onDelete: (product: Product) => void;
  onEdit: (product: Product) => void;
  onManageVariants: (product: Product) => void;
  onStatusChange: (product: Product, status: ProductStatus) => void;
  /** Opens the product's details; the whole row is the target. */
  onView: (product: Product) => void;
  products: Product[];
};

export function productInitials(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatProductCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatQuantity(value: number): string {
  return value.toLocaleString("en-AE", { maximumFractionDigits: 3 });
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function latestPurchasePrice(product: Product): number | null {
  return product.lastPurchaseCost ?? product.costPrice;
}

export function QuantityValue({
  inventoryAvailable,
  product,
  summary,
}: {
  inventoryAvailable: boolean;
  product: Product;
  summary: ProductInventorySummary | undefined;
}): JSX.Element {
  if (!product.isStockTracked) {
    return <span className="text-meta text-foreground-muted">Not tracked</span>;
  }
  if (!inventoryAvailable) {
    return <span className="text-foreground-muted">—</span>;
  }

  return (
    <span className="grid gap-0.5">
      <span className="font-medium tabular-nums">
        {formatQuantity(summary?.currentQuantity ?? 0)} {summary?.unitSymbol ?? product.unitName}
      </span>
      <span className="text-meta tabular-nums text-foreground-muted">
        {formatQuantity(summary?.availableQuantity ?? 0)} available
      </span>
    </span>
  );
}

export function ProductAvailability({ product }: { product: Product }): JSX.Element {
  const items = [
    { active: product.isSellable, label: "Sell" },
    { active: isPosSelectableProduct(product), label: "POS" },
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${
            item.active
              ? "border-money/30 bg-money-tint text-money-text"
              : "border-border bg-muted text-foreground-muted"
          }`}
          key={item.label}
        >
          {item.active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ProductsTable({
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Current quantity</TableHead>
          <TableHead className="text-right">Latest purchase</TableHead>
          <TableHead className="text-right">Sale price</TableHead>
          <TableHead>Availability</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => {
          const inventory = inventoryByProduct.get(product.id);
          const purchasePrice = latestPurchasePrice(product);

          return (
            // The row opens the drawer; the name is also a button so the
            // keyboard has a focusable target for the same action.
            <TableRow className="cursor-pointer" key={product.id} onClick={() => onView(product)}>
              <TableCell>
                <button
                  className="flex items-center gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  <span className="grid gap-0.5">
                    <span className="font-medium">{product.productName}</span>
                    <span className="text-meta text-foreground-muted">
                      <span className="font-mono">{product.productCode}</span> ·{" "}
                      {product.categoryName} · {product.unitName}
                    </span>
                    {product.variants.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-meta tabular-nums text-foreground-muted">
                        <PackageSearch className="h-3.5 w-3.5" />
                        {product.variants.length} variants
                      </span>
                    ) : null}
                  </span>
                </button>
              </TableCell>
              <TableCell className="text-right">
                <QuantityValue
                  inventoryAvailable={inventoryAvailable}
                  product={product}
                  summary={inventory}
                />
              </TableCell>
              <TableCell className="text-right">
                <span className="grid gap-0.5">
                  <span className="font-medium tabular-nums">
                    {purchasePrice === null ? "—" : formatProductCurrency(purchasePrice)}
                  </span>
                  <span className="text-meta tabular-nums text-foreground-muted">
                    {product.lastPurchaseDate
                      ? formatDate(product.lastPurchaseDate)
                      : "No receipt yet"}
                  </span>
                </span>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatProductCurrency(product.salePrice)}
              </TableCell>
              <TableCell>
                <ProductAvailability product={product} />
              </TableCell>
              <TableCell>
                <ProductStatusBadge status={product.status} />
              </TableCell>
              <TableCell className="tabular-nums text-foreground-muted">
                {formatDate(product.updatedAt)}
              </TableCell>
              {/* The menu must not also open the drawer. */}
              <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <ProductActionsMenu
                  canManage={canManage}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onManageVariants={onManageVariants}
                  onStatusChange={onStatusChange}
                  product={product}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
