"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

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
import { totalsByUnit } from "@/lib/purchasing/purchase-order-quantities";
import type {
  PurchaseOrder,
  ReceivePurchaseOrderItemPayload,
  ReceivePurchaseOrderPayload,
} from "@/types/purchasing";

type ReceiveGoodsRow = {
  batchNumber: string;
  expiryDate: string;
  purchaseOrderItemId: string;
  quantityReceived: string;
};

type PurchaseOrderReceiveGoodsDialogProps = {
  isSubmitting: boolean;
  isLoading?: boolean;
  loadError?: string | null;
  onClose: () => void;
  onReceive: (payload: ReceivePurchaseOrderPayload) => Promise<void>;
  open: boolean;
  order: PurchaseOrder | null;
};

const quantityFormat = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 });

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function unitLabel(item: PurchaseOrder["items"][number]): string {
  return item.unitSymbol || item.unitName || "";
}

/** A bare number in a receiving grid is a guess. Always ship the unit with it. */
function withUnit(value: number, item: PurchaseOrder["items"][number]): string {
  const unit = unitLabel(item);
  const amount = quantityFormat.format(value);
  return unit ? `${amount} ${unit}` : amount;
}

function remainingQuantity(order: PurchaseOrder, purchaseOrderItemId: string): number {
  const item = order.items.find((line) => line.id === purchaseOrderItemId);
  if (!item) return 0;
  return Math.max(item.quantityOrdered - item.quantityReceived, 0);
}

function receivableItems(order: PurchaseOrder): PurchaseOrder["items"] {
  return order.items.filter((item) => item.lineType !== "account");
}

function hasRowChanges(order: PurchaseOrder, rows: ReceiveGoodsRow[]): boolean {
  return rows.some((row) => {
    const remaining = remainingQuantity(order, row.purchaseOrderItemId);
    return (
      row.batchNumber.trim() !== "" ||
      row.expiryDate !== "" ||
      Number(row.quantityReceived) !== remaining
    );
  });
}

