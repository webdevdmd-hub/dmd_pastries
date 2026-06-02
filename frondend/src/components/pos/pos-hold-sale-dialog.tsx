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
    <div className="flex gap-3 rounded-lg border border-[#d4d4d8] bg-white p-2.5">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#f4f4f5] text-[#71717a]">
        {imageUrl ? (
          <img alt="" className="h-full w-full object-cover" src={imageUrl} />
        ) : (
          <PackagePlus className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-black text-[#09090b]">{item.productName}</p>
        {item.variantName ? (
          <p className="line-clamp-1 text-xs font-bold text-[#52525b]">{item.variantName}</p>
        ) : null}
        {item.sku ? (
          <p className="line-clamp-1 text-[0.68rem] font-semibold text-[#71717a]">SKU {item.sku}</p>
        ) : null}
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="font-mono text-xs font-bold text-[#52525b]">
            {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} x{" "}
            {formatMoney(item.unitPrice)}
          </p>
          <p className="font-mono shrink-0 text-sm font-black text-[#09090b]">
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
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-lg border-[#d4d4d8] bg-white p-0 text-[#09090b] shadow-lg sm:max-w-4xl">
        <div className="border-b border-[#d4d4d8] bg-[#fafafa] px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">Hold / Resume</DialogTitle>
            <DialogDescription className="text-[#52525b]">
              Save the current cart temporarily or resume a previously held cart.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-4 p-4">
          <div className="rounded-lg border border-[#d4d4d8] bg-[#fafafa] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold uppercase tracking-[0.16em] text-[#71717a]">
                  Hold current cart
                </label>
                <Input
                  className="rounded-md border-[#d4d4d8] bg-white shadow-none focus-visible:ring-black"
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional note, customer name, or pickup reminder"
                  value={notes}
                />
              </div>
              <Button
                className="rounded-md bg-black text-white hover:bg-[#18181b]"
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
              <p className="mt-2 text-xs text-[#52525b]">
                Add items to the cart before holding a sale.
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#71717a]">
                Waiting carts
              </h3>
              <Button
                className="rounded-md border-[#d4d4d8] bg-white text-[#09090b] hover:bg-[#f4f4f5]"
                onClick={onRetry}
                type="button"
                variant="outline"
              >
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="rounded-lg border border-dashed border-[#a1a1aa] bg-white p-6 text-sm text-[#52525b]">
                Loading held sales...
              </div>
            ) : null}

            {!isLoading && heldSales.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#a1a1aa] bg-white p-6 text-center">
                <Clock className="mx-auto h-8 w-8 text-[#71717a]" />
                <p className="mt-2 font-semibold text-[#09090b]">No held sales</p>
                <p className="text-sm text-[#52525b]">
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
                    className="overflow-hidden rounded-lg border border-[#d4d4d8] bg-white"
                    key={heldSale.id}
                  >
                    <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-[#09090b]">{heldSale.holdNumber}</p>
                          <span className="rounded-md bg-[#f4f4f5] px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#52525b]">
                            {heldSale.itemCount} items
                          </span>
                        </div>
                        <p className="font-mono mt-1 text-sm font-black text-[#09090b]">
                          {formatMoney(heldSale.total)}
                        </p>
                        <p className="text-xs font-medium text-[#71717a]">
                          Held {formatHeldAt(heldSale.heldAt)}
                        </p>
                        {heldSale.customerName ? (
                          <p className="mt-1 text-xs font-bold text-[#52525b]">
                            {heldSale.customerName}
                          </p>
                        ) : null}
                        {heldSale.notes ? (
                          <p className="mt-1 line-clamp-2 text-xs text-[#52525b]">
                            {heldSale.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          aria-expanded={isExpanded}
                          className="rounded-md border-[#d4d4d8] bg-white text-[#09090b] hover:bg-[#f4f4f5]"
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
                          className="rounded-md bg-black text-white hover:bg-[#18181b]"
                          disabled={isResuming}
                          onClick={() => onResumeHeldSale(heldSale.id)}
                          type="button"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Resume
                        </Button>
                        <Button
                          className="rounded-md border-[#d4d4d8] bg-white text-red-700 hover:bg-red-50"
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
                      <div className="border-t border-[#d4d4d8] bg-[#fafafa] p-3">
                        {heldSaleDetailsQuery.isLoading ? (
                          <div className="flex items-center gap-2 rounded-md border border-dashed border-[#a1a1aa] bg-white p-4 text-sm font-semibold text-[#52525b]">
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
                          <div className="rounded-md border border-dashed border-[#a1a1aa] bg-white p-4 text-sm text-[#52525b]">
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

        <DialogFooter className="border-t border-[#d4d4d8] bg-white px-4 py-3">
          <Button
            className="rounded-md border-[#d4d4d8] bg-white text-[#09090b] hover:bg-[#f4f4f5]"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
