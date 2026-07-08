"use client";

import { Barcode, Clock3, DollarSign, Package, ReceiptText, Store } from "lucide-react";
import type { JSX } from "react";

import { ProductVariantsSection } from "@/components/products/product-variants-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import {
  ITEM_STRUCTURE_LABELS,
  type Product,
  PRODUCT_TYPE_LABELS,
  type ProductVariant,
} from "@/types/product";

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

function formatMoney(value: number | null): string {
  if (value === null) return "-";

  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatPreparationTime(value: number | null): string {
  return value === null ? "- min" : `${String(value)} min`;
}

function DetailMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Barcode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-brand-cappuccino/70 bg-white/80 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-brand-espresso">{value}</p>
    </div>
  );
}

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
          <div className="flex flex-col gap-5">
            <SheetHeader>
              <SheetTitle className="pr-8 text-2xl">{product.productName}</SheetTitle>
              <SheetDescription>
                {product.productCode} · {product.categoryName} · {product.unitName}
              </SheetDescription>
            </SheetHeader>

            {(getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl) ? (
              <img
                alt={product.productName}
                className="h-48 w-full rounded-lg object-cover"
                src={getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl ?? ""}
              />
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <DetailMetric
                icon={DollarSign}
                label="Sale price"
                value={formatMoney(product.salePrice)}
              />
              <DetailMetric
                icon={ReceiptText}
                label="Cost price"
                value={formatMoney(product.costPrice)}
              />
              <DetailMetric
                icon={Barcode}
                label="SKU / Barcode"
                value={`${product.sku ?? "-"} / ${product.barcode ?? "-"}`}
              />
              <DetailMetric
                icon={Clock3}
                label="Prep time"
                value={formatPreparationTime(product.preparationTimeMinutes)}
              />
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Sellable: {product.isSellable ? "Yes" : "No"}</Badge>
              <Badge variant="outline">POS: {product.isPosVisible ? "Visible" : "Hidden"}</Badge>
              <Badge variant="outline">
                Purchasable: {product.isPurchasable ? "Yes" : "No"}
              </Badge>
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
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-latte text-brand-mocha">
                    <Package className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-brand-espresso">Catalog notes</p>
                    <p className="mt-1 text-sm leading-6 text-brand-mocha">
                      {product.description ?? "No product description has been added."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-2">
                <DetailMetric
                  icon={Store}
                  label="Product type"
                  value={PRODUCT_TYPE_LABELS[product.productType]}
                />
                <DetailMetric
                  icon={Package}
                  label="Item structure"
                  value={ITEM_STRUCTURE_LABELS[product.itemStructure]}
                />
                <DetailMetric
                  icon={ReceiptText}
                  label="Tax rate"
                  value={product.taxRateName ?? "-"}
                />
                <DetailMetric
                  icon={Clock3}
                  label="Created"
                  value={new Date(product.createdAt).toLocaleString()}
                />
                <DetailMetric
                  icon={Clock3}
                  label="Updated"
                  value={new Date(product.updatedAt).toLocaleString()}
                />
              </CardContent>
            </Card>
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