export function PurchaseOrderReceiveGoodsDialog({
  isSubmitting,
  isLoading = false,
  loadError = null,
  onClose,
  onReceive,
  open,
  order,
}: PurchaseOrderReceiveGoodsDialogProps): JSX.Element {
  const [receivedDate, setReceivedDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<ReceiveGoodsRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRows([]);
      setError(null);
      return;
    }

    if (!order) {
      setRows([]);
      setError(null);
      return;
    }

    setReceivedDate(today());
    setNotes("");
    setError(null);
    setRows(
      receivableItems(order).map((item) => ({
        batchNumber: "",
        expiryDate: "",
        purchaseOrderItemId: item.id,
        quantityReceived: String(Math.max(item.quantityOrdered - item.quantityReceived, 0)),
      })),
    );
  }, [open, order]);

  const receiveTotal = useMemo(
    () =>
      rows.reduce((total, row) => {
        const quantity = Number(row.quantityReceived);
        return total + (Number.isFinite(quantity) ? quantity : 0);
      }, 0),
    [rows],
  );

  /**
   * Receiving quantities only add up within a unit. The old footer summed every
   * row into one "units" figure, so 200 kg of flour plus 12 litres of extract
   * read as "212 units" -- a number that describes nothing and that counted
   * rows the operator had deliberately zeroed. Group by unit instead, and count
   * only the rows that will actually post.
   */
  const receivingByUnit = useMemo(() => {
    if (!order) return [];

    const entries = rows.flatMap((row) => {
      const item = order.items.find((line) => line.id === row.purchaseOrderItemId);
      if (!item) return [];

      return [{ quantity: Number(row.quantityReceived), unit: unitLabel(item) }];
    });

    return totalsByUnit(entries).map(({ quantity, unit }) => ({
      label: unit ? `${quantityFormat.format(quantity)} ${unit}` : quantityFormat.format(quantity),
      unit,
    }));
  }, [order, rows]);

  const receivingLineCount = rows.filter((row) => {
    const quantity = Number(row.quantityReceived);
    return Number.isFinite(quantity) && quantity > 0;
  }).length;

  const updateRow = (
    purchaseOrderItemId: string,
    field: keyof ReceiveGoodsRow,
    value: string,
  ): void => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.purchaseOrderItemId === purchaseOrderItemId ? { ...row, [field]: value } : row,
      ),
    );
  };

  const submit = async (): Promise<void> => {
    if (isLoading || loadError || !order) return;

    if (!receivedDate) {
      setError("Received date is required.");
      return;
    }

    const receivableLegacyItem = receivableItems(order).find(
      (item) => Math.max(item.quantityOrdered - item.quantityReceived, 0) > 0 && !item.productId,
    );

    if (receivableLegacyItem) {
      setError(
        "This purchase order was created with legacy item data. Recreate it using Product Master items before receiving.",
      );
      return;
    }

    if (receiveTotal <= 0) {
      setError("There are no remaining quantities to receive for this purchase order.");
      return;
    }

    const customReceive = hasRowChanges(order, rows);

    if (!customReceive) {
      await onReceive({
        notes: notes.trim() || null,
        receivedDate,
      });
      return;
    }

    const items: ReceivePurchaseOrderItemPayload[] = [];

    for (const row of rows) {
      const quantity = Number(row.quantityReceived);
      const remaining = remainingQuantity(order, row.purchaseOrderItemId);
      const orderItem = receivableItems(order).find((item) => item.id === row.purchaseOrderItemId);

      if (!Number.isFinite(quantity) || quantity < 0) {
        setError("Receive quantity must be a valid positive number.");
        return;
      }

      if (quantity > remaining) {
        setError("Receive quantity cannot exceed the remaining ordered quantity.");
        return;
      }

      if (quantity > 0) {
        if (!orderItem?.productId) {
          setError(
            "This purchase order was created with legacy item data. Recreate it using Product Master items before receiving.",
          );
          return;
        }

        if (!orderItem.unitId) {
          setError("Every received line must have a unit. Update the purchase order item first.");
          return;
        }

        items.push({
          batchNumber: row.batchNumber.trim() || null,
          expiryDate: row.expiryDate || null,
          productId: orderItem.productId,
          productVariantId: orderItem.productVariantId,
          quantityReceived: quantity,
          unitCost: orderItem.unitCost,
          unitId: orderItem.unitId,
        });
      }
    }

    if (items.length === 0) {
      setError("Enter a receive quantity for at least one item.");
      return;
    }

    await onReceive({
      items,
      notes: notes.trim() || null,
      receivedDate,
    });
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      open={open}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Receive goods</DialogTitle>
          <DialogDescription>
            Receive supplier goods against {order?.purchaseOrderNumber ?? "this purchase order"}.
            Stock is received into the branch default location unless an advanced workflow overrides
            it. No accounting journal is posted from this receive-goods record.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="po-receive-date">Received date</Label>
              <Input
                id="po-receive-date"
                onChange={(event) => setReceivedDate(event.target.value)}
                type="date"
                value={receivedDate}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="po-receive-notes">Notes</Label>
              <Input
                id="po-receive-notes"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional receiving note"
                value={notes}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-background">
            {/* Remaining is what the operator is actually counting against. It
                was computed to pre-fill the input but never shown, leaving
                "Received" (to date) sitting next to the entry field as the only
                context -- two different quantities, one word apart. */}
            <div className="grid grid-cols-[1.8fr_0.75fr_0.85fr_0.85fr_0.9fr_1fr_1fr] gap-3 border-b bg-muted/50 px-4 py-3 text-meta font-medium text-foreground-muted">
              <span>Item</span>
              <span className="text-right">Ordered</span>
              <span className="text-right">
                Received
                <span className="block font-normal text-foreground-muted">to date</span>
              </span>
              <span className="text-right">Remaining</span>
              <span>Receive now</span>
              <span>Batch</span>
              <span>Expiry</span>
            </div>
            <div className="max-h-[22rem] overflow-y-auto">
              {isLoading ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Loading purchase order items...
                </div>
              ) : loadError ? (
                <div className="px-4 py-6 text-sm font-medium text-danger-text">{loadError}</div>
              ) : order ? (
                receivableItems(order).map((item) => {
                  const row = rows.find((line) => line.purchaseOrderItemId === item.id);
                  const remaining = Math.max(item.quantityOrdered - item.quantityReceived, 0);

                  return (
                    <div
                      className="grid grid-cols-[1.8fr_0.75fr_0.85fr_0.85fr_0.9fr_1fr_1fr] gap-3 border-b px-4 py-3 text-sm last:border-b-0"
                      key={item.id}
                    >
                      <div>
                        <p className="font-medium text-foreground">{item.itemNameSnapshot}</p>
                        <p className="text-meta text-foreground-muted">
                          {remaining === 0
                            ? "Fully received"
                            : `Measured in ${item.unitName || unitLabel(item)}`}
                        </p>
                      </div>
                      <span className="text-right tabular-nums">
                        {withUnit(item.quantityOrdered, item)}
                      </span>
                      <span className="text-right tabular-nums">
                        {withUnit(item.quantityReceived, item)}
                      </span>
                      <span className="text-right font-medium tabular-nums">
                        {withUnit(remaining, item)}
                      </span>
                      <Input
                        aria-label={`Receiving now for ${item.itemNameSnapshot}${
                          unitLabel(item) ? ` in ${item.unitName || unitLabel(item)}` : ""
                        }`}
                        className="text-right tabular-nums"
                        min={0}
                        max={remaining}
                        onChange={(event) =>
                          updateRow(item.id, "quantityReceived", event.target.value)
                        }
                        step="0.001"
                        type="number"
                        value={row?.quantityReceived ?? "0"}
                      />
                      <Input
                        onChange={(event) => updateRow(item.id, "batchNumber", event.target.value)}
                        placeholder="Optional"
                        value={row?.batchNumber ?? ""}
                      />
                      <Input
                        onChange={(event) => updateRow(item.id, "expiryDate", event.target.value)}
                        type="date"
                        value={row?.expiryDate ?? ""}
                      />
                    </div>
                  );
                })
              ) : null}
            </div>
          </div>

          {error ? <p className="text-sm font-medium text-danger-text">{error}</p> : null}
        </div>

        <DialogFooter className="items-center gap-3">
          <span className="mr-auto text-sm text-foreground-muted">
            {receivingByUnit.length === 0 ? (
              "Nothing to receive yet."
            ) : (
              <>
                Receiving{" "}
                {receivingByUnit.map((entry, index) => (
                  <span key={entry.unit}>
                    {index > 0 ? (index === receivingByUnit.length - 1 ? " and " : ", ") : null}
                    <span className="font-medium tabular-nums text-foreground">{entry.label}</span>
                  </span>
                ))}{" "}
                across {receivingLineCount} {receivingLineCount === 1 ? "line" : "lines"}.
              </>
            )}
          </span>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={isSubmitting || isLoading || loadError !== null || !order}
            onClick={() => void submit()}
            type="button"
          >
            {isSubmitting ? "Receiving..." : "Receive goods"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
