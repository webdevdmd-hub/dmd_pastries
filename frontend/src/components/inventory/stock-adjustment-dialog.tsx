"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type StockAdjustmentSchema,
  stockAdjustmentSchema,
} from "@/lib/validators/inventory.schema";
import type { InventoryItem, StockAdjustmentPayload } from "@/types/inventory";

type StockAdjustmentDialogProps = {
  item: InventoryItem | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (id: string, payload: StockAdjustmentPayload) => Promise<void>;
  open: boolean;
};

export function StockAdjustmentDialog({
  item,
  isSubmitting,
  onClose,
  onSubmit,
  open,
}: StockAdjustmentDialogProps): JSX.Element {
  const form = useForm<StockAdjustmentSchema>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      adjustmentType: "increase",
      quantity: 1,
      reason: "",
    },
  });

  useEffect(() => {
    form.reset({ adjustmentType: "increase", quantity: 1, reason: "" });
  }, [form, item]);

  const handleSubmit = async (values: StockAdjustmentSchema): Promise<void> => {
    if (!item) return;

    if (values.adjustmentType === "decrease" && values.quantity > item.currentQuantity) {
      form.setError("quantity", {
        message: "Decrease cannot exceed current quantity.",
        type: "manual",
      });
      return;
    }

    await onSubmit(item.id, {
      adjustmentType: values.adjustmentType,
      quantity: values.quantity,
      reason: values.reason,
    });
  };

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {item
              ? `Current stock for ${item.itemName}: ${String(item.currentQuantity)} ${item.unitSymbol}`
              : "Adjust inventory quantity."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              void handleSubmit(values);
            })(event);
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="stock-adjustment-adjustment-type">Adjustment type</Label>
            <Select
              onValueChange={(value) =>
                form.setValue("adjustmentType", value as StockAdjustmentSchema["adjustmentType"])
              }
              value={form.watch("adjustmentType")}
            >
              <SelectTrigger id="stock-adjustment-adjustment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="increase">Increase</SelectItem>
                <SelectItem value="decrease">Decrease</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="adjustQuantity">Quantity</Label>
            <Input
              id="adjustQuantity"
              min={0.001}
              step="0.001"
              type="number"
              {...form.register("quantity")}
            />
            {form.formState.errors.quantity ? (
              <p className="text-sm text-danger-text">{form.formState.errors.quantity.message}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="adjustReason">Reason</Label>
            <Input id="adjustReason" {...form.register("reason")} />
            {form.formState.errors.reason ? (
              <p className="text-sm text-danger-text">{form.formState.errors.reason.message}</p>
            ) : null}
          </div>
          {form.watch("adjustmentType") === "decrease" ? (
            <p className="rounded-2xl bg-warning-tint p-3 text-sm text-warning-text">
              Decreasing stock affects availability immediately. Backend remains final authority.
            </p>
          ) : null}
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving..." : "Save adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
