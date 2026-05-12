"use client";

import { Clock, RotateCcw, Trash2 } from "lucide-react";
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
import type { HeldSale } from "@/types/pos";

type POSHoldSaleDialogProps = {
  canHoldCurrentSale: boolean;
  heldSales: HeldSale[];
  isCancelling: boolean;
  isHolding: boolean;
  isLoading: boolean;
  isResuming: boolean;
  onCancelHeldSale: (id: string) => void;
  onHoldCurrentSale: (notes: string | null) => void;
  onOpenChange: (open: boolean) => void;
  onResumeHeldSale: (id: string) => void;
  onRetry: () => void;
  open: boolean;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function formatHeldAt(value: string): string {
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function POSHoldSaleDialog({
  canHoldCurrentSale,
  heldSales,
  isCancelling,
  isHolding,
  isLoading,
  isResuming,
  onCancelHeldSale,
  onHoldCurrentSale,
  onOpenChange,
  onResumeHeldSale,
  onRetry,
  open,
}: POSHoldSaleDialogProps): JSX.Element {
  const [notes, setNotes] = useState("");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Held Sales</DialogTitle>
          <DialogDescription>
            Save the current cart temporarily or resume a previously held cart.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-3xl border border-brand-cappuccino/70 bg-brand-latte/55 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold uppercase tracking-[0.16em] text-brand-mocha">
                  Hold current cart
                </label>
                <Input
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional note, customer name, or pickup reminder"
                  value={notes}
                />
              </div>
              <Button
                disabled={!canHoldCurrentSale || isHolding}
                onClick={() => {
                  onHoldCurrentSale(notes.trim() ? notes : null);
                  setNotes("");
                }}
                type="button"
              >
                {isHolding ? "Holding..." : "Hold Sale"}
              </Button>
            </div>
            {!canHoldCurrentSale ? (
              <p className="mt-2 text-xs text-brand-mocha">
                Add items to the cart before holding a sale.
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-brand-mocha">
                Waiting carts
              </h3>
              <Button onClick={onRetry} type="button" variant="outline">
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="rounded-3xl border border-dashed border-brand-cappuccino/70 bg-white/70 p-6 text-sm text-brand-mocha">
                Loading held sales...
              </div>
            ) : null}

            {!isLoading && heldSales.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-brand-cappuccino/70 bg-white/70 p-6 text-center">
                <Clock className="mx-auto h-8 w-8 text-brand-mocha" />
                <p className="mt-2 font-semibold text-brand-espresso">No held sales</p>
                <p className="text-sm text-brand-mocha">
                  Held carts will appear here until they are resumed or cancelled.
                </p>
              </div>
            ) : null}

            <div className="grid gap-2">
              {heldSales.map((heldSale) => (
                <div
                  className="rounded-3xl border border-brand-cappuccino/70 bg-white p-4 shadow-sm"
                  key={heldSale.id}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-black text-brand-espresso">{heldSale.holdNumber}</p>
                      <p className="text-sm text-brand-mocha">
                        {heldSale.itemCount} items / {formatMoney(heldSale.total)}
                      </p>
                      <p className="text-xs text-brand-mocha">{formatHeldAt(heldSale.heldAt)}</p>
                      {heldSale.notes ? (
                        <p className="mt-1 text-xs text-brand-mocha">{heldSale.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        disabled={isResuming}
                        onClick={() => onResumeHeldSale(heldSale.id)}
                        type="button"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Resume
                      </Button>
                      <Button
                        disabled={isCancelling}
                        onClick={() => onCancelHeldSale(heldSale.id)}
                        type="button"
                        variant="outline"
                      >
                        <Trash2 className="h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
