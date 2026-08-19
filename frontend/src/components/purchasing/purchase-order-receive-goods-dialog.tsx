"use client";

import { AlertTriangle } from "lucide-react";
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
import { isStockLine, totalsByUnit } from "@/lib/purchasing/purchase-order-quantities";
import { cn } from "@/lib/utils/cn";
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

type ReceiveStep = "count" | "confirm";

type PurchaseOrderReceiveGoodsDialogProps = {
  isSubmitting: boolean;
  isLoading?: boolean;
  loadError?: string | null;
  onClose: () => void;
  onReceive: (payload: ReceivePurchaseOrderPayload) => Promise<void>;
  open: boolean;
  order: PurchaseOrder | null;
};

type PurchaseOrderLine = PurchaseOrder["items"][number];

const quantityFormat = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 });
const currencyFormat = new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" });

/** The 7-column desktop grid. Below lg each row becomes a stacked card. */
const GRID = "lg:grid-cols-[1.8fr_0.75fr_0.85fr_0.85fr_0.9fr_1fr_1fr]";

function today(): string {
  // Local calendar date. toISOString() is UTC, which in a UTC+4 business
  // pre-filled yesterday's date for any receipt posted before 4am.
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(now.getFullYear())}-${month}-${day}`;
}

function unitLabel(item: PurchaseOrderLine): string {
  return item.unitSymbol || item.unitName || "";
}

/** A bare number in a receiving grid is a guess. Always ship the unit with it. */
function withUnit(value: number, item: PurchaseOrderLine): string {
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
  return order.items.filter(isStockLine);
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

/** A cell label that only appears once the row has collapsed into a card. */
function StackedLabel({ children }: { children: string }): JSX.Element {
  return (
    <span className="block text-meta font-normal text-foreground-muted lg:hidden">{children}</span>
  );
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
  const [step, setStep] = useState<ReceiveStep>("count");

  useEffect(() => {
    if (!open || !order) {
      setRows([]);
      setError(null);
      setStep("count");
      return;
    }

    setReceivedDate(today());
    setNotes("");
    setError(null);
    setStep("count");
    setRows(
      receivableItems(order).map((item) => ({
        batchNumber: "",
        expiryDate: "",
        purchaseOrderItemId: item.id,
        quantityReceived: String(
          Math.round(Math.max(item.quantityOrdered - item.quantityReceived, 0) * 1000) / 1000,
        ),
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
   * One message per offending row, so the error lands beside the field that
   * caused it. The single unanchored paragraph this replaces said "Receive
   * quantity cannot exceed the remaining ordered quantity" without naming the
   * item, which on a ten-line delivery is a hunt rather than a correction.
   */
  const rowIssues = useMemo(() => {
    const issues = new Map<string, string>();
    if (!order) return issues;

    for (const row of rows) {
      const item = order.items.find((line) => line.id === row.purchaseOrderItemId);
      if (!item) continue;

      const remaining = Math.max(item.quantityOrdered - item.quantityReceived, 0);
      const raw = row.quantityReceived.trim();

      if (raw === "") {
        issues.set(item.id, `Enter a quantity for ${item.itemNameSnapshot}, or 0 to skip it.`);
        continue;
      }

      const quantity = Number(raw);

      if (!Number.isFinite(quantity)) {
        issues.set(item.id, `${item.itemNameSnapshot} needs a number.`);
        continue;
      }

      if (quantity < 0) {
        issues.set(item.id, `${item.itemNameSnapshot} cannot be received as a negative quantity.`);
        continue;
      }

      // Epsilon covers float drift: remaining can be 0.29999999 while the row
      // displays "0.3", and typing exactly 0.3 must not be rejected.
      if (quantity > remaining + 1e-9) {
        issues.set(
          item.id,
          `Only ${withUnit(remaining, item)} of ${item.itemNameSnapshot} is still outstanding.`,
        );
      }
    }

    return issues;
  }, [order, rows]);

  /** Rows that will actually post: a real quantity, and nothing wrong with it. */
  const postingRows = useMemo(() => {
    if (!order) return [];

    return rows.flatMap((row) => {
      const item = order.items.find((line) => line.id === row.purchaseOrderItemId);
      if (!item || rowIssues.has(item.id)) return [];

      const quantity = Number(row.quantityReceived);
      if (!Number.isFinite(quantity) || quantity <= 0) return [];

      return [{ item, quantity }];
    });
  }, [order, rows, rowIssues]);

  /**
   * Receiving quantities only add up within a unit. The old footer summed every
   * row into one "units" figure, so 200 kg of flour plus 12 litres of extract
   * read as "212 units" -- a number that describes nothing. It also totalled
   * rows that were zeroed or invalid, cheerfully reporting quantities the
   * backend would refuse.
   */
  const receivingByUnit = useMemo(
    () =>
      totalsByUnit(
        postingRows.map(({ item, quantity }) => ({ quantity, unit: unitLabel(item) })),
      ).map(({ quantity, unit }) => ({
        label: unit
          ? `${quantityFormat.format(quantity)} ${unit}`
          : quantityFormat.format(quantity),
        unit,
      })),
    [postingRows],
  );

  const skippedLines = useMemo(() => {
    if (!order) return [];

    return rows.flatMap((row) => {
      const item = order.items.find((line) => line.id === row.purchaseOrderItemId);
      if (!item || rowIssues.has(item.id)) return [];

      const remaining = Math.max(item.quantityOrdered - item.quantityReceived, 0);
      const quantity = Number(row.quantityReceived);
      if (remaining <= 0 || quantity > 0) return [];

      return [{ item, remaining }];
    });
  }, [order, rows, rowIssues]);

  const receiptValue = postingRows.reduce(
    (total, { item, quantity }) => total + quantity * item.unitCost,
    0,
  );

  /** Does this receipt close every outstanding line, or leave the order open? */
  const willCompleteOrder = useMemo(() => {
    if (!order) return false;

    return receivableItems(order).every((item) => {
      const row = rows.find((line) => line.purchaseOrderItemId === item.id);
      const quantity = Number(row?.quantityReceived);
      const received = item.quantityReceived + (Number.isFinite(quantity) ? quantity : 0);
      return received >= item.quantityOrdered;
    });
  }, [order, rows]);

  const blocked = isLoading || loadError !== null || !order;
  const canReview = !blocked && rowIssues.size === 0 && postingRows.length > 0;

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
      setStep("count");
      return;
    }

    const receivableLegacyItem = receivableItems(order).find(
      (item) => Math.max(item.quantityOrdered - item.quantityReceived, 0) > 0 && !item.productId,
    );

    if (receivableLegacyItem) {
      setError(
        "This purchase order was created with legacy item data. Recreate it using Product Master items before receiving.",
      );
      setStep("count");
      return;
    }

    if (receiveTotal <= 0) {
      setError("There are no remaining quantities to receive for this purchase order.");
      setStep("count");
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
        setStep("count");
        return;
      }

      if (quantity > remaining + 1e-9) {
        setError("Receive quantity cannot exceed the remaining ordered quantity.");
        setStep("count");
        return;
      }

      if (quantity > 0) {
        if (!orderItem?.productId) {
          setError(
            "This purchase order was created with legacy item data. Recreate it using Product Master items before receiving.",
          );
          setStep("count");
          return;
        }

        if (!orderItem.unitId) {
          setError("Every received line must have a unit. Update the purchase order item first.");
          setStep("count");
          return;
        }

        items.push({
          batchNumber: row.batchNumber.trim() || null,
          expiryDate: row.expiryDate || null,
          productId: orderItem.productId,
          productVariantId: orderItem.productVariantId,
          quantityReceived: Math.min(quantity, remaining),
          unitCost: orderItem.unitCost,
          unitId: orderItem.unitId,
        });
      }
    }

    if (items.length === 0) {
      setError("Enter a receive quantity for at least one item.");
      setStep("count");
      return;
    }

    await onReceive({
      items,
      notes: notes.trim() || null,
      receivedDate,
    });
  };

  const summary = (): JSX.Element => {
    if (rowIssues.size > 0) {
      return (
        <span className="font-medium text-danger-text">
          {rowIssues.size} {rowIssues.size === 1 ? "line needs" : "lines need"} a valid quantity.
        </span>
      );
    }

    if (receivingByUnit.length === 0) return <>Nothing to receive yet.</>;

    return (
      <>
        Receiving{" "}
        {receivingByUnit.map((entry, index) => (
          <span key={entry.unit}>
            {index > 0 ? (index === receivingByUnit.length - 1 ? " and " : ", ") : null}
            <span className="font-medium tabular-nums text-foreground">{entry.label}</span>
          </span>
        ))}{" "}
        across {postingRows.length} {postingRows.length === 1 ? "line" : "lines"}.
      </>
    );
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
            {step === "count"
              ? `Record what physically arrived against ${order?.purchaseOrderNumber ?? "this purchase order"}. Stock is received into the branch default location unless an advanced workflow overrides it.`
              : "Check this against the delivery note. Posting writes stock and cannot be undone from here."}
          </DialogDescription>
          <div className="mt-2 flex items-center gap-2 text-meta text-foreground-muted">
            <span className={cn("font-medium", step === "count" && "text-foreground")}>
              1. Count what arrived
            </span>
            <span aria-hidden="true" className="h-px w-4 bg-border" />
            <span className={cn("font-medium", step === "confirm" && "text-foreground")}>
              2. Confirm and post
            </span>
          </div>
        </DialogHeader>

        {step === "count" ? (
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

            <div className="overflow-hidden rounded-md border border-border bg-background">
              {/* Remaining is what the operator is actually counting against. It
                  was computed to pre-fill the input but never shown, leaving
                  "Received" (to date) sitting next to the entry field as the only
                  context -- two different quantities, one word apart. */}
              <div
                className={cn(
                  "hidden gap-3 border-b bg-muted px-4 py-3 text-meta font-medium text-foreground-muted lg:grid",
                  GRID,
                )}
              >
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
                  <div className="px-4 py-6 text-sm text-foreground-muted">
                    Loading purchase order items...
                  </div>
                ) : loadError ? (
                  <div className="px-4 py-6 text-sm font-medium text-danger-text" role="alert">
                    {loadError}
                  </div>
                ) : order ? (
                  receivableItems(order).map((item) => {
                    const row = rows.find((line) => line.purchaseOrderItemId === item.id);
                    const remaining = Math.max(item.quantityOrdered - item.quantityReceived, 0);
                    const issue = rowIssues.get(item.id);
                    const errorId = `po-receive-error-${item.id}`;

                    return (
                      <div
                        className={cn(
                          // Inputs size from the --field-h token (h-field), so
                          // the stockroom-tablet 44px comes from rebinding the
                          // token below lg, not from fighting the class.
                          "grid grid-cols-2 gap-3 border-b px-4 py-3 text-sm [--field-h:2.75rem] last:border-b-0 lg:items-center lg:[--field-h:2.25rem]",
                          GRID,
                          issue && "bg-danger-tint",
                        )}
                        key={item.id}
                      >
                        <div className="col-span-2 lg:col-span-1">
                          <p className="font-medium text-foreground">{item.itemNameSnapshot}</p>
                          <p className="text-meta text-foreground-muted">
                            {remaining === 0 ? "Fully received" : `Measured in ${unitLabel(item)}`}
                          </p>
                        </div>
                        <span className="tabular-nums lg:text-right">
                          <StackedLabel>Ordered</StackedLabel>
                          {withUnit(item.quantityOrdered, item)}
                        </span>
                        <span className="tabular-nums lg:text-right">
                          <StackedLabel>Received to date</StackedLabel>
                          {withUnit(item.quantityReceived, item)}
                        </span>
                        <span className="font-medium tabular-nums lg:text-right">
                          <StackedLabel>Remaining</StackedLabel>
                          {withUnit(remaining, item)}
                        </span>
                        <div className="col-span-2 lg:col-span-1">
                          <StackedLabel>Receive now</StackedLabel>
                          <Input
                            aria-describedby={issue ? errorId : undefined}
                            aria-invalid={issue ? true : undefined}
                            aria-label={`Receiving now for ${item.itemNameSnapshot}${
                              unitLabel(item) ? ` in ${unitLabel(item)}` : ""
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
                        </div>
                        <div>
                          <StackedLabel>Batch</StackedLabel>
                          <Input
                            aria-label={`Batch number for ${item.itemNameSnapshot}`}
                            onChange={(event) =>
                              updateRow(item.id, "batchNumber", event.target.value)
                            }
                            placeholder="Optional"
                            value={row?.batchNumber ?? ""}
                          />
                        </div>
                        <div>
                          <StackedLabel>Expiry</StackedLabel>
                          <Input
                            aria-label={`Expiry date for ${item.itemNameSnapshot}`}
                            onChange={(event) =>
                              updateRow(item.id, "expiryDate", event.target.value)
                            }
                            type="date"
                            value={row?.expiryDate ?? ""}
                          />
                        </div>
                        {issue ? (
                          <p
                            className="col-span-2 text-meta font-medium text-danger-text lg:col-span-7"
                            id={errorId}
                            role="alert"
                          >
                            {issue}
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                ) : null}
              </div>
            </div>

            <p className="text-meta text-foreground-muted">
              Leave a line at 0 to receive it on a later delivery. The order stays open until every
              line is complete.
            </p>

            {error ? (
              <p className="text-sm font-medium text-danger-text" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="overflow-hidden rounded-md border border-border bg-background">
              <p className="border-b bg-muted px-4 py-3 text-meta font-medium text-foreground-muted">
                Posting this receipt adds the following to stock
              </p>
              {postingRows.map(({ item, quantity }) => {
                const after = item.quantityReceived + quantity;

                return (
                  <div
                    className="flex flex-wrap items-baseline justify-between gap-3 border-b px-4 py-3 last:border-b-0"
                    key={item.id}
                  >
                    <div>
                      <p className="font-medium text-foreground">{item.itemNameSnapshot}</p>
                      <p className="text-meta text-foreground-muted">
                        {withUnit(after, item)} of {withUnit(item.quantityOrdered, item)} received
                        after this
                        {after >= item.quantityOrdered ? " - line complete" : ""}
                      </p>
                    </div>
                    <span className="font-medium tabular-nums text-foreground">
                      + {withUnit(quantity, item)}
                    </span>
                  </div>
                );
              })}
              {skippedLines.map(({ item, remaining }) => (
                <div
                  className="flex flex-wrap items-baseline justify-between gap-3 border-b bg-muted px-4 py-3 text-foreground-muted last:border-b-0"
                  key={item.id}
                >
                  <div>
                    <p className="font-medium">{item.itemNameSnapshot}</p>
                    <p className="text-meta">Not receiving on this delivery</p>
                  </div>
                  <span className="tabular-nums">{withUnit(remaining, item)} stays open</span>
                </div>
              ))}
            </div>

            <ul className="grid gap-2 text-sm text-foreground-muted">
              <li>
                A goods receipt worth{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {currencyFormat.format(receiptValue)}
                </span>{" "}
                is created and linked to {order?.purchaseOrderNumber ?? "this order"}.
              </li>
              <li>
                {willCompleteOrder
                  ? "This order moves to Received and becomes billable."
                  : "This order stays partially received. The remaining lines stay open."}
              </li>
              <li>
                No accounting journal is posted from this receive-goods record. That happens when
                the supplier bill is posted.
              </li>
            </ul>

            {error ? (
              <div
                className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-tint px-4 py-3 text-sm font-medium text-danger-text"
                role="alert"
              >
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="items-center gap-3">
          <span aria-live="polite" className="mr-auto text-sm text-foreground-muted">
            {step === "confirm" ? "Step 2 of 2 - nothing has been written yet." : summary()}
          </span>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          {step === "confirm" ? (
            <Button
              disabled={isSubmitting}
              onClick={() => setStep("count")}
              type="button"
              variant="outline"
            >
              Back to counting
            </Button>
          ) : null}
          {step === "count" ? (
            <Button disabled={!canReview} onClick={() => setStep("confirm")} type="button">
              Review {postingRows.length > 0 ? postingRows.length : ""}{" "}
              {postingRows.length === 1 ? "line" : "lines"}
            </Button>
          ) : (
            <Button disabled={isSubmitting} onClick={() => void submit()} type="button">
              {isSubmitting ? "Posting receipt..." : "Post receipt"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
