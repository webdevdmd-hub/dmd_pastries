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
import {
  useCreatePurchaseReturn,
  usePurchaseReceiptReturnableItems,
  usePurchaseReceipts,
} from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";
import type { StockLocation } from "@/types/inventory";
import type {
  PurchasingBranchOption,
  PurchasingSupplierOption,
  ReturnablePurchaseReceiptItem,
} from "@/types/purchasing";

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

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function estimatedLineCredit(item: ReturnablePurchaseReceiptItem, quantity: number): number {
  if (quantity <= 0) {
    return 0;
  }

  const backendLineTotal = item.lineTotal > 0 ? item.lineTotal : 0;
  if (backendLineTotal > 0 && item.returnableQuantity > 0) {
    return roundMoney(backendLineTotal * (quantity / item.returnableQuantity));
  }

  return roundMoney(quantity * item.unitCost);
}

export function PurchaseReturnFromReceiptDialog({
  branches,
  defaultBranchId,
  onClose,
  open,
  stockLocations,
  suppliers,
}: {
  branches: PurchasingBranchOption[];
  defaultBranchId: string;
  onClose: () => void;
  open: boolean;
  stockLocations: StockLocation[];
  suppliers: PurchasingSupplierOption[];
}): JSX.Element {
  const router = useRouter();
  const [selectedBranchId, setSelectedBranchId] = useState(defaultBranchId);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedReceiptId, setSelectedReceiptId] = useState("");
  const [reason, setReason] = useState("");
  const [returnDate, setReturnDate] = useState(todayInputValue());
  const [supplierReferenceNumber, setSupplierReferenceNumber] = useState("");
  const [lines, setLines] = useState<ReturnLineState[]>([]);
  const receiptsQuery = usePurchaseReceipts(
    {
      branchId: selectedBranchId,
      dateFrom: "",
      dateTo: "",
      search: "",
      status: "posted",
      supplierId: selectedSupplierId || "all",
    },
    open && selectedSupplierId !== "",
  );
  const selectedReceipt =
    (receiptsQuery.data ?? []).find((receipt) => receipt.id === selectedReceiptId) ?? null;
  const returnableItemsQuery = usePurchaseReceiptReturnableItems(
    selectedReceiptId || null,
    open && selectedReceiptId !== "",
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

  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        description: branch.status,
        label: branch.branchName,
        value: branch.id,
      })),
    [branches],
  );

  const supplierOptions = useMemo(
    () =>
      suppliers.map((supplier) => ({
        label: supplier.supplierName,
        value: supplier.id,
      })),
    [suppliers],
  );

  const receiptOptions = useMemo(
    () =>
      (receiptsQuery.data ?? []).map((receipt) => ({
        description: [
          formatDate(receipt.receivedDate),
          receipt.purchaseOrderNumber ? `PO ${receipt.purchaseOrderNumber}` : null,
          receipt.purchaseInvoiceNumber ? `Bill ${receipt.purchaseInvoiceNumber}` : null,
        ]
          .filter((part): part is string => part !== null)
          .join(" - "),
        keywords: [
          receipt.receiptNumber,
          receipt.purchaseOrderNumber ?? "",
          receipt.purchaseInvoiceNumber ?? "",
          receipt.supplierName,
        ],
        label: receipt.receiptNumber,
        value: receipt.id,
      })),
    [receiptsQuery.data],
  );

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
      setSelectedBranchId(defaultBranchId);
      setSelectedSupplierId("");
      setSelectedReceiptId("");
      setReason("");
      setReturnDate(todayInputValue());
      setSupplierReferenceNumber("");
      setLines([]);
    }
  }, [defaultBranchId, open]);

  useEffect(() => {
    setSelectedReceiptId("");
    setLines([]);
  }, [selectedBranchId, selectedSupplierId]);

  useEffect(() => {
    if (!open || !returnableItemsQuery.data) {
      return;
    }

    setLines(
      returnableItemsQuery.data.map((item) => ({
        purchaseReceiptItemId: item.purchaseReceiptItemId,
        quantity: item.returnableQuantity > 0 ? 1 : 0,
        reason: "",
        selected: false,
        stockLocationId: defaultLocationId,
      })),
    );
  }, [defaultLocationId, open, returnableItemsQuery.data]);

  const selectedLines = lines.filter((line) => line.selected && line.quantity > 0);
  const hasInvalidSelectedQuantity = selectedLines.some((line) => {
    const item = (returnableItemsQuery.data ?? []).find(
      (returnableItem) => returnableItem.purchaseReceiptItemId === line.purchaseReceiptItemId,
    );
    return !item || line.quantity > item.returnableQuantity;
  });
  const selectedTotal = selectedLines.reduce((total, line) => {
    const item = (returnableItemsQuery.data ?? []).find(
      (returnableItem) => returnableItem.purchaseReceiptItemId === line.purchaseReceiptItemId,
    );
    return item ? total + estimatedLineCredit(item, line.quantity) : total;
  }, 0);
  const estimatedCredit = roundMoney(selectedTotal);

  const updateLine = (itemId: string, patch: Partial<ReturnLineState>): void => {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.purchaseReceiptItemId === itemId ? { ...line, ...patch } : line,
      ),
    );
  };

  const handleSubmit = async (): Promise<void> => {
    if (!selectedReceipt) {
      toast.error("Select a posted receipt before creating a vendor credit.");
      return;
    }

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
        purchaseReceiptId: selectedReceipt.id,
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
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create vendor credit</DialogTitle>
          <DialogDescription>
            Select a posted receive-goods record, then return supplier stock against that receipt.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Branch</Label>
            <SearchableCombobox
              emptyMessage="No branches found."
              onValueChange={setSelectedBranchId}
              options={branchOptions}
              placeholder="Select branch"
              searchPlaceholder="Search branch..."
              value={selectedBranchId}
            />
          </div>
          <div className="space-y-2">
            <Label>Supplier *</Label>
            <SearchableCombobox
              emptyMessage="No suppliers found."
              onValueChange={setSelectedSupplierId}
              options={supplierOptions}
              placeholder="Select supplier"
              searchPlaceholder="Search supplier..."
              value={selectedSupplierId}
            />
          </div>
          <div className="space-y-2">
            <Label>Posted receipt *</Label>
            <SearchableCombobox
              disabled={selectedSupplierId === ""}
              emptyMessage="No posted receipt with returnable items found."
              errorMessage={receiptsQuery.error ? getErrorMessage(receiptsQuery.error) : null}
              isLoading={receiptsQuery.isFetching}
              onRetry={() => {
                void receiptsQuery.refetch();
              }}
              onValueChange={setSelectedReceiptId}
              options={receiptOptions}
              placeholder="Select receipt"
              searchPlaceholder="Search receipt, PO, bill..."
              value={selectedReceiptId}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr_16rem]">
          <div className="space-y-2">
            <Label htmlFor="vendor-credit-date">Return date</Label>
            <Input
              id="vendor-credit-date"
              onChange={(event) => setReturnDate(event.target.value)}
              type="date"
              value={returnDate}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-credit-supplier-reference">Supplier reference</Label>
            <Input
              id="vendor-credit-supplier-reference"
              onChange={(event) => setSupplierReferenceNumber(event.target.value)}
              placeholder="Optional credit note ref"
              value={supplierReferenceNumber}
            />
          </div>
          <div className="rounded-lg border border-brand-cappuccino bg-brand-latte/60 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-brand-mocha">Estimated credit</p>
            <p className="mt-2 text-2xl font-semibold text-brand-espresso">
              {formatCurrency(estimatedCredit)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vendor-credit-reason">Return reason *</Label>
          <Textarea
            id="vendor-credit-reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Damaged items, expired on delivery, supplier quality issue..."
            value={reason}
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-brand-cappuccino">
          <div className="grid grid-cols-[auto_1.6fr_0.8fr_0.8fr_1fr_1.2fr] gap-3 bg-brand-latte px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-mocha">
            <span />
            <span>Item</span>
            <span>Returnable</span>
            <span>Quantity</span>
            <span>Location</span>
            <span>Line reason</span>
          </div>

          {selectedSupplierId === "" ? (
            <div className="p-8 text-center text-sm text-brand-mocha">
              Select a supplier to view posted receipts.
            </div>
          ) : null}

          {selectedSupplierId !== "" && selectedReceiptId === "" && !receiptsQuery.isFetching ? (
            <div className="p-8 text-center text-sm text-brand-mocha">
              Select a posted receipt to view returnable items.
            </div>
          ) : null}

          {returnableItemsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-brand-mocha">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading returnable items...
            </div>
          ) : null}

          {returnableItemsQuery.error ? (
            <div className="p-6 text-sm text-red-800">
              {getErrorMessage(returnableItemsQuery.error)}
            </div>
          ) : null}

          {!returnableItemsQuery.isLoading &&
          selectedReceiptId !== "" &&
          !returnableItemsQuery.error &&
          (returnableItemsQuery.data ?? []).length === 0 ? (
            <div className="p-8 text-center text-sm text-brand-mocha">
              No posted receipt with returnable items found.
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
            const lineCredit = line.selected ? estimatedLineCredit(item, line.quantity) : 0;

            return (
              <div
                className="grid grid-cols-[auto_1.6fr_0.8fr_0.8fr_1fr_1.2fr] items-center gap-3 border-t border-brand-cappuccino px-4 py-3"
                key={item.purchaseReceiptItemId}
              >
                <Checkbox
                  checked={line.selected}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    updateLine(item.purchaseReceiptItemId, { selected: checked === true })
                  }
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-espresso">
                    {item.itemNameSnapshot}
                  </p>
                  <p className="text-xs text-brand-mocha">
                    {item.itemType} - {item.unitCost ? formatCurrency(item.unitCost) : "No cost"}
                  </p>
                  {line.selected ? (
                    <p className="text-xs font-medium text-brand-espresso">
                      Credit {formatCurrency(lineCredit)}
                    </p>
                  ) : null}
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
              selectedReceipt === null ||
              selectedLines.length === 0 ||
              hasInvalidSelectedQuantity ||
              estimatedCredit <= 0
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
