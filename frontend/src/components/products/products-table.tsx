"use client";

import { CheckCircle2, Clock3, EyeOff, PackageSearch } from "lucide-react";
import type { JSX } from "react";

import { ProductActionsMenu } from "@/components/products/product-actions-menu";
import { ProductItemStructureBadge } from "@/components/products/product-item-structure-badge";
import { ProductStatusBadge } from "@/components/products/product-status-badge";
import { ProductTypeBadge } from "@/components/products/product-type-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import type { Product, ProductStatus } from "@/types/product";

type ProductsTableProps = {
  canManage: boolean;
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ProductCapabilityBadges({ product }: { product: Product }): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge
        className={
          product.isPosVisible
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50"
            : "border-brand-cappuccino bg-brand-latte text-brand-mocha hover:bg-brand-latte"
        }
      >
        {product.isPosVisible ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <EyeOff className="h-3.5 w-3.5" />
        )}
        POS {product.isPosVisible ? "Visible" : "Hidden"}
      </Badge>
      <Badge
        className={
          product.isSellable
            ? "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-50"
            : "border-brand-cappuccino bg-brand-latte text-brand-mocha hover:bg-brand-latte"
        }
      >
        {product.isSellable ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <EyeOff className="h-3.5 w-3.5" />
        )}
        {product.isSellable ? "Sellable" : "Not sellable"}
      </Badge>
      {product.isStockTracked ? <Badge variant="outline">Stock</Badge> : null}
      {product.isExpiryTracked ? <Badge variant="outline">Expiry</Badge> : null}
      {product.isCustomOrderAvailable ? <Badge variant="outline">Custom</Badge> : null}
    </div>
  );
}

export function ProductsTable({
  canManage,
  onDelete,
  onEdit,
  onManageVariants,
  onStatusChange,
  onView,
  products,
}: ProductsTableProps): JSX.Element {
  return (
    <div>
      <div className="grid gap-3 p-3 md:hidden">
        {products.map((product) => (
          <div
            key={product.id}
            className="rounded-2xl border border-brand-cappuccino/70 bg-white/80 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-12 w-12 rounded-2xl">
                  <AvatarImage
                    alt={product.productName}
                    src={getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl ?? ""}
                  />
                  <AvatarFallback className="rounded-2xl">
                    {initials(product.productName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-espresso">
                    {product.productName}
                  </p>
                  <p className="truncate text-xs text-brand-mocha">
                    {product.productCode} {product.sku ? `• ${product.sku}` : ""}
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ProductStatusBadge status={product.status} />
              <ProductTypeBadge type={product.productType} />
              <ProductItemStructureBadge itemStructure={product.itemStructure} />
              <ProductCapabilityBadges product={product} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-brand-mocha/70">Price</p>
                <p className="font-semibold text-brand-espresso">
                  {formatCurrency(product.salePrice)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-brand-mocha/70">Unit</p>
                <p className="font-medium text-brand-espresso">{product.unitName}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-[0.18em] text-brand-mocha/70">Category</p>
                <p className="font-medium text-brand-espresso">{product.categoryName}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[280px]">Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Structure</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Behavior</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} className="align-top">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 rounded-2xl">
                      <AvatarImage
                        alt={product.productName}
                        src={
                          getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl ?? ""
                        }
                      />
                      <AvatarFallback className="rounded-2xl">
                        {initials(product.productName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-brand-espresso">
                        {product.productName}
                      </p>
                      <p className="mt-0.5 text-xs text-brand-mocha">
                        {product.productCode}
                        {product.sku ? ` • SKU ${product.sku}` : ""}
                        {product.barcode ? ` • ${product.barcode}` : ""}
                      </p>
                      {product.variants.length > 0 ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-brand-mocha">
                          <PackageSearch className="h-3.5 w-3.5" />
                          {product.variants.length} variants
                        </p>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-medium text-brand-espresso">{product.categoryName}</p>
                  <p className="text-xs text-brand-mocha">{product.unitName}</p>
                </TableCell>
                <TableCell>
                  <ProductTypeBadge type={product.productType} />
                </TableCell>
                <TableCell>
                  <ProductItemStructureBadge itemStructure={product.itemStructure} />
                </TableCell>
                <TableCell>
                  <p className="font-semibold text-brand-espresso">
                    {formatCurrency(product.salePrice)}
                  </p>
                  <p className="text-xs text-brand-mocha">
                    Cost {product.costPrice === null ? "-" : formatCurrency(product.costPrice)}
                  </p>
                  <p className="text-xs text-brand-mocha">Tax {product.taxRateName ?? "-"}</p>
                </TableCell>
                <TableCell>
                  <ProductCapabilityBadges product={product} />
                </TableCell>
                <TableCell>
                  <ProductStatusBadge status={product.status} />
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-sm text-brand-mocha">
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
