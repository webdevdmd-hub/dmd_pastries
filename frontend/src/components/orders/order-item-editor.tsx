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
import type { Unit } from "@/types/master-data";
import type { CreateOrderItemPayload } from "@/types/orders";
import type { Product } from "@/types/product";

type ProductOptionMeta = {
  productId: string | null;
  productVariantId: string | null;
};

function parentProductValue(productId: string): string {
  return `product:${productId}`;
}

function variantProductValue(productId: string, variantId: string): string {
  return `variant:${productId}:${variantId}`;
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
  const isCustomItem = item.productId === null && item.itemName !== null;
  const productSelectValue = item.productId
    ? item.productVariantId
      ? variantProductValue(item.productId, item.productVariantId)
      : parentProductValue(item.productId)
    : "";
  const productOptionMetaByValue = useMemo<Map<string, ProductOptionMeta>>(() => {
    const map = new Map<string, ProductOptionMeta>();
    products.forEach((product) => {
      map.set(parentProductValue(product.id), {
        productId: product.id,
        productVariantId: null,
      });
      product.variants.forEach((variant) => {
        map.set(variantProductValue(product.id, variant.id), {
          productId: product.id,
          productVariantId: variant.id,
        });
      });
    });
    return map;
  }, [products]);
  const productOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      products.flatMap((product) => [
        {
          value: parentProductValue(product.id),
          label: product.productName,
          description: [
            "Parent product",
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
          ],
        },
        ...product.variants.map((variant) => ({
          value: variantProductValue(product.id, variant.id),
          label: `${product.productName} - ${variant.variantName}`,
          description: [
            "Variant",
            variant.sku ?? "",
            variant.barcode ?? "",
            product.categoryName,
            `AED ${variant.salePrice.toFixed(2)}`,
          ]
            .filter((part) => part.length > 0)
            .join(" - "),
          keywords: [
            product.productName,
            product.productCode,
            product.categoryName,
            product.sku ?? "",
            product.barcode ?? "",
            variant.variantName,
            variant.sku ?? "",
            variant.barcode ?? "",
          ],
        })),
      ]),
    [products],
  );
  const update = (patch: Partial<CreateOrderItemPayload>): void => {
    onChange({ ...item, ...patch });
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4">
      <div className="grid gap-3 md:grid-cols-[0.75fr_1.5fr_0.55fr_0.8fr_0.8fr_auto]">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha">
            Item type
          </span>
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
        <div className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha">
            {isCustomItem ? "Custom item name" : "Product / variant"}
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
                const variant =
                  product?.variants.find((entry) => entry.id === selectedMeta?.productVariantId) ??
                  null;
                update({
                  itemName: null,
                  productId: selectedMeta?.productId ?? null,
                  productVariantId: selectedMeta?.productVariantId ?? null,
                  taxRateId: product?.taxRateId ?? null,
                  unitId: product?.unitId ?? item.unitId,
                  unitPrice: variant?.salePrice ?? product?.salePrice ?? item.unitPrice,
                });
              }}
              options={productOptions}
              placeholder="Select product or variant"
              searchPlaceholder="Search product, variant, SKU, barcode, category..."
              value={productSelectValue}
            />
          )}
        </div>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha">
            Quantity
          </span>
          <Input
            min={1}
            onChange={(event) => update({ quantity: Number(event.target.value) })}
            placeholder="Qty"
            type="number"
            value={item.quantity}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha">
            Unit
          </span>
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
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha">
            Unit price
          </span>
          <Input
            min={0}
            onChange={(event) => update({ unitPrice: Number(event.target.value) })}
            placeholder="Price"
            step="0.01"
            type="number"
            value={item.unitPrice}
          />
        </label>
        <Button
          aria-label="Remove item"
          className="self-end"
          onClick={onRemove}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4 text-red-700" />
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha">
            Weight / size
          </span>
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
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha">
            Flavor
          </span>
          <Input
            onChange={(event) => update({ flavor: event.target.value || null })}
            placeholder="Flavor"
            value={item.flavor ?? ""}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha">
            Cake message
          </span>
          <Input
            onChange={(event) => update({ messageText: event.target.value || null })}
            placeholder="Cake message"
            value={item.messageText ?? ""}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha">
            Discount
          </span>
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
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha">
          Design notes
        </span>
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
