"use client";

import type { JSX } from "react";

import type { ProductDetailTabKey } from "@/components/products/product-detail-tabs";
import {
  PRODUCT_DETAIL_TABPANEL_ID,
  ProductDetailViewTabs,
} from "@/components/products/product-detail-view-tabs";
import { ProductVariantsSection } from "@/components/products/product-variants-section";
import { Badge } from "@/components/ui/badge";
import { getProductPosVisibilityLabel } from "@/lib/selectors/eligibility";
import { getProductImageUrl } from "@/lib/storage/files";
import {
  COST_UPDATE_POLICY_LABELS,
  ITEM_STRUCTURE_LABELS,
  PRICING_TYPE_LABELS,
  type Product,
  PRODUCT_TYPE_LABELS,
  type ProductVariant,
} from "@/types/product";

type ProductDetailsPanelProps = {
  activeTab: ProductDetailTabKey;
  canManage: boolean;
  onAddVariant: () => void;
  onDeleteVariant: (variant: ProductVariant) => void;
  onEditVariant: (variant: ProductVariant) => void;
  onTabChange: (tab: ProductDetailTabKey) => void;
  product: Product;
  variants: ProductVariant[];
};

function formatMoney(value: number | null): string {
  if (value === null) return "—";

  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("en-AE") : "—";
}

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="grid gap-0.5 rounded-lg bg-muted px-3 py-2">
      <span className="text-meta text-foreground-muted">{label}</span>
      <span className="break-words text-cell font-medium tabular-nums">{value}</span>
    </div>
  );
}

/**
 * A product capability, named for what it actually is.
 *
 * This used to render one label and swap only the badge colour, so a product
 * that does NOT track expiry still read "Expiry tracked", in grey. Colour was
 * the only thing carrying the meaning: to anyone who cannot separate a green
 * tint from no tint, and to every screen reader, the badge asserted the exact
 * opposite of the truth.
 *
 * The POS badge in the same row already had this right -- its label reads
 * "POS: POS Visible" or "POS: Not Sellable" -- so the state belongs in the
 * words here too, with the colour left to reinforce rather than to inform.
 *
 * Regression: ISSUE-008 — product flag badges read the same whether the flag was on or off
 * Found by /qa on 2026-09-14
 */
function Flag({ active, offLabel, onLabel }: FlagProps): JSX.Element {
  return <Badge variant={active ? "money" : "outline"}>{active ? onLabel : offLabel}</Badge>;
}

type FlagProps = {
  active: boolean;
  offLabel: string;
  onLabel: string;
};

/**
 * The body of a product's details: the tab strip and whichever panel is
 * selected. Shared by the full page and the drawer over the list, which is
 * why the tab is a prop rather than state. The page keeps it in the URL; the
 * drawer keeps it in memory.
 */
export function ProductDetailsPanel({
  activeTab,
  canManage,
  onAddVariant,
  onDeleteVariant,
  onEditVariant,
  onTabChange,
  product,
  variants,
}: ProductDetailsPanelProps): JSX.Element {
  const imageUrl = getProductImageUrl(product) ?? product.imageUrl;

  return (
    <div className="grid gap-6">
      <ProductDetailViewTabs
        active={activeTab}
        onTabChange={onTabChange}
        productId={product.id}
        variantsCount={variants.length}
      />

      {/* One panel element that swaps, which is what `aria-controls` on every
          tab points at. */}
      <div id={PRODUCT_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {activeTab === "overview" ? (
          <div className="grid gap-4">
            {imageUrl ? (
              <img
                alt={product.productName}
                className="h-48 w-full rounded-lg object-cover"
                src={imageUrl}
              />
            ) : null}

            <div className="grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-4">
              <DetailRow label="Sale price" value={formatMoney(product.salePrice)} />
              <DetailRow label="Cost price" value={formatMoney(product.costPrice)} />
              <DetailRow
                label="Latest purchase"
                value={formatMoney(product.lastPurchaseCost ?? product.costPrice)}
              />
              <DetailRow
                label="Prep time"
                value={
                  product.preparationTimeMinutes === null
                    ? "—"
                    : `${String(product.preparationTimeMinutes)} min`
                }
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Flag active={product.isSellable} offLabel="Not sellable" onLabel="Sellable" />
              <Flag
                active={product.isPosVisible}
                offLabel={`POS: ${getProductPosVisibilityLabel(product)}`}
                onLabel={`POS: ${getProductPosVisibilityLabel(product)}`}
              />
              <Flag
                active={product.isExpiryTracked}
                offLabel="No expiry tracking"
                onLabel="Expiry tracked"
              />
              <Flag
                active={product.isCustomOrderAvailable}
                offLabel="No custom orders"
                onLabel="Custom orders"
              />
            </div>

            <div className="rounded-lg bg-muted px-3 py-2">
              <span className="text-meta text-foreground-muted">Description</span>
              <p className="mt-0.5 text-cell">
                {product.description ?? "No product description has been added."}
              </p>
            </div>
          </div>
        ) : null}

        {activeTab === "details" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <DetailRow label="Product code" value={product.productCode} />
            <DetailRow
              label="SKU / Barcode"
              value={`${product.sku ?? "—"} / ${product.barcode ?? "—"}`}
            />
            <DetailRow label="Product type" value={PRODUCT_TYPE_LABELS[product.productType]} />
            <DetailRow
              label="Item structure"
              value={ITEM_STRUCTURE_LABELS[product.itemStructure]}
            />
            <DetailRow label="Category" value={product.categoryName} />
            <DetailRow label="Unit" value={product.unitName} />
            <DetailRow label="Tax rate" value={product.taxRateName ?? "—"} />
            <DetailRow
              label="Cost policy"
              value={COST_UPDATE_POLICY_LABELS[product.costUpdatePolicy]}
            />
            <DetailRow
              label="Pricing"
              value={`${PRICING_TYPE_LABELS[product.pricingType]} ${String(product.pricingPercent)}%`}
            />
            <DetailRow label="Minimum sale price" value={formatMoney(product.minimumSalePrice)} />
            <DetailRow
              label="Suggested sale price"
              value={formatMoney(product.suggestedSalePrice)}
            />
            <DetailRow
              label="Average inventory cost"
              value={formatMoney(product.averageInventoryCost)}
            />
            <DetailRow label="Last purchase" value={formatDateTime(product.lastPurchaseDate)} />
            <DetailRow label="Last production" value={formatDateTime(product.lastProductionDate)} />
            <DetailRow label="Created" value={formatDateTime(product.createdAt)} />
            <DetailRow label="Updated" value={formatDateTime(product.updatedAt)} />
          </div>
        ) : null}

        {activeTab === "variants" ? (
          <ProductVariantsSection
            canManage={canManage}
            onAdd={onAddVariant}
            onDelete={onDeleteVariant}
            onEdit={onEditVariant}
            product={product}
            variants={variants}
          />
        ) : null}
      </div>
    </div>
  );
}
