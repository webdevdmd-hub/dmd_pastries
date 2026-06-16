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
import type { ConvertPurchaseOrderToBillPayload, PurchaseOrder } from "@/types/purchasing";

type PurchaseOrderConvertToBillDialogProps = {
  isSubmitting: boolean;
  onClose: () => void;
  onConvert: (payload: ConvertPurchaseOrderToBillPayload) => Promise<void>;
  open: boolean;
  order: PurchaseOrder | null;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PurchaseOrderConvertToBillDialog({
  isSubmitting,
  onClose,
  onConvert,
  open,
  order,
}: PurchaseOrderConvertToBillDialogProps): JSX.Element {
  const [billDate, setBillDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setBillDate(today());
    setDueDate("");
    setNotes(order ? `Created from ${order.purchaseOrderNumber}` : "");
    setError(null);
  }, [open, order]);

  const submit = async (): Promise<void> => {
    if (!billDate) {
      setError("Bill date is required.");
      return;
    }

    await onConvert({
      dueDate: dueDate || null,
      invoiceDate: billDate,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to bill</DialogTitle>
          <DialogDescription>
            Create a draft Bill from {order?.purchaseOrderNumber ?? "this purchase order"}.
            Supplier, item, quantity, unit cost, discount, and tax details are carried forward
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="bill-date">Bill date</Label>
              <Input
                id="bill-date"
                onChange={(event) => setBillDate(event.target.value)}
                type="date"
                value={billDate}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bill-due-date">Due date</Label>
              <Input
                id="bill-due-date"
                onChange={(event) => setDueDate(event.target.value)}
                type="date"
                value={dueDate}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bill-notes">Notes</Label>
            <Input
              id="bill-notes"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional bill note"
              value={notes}
            />
          </div>
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={() => void submit()} type="button">
            {isSubmitting ? "Converting..." : "Convert to bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
