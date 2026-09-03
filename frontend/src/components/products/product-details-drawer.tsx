"use client";

import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import type { ProductDetailTabKey } from "@/components/products/product-detail-tabs";
import { ProductDetailsPanel } from "@/components/products/product-details-panel";
import { ProductStatusBadge } from "@/components/products/product-status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";
import type { Product, ProductVariant } from "@/types/product";

type ProductDetailsDrawerProps = {
  canManage: boolean;
  /** The tab the sheet opens on; "Manage variants" lands on Variants. */
  initialTab: ProductDetailTabKey;
  onAddVariant: () => void;
  onDeleteVariant: (variant: ProductVariant) => void;
  /** Opens the edit form in the host's own modal flow. */
  onEdit?: ((product: Product) => void) | undefined;
  onEditVariant: (variant: ProductVariant) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  product: Product | null;
  variants: ProductVariant[];
};

/**
 * One product's details in a sheet over the catalogue. The product record is
 * already on the row, so the sheet needs no fetch of its own; the variants
 * come from the host, which refreshes them as they are edited. The tab is
 * plain state here; the header offers the full page for anyone who wants a
 * URL to share.
 */
export function ProductDetailsDrawer({
  canManage,
  initialTab,
  onAddVariant,
  onDeleteVariant,
  onEdit,
  onEditVariant,
  onOpenChange,
  open,
  product,
  variants,
}: ProductDetailsDrawerProps): JSX.Element {
  // Radix requires a title in every dialog. The body renders the product's
  // name; the empty state names the sheet invisibly.
  const fallbackTitle = (
    <SheetHeader className="sr-only">
      <SheetTitle>Product details</SheetTitle>
      <SheetDescription>Details of the selected product.</SheetDescription>
    </SheetHeader>
  );

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {product ? (
          // Keyed by product and opening tab so switching products, or
          // re-opening on Variants from the kebab, resets the strip.
          <ProductDetailsDrawerBody
            canManage={canManage}
            initialTab={initialTab}
            key={`${product.id}:${initialTab}`}
            onAddVariant={onAddVariant}
            onDeleteVariant={onDeleteVariant}
            onEdit={onEdit}
            onEditVariant={onEditVariant}
            product={product}
            variants={variants}
          />
        ) : (
          fallbackTitle
        )}
      </SheetContent>
    </Sheet>
  );
}

function ProductDetailsDrawerBody({
  canManage,
  initialTab,
  onAddVariant,
  onDeleteVariant,
  onEdit,
  onEditVariant,
  product,
  variants,
}: {
  canManage: boolean;
  initialTab: ProductDetailTabKey;
  onAddVariant: () => void;
  onDeleteVariant: (variant: ProductVariant) => void;
  onEdit: ((product: Product) => void) | undefined;
  onEditVariant: (variant: ProductVariant) => void;
  product: Product;
  variants: ProductVariant[];
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<ProductDetailTabKey>(initialTab);
  const detailHref = `${ROUTES.products}/${product.id}`;

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <SheetTitle className="text-page">{product.productName}</SheetTitle>
          <ProductStatusBadge status={product.status} />
        </div>
        <SheetDescription>
          <span className="font-mono">{product.productCode}</span> · {product.categoryName} ·{" "}
          {product.unitName}
        </SheetDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href={detailHref}>
              <ExternalLink className="h-4 w-4" />
              Open full page
            </Link>
          </Button>
          {canManage && onEdit ? (
            <Button onClick={() => onEdit(product)} size="sm" type="button" variant="outline">
              <Pencil className="h-4 w-4" />
              Edit product
            </Button>
          ) : null}
        </div>
      </SheetHeader>

      <ProductDetailsPanel
        activeTab={activeTab}
        canManage={canManage}
        onAddVariant={onAddVariant}
        onDeleteVariant={onDeleteVariant}
        onEditVariant={onEditVariant}
        onTabChange={setActiveTab}
        product={product}
        variants={variants}
      />
    </div>
  );
}
