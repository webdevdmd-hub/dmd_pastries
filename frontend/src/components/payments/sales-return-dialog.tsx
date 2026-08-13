"use client";

import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SalesReturnStatusBadge } from "@/components/payments/sales-return-status-badge";
import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from "@/components/shared/searchable-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateSalesReturn,
  usePostSalesReturn,
  useReturnableSaleItems,
} from "@/hooks/use-sales-returns";
import { getErrorMessage } from "@/lib/api/client";
import { calculateSalesReturnRefundPreview } from "@/lib/sales-returns/refund-preview";
import type { StockLocation } from "@/types/inventory";
import type {
  RefundMode,
  RestockAction,
  SalesReturn,
  SalesReturnDraftFormItem,
} from "@/types/sales-return";
import type { PaymentMethod } from "@/types/settings";

type SalesReturnDialogProps = {
  onOpenChange: (open: boolean) => void;
  onPosted?: (salesReturn: SalesReturn) => void;
  open: boolean;
  paymentMethods: PaymentMethod[];
  saleId: string | null;
  saleNumber?: string | null;
  stockLocations: StockLocation[];
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function selectedQuantity(lines: SalesReturnDraftFormItem[], saleItemId: string): number {
  return lines.find((line) => line.saleItemId === saleItemId)?.quantity ?? 0;
}

export function SalesReturnDialog({
  onOpenChange,
  onPosted,
  open,
  paymentMethods,
  saleId,
  saleNumber,
  stockLocations,
}: SalesReturnDialogProps): JSX.Element {
  const returnableItemsQuery = useReturnableSaleItems(saleId, open && saleId !== null);
  const createMutation = useCreateSalesReturn();
  const postMutation = usePostSalesReturn();
  const [returnDate, setReturnDate] = useState(todayDate);
  const [reason, setReason] = useState("");
  const [refundMode, setRefundMode] = useState<RefundMode>("refund");
  const [refundPaymentMethodId, setRefundPaymentMethodId] = useState("");
  const [refundReferenceNumber, setRefundReferenceNumber] = useState("");
  const [lines, setLines] = useState<SalesReturnDraftFormItem[]>([]);
  const [draftReturn, setDraftReturn] = useState<SalesReturn | null>(null);

  const activePaymentMethods = useMemo(
    () =>
      paymentMethods.filter(
        (method) =>
          method.status === "active" && method.showInPos && method.defaultPaymentAccountId !== null,
      ),
    [paymentMethods],
  );
  const paymentMethodOptions: SearchableComboboxOption[] = activePaymentMethods.map((method) => ({
    value: method.id,
    label: method.methodName,
    description: method.methodType,
    keywords: [method.methodType],
  }));
  const stockLocationOptions: SearchableComboboxOption[] = stockLocations
    .filter((location) => location.status === "active")
    .map((location) => ({
      value: location.id,
      label: location.locationName,
      description: `${location.branchName} / ${location.locationCode}`,
      keywords: [location.branchName, location.locationCode, location.locationType],
    }));
  const selectedPaymentMethod =
    activePaymentMethods.find((method) => method.id === refundPaymentMethodId) ?? null;
  const selectedLines = lines.filter((line) => line.quantity > 0);
  const estimatedRefundPreview = calculateSalesReturnRefundPreview(
    returnableItemsQuery.data ?? [],
    selectedLines,
  );
  const requiresStockLocation = selectedLines.some((line) => line.restockAction === "restock");

  useEffect(() => {
    if (!open) {
      setReturnDate(todayDate());
      setReason("");
      setRefundMode("refund");
      setRefundPaymentMethodId("");
      setRefundReferenceNumber("");
      setLines([]);
      setDraftReturn(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !returnableItemsQuery.data) {
      return;
    }

    setLines((currentLines) => {
      const currentById = new Map(currentLines.map((line) => [line.saleItemId, line]));

      return returnableItemsQuery.data.map((item) => ({
        saleItemId: item.saleItemId,
        quantity: currentById.get(item.saleItemId)?.quantity ?? 0,
        restockAction: currentById.get(item.saleItemId)?.restockAction ?? "discard",
        stockLocationId: currentById.get(item.saleItemId)?.stockLocationId ?? "",
        reason: currentById.get(item.saleItemId)?.reason ?? "",
      }));
    });
  }, [open, returnableItemsQuery.data]);

  const updateLine = (
    saleItemId: string,
    updater: (line: SalesReturnDraftFormItem) => SalesReturnDraftFormItem,
  ): void => {
    setLines((currentLines) =>
      currentLines.map((line) => (line.saleItemId === saleItemId ? updater(line) : line)),
    );
  };

  const validate = (): string | null => {
    if (!saleId) {
      return "Sale ID is missing.";
    }

    if (!reason.trim()) {
      return "Return reason is required.";
    }

    if (selectedLines.length === 0) {
      return "Select at least one returned item.";
    }

    const invalidLine = selectedLines.find((line) => {
      const item = (returnableItemsQuery.data ?? []).find(
        (returnableItem) => returnableItem.saleItemId === line.saleItemId,
      );
      return !item || line.quantity > item.returnableQuantity;
    });

    if (invalidLine) {
      return "Returned quantity cannot exceed remaining returnable quantity.";
    }

    if (refundMode === "refund" && !refundPaymentMethodId) {
      return "Select a refund payment method.";
    }

    if (
      refundMode === "refund" &&
      selectedPaymentMethod?.requiresReference &&
      !refundReferenceNumber.trim()
    ) {
      return "Reference number is required for this refund payment method.";
    }

    if (
      requiresStockLocation &&
      selectedLines.some((line) => line.restockAction === "restock" && !line.stockLocationId)
    ) {
      return "Select a stock location for restocked items.";
    }

    return null;
  };

  const handleCreateDraft = async (): Promise<void> => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!saleId) {
      return;
    }

    try {
      const createdReturn = await createMutation.mutateAsync({
        saleId,
        returnDate,
        reason: reason.trim(),
        refundMode,
        refundPaymentMethodId: refundMode === "refund" ? refundPaymentMethodId : null,
        refundReferenceNumber:
          refundMode === "refund" && refundReferenceNumber.trim()
            ? refundReferenceNumber.trim()
            : null,
        items: selectedLines.map((line) => ({
          saleItemId: line.saleItemId,
          quantity: line.quantity,
          restockAction: line.restockAction,
          stockLocationId: line.restockAction === "restock" ? line.stockLocationId : null,
          reason: line.reason.trim() || null,
        })),
      });
      setDraftReturn(createdReturn);
      toast.success("Draft credit note created.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handlePost = async (): Promise<void> => {
    if (!draftReturn) {
      return;
    }

    try {
      const postedReturn = await postMutation.mutateAsync(draftReturn.id);
      toast.success("Credit note posted.");
      onPosted?.(postedReturn);
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create sales return / credit note</DialogTitle>
          <DialogDescription>
            Return item quantities from {saleNumber ?? "this POS sale"} and optionally create a
            customer refund.
          </DialogDescription>
        </DialogHeader>

        {draftReturn ? (
          <div className="space-y-5">
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Draft credit note ready</AlertTitle>
              <AlertDescription>
                Review {draftReturn.returnNumber}, then post it to finalize stock/refund handling.
              </AlertDescription>
            </Alert>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-brand-cappuccino bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-mocha">
                  Credit note
                </p>
                <p className="mt-1 font-bold text-brand-espresso">{draftReturn.returnNumber}</p>
              </div>
              <div className="rounded-2xl border border-brand-cappuccino bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-mocha">
                  Refund amount
                </p>
                <p className="mt-1 font-bold text-brand-espresso">
                  {formatMoney(draftReturn.refundAmount)}
                </p>
              </div>
              <div className="rounded-2xl border border-brand-cappuccino bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-mocha">
                  Items
                </p>
                <p className="mt-1 font-bold text-brand-espresso">{draftReturn.items.length}</p>
              </div>
              <div className="rounded-2xl border border-brand-cappuccino bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-mocha">
                  Status
                </p>
                <div className="mt-1">
                  <SalesReturnStatusBadge status={draftReturn.status} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
                Close
              </Button>
              <Button
                disabled={postMutation.isPending}
                onClick={() => void handlePost()}
                type="button"
              >
                {postMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Post credit note
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-6">
            {returnableItemsQuery.isLoading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-brand-mocha">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading returnable items...
              </div>
            ) : null}

            {returnableItemsQuery.error ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Unable to load returnable items</AlertTitle>
                <AlertDescription>{getErrorMessage(returnableItemsQuery.error)}</AlertDescription>
              </Alert>
            ) : null}

            {!returnableItemsQuery.isLoading &&
            !returnableItemsQuery.error &&
            (returnableItemsQuery.data ?? []).length === 0 ? (
              <div className="rounded-3xl border border-brand-cappuccino bg-brand-latte/40 p-8 text-center">
                <p className="font-semibold text-brand-espresso">No returnable items found.</p>
                <p className="mt-1 text-sm text-brand-mocha">
                  This sale may already be fully returned or not eligible for item returns.
                </p>
              </div>
            ) : null}

            {(returnableItemsQuery.data ?? []).length > 0 ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="return-date">Return date</Label>
                    <Input
                      id="return-date"
                      onChange={(event) => setReturnDate(event.target.value)}
                      type="date"
                      value={returnDate}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="refund-mode">Refund mode</Label>
                    <Select
                      onValueChange={(value: RefundMode) => setRefundMode(value)}
                      value={refundMode}
                    >
                      <SelectTrigger id="refund-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="refund">Refund customer</SelectItem>
                        <SelectItem value="store_credit">Store credit</SelectItem>
                        <SelectItem value="none">No compensation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-mocha">
                      {refundMode === "store_credit" ? "Estimated store credit" : "Estimated refund"}
                    </p>
                    <p className="mt-1 text-2xl font-black text-brand-espresso">
                      {formatMoney(
                        refundMode !== "none" ? estimatedRefundPreview.finalRefundAmount : 0,
                      )}
                    </p>
                    <div className="mt-3 space-y-1 text-sm text-brand-mocha">
                      <div className="flex items-center justify-between gap-3">
                        <span>Item refund amount</span>
                        <span className="font-semibold text-brand-espresso">
                          {formatMoney(
                            refundMode !== "none" ? estimatedRefundPreview.itemRefundAmount : 0,
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Refundable VAT</span>
                        <span className="font-semibold text-brand-espresso">
                          {formatMoney(
                            refundMode !== "none" ? estimatedRefundPreview.refundableVat : 0,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {refundMode === "refund" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Refund payment method</Label>
                      <SearchableCombobox
                        emptyMessage="No active POS refund methods with payment accounts found."
                        onValueChange={setRefundPaymentMethodId}
                        options={paymentMethodOptions}
                        placeholder="Select refund method"
                        searchPlaceholder="Search method..."
                        value={refundPaymentMethodId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="refund-reference">
                        Reference number
                        {selectedPaymentMethod?.requiresReference ? " *" : ""}
                      </Label>
                      <Input
                        id="refund-reference"
                        onChange={(event) => setRefundReferenceNumber(event.target.value)}
                        placeholder="Optional refund reference"
                        value={refundReferenceNumber}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="return-reason">Return reason</Label>
                  <Textarea
                    id="return-reason"
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Why is this item being returned?"
                    value={reason}
                  />
                </div>

                <div className="overflow-hidden rounded-3xl border border-brand-cappuccino bg-white">
                  <div className="grid grid-cols-[minmax(0,1fr)_120px_180px_220px] gap-3 border-b border-brand-cappuccino bg-brand-cream/60 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-brand-mocha">
                    <span>Item</span>
                    <span>Quantity</span>
                    <span>Action</span>
                    <span>Location / reason</span>
                  </div>
                  <div className="divide-y divide-brand-cappuccino/70">
                    {(returnableItemsQuery.data ?? []).map((item) => {
                      const line = lines.find(
                        (candidate) => candidate.saleItemId === item.saleItemId,
                      );
                      const quantity = selectedQuantity(lines, item.saleItemId);

                      return (
                        <div
                          className="grid grid-cols-[minmax(0,1fr)_120px_180px_220px] gap-3 px-4 py-3"
                          key={item.saleItemId}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-brand-espresso">{item.itemName}</p>
                            <p className="mt-1 text-xs text-brand-mocha">
                              Sold {item.soldQuantity} / Returned {item.returnedQuantity} /
                              Available {item.returnableQuantity}
                            </p>
                            <p className="mt-1 text-xs text-brand-mocha">
                              Unit {formatMoney(item.unitPrice)}
                            </p>
                          </div>
                          <Input
                            min={0}
                            max={item.returnableQuantity}
                            onChange={(event) =>
                              updateLine(item.saleItemId, (currentLine) => ({
                                ...currentLine,
                                quantity: Math.min(
                                  Number(event.target.value || 0),
                                  item.returnableQuantity,
                                ),
                              }))
                            }
                            type="number"
                            value={quantity}
                          />
                          <Select
                            disabled={quantity <= 0}
                            onValueChange={(value: RestockAction) =>
                              updateLine(item.saleItemId, (currentLine) => ({
                                ...currentLine,
                                restockAction: value,
                                stockLocationId:
                                  value === "discard" ? "" : currentLine.stockLocationId,
                              }))
                            }
                            value={line?.restockAction ?? "discard"}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="discard">Discard</SelectItem>
                              <SelectItem value="restock">Restock</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="space-y-2">
                            {line?.restockAction === "restock" ? (
                              <SearchableCombobox
                                disabled={quantity <= 0}
                                emptyMessage="No active stock locations found."
                                onValueChange={(value) =>
                                  updateLine(item.saleItemId, (currentLine) => ({
                                    ...currentLine,
                                    stockLocationId: value,
                                  }))
                                }
                                options={stockLocationOptions}
                                placeholder="Select location"
                                searchPlaceholder="Search location..."
                                value={line.stockLocationId}
                              />
                            ) : null}
                            <Input
                              disabled={quantity <= 0}
                              onChange={(event) =>
                                updateLine(item.saleItemId, (currentLine) => ({
                                  ...currentLine,
                                  reason: event.target.value,
                                }))
                              }
                              placeholder="Line reason"
                              value={line?.reason ?? ""}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/40 p-4">
                  <Checkbox checked={selectedLines.length > 0} disabled />
                  <div>
                    <p className="text-sm font-semibold text-brand-espresso">
                      {selectedLines.length} item line{selectedLines.length === 1 ? "" : "s"}{" "}
                      selected
                    </p>
                    <p className="text-sm text-brand-mocha">
                      Posting the credit note finalizes refund and stock actions.
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
                    Cancel
                  </Button>
                  <Button
                    disabled={createMutation.isPending}
                    onClick={() => void handleCreateDraft()}
                    type="button"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Create draft return
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
