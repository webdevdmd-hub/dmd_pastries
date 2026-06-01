"use client";

import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  PackagePlus,
  RotateCcw,
  Trash2,
} from "lucide-react";
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
import { useHeldSaleDetails } from "@/hooks/use-pos-checkout";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import type { CartItem, HeldSale } from "@/types/pos";

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

function HeldSaleItemCard({ item }: { item: CartItem }): JSX.Element {
  const imageUrl = getProductImagePreviewUrl(item.imageFileId) ?? item.imageUrl;

  return (
    <div className="flex gap-3 rounded-2xl border border-brand-cappuccino/70 bg-white p-2.5 shadow-sm">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-latte text-brand-mocha">
        {imageUrl ? (
          <img alt="" className="h-full w-full object-cover" src={imageUrl} />
        ) : (
          <PackagePlus className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-black text-brand-espresso">{item.productName}</p>
        {item.variantName ? (
          <p className="line-clamp-1 text-xs font-bold text-brand-mocha">{item.variantName}</p>
        ) : null}
        {item.sku ? (
          <p className="line-clamp-1 text-[0.68rem] font-semibold text-brand-mocha/80">
            SKU {item.sku}
          </p>
        ) : null}
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="text-xs font-bold text-brand-mocha">
            {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} x{" "}
            {formatMoney(item.unitPrice)}
          </p>
          <p className="shrink-0 text-sm font-black text-brand-espresso">
            {formatMoney(item.lineTotal)}
          </p>
        </div>
      </div>
    </div>
  );
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
  const [expandedHeldSaleId, setExpandedHeldSaleId] = useState<string | null>(null);
  const heldSaleDetailsQuery = useHeldSaleDetails(
    expandedHeldSaleId,
    open && expandedHeldSaleId !== null,
  );

  useEffect(() => {
    if (!open) {
      setExpandedHeldSaleId(null);
    }
  }, [open]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2rem] border-brand-cappuccino/80 bg-white p-0 shadow-[0_28px_90px_rgba(59,42,34,0.22)] sm:max-w-4xl">
        <div className="border-b border-brand-cappuccino/70 bg-brand-latte/65 px-5 py-4">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-brand-espresso">
              Hold / Resume
            </DialogTitle>
            <DialogDescription className="text-brand-mocha">
              Save the current cart temporarily or resume a previously held cart.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-4 p-4">
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

            <div className="grid gap-3">
              {heldSales.map((heldSale) => {
                const isExpanded = expandedHeldSaleId === heldSale.id;
                const detailItems = isExpanded ? (heldSaleDetailsQuery.data?.items ?? []) : [];

                return (
                  <div
                    className="overflow-hidden rounded-3xl border border-brand-cappuccino/70 bg-white shadow-sm"
                    key={heldSale.id}
                  >
                    <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-brand-espresso">{heldSale.holdNumber}</p>
                          <span className="rounded-full bg-brand-latte px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.12em] text-brand-mocha">
                            {heldSale.itemCount} items
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-black text-brand-espresso">
                          {formatMoney(heldSale.total)}
                        </p>
                        <p className="text-xs font-medium text-brand-mocha">
                          Held {formatHeldAt(heldSale.heldAt)}
                        </p>
                        {heldSale.customerName ? (
                          <p className="mt-1 text-xs font-bold text-brand-mocha">
                            {heldSale.customerName}
                          </p>
                        ) : null}
                        {heldSale.notes ? (
                          <p className="mt-1 line-clamp-2 text-xs text-brand-mocha">
                            {heldSale.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          aria-expanded={isExpanded}
                          className="rounded-2xl"
                          onClick={() =>
                            setExpandedHeldSaleId((current) =>
                              current === heldSale.id ? null : heldSale.id,
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          {isExpanded ? "Hide items" : "View items"}
                        </Button>
                        <Button
                          className="rounded-2xl"
                          disabled={isResuming}
                          onClick={() => onResumeHeldSale(heldSale.id)}
                          type="button"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Resume
                        </Button>
                        <Button
                          className="rounded-2xl"
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

                    {isExpanded ? (
                      <div className="border-t border-brand-cappuccino/70 bg-brand-latte/35 p-3">
                        {heldSaleDetailsQuery.isLoading ? (
                          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-brand-cappuccino/70 bg-white/70 p-4 text-sm font-semibold text-brand-mocha">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading held items...
                          </div>
                        ) : null}

                        {heldSaleDetailsQuery.isError ? (
                          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
                            <span className="flex items-center gap-2 font-semibold">
                              <AlertCircle className="h-4 w-4" />
                              Unable to load held items.
                            </span>
                            <Button
                              onClick={() => {
                                void heldSaleDetailsQuery.refetch();
                              }}
                              type="button"
                              variant="outline"
                            >
                              Retry
                            </Button>
                          </div>
                        ) : null}

                        {!heldSaleDetailsQuery.isLoading &&
                        !heldSaleDetailsQuery.isError &&
                        detailItems.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-brand-cappuccino/70 bg-white/70 p-4 text-sm text-brand-mocha">
                            No item details were returned for this held cart.
                          </div>
                        ) : null}

                        {detailItems.length > 0 ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {detailItems.map((item) => (
                              <HeldSaleItemCard item={item} key={item.cartItemId} />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-brand-cappuccino/70 bg-white px-4 py-3">
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
