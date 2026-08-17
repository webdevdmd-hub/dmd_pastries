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
  type CreateExpiryBatchSchema,
  createExpiryBatchSchema,
} from "@/lib/validators/inventory.schema";
import type { CreateExpiryBatchPayload, InventoryItem } from "@/types/inventory";

type ExpiryBatchDialogProps = {
  item: InventoryItem | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (itemId: string, payload: CreateExpiryBatchPayload) => Promise<void>;
  open: boolean;
};

export function ExpiryBatchDialog({
  item,
  isSubmitting,
  onClose,
  onSubmit,
  open,
}: ExpiryBatchDialogProps): JSX.Element {
  const form = useForm<CreateExpiryBatchSchema>({
    resolver: zodResolver(createExpiryBatchSchema),
    defaultValues: {
      batchNumber: "",
      quantity: 1,
      receivedDate: "",
      expiryDate: "",
    },
  });

  useEffect(() => {
    form.reset({ batchNumber: "", quantity: 1, receivedDate: "", expiryDate: "" });
  }, [form, item]);

  const handleSubmit = async (values: CreateExpiryBatchSchema): Promise<void> => {
    if (!item) return;

    await onSubmit(item.id, {
      ...(values.batchNumber ? { batchNumber: values.batchNumber } : {}),
      quantity: values.quantity,
      receivedDate: values.receivedDate,
      expiryDate: values.expiryDate,
    });
  };

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add expiry batch</DialogTitle>
          <DialogDescription>
            {item ? `Track an expiry-sensitive batch for ${item.itemName}.` : "Add a batch."}
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
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="batchNumber">Batch number</Label>
              <Input id="batchNumber" {...form.register("batchNumber")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="batchQuantity">Quantity</Label>
              <Input id="batchQuantity" step="0.001" type="number" {...form.register("quantity")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="receivedDate">Received date</Label>
              <Input id="receivedDate" type="date" {...form.register("receivedDate")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="batchExpiryDate">Expiry date</Label>
              <Input id="batchExpiryDate" type="date" {...form.register("expiryDate")} />
              {form.formState.errors.expiryDate ? (
                <p className="text-sm text-danger-text">
                  {form.formState.errors.expiryDate.message}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving..." : "Add batch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
