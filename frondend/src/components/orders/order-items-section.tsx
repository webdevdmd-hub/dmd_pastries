"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";

import { OrderItemEditor } from "@/components/orders/order-item-editor";
import { Button } from "@/components/ui/button";
import type { Unit } from "@/types/master-data";
import type { CreateOrderItemPayload } from "@/types/orders";
import type { Product } from "@/types/product";

function createEmptyItem(defaultUnitId: string): CreateOrderItemPayload {
  return {
    customizationsJson: null,
    designNotes: null,
    discountAmount: 0,
    flavor: null,
    itemName: null,
    messageText: null,
    productId: null,
    productVariantId: null,
    quantity: 1,
    taxRateId: null,
    unitId: defaultUnitId,
    unitPrice: 0,
    weight: null,
  };
}

export function OrderItemsSection({
  items,
  onChange,
  products,
  units,
}: {
  items: CreateOrderItemPayload[];
  onChange: (items: CreateOrderItemPayload[]) => void;
  products: Product[];
  units: Unit[];
}): JSX.Element {
  const defaultUnitId = units[0]?.id ?? "";

  return (
    <section className="rounded-3xl border border-brand-cappuccino/60 bg-white/85 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-brand-espresso">Order Items</h2>
          <p className="text-sm text-brand-mocha">
            Add cakes, made-to-order items, and custom notes.
          </p>
        </div>
        <Button
          onClick={() => onChange([...items, createEmptyItem(defaultUnitId)])}
          type="button"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          Add item
        </Button>
      </div>
      <div className="mt-5 grid gap-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-brand-cappuccino p-6 text-brand-mocha">
            No items added yet.
          </div>
        ) : null}
        {items.map((item, index) => (
          <OrderItemEditor
            item={item}
            key={String(index)}
            onChange={(nextItem) => {
              onChange(items.map((entry, entryIndex) => (entryIndex === index ? nextItem : entry)));
            }}
            onRemove={() => onChange(items.filter((_entry, entryIndex) => entryIndex !== index))}
            products={products}
            units={units}
          />
        ))}
      </div>
    </section>
  );
}
