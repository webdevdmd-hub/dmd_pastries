"use client";

import { Check, Clock3, PackageSearch, X } from "lucide-react";
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

type ProductsTableProps = {
  canManage: boolean;
  inventoryAvailable: boolean;
  inventoryByProduct: ReadonlyMap<string, ProductInventorySummary>;
  onDelete: (product: Product) => void;
  onEdit: (product: Product) => void;
  onManageVariants: (product: Product) => void;
  onStatusChange: (product: Product, status: ProductStatus) => void;
  onView: (product: Product) => void;
  products: Product[];
};

function initials(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() ?? "")
    .join("");
}

function formatCurrency(value: number): string {
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

function latestPurchasePrice(product: Product): number | null {
  return product.lastPurchaseCost ?? product.costPrice;
}

function QuantityValue({
  inventoryAvailable,
  product,
  summary,
}: {
  inventoryAvailable: boolean;
  product: Product;
  summary: ProductInventorySummary | undefined;
}): JSX.Element {
  if (!product.isStockTracked) {
    return <span className="text-xs text-workspace-muted">Not tracked</span>;
  }
  if (!inventoryAvailable) {
    return <span className="text-workspace-muted">-</span>;
  }

  return (
    <div>
      <p className="font-semibold text-brand-espresso">
        {formatQuantity(summary?.currentQuantity ?? 0)} {summary?.unitSymbol ?? product.unitName}
      </p>
      <p className="mt-0.5 text-xs text-workspace-muted">
        {formatQuantity(summary?.availableQuantity ?? 0)} available
      </p>
    </div>
  );
}

function Availability({ product }: { product: Product }): JSX.Element {
  const items = [
    { active: product.isPurchasable, label: "Purchase" },
    { active: product.isSellable, label: "Sell" },
    { active: isPosSelectableProduct(product), label: "POS" },
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.68rem] font-medium ${
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
}: ProductsTableProps): JSX.Element {
  return (
    <div>
      <div className="grid gap-2 p-3 md:hidden">
        {products.map((product) => {
          const inventory = inventoryByProduct.get(product.id);
          const purchasePrice = latestPurchasePrice(product);

          return (
            <article
              className="rounded-2xl border border-brand-cappuccino bg-card p-4"
              key={product.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      alt={product.productName}
                      src={getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl ?? ""}
                    />
                    <AvatarFallback className="bg-brand-cappuccino text-brand-espresso">
                      {initials(product.productName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-brand-espresso">
                      {product.productName}
                    </p>
                    <p className="truncate text-xs text-workspace-muted">
                      {product.productCode} / {product.categoryName}
                    </p>
                  </div>
                </div>
                <ProductActionsMenu
                  canManage={canManage}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onManageVariants={onManageVariants}
                  onStatusChange={onStatusChange}
                  onView={onView}
                  product={product}
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 border-y border-brand-cappuccino/70 py-3 text-sm">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase text-workspace-muted">
                    Current qty
                  </p>
                  <div className="mt-1">
                    <QuantityValue
                      inventoryAvailable={inventoryAvailable}
                      product={product}
                      summary={inventory}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase text-workspace-muted">
                    Latest purchase
                  </p>
                  <p className="mt-1 font-semibold text-brand-espresso">
                    {purchasePrice === null ? "-" : formatCurrency(purchasePrice)}
                  </p>
                </div>
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase text-workspace-muted">
                    Sale price
                  </p>
                  <p className="mt-1 font-semibold text-brand-espresso">
                    {formatCurrency(product.salePrice)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Availability product={product} />
                <ProductStatusBadge status={product.status} />
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[260px]">Product</TableHead>
              <TableHead className="min-w-[150px]">Current quantity</TableHead>
              <TableHead className="min-w-[145px]">Latest purchase</TableHead>
              <TableHead>Sale price</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const inventory = inventoryByProduct.get(product.id);
              const purchasePrice = latestPurchasePrice(product);

              return (
                <TableRow className="align-middle" key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          alt={product.productName}
                          src={
                            getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl ?? ""
                          }
                        />
                        <AvatarFallback className="bg-brand-cappuccino text-brand-espresso">
                          {initials(product.productName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-brand-espresso">
                          {product.productName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-workspace-muted">
                          {product.productCode} / {product.categoryName} / {product.unitName}
                        </p>
                        {product.variants.length > 0 ? (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs text-workspace-muted">
                            <PackageSearch className="h-3.5 w-3.5" />
                            {product.variants.length} variants
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <QuantityValue
                      inventoryAvailable={inventoryAvailable}
                      product={product}
                      summary={inventory}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-brand-espresso">
                      {purchasePrice === null ? "-" : formatCurrency(purchasePrice)}
                    </p>
                    <p className="mt-0.5 text-xs text-workspace-muted">
                      {product.lastPurchaseDate
                        ? formatDate(product.lastPurchaseDate)
                        : "No receipt yet"}
                    </p>
                  </TableCell>
                  <TableCell className="font-semibold text-brand-espresso">
                    {formatCurrency(product.salePrice)}
                  </TableCell>
                  <TableCell>
                    <Availability product={product} />
                  </TableCell>
                  <TableCell>
                    <ProductStatusBadge status={product.status} />
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm text-workspace-muted">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDate(product.updatedAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <ProductActionsMenu
                      canManage={canManage}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onManageVariants={onManageVariants}
                      onStatusChange={onStatusChange}
                      onView={onView}
                      product={product}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
