"use client";

import type { JSX } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { wastageSchema } from "@/lib/validators/manufacturing.schema";
import type { ManufacturingInventoryOption, WastagePayload } from "@/types/manufacturing";
import { PRODUCT_TYPE_LABELS } from "@/types/product";

function inventoryLabel(item: ManufacturingInventoryOption): string {
  return item.productVariantName ?? item.productName ?? item.itemName;
}

function inventoryMeta(item: ManufacturingInventoryOption): string {
  const parts = [
    item.productType ? PRODUCT_TYPE_LABELS[item.productType] : null,
    item.unitSymbol || item.unitName,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" / ");
}

export function BatchWastageDialog({
  inventory,
  isSubmitting,
  onClose,
  onWastage,
  open,
}: {
  inventory: ManufacturingInventoryOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onWastage: (payload: WastagePayload) => Promise<void>;
  open: boolean;
}): JSX.Element {
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [wastageType, setWastageType] = useState("ingredient");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    const result = wastageSchema.safeParse({
      inventoryItemId,
      quantity,
      reason,
      wastageType,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please check wastage form.");
      return;
    }

    await onWastage(result.data);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add wastage</DialogTitle>
          <DialogDescription>
            Record unusable stock or production waste for audit visibility.
          </DialogDescription>
        </DialogHeader>
        <Select
          value={inventoryItemId || "none"}
          onValueChange={(value) => setInventoryItemId(value === "none" ? "" : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Inventory item" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select item</SelectItem>
            {inventory.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {inventoryLabel(item)}
                {inventoryMeta(item) ? ` (${inventoryMeta(item)})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Wastage type"
          onChange={(event) => setWastageType(event.target.value)}
          placeholder="Wastage type"
          value={wastageType}
        />
        <Input
          aria-label="Quantity"
          min="0"
          onChange={(event) => setQuantity(Number(event.target.value))}
          type="number"
          value={quantity}
        />
        <Input
          aria-label="Reason"
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason"
          value={reason}
        />
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={() => void submit()} type="button">
            Add wastage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
