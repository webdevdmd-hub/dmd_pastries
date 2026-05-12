"use client";

import { Trash2 } from "lucide-react";
import type { JSX } from "react";

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

  const update = (patch: Partial<CreateOrderItemPayload>): void => {
    onChange({ ...item, ...patch });
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4">
      <div className="grid gap-3 md:grid-cols-[1.5fr_0.6fr_0.8fr_0.8fr_auto]">
        <Select
          onValueChange={(productId) => {
            const product = products.find((entry) => entry.id === productId);
            update({
              productId,
              taxRateId: product?.taxRateId ?? null,
              unitId: product?.unitId ?? item.unitId,
              unitPrice: product?.salePrice ?? item.unitPrice,
            });
          }}
          value={item.productId || "none"}
        >
          <SelectTrigger>
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select product</SelectItem>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.productName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Quantity"
          min={1}
          onChange={(event) => update({ quantity: Number(event.target.value) })}
          placeholder="Qty"
          type="number"
          value={item.quantity}
        />
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
        <Input
          aria-label="Unit price"
          min={0}
          onChange={(event) => update({ unitPrice: Number(event.target.value) })}
          placeholder="Price"
          step="0.01"
          type="number"
          value={item.unitPrice}
        />
        <Button
          aria-label="Remove item"
          onClick={onRemove}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4 text-red-700" />
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Input
          onChange={(event) => update({ weight: event.target.value || null })}
          placeholder="Weight, e.g. 1kg"
          value={item.weight ?? ""}
        />
        <Input
          onChange={(event) => update({ flavor: event.target.value || null })}
          placeholder="Flavor"
          value={item.flavor ?? ""}
        />
        <Input
          onChange={(event) => update({ messageText: event.target.value || null })}
          placeholder="Cake message"
          value={item.messageText ?? ""}
        />
        <Input
          min={0}
          onChange={(event) => update({ discountAmount: Number(event.target.value) })}
          placeholder="Discount"
          step="0.01"
          type="number"
          value={item.discountAmount}
        />
      </div>
      <Input
        onChange={(event) => update({ designNotes: event.target.value || null })}
        placeholder="Design notes"
        value={item.designNotes ?? ""}
      />
      <div className="flex items-center justify-between text-sm text-brand-mocha">
        <span>{selectedProduct?.productCode ?? "Custom order item"}</span>
        <span className="font-semibold text-brand-espresso">
          AED {Math.max(item.quantity * item.unitPrice - item.discountAmount, 0).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
