"use client";

import type { JSX } from "react";

import { ProductVariantsSection } from "@/components/products/product-variants-section";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import type { Product, ProductVariant } from "@/types/product";

type ProductDetailsDrawerProps = {
  canManage: boolean;
  onAddVariant: () => void;
  onDeleteVariant: (variant: ProductVariant) => void;
  onEditVariant: (variant: ProductVariant) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  variants: ProductVariant[];
};

export function ProductDetailsDrawer({
  canManage,
  onAddVariant,
  onDeleteVariant,
  onEditVariant,
  open,
  onOpenChange,
  product,
  variants,
}: ProductDetailsDrawerProps): JSX.Element {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {product ? (
          <div className="space-y-5">
            <SheetHeader>
              <SheetTitle>{product.productName}</SheetTitle>
              <SheetDescription>
                {product.description ?? "No product description."}
              </SheetDescription>
            </SheetHeader>

            {(getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl) ? (
              <img
                alt={product.productName}
                className="h-48 w-full rounded-lg object-cover"
                src={getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl ?? ""}
              />
            ) : null}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-brand-mocha">Product code</p>
                <p className="font-medium text-brand-espresso">{product.productCode}</p>
              </div>
              <div>
                <p className="text-brand-mocha">SKU / Barcode</p>
                <p className="font-medium text-brand-espresso">
                  {product.sku ?? "-"} / {product.barcode ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-brand-mocha">Category / Unit</p>
                <p className="font-medium text-brand-espresso">
                  {product.categoryName} / {product.unitName}
                </p>
              </div>
              <div>
                <p className="text-brand-mocha">Tax / Type</p>
                <p className="font-medium text-brand-espresso">
                  {product.taxRateName ?? "-"} / {product.productType.replaceAll("_", " ")}
                </p>
              </div>
              <div>
                <p className="text-brand-mocha">Sale / Cost / Compare</p>
                <p className="font-medium text-brand-espresso">
                  {product.salePrice.toFixed(2)} / {product.costPrice?.toFixed(2) ?? "-"} /{" "}
                  {product.compareAtPrice?.toFixed(2) ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-brand-mocha">Preparation time</p>
                <p className="font-medium text-brand-espresso">
                  {product.preparationTimeMinutes ?? "-"} min
                </p>
              </div>
              <div>
                <p className="text-brand-mocha">Created at</p>
                <p className="font-medium text-brand-espresso">
                  {new Date(product.createdAt).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-brand-mocha">Updated at</p>
                <p className="font-medium text-brand-espresso">
                  {new Date(product.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">POS: {product.isPosVisible ? "Visible" : "Hidden"}</Badge>
              <Badge variant="outline">
                Stock: {product.isStockTracked ? "Tracked" : "Not tracked"}
              </Badge>
              <Badge variant="outline">
                Expiry: {product.isExpiryTracked ? "Tracked" : "Not tracked"}
              </Badge>
              <Badge variant="outline">
                Custom orders: {product.isCustomOrderAvailable ? "Enabled" : "Disabled"}
              </Badge>
              <Badge variant="outline">Status: {product.status}</Badge>
            </div>
            <ProductVariantsSection
              canManage={canManage}
              onAdd={onAddVariant}
              onDelete={onDeleteVariant}
              onEdit={onEditVariant}
              variants={variants}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
