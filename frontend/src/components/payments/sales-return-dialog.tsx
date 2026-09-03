"use client";

import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SalesReturnStatusBadge } from "@/components/payments/sales-return-status-badge";
import { type FormTab, FormTabs } from "@/components/shared/form-tabs";
import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from "@/components/shared/searchable-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

type SalesReturnTabKey = "items" | "refund";

const FORM_TABPANEL_ID = "sales-return-form-tabpanel";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function selectedQuantity(lines: SalesReturnDraftFormItem[], saleItemId: string): number {
  return lines.find((line) => line.saleItemId === saleItemId)?.quantity ?? 0;
}

/**
 * Create a sales return in two tabs: which items come back, and how the
 * customer is compensated. Both tabs read the same state, so nothing typed
 * on one is lost on the other. A validation failure switches to the tab
 * that holds the problem before the toast explains it.
 */
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
  const [activeTab, setActiveTab] = useState<SalesReturnTabKey>("items");
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
  const returnableItems = returnableItemsQuery.data ?? [];

  useEffect(() => {
    if (!open) {
      setActiveTab("items");
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

  /** The first problem, and the tab it lives on. */
  const validate = (): { message: string; tab: SalesReturnTabKey } | null => {
    if (!saleId) {
      return { message: "Sale ID is missing.", tab: "items" };
    }

    if (selectedLines.length === 0) {
      return { message: "Select at least one returned item.", tab: "items" };
    }

    const invalidLine = selectedLines.find((line) => {
      const item = returnableItems.find(
        (returnableItem) => returnableItem.saleItemId === line.saleItemId,
      );
      return !item || line.quantity > item.returnableQuantity;
    });

    if (invalidLine) {
      return {
        message: "Returned quantity cannot exceed remaining returnable quantity.",
        tab: "items",
      };
    }

    if (
      requiresStockLocation &&
      selectedLines.some((line) => line.restockAction === "restock" && !line.stockLocationId)
    ) {
      return { message: "Select a stock location for restocked items.", tab: "items" };
    }

    if (!reason.trim()) {
      return { message: "Return reason is required.", tab: "refund" };
    }

    if (refundMode === "refund" && !refundPaymentMethodId) {
      return { message: "Select a refund payment method.", tab: "refund" };
    }

    if (
      refundMode === "refund" &&
      selectedPaymentMethod?.requiresReference &&
      !refundReferenceNumber.trim()
    ) {
      return {
        message: "Reference number is required for this refund payment method.",
        tab: "refund",
      };
    }

    return null;
  };

  const handleCreateDraft = async (): Promise<void> => {
    const validationError = validate();
    if (validationError) {
      setActiveTab(validationError.tab);
      toast.error(validationError.message);
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

  const tabs: FormTab<SalesReturnTabKey>[] = [
    { key: "items", label: "Items", badge: selectedLines.length },
    { key: "refund", label: "Refund" },
  ];
  const estimateLabel =
    refundMode === "store_credit" ? "Estimated store credit" : "Estimated refund";
  const hasItems = returnableItems.length > 0;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[90dvh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle>Create sales return / credit note</DialogTitle>
          <DialogDescription>
            Return item quantities from {saleNumber ?? "this POS sale"} and optionally create a
            customer refund.
          </DialogDescription>
        </DialogHeader>

        {draftReturn ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
              <div className="grid gap-5">
                <Alert className="border-money/30 bg-money-tint text-money-text">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Draft credit note ready</AlertTitle>
                  <AlertDescription>
                    Review {draftReturn.returnNumber}, then post it to finalize stock and refund
                    handling.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="min-w-0 rounded-lg bg-muted p-3">
                    <p className="text-meta text-foreground-muted">Credit note</p>
                    <p className="mt-1 break-words font-mono text-cell font-medium">
                      {draftReturn.returnNumber}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-lg bg-muted p-3">
                    <p className="text-meta text-foreground-muted">Refund amount</p>
                    <p className="mt-1 break-words text-cell font-medium tabular-nums">
                      {formatMoney(draftReturn.refundAmount)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-meta text-foreground-muted">Items</p>
                    <p className="mt-1 text-cell font-medium tabular-nums">
                      {draftReturn.items.length}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-meta text-foreground-muted">Status</p>
                    <div className="mt-1">
                      <SalesReturnStatusBadge status={draftReturn.status} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border px-6 py-4">
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
          </>
        ) : (
          <>
            {hasItems ? (
              <div className="border-b border-border px-6 py-3">
                <FormTabs
                  active={activeTab}
                  aria-label="Sales return sections"
                  onTabChange={setActiveTab}
                  panelId={FORM_TABPANEL_ID}
                  tabs={tabs}
                />
              </div>
            ) : null}

            {/* One panel element that swaps. It is the only part that scrolls,
                so the tab strip and the footer stay in reach on a phone. */}
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5"
              id={FORM_TABPANEL_ID}
              role="tabpanel"
              tabIndex={-1}
            >
              {returnableItemsQuery.isLoading ? (
                <div className="flex min-h-48 items-center justify-center gap-2 text-cell text-foreground-muted">
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

              {!returnableItemsQuery.isLoading && !returnableItemsQuery.error && !hasItems ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="font-medium">Nothing left to return</p>
                  <p className="mt-1 text-cell text-foreground-muted">
                    This sale may already be fully returned or not eligible for item returns.
                  </p>
                </div>
              ) : null}

              {hasItems && activeTab === "items" ? (
                <div className="grid gap-4">
                  {/* Rows stack on a phone and become a four-column grid from md. */}
                  <div className="overflow-hidden rounded-lg border border-border">
                    <div className="hidden gap-3 border-b border-border bg-muted px-4 py-2 text-meta text-foreground-muted md:grid md:grid-cols-[minmax(0,1fr)_6rem_9rem_13rem]">
                      <span>Item</span>
                      <span>Quantity</span>
                      <span>Action</span>
                      <span>Location / reason</span>
                    </div>
                    <div className="divide-y divide-border">
                      {returnableItems.map((item) => {
                        const line = lines.find(
                          (candidate) => candidate.saleItemId === item.saleItemId,
                        );
                        const quantity = selectedQuantity(lines, item.saleItemId);

                        return (
                          <div
                            className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_6rem_9rem_13rem]"
                            key={item.saleItemId}
                          >
                            <div className="min-w-0">
                              <p className="font-medium">{item.itemName}</p>
                              <p className="mt-1 text-meta tabular-nums text-foreground-muted">
                                Sold {item.soldQuantity} · Returned {item.returnedQuantity} ·
                                Available {item.returnableQuantity}
                              </p>
                              <p className="mt-0.5 text-meta tabular-nums text-foreground-muted">
                                Unit {formatMoney(item.unitPrice)}
                              </p>
                            </div>
                            <Input
                              aria-label={`Quantity to return for ${item.itemName}`}
                              className="tabular-nums"
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
                              <SelectTrigger aria-label={`Stock action for ${item.itemName}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="discard">Discard</SelectItem>
                                <SelectItem value="restock">Restock</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="grid gap-2">
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
                                aria-label={`Line reason for ${item.itemName}`}
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

                  <p className="text-cell text-foreground-muted">
                    <span className="font-medium tabular-nums text-foreground">
                      {selectedLines.length} item line{selectedLines.length === 1 ? "" : "s"}
                    </span>{" "}
                    selected. Posting the credit note finalizes refund and stock actions.
                  </p>
                </div>
              ) : null}

              {hasItems && activeTab === "refund" ? (
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="return-date">Return date</Label>
                      <Input
                        id="return-date"
                        onChange={(event) => setReturnDate(event.target.value)}
                        type="date"
                        value={returnDate}
                      />
                    </div>
                    <div className="grid gap-2">
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
                  </div>

                  {refundMode === "refund" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="sales-return-refund-payment-method">
                          Refund payment method
                        </Label>
                        <SearchableCombobox
                          id="sales-return-refund-payment-method"
                          emptyMessage="No active POS refund methods with payment accounts found."
                          onValueChange={setRefundPaymentMethodId}
                          options={paymentMethodOptions}
                          placeholder="Select refund method"
                          searchPlaceholder="Search method..."
                          value={refundPaymentMethodId}
                        />
                      </div>
                      <div className="grid gap-2">
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

                  <div className="grid gap-2">
                    <Label htmlFor="return-reason">Return reason</Label>
                    <Textarea
                      id="return-reason"
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Why is this item being returned?"
                      value={reason}
                    />
                  </div>

                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-meta text-foreground-muted">{estimateLabel}</p>
                    <p className="mt-1 text-title tabular-nums">
                      {formatMoney(
                        refundMode !== "none" ? estimatedRefundPreview.finalRefundAmount : 0,
                      )}
                    </p>
                    <div className="mt-3 grid gap-1 text-cell text-foreground-muted">
                      <div className="flex items-center justify-between gap-3">
                        <span>Item refund amount</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {formatMoney(
                            refundMode !== "none" ? estimatedRefundPreview.itemRefundAmount : 0,
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Refundable VAT</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {formatMoney(
                            refundMode !== "none" ? estimatedRefundPreview.refundableVat : 0,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <DialogFooter className="border-t border-border px-6 py-4">
              <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
                Cancel
              </Button>
              {hasItems ? (
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
              ) : null}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
