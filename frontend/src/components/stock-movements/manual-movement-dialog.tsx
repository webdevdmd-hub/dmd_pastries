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
  type ManualMovementSchema,
  manualMovementSchema,
} from "@/lib/validators/stock-movements.schema";
import type { InventoryItem } from "@/types/inventory";
import type { ManualMovementPayload } from "@/types/stock-movements";

type ManualMovementDialogProps = {
  inventoryItems: InventoryItem[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: ManualMovementPayload) => Promise<void>;
  open: boolean;
};

export function ManualMovementDialog({
  inventoryItems,
  isSubmitting,
  onClose,
  onSubmit,
  open,
}: ManualMovementDialogProps): JSX.Element {
  const form = useForm<ManualMovementSchema>({
    resolver: zodResolver(manualMovementSchema),
    defaultValues: {
      inventoryItemId: "",
      movementType: "adjustment_in",
      quantity: 1,
      reason: "",
      notes: "",
    },
  });
  const movementType = form.watch("movementType");
  // The schema rejects an empty reason and a zero quantity, and nothing here
  // ever displayed the message: submitting a blank form simply did nothing.
  const errors = form.formState.errors;

  useEffect(() => {
    if (open) {
      form.reset({
        inventoryItemId: inventoryItems[0]?.id ?? "",
        movementType: "adjustment_in",
        quantity: 1,
        reason: "",
        notes: "",
      });
    }
  }, [form, inventoryItems, open]);

  const handleSubmit = async (values: ManualMovementSchema): Promise<void> => {
    await onSubmit({
      inventoryItemId: values.inventoryItemId,
      movementType: values.movementType,
      quantity: values.quantity,
      reason: values.reason,
      ...(values.notes ? { notes: values.notes } : {}),
    });
  };

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual stock movement</DialogTitle>
          <DialogDescription>
            Create a controlled manual movement. Backend remains the source of truth for stock.
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
            <Label htmlFor="manual-movement-inventory-item">Inventory item</Label>
            <Select
              onValueChange={(value) => form.setValue("inventoryItemId", value)}
              value={form.watch("inventoryItemId")}
            >
              <SelectTrigger id="manual-movement-inventory-item">
                <SelectValue placeholder="Select inventory item" />
              </SelectTrigger>
              <SelectContent>
                {inventoryItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.itemName} · {item.branchName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.inventoryItemId ? (
              <p className="text-meta text-danger-text">{errors.inventoryItemId.message}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="manual-movement-movement-type">Movement type</Label>
            <Select
              onValueChange={(value) =>
                form.setValue("movementType", value as ManualMovementSchema["movementType"])
              }
              value={movementType}
            >
              <SelectTrigger id="manual-movement-movement-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adjustment_in">Adjustment In</SelectItem>
                <SelectItem value="adjustment_out">Adjustment Out</SelectItem>
                <SelectItem value="wastage">Wastage</SelectItem>
                <SelectItem value="return_in">Return In</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="manualQuantity">Quantity</Label>
            <Input
              id="manualQuantity"
              min={0.001}
              step="0.001"
              type="number"
              {...form.register("quantity")}
            />
            {errors.quantity ? (
              <p className="text-meta text-danger-text">{errors.quantity.message}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="manualReason">Reason</Label>
            <Input id="manualReason" {...form.register("reason")} />
            {errors.reason ? (
              <p className="text-meta text-danger-text">{errors.reason.message}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="manualNotes">Notes</Label>
            <Input id="manualNotes" {...form.register("notes")} />
          </div>
          {movementType === "adjustment_out" || movementType === "wastage" ? (
            <p className="rounded-2xl bg-warning-tint p-3 text-sm text-warning-text">
              This movement decreases stock availability. Backend will reject invalid stock changes.
            </p>
          ) : null}
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving..." : "Create movement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
