"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";

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
import { batchWastageRemaining } from "@/lib/manufacturing/batch-status";
import { batchWastageSchema } from "@/lib/validators/manufacturing.schema";
import type { ProductionBatch, WastagePayload } from "@/types/manufacturing";

/**
 * Writes off finished goods from a produced batch. The server takes them out
 * of stock and posts the cost to Wastage Expense, so the dialog names what is
 * being written off and how much is left, instead of the old free item picker
 * and "wastage type" text box, which the server ignored. (ISSUE-044)
 */
export function BatchWastageDialog({
  batch,
  isSubmitting,
  onClose,
  onWastage,
}: {
  batch: ProductionBatch | null;
  isSubmitting: boolean;
  onClose: () => void;
  onWastage: (payload: WastagePayload) => Promise<void>;
}): JSX.Element {
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const open = batch !== null;

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuantity("1");
    setReason("");
    setError(null);
  }, [open]);

  const remaining = batch ? batchWastageRemaining(batch) : 0;
  const unit = batch?.batchUnitName ?? "";
  const productName = batch
    ? `${batch.productName}${batch.productVariantName ? ` - ${batch.productVariantName}` : ""}`
    : "";

  const validate = (): WastagePayload | null => {
    const result = batchWastageSchema(remaining, unit).safeParse({ quantity, reason });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please check the wastage details.");
      return null;
    }

    setError(null);
    return result.data;
  };

  // Once an error is showing, re-check as the fields change, so correcting
  // the quantity clears "Only 1 pcs ..." instead of leaving it until the next
  // submit. (ISSUE-045)
  const errorShown = error !== null;
  useEffect(() => {
    if (errorShown) {
      validate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check on field changes only
  }, [quantity, reason]);

  const submit = async (): Promise<void> => {
    const payload = validate();
    if (payload) {
      await onWastage(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-w-xl p-0">
        <DialogHeader className="border-b border-border px-7 py-6">
          <DialogTitle>Record wastage</DialogTitle>
          <DialogDescription>
            Write off {productName} from {batch?.batchNumber}. Stock goes down and the cost is
            posted to Wastage Expense.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-7 py-6">
          <div className="grid gap-2">
            <Label htmlFor="batch-wastage-quantity">Quantity wasted</Label>
            <Input
              id="batch-wastage-quantity"
              inputMode="decimal"
              max={remaining}
              min="0"
              onChange={(event) => setQuantity(event.target.value)}
              step="any"
              type="number"
              value={quantity}
            />
            <p className="text-meta text-foreground-muted tabular-nums">
              Up to {remaining} {unit} can be written off.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="batch-wastage-reason">Reason</Label>
            <Input
              id="batch-wastage-reason"
              onChange={(event) => setReason(event.target.value)}
              placeholder="For example: dropped, burnt, expired"
              value={reason}
            />
          </div>
          {error ? (
            <p className="text-sm font-semibold text-danger-text" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="border-t border-border bg-muted px-7 py-5">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary"
            disabled={isSubmitting}
            onClick={() => void submit()}
            type="button"
          >
            {isSubmitting ? "Recording..." : "Record wastage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
