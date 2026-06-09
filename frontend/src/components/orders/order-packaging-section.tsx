"use client";

import { PackagePlus, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddOrderPackaging, useOrderPackaging } from "@/hooks/use-orders";
import { useProducts } from "@/hooks/use-products";
import { getErrorMessage } from "@/lib/api/client";
import type { AddOrderPackagingPayload, BakeryOrder } from "@/types/orders";
import type { Product, ProductListFilters } from "@/types/product";

type PackagingOptionMeta = {
  product: Product;
  variantId: string | null;
  variantName: string | null;
};

const PACKAGING_PRODUCT_FILTERS: ProductListFilters = {
  search: "",
  categoryId: "all",
  productType: "packaging",
  itemStructure: "all",
  status: "active",
  isPosVisible: "all",
  page: 1,
  limit: 100,
  sortBy: "product_name",
  sortOrder: "asc",
};

function optionValue(productId: string, variantId: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

function compactStrings(values: (string | null | undefined)[]): string[] {
  return values.filter((value): value is string => Boolean(value && value.length > 0));
}

function packagingDisplayName(meta: PackagingOptionMeta | undefined): string | null {
  if (!meta) {
    return null;
  }

  return meta.variantName
    ? `${meta.product.productName} / ${meta.variantName}`
    : meta.product.productName;
}

export function OrderPackagingSection({
  canManage,
  draftPackaging = [],
  onDraftPackagingChange,
  order,
}: {
  canManage: boolean;
  draftPackaging?: AddOrderPackagingPayload[];
  onDraftPackagingChange?: (lines: AddOrderPackagingPayload[]) => void;
  order: BakeryOrder | null;
}): JSX.Element {
  const [selectedPackagingValue, setSelectedPackagingValue] = useState("");
  const [quantityRequired, setQuantityRequired] = useState(1);
  const packagingProductsQuery = useProducts(PACKAGING_PRODUCT_FILTERS, canManage);
  const orderPackagingQuery = useOrderPackaging(order?.id ?? null, order !== null);
  const addPackagingMutation = useAddOrderPackaging();
  const packagingProducts = useMemo(
    () => packagingProductsQuery.data?.items ?? [],
    [packagingProductsQuery.data?.items],
  );
  const packagingOptionLookup = useMemo<Map<string, PackagingOptionMeta>>(() => {
    const lookup = new Map<string, PackagingOptionMeta>();

    packagingProducts.forEach((product) => {
      lookup.set(optionValue(product.id, null), {
        product,
        variantId: null,
        variantName: null,
      });

      product.variants
        .filter((variant) => variant.status === "active")
        .forEach((variant) => {
          lookup.set(optionValue(product.id, variant.id), {
            product,
            variantId: variant.id,
            variantName: variant.variantName,
          });
        });
    });

    return lookup;
  }, [packagingProducts]);
  const selectedPackaging = packagingOptionLookup.get(selectedPackagingValue);
  const packagingOptions = useMemo<SearchableComboboxOption[]>(() => {
    const options: SearchableComboboxOption[] = [];

    packagingProducts.forEach((product) => {
      options.push({
        value: optionValue(product.id, null),
        label: product.productName,
        description: compactStrings([
          product.productCode,
          product.categoryName,
          product.unitName,
          product.itemStructure === "variant" ? "Parent product" : "",
        ]).join(" - "),
        keywords: compactStrings([
          product.productName,
          product.productCode,
          product.sku,
          product.barcode,
          product.categoryName,
          product.unitName,
        ]),
      });

      product.variants
        .filter((variant) => variant.status === "active")
        .forEach((variant) => {
          options.push({
            value: optionValue(product.id, variant.id),
            label: `${product.productName} / ${variant.variantName}`,
            description: compactStrings([
              product.productCode,
              variant.sku,
              product.categoryName,
              product.unitName,
            ]).join(" - "),
            keywords: compactStrings([
              product.productName,
              product.productCode,
              product.categoryName,
              variant.variantName,
              variant.sku,
              variant.barcode,
            ]),
          });
        });
    });

    return options;
  }, [packagingProducts]);

  const addDraftPackaging = (): void => {
    if (!selectedPackaging || !onDraftPackagingChange) {
      return;
    }

    onDraftPackagingChange([
      ...draftPackaging,
      {
        componentProductId: selectedPackaging.product.id,
        componentVariantId: selectedPackaging.variantId,
        quantityRequired,
        unitId: selectedPackaging.product.unitId,
      },
    ]);
    setSelectedPackagingValue("");
    setQuantityRequired(1);
  };

  const packagingName = (
    componentProductId: string,
    componentVariantId: string | null = null,
  ): string => {
    const exactMatch = packagingOptionLookup.get(
      optionValue(componentProductId, componentVariantId),
    );
    const baseMatch = packagingOptionLookup.get(optionValue(componentProductId, null));

    return (
      packagingDisplayName(exactMatch) ?? packagingDisplayName(baseMatch) ?? "Packaging product"
    );
  };

  return (
    <section className="rounded-3xl border border-brand-cappuccino/60 bg-white/85 p-5">
      <h2 className="text-xl font-semibold text-brand-espresso">Packaging</h2>
      <p className="mt-1 text-sm text-brand-mocha">
        Attach boxes, trays, labels, or packaging items.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
        <SearchableCombobox
          disabled={!canManage}
          emptyMessage="No matching Product Master packaging products found."
          isLoading={packagingProductsQuery.isLoading}
          loadingMessage="Loading packaging products..."
          onRetry={() => void packagingProductsQuery.refetch()}
          onValueChange={setSelectedPackagingValue}
          options={packagingOptions}
          placeholder="Select packaging product"
          searchPlaceholder="Search packaging product, code, SKU..."
          value={selectedPackagingValue}
        />
        <Input
          min={1}
          onChange={(event) => setQuantityRequired(Number(event.target.value))}
          type="number"
          value={quantityRequired}
        />
        <Button
          disabled={!canManage || !selectedPackagingValue || addPackagingMutation.isPending}
          onClick={() => {
            void (async () => {
              if (!selectedPackagingValue || !selectedPackaging) {
                return;
              }
              if (!order) {
                addDraftPackaging();
                return;
              }
              try {
                await addPackagingMutation.mutateAsync({
                  orderId: order.id,
                  payload: {
                    componentProductId: selectedPackaging.product.id,
                    componentVariantId: selectedPackaging.variantId,
                    quantityRequired,
                    unitId: selectedPackaging.product.unitId,
                  },
                });
                setSelectedPackagingValue("");
                setQuantityRequired(1);
                toast.success("Packaging added.");
              } catch (error: unknown) {
                toast.error(getErrorMessage(error));
              }
            })();
          }}
          type="button"
        >
          <PackagePlus className="h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="mt-4 grid gap-2">
        {!order
          ? draftPackaging.map((entry, index) => (
              <div
                className="flex items-center justify-between rounded-2xl border border-brand-cappuccino/60 p-3 text-sm"
                key={`${entry.componentProductId}-${entry.componentVariantId ?? "base"}-${String(index)}`}
              >
                <span className="font-medium text-brand-espresso">
                  {packagingName(entry.componentProductId, entry.componentVariantId)}
                </span>
                <span className="flex items-center gap-3 text-brand-mocha">
                  Qty {entry.quantityRequired}
                  <Button
                    aria-label="Remove draft packaging"
                    onClick={() =>
                      onDraftPackagingChange?.(
                        draftPackaging.filter((_line, lineIndex) => lineIndex !== index),
                      )
                    }
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4 text-red-700" />
                  </Button>
                </span>
              </div>
            ))
          : null}
        {(orderPackagingQuery.data ?? []).map((entry) => (
          <div
            className="flex items-center justify-between rounded-2xl border border-brand-cappuccino/60 p-3 text-sm"
            key={entry.id}
          >
            <span className="font-medium text-brand-espresso">
              {entry.componentProductName ??
                (entry.packagingItemId ? entry.packagingName : "Packaging product")}
              {entry.componentVariantName ? ` / ${entry.componentVariantName}` : ""}
            </span>
            <span className="text-brand-mocha">Qty {entry.quantityRequired}</span>
          </div>
        ))}
        {!order ? (
          <p className="rounded-2xl border border-dashed border-brand-cappuccino p-4 text-sm text-brand-mocha">
            Add packaging now. It will be saved automatically when you create the order.
          </p>
        ) : null}
        {order &&
        !orderPackagingQuery.isLoading &&
        (orderPackagingQuery.data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand-cappuccino p-4 text-sm text-brand-mocha">
            No packaging linked yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
