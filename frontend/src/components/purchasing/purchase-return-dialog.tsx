"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/constants/routes";
import { useCreatePurchaseReturn, usePurchaseReceiptReturnableItems } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";
import type { StockLocation } from "@/types/inventory";
import type { PurchaseReceipt } from "@/types/purchasing";

type ReturnLineState = {
  purchaseReceiptItemId: string;
  quantity: number;
  reason: string;
  selected: boolean;
  stockLocationId: string;
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function defaultReturnQuantity(returnableQuantity: number): number {
  return returnableQuantity > 0 ? 1 : 0;
}

export function PurchaseReturnDialog({
  onClose,
  open,
  receipt,
  stockLocations,
}: {
  onClose: () => void;
  open: boolean;
  receipt: PurchaseReceipt | null;
  stockLocations: StockLocation[];
}): JSX.Element {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [returnDate, setReturnDate] = useState(todayInputValue());
  const [supplierReferenceNumber, setSupplierReferenceNumber] = useState("");
  const [lines, setLines] = useState<ReturnLineState[]>([]);
  const returnableItemsQuery = usePurchaseReceiptReturnableItems(
    receipt?.id ?? null,
    open && receipt !== null,
  );
  const createReturnMutation = useCreatePurchaseReturn();
  const activeStockLocations = useMemo(
    () => stockLocations.filter((location) => location.status === "active"),
    [stockLocations],
  );
  const defaultLocationId =
    activeStockLocations.find((location) => location.isDefault)?.id ??
    activeStockLocations[0]?.id ??
    "";
  const stockLocationOptions = useMemo(
    () =>
      activeStockLocations.map((location) => ({
        description: `${location.locationCode} - ${location.branchName}`,
        keywords: [location.locationCode, location.branchName],
        label: location.locationName,
        value: location.id,
      })),
    [activeStockLocations],
  );

  useEffect(() => {
    if (!open) {
      setReason("");
      setReturnDate(todayInputValue());
      setSupplierReferenceNumber("");
      setLines([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !returnableItemsQuery.data) {
      return;
    }

    const validItems = returnableItemsQuery.data.filter((item) => item.returnableQuantity > 0);
    const shouldAutoSelect = validItems.length === 1;

    setLines(
      returnableItemsQuery.data.map((item) => {
        const selected = shouldAutoSelect && item.returnableQuantity > 0;
        return {
          purchaseReceiptItemId: item.purchaseReceiptItemId,
          quantity: selected ? defaultReturnQuantity(item.returnableQuantity) : 0,
          reason: "",
          selected,
          stockLocationId: defaultLocationId,
        };
      }),
    );
  }, [defaultLocationId, open, returnableItemsQuery.data]);

  const selectedLines = lines.filter((line) => line.selected && line.quantity > 0);
  const selectedLineCountText = String(selectedLines.length);
  const selectedTotal = selectedLines.reduce((total, line) => {
    const item = (returnableItemsQuery.data ?? []).find(
      (returnableItem) => returnableItem.purchaseReceiptItemId === line.purchaseReceiptItemId,
    );
    return total + line.quantity * (item?.unitCost ?? 0);
  }, 0);

  const updateLine = (itemId: string, patch: Partial<ReturnLineState>): void => {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.purchaseReceiptItemId === itemId ? { ...line, ...patch } : line,
      ),
    );
  };

  const setLineSelected = (itemId: string, checked: boolean, returnableQuantity: number): void => {
    updateLine(itemId, {
      quantity: checked ? defaultReturnQuantity(returnableQuantity) : 0,
      selected: checked,
    });
  };

  const handleSubmit = async (): Promise<void> => {
    if (!receipt) return;

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      toast.error("Return reason is required.");
      return;
    }

    if (selectedLines.length === 0) {
      toast.error("Select at least one return item.");
      return;
    }

    const hasInvalidQuantity = selectedLines.some((line) => {
      const item = (returnableItemsQuery.data ?? []).find(
        (returnableItem) => returnableItem.purchaseReceiptItemId === line.purchaseReceiptItemId,
      );
      return !item || line.quantity > item.returnableQuantity;
    });

    if (hasInvalidQuantity) {
      toast.error("Return quantity cannot exceed the remaining returnable quantity.");
      return;
    }

    try {
      const purchaseReturn = await createReturnMutation.mutateAsync({
        items: selectedLines.map((line) => ({
          purchaseReceiptItemId: line.purchaseReceiptItemId,
          quantity: line.quantity,
          reason: line.reason.trim() || trimmedReason,
          stockLocationId: line.stockLocationId || null,
        })),
        purchaseReceiptId: receipt.id,
        reason: trimmedReason,
        returnDate,
        supplierReferenceNumber: supplierReferenceNumber.trim() || null,
      });

      toast.success("Draft vendor credit created. Review it before posting.");
      onClose();
      router.push(`${ROUTES.purchasingReturns}/${purchaseReturn.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Create purchase return</DialogTitle>
          <DialogDescription>
            Select damaged, expired, or rejected receipt items and create a draft vendor credit for
            review.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="purchase-return-date">Return date</Label>
            <Input
              id="purchase-return-date"
              onChange={(event) => setReturnDate(event.target.value)}
              type="date"
              value={returnDate}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier-reference-number">Supplier reference</Label>
            <Input
              id="supplier-reference-number"
              onChange={(event) => setSupplierReferenceNumber(event.target.value)}
              placeholder="Optional credit note ref"
              value={supplierReferenceNumber}
            />
          </div>
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
            <p className="text-xs text-brand-mocha">Estimated credit</p>
            <p className="mt-2 text-2xl font-semibold text-brand-espresso">
              {formatCurrency(selectedTotal)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchase-return-reason">Return reason</Label>
          <Textarea
            id="purchase-return-reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Damaged items, expired on delivery, supplier quality issue..."
            value={reason}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-brand-cappuccino">
          <div className="border-b border-brand-cappuccino bg-brand-cream px-4 py-3 text-sm font-medium text-brand-mocha">
            {selectedLines.length === 0
              ? "Please select at least one return line to create the Vendor Credit."
              : `${selectedLineCountText} return line${selectedLines.length === 1 ? "" : "s"} selected.`}
          </div>
          <div className="grid grid-cols-[7rem_1.6fr_0.8fr_0.8fr_1fr_1.2fr] gap-3 bg-brand-latte px-4 py-3 text-xs font-semibold text-brand-mocha">
            <span>Select</span>
            <span>Item</span>
            <span>Returnable</span>
            <span>Quantity</span>
            <span>Location</span>
            <span>Line reason</span>
          </div>

          {returnableItemsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-brand-mocha">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading returnable items...
            </div>
          ) : null}

          {returnableItemsQuery.error ? (
            <div className="p-6 text-sm text-danger-text">
              {getErrorMessage(returnableItemsQuery.error)}
            </div>
          ) : null}

          {!returnableItemsQuery.isLoading &&
          !returnableItemsQuery.error &&
          (returnableItemsQuery.data ?? []).length === 0 ? (
            <div className="p-8 text-center text-sm text-brand-mocha">
              No returnable items found for this posted receipt.
            </div>
          ) : null}

          {(returnableItemsQuery.data ?? []).map((item) => {
            const line = lines.find(
              (currentLine) => currentLine.purchaseReceiptItemId === item.purchaseReceiptItemId,
            );
            if (!line) {
              return null;
            }

            const disabled = item.returnableQuantity <= 0;

            return (
              <div
                className="grid grid-cols-[7rem_1.6fr_0.8fr_0.8fr_1fr_1.2fr] items-center gap-3 border-t border-brand-cappuccino px-4 py-3"
                key={item.purchaseReceiptItemId}
              >
                <label className="flex items-center gap-2 text-sm font-medium text-brand-espresso">
                  <Checkbox
                    checked={line.selected}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      setLineSelected(
                        item.purchaseReceiptItemId,
                        checked === true,
                        item.returnableQuantity,
                      )
                    }
                  />
                  <span>{line.selected ? "Selected" : "Select"}</span>
                </label>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-espresso">
                    {item.itemNameSnapshot}
                  </p>
                  <p className="text-xs text-brand-mocha">
                    {item.itemType} - {item.unitCost ? formatCurrency(item.unitCost) : "No cost"}
                  </p>
                </div>
                <p className="text-sm text-brand-mocha">
                  {item.returnableQuantity} {item.unitSymbol}
                </p>
                <Input
                  disabled={disabled || !line.selected}
                  max={item.returnableQuantity}
                  min={0}
                  onChange={(event) =>
                    updateLine(item.purchaseReceiptItemId, {
                      quantity: Number(event.target.value),
                    })
                  }
                  type="number"
                  value={line.quantity}
                />
                <SearchableCombobox
                  disabled={disabled || !line.selected}
                  emptyMessage="No active stock locations found."
                  onValueChange={(value) =>
                    updateLine(item.purchaseReceiptItemId, { stockLocationId: value })
                  }
                  options={stockLocationOptions}
                  placeholder="Default location"
                  searchPlaceholder="Search location..."
                  value={line.stockLocationId}
                />
                <Input
                  disabled={disabled || !line.selected}
                  onChange={(event) =>
                    updateLine(item.purchaseReceiptItemId, { reason: event.target.value })
                  }
                  placeholder="Optional"
                  value={line.reason}
                />
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={
              createReturnMutation.isPending ||
              returnableItemsQuery.isLoading ||
              selectedLines.length === 0
            }
            onClick={() => void handleSubmit()}
            type="button"
          >
            Create draft vendor credit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
