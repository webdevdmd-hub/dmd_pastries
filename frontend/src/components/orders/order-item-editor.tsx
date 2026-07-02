"use client";

import { Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useMemo } from "react";

import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import type { Unit } from "@/types/master-data";
import type { CreateOrderItemPayload } from "@/types/orders";
import type { Product, ProductVariant } from "@/types/product";

type ProductOptionMeta = {
  productId: string | null;
};

const fieldLabelClassName =
  "text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-brand-mocha";

function parentProductValue(productId: string): string {
  return `product:${productId}`;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function compactCode(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "-";
}

function stockLabel(isStockTracked: boolean): string {
  return isStockTracked ? "Stock tracked" : "Not stock tracked";
}

function variantSummary(variants: ProductVariant[]): string {
  const activeVariants = variants.filter((variant) => variant.status === "active");
  if (activeVariants.length === 0) {
    return "No active variants";
  }

  return activeVariants
    .slice(0, 3)
    .map((variant) => [variant.variantName, compactCode(variant.sku)].join(" / "))
    .join(", ");
}

export function OrderItemEditor({
  item,
  onChange,
  onRemove,
  products,
  units,
}: {
  item: CreateOrderItemPayload;
  onChange: (item: CreateOrderItemPayload) => void;
  onRemove: () => void;
  products: Product[];
  units: Unit[];
}): JSX.Element {
  const selectedProduct = products.find((product) => product.id === item.productId);
  const selectedVariant =
    selectedProduct?.variants.find((variant) => variant.id === item.productVariantId) ?? null;
  const activeProductVariants = useMemo(
    () => selectedProduct?.variants.filter((variant) => variant.status === "active") ?? [],
    [selectedProduct],
  );
  const isCustomItem = item.productId === null && item.itemName !== null;
  const productSelectValue = item.productId ? parentProductValue(item.productId) : "";
  const productOptionMetaByValue = useMemo<Map<string, ProductOptionMeta>>(() => {
    const map = new Map<string, ProductOptionMeta>();
    products.forEach((product) => {
      map.set(parentProductValue(product.id), {
        productId: product.id,
      });
    });
    return map;
  }, [products]);
  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [products]);
  const productOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      products.map((product) => ({
        value: parentProductValue(product.id),
        label: product.productName,
        description: [
          product.variants.length > 0
            ? [String(product.variants.length), "variants"].join(" ")
            : "Base product",
          product.productCode,
          product.categoryName,
          `AED ${product.salePrice.toFixed(2)}`,
        ]
          .filter((part) => part.length > 0)
          .join(" - "),
        keywords: [
          product.productName,
          product.productCode,
          product.categoryName,
          product.sku ?? "",
          product.barcode ?? "",
          ...product.variants.flatMap((variant) => [
            variant.variantName,
            variant.sku ?? "",
            variant.barcode ?? "",
          ]),
        ],
      })),
    [products],
  );
  const variantOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      activeProductVariants.map((variant) => ({
        value: variant.id,
        label: variant.variantName,
        description: [
          variant.sku ?? "",
          variant.barcode ?? "",
          `AED ${variant.salePrice.toFixed(2)}`,
        ]
          .filter((part) => part.length > 0)
          .join(" - "),
        keywords: [variant.variantName, variant.sku ?? "", variant.barcode ?? ""],
      })),
    [activeProductVariants],
  );
  const update = (patch: Partial<CreateOrderItemPayload>): void => {
    onChange({ ...item, ...patch });
  };
  const renderProductOption = (
    option: SearchableComboboxOption,
    state: { selected: boolean },
  ): JSX.Element => {
    const productId = productOptionMetaByValue.get(option.value)?.productId;
    const product = productId ? productById.get(productId) : null;

    if (!product) {
      return (
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{option.label}</span>
          {option.description ? (
            <span className="block truncate text-xs text-brand-mocha">{option.description}</span>
          ) : null}
        </span>
      );
    }

    return (
      <div
        className={cn(
          "min-w-0 max-w-full flex-1 rounded-lg px-1 py-1 text-left",
          state.selected ? "bg-brand-latte/50" : "",
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-brand-espresso">
            {product.productName}
          </p>
          <div className="mt-1.5 flex max-w-full flex-wrap gap-1.5 text-[0.68rem] font-semibold text-brand-mocha">
            <span className="rounded-md bg-brand-latte px-2 py-0.5 font-mono text-brand-espresso">
              AED {money(product.salePrice)}
            </span>
            <span className="max-w-[12rem] truncate rounded-md bg-neutral-100 px-2 py-0.5">
              {product.categoryName}
            </span>
            <span className="rounded-md bg-neutral-100 px-2 py-0.5">
              {stockLabel(product.isStockTracked)}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-brand-mocha">
            Variants: {variantSummary(product.variants)}
          </p>
          <p className="truncate text-xs text-brand-mocha">
            Code {compactCode(product.productCode)} - SKU {compactCode(product.sku)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4">
      <div className="grid gap-2.5 md:grid-cols-12">
        <label className="grid gap-1.5 md:col-span-2">
          <span className={fieldLabelClassName}>Item type</span>
          <Select
            onValueChange={(value) => {
              if (value === "custom") {
                update({
                  itemName: "",
                  productId: null,
                  productVariantId: null,
                  taxRateId: null,
                });
                return;
              }

              update({
                itemName: null,
                productId: null,
                productVariantId: null,
              });
            }}
            value={isCustomItem ? "custom" : "catalog"}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="catalog">Catalog</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <div className="grid min-w-0 gap-1.5 md:col-span-4">
          <span className={fieldLabelClassName}>
            {isCustomItem ? "Custom item name" : "Product"}
          </span>
          {isCustomItem ? (
            <Input
              onChange={(event) => update({ itemName: event.target.value })}
              placeholder="Custom Batman Birthday Cake 2kg"
              value={item.itemName ?? ""}
            />
          ) : (
            <SearchableCombobox
              emptyMessage="No matching products or variants found."
              onValueChange={(selectedValue) => {
                const selectedMeta = productOptionMetaByValue.get(selectedValue);
                const product = products.find((entry) => entry.id === selectedMeta?.productId);
                update({
                  itemName: null,
                  productId: selectedMeta?.productId ?? null,
                  productVariantId: null,
                  taxRateId: product?.taxRateId ?? null,
                  unitId: product?.unitId ?? item.unitId,
                  unitPrice: product?.salePrice ?? item.unitPrice,
                });
              }}
              options={productOptions}
              placeholder="Select product"
              contentClassName="w-[min(560px,calc(100vw-2rem))]"
              listClassName="max-h-[360px]"
              renderOption={renderProductOption}
              searchPlaceholder="Search product, variant, SKU, barcode, category..."
              triggerClassName="min-w-0"
              value={productSelectValue}
            />
          )}
        </div>
        <label className="grid min-w-0 gap-1.5 md:col-span-3">
          <span className={fieldLabelClassName}>Variant</span>
          <SearchableCombobox
            disabled={isCustomItem || activeProductVariants.length === 0}
            emptyMessage="No matching variants found."
            onValueChange={(variantId) => {
              const variant = activeProductVariants.find((entry) => entry.id === variantId) ?? null;
              update({
                productVariantId: variant?.id ?? null,
                unitPrice: variant?.salePrice ?? selectedProduct?.salePrice ?? item.unitPrice,
              });
            }}
            options={variantOptions}
            placeholder={
              isCustomItem
                ? "Custom item"
                : activeProductVariants.length > 0
                  ? "Base product"
                  : "No variants"
            }
            searchPlaceholder="Search variant, SKU, barcode..."
            value={item.productVariantId ?? ""}
          />
        </label>
        <label className="grid min-w-[5.75rem] gap-1.5 md:col-span-2">
          <span className={fieldLabelClassName}>Quantity</span>
          <Input
            className="min-w-0"
            min={1}
            onChange={(event) => update({ quantity: Number(event.target.value) })}
            placeholder="Qty"
            type="number"
            value={item.quantity}
          />
        </label>
        <Button
          aria-label="Remove item"
          className="self-end justify-self-start md:col-span-1 md:justify-self-end"
          onClick={onRemove}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4 text-red-700" />
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-12">
        <label className="grid min-w-0 gap-1.5 md:col-span-2">
          <span className={fieldLabelClassName}>Unit</span>
          <Select onValueChange={(unitId) => update({ unitId })} value={item.unitId || "none"}>
            <SelectTrigger>
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unit</SelectItem>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.unitName} ({unit.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid min-w-0 gap-1.5 md:col-span-2">
          <span className={fieldLabelClassName}>Unit price</span>
          <Input
            min={0}
            onChange={(event) => update({ unitPrice: Number(event.target.value) })}
            placeholder="Price"
            step="0.01"
            type="number"
            value={item.unitPrice}
          />
        </label>
        <label className="grid gap-1.5 md:col-span-2">
          <span className={fieldLabelClassName}>Weight / size</span>
          <Input
            onChange={(event) =>
              update({ weight: event.target.value ? Number(event.target.value) : null })
            }
            placeholder="Weight, e.g. 2"
            step="0.01"
            type="number"
            value={item.weight ?? ""}
          />
        </label>
        <label className="grid gap-1.5 md:col-span-2">
          <span className={fieldLabelClassName}>Flavor</span>
          <Input
            onChange={(event) => update({ flavor: event.target.value || null })}
            placeholder="Flavor"
            value={item.flavor ?? ""}
          />
        </label>
        <label className="grid gap-1.5 md:col-span-2">
          <span className={fieldLabelClassName}>Cake message</span>
          <Input
            onChange={(event) => update({ messageText: event.target.value || null })}
            placeholder="Cake message"
            value={item.messageText ?? ""}
          />
        </label>
        <label className="grid gap-1.5 md:col-span-2">
          <span className={fieldLabelClassName}>Discount</span>
          <Input
            min={0}
            onChange={(event) => update({ discountAmount: Number(event.target.value) })}
            placeholder="Discount"
            step="0.01"
            type="number"
            value={item.discountAmount}
          />
        </label>
      </div>
      <label className="grid gap-1.5">
        <span className={fieldLabelClassName}>Design notes</span>
        <Input
          onChange={(event) => update({ designNotes: event.target.value || null })}
          placeholder="Design notes"
          value={item.designNotes ?? ""}
        />
      </label>
      <div className="flex items-center justify-between text-sm text-brand-mocha">
        <span>
          {isCustomItem
            ? "Custom one-off item"
            : (selectedVariant?.sku ?? selectedProduct?.productCode ?? "Catalog item")}
        </span>
        <span className="font-semibold text-brand-espresso">
          AED {Math.max(item.quantity * item.unitPrice - item.discountAmount, 0).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
