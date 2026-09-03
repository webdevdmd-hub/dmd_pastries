"use client";

import { Plus, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import { SupplierLookupSelect } from "@/components/purchasing/supplier-lookup-select";
import { type FormTab, FormTabs } from "@/components/shared/form-tabs";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
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
import { useBranchScope } from "@/hooks/use-branch-scope";
import { createUuid } from "@/lib/uuid";
import { purchaseReceiveSchema } from "@/lib/validators/purchasing.schema";
import { PRODUCT_TYPE_LABELS } from "@/types/product";
import type {
  PurchaseInvoice,
  PurchaseItemLineDraft,
  PurchaseOrder,
  PurchasingBranchOption,
  PurchasingProductOption,
  PurchasingSupplierOption,
  PurchasingTaxRateOption,
  PurchasingUnitOption,
  ReceivePurchasePayload,
} from "@/types/purchasing";

type ReceiveFormTabKey = "source" | "items";

const FORM_TABPANEL_ID = "receive-goods-form-tabpanel";

/** Which tab a validation issue belongs to, from the field it names. */
function tabForField(field: string | number | undefined): ReceiveFormTabKey {
  return field === "items" ? "items" : "source";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(): PurchaseItemLineDraft {
  return {
    batchNumber: null,
    discountAmount: 0,
    expiryDate: null,
    ingredientId: null,
    itemType: "product",
    lineId: createUuid(),
    lineType: "product",
    packagingItemId: null,
    productId: null,
    productVariantId: null,
    quantity: 1,
    taxRateId: null,
    unitCost: 0,
    unitId: "",
  };
}

function linesFromOrder(order: PurchaseOrder): PurchaseItemLineDraft[] {
  return order.items
    .filter((item) => item.lineType !== "account" && item.itemType !== "account")
    .map((item) => ({
      batchNumber: null,
      discountAmount: item.discountAmount,
      expiryDate: null,
      ingredientId: item.ingredientId,
      itemType: "product",
      itemNameSnapshot: item.itemNameSnapshot,
      lineId: item.id || createUuid(),
      lineType: "product",
      packagingItemId: item.packagingItemId,
      productId: item.productId,
      productVariantId: item.productVariantId,
      quantity: Math.max(item.quantityOrdered - item.quantityReceived, 1),
      taxRateId: item.taxRateId,
      unitCost: item.unitCost,
      unitId: item.unitId,
    }));
}

function linesFromInvoice(invoice: PurchaseInvoice): PurchaseItemLineDraft[] {
  return invoice.items
    .filter(
      (item) =>
        item.lineType !== "account" &&
        item.itemType !== "account" &&
        (item.canReceive || item.quantityRemaining > 0),
    )
    .map((item) => ({
      batchNumber: item.batchNumber,
      discountAmount: item.discountAmount,
      expiryDate: item.expiryDate,
      ingredientId: item.ingredientId,
      itemType: "product",
      itemNameSnapshot: item.itemNameSnapshot,
      lineId: item.id || createUuid(),
      lineType: "product",
      packagingItemId: item.packagingItemId,
      productId: item.productId,
      productVariantId: item.productVariantId,
      quantity: Math.max(item.quantityRemaining, 0),
      taxRateId: item.taxRateId,
      unitCost: item.unitCost,
      unitId: item.unitId,
    }));
}

function updateLine(
  lines: PurchaseItemLineDraft[],
  lineId: string,
  patch: Partial<PurchaseItemLineDraft>,
): PurchaseItemLineDraft[] {
  return lines.map((line) => (line.lineId === lineId ? { ...line, ...patch } : line));
}

function lineAmount(line: PurchaseItemLineDraft): number {
  return Math.max(line.quantity * line.unitCost - line.discountAmount, 0);
}

function formatAmount(value: number): string {
  return value.toFixed(2);
}

export function PurchaseReceiveDialog({
  branches,
  invoice,
  isSubmitting,
  onClose,
  onReceive,
  open,
  order,
  products,
  suppliers,
  taxRates: _taxRates,
  units,
}: {
  branches: PurchasingBranchOption[];
  invoice?: PurchaseInvoice | null;
  isSubmitting: boolean;
  onClose: () => void;
  onReceive: (payload: ReceivePurchasePayload) => Promise<void>;
  open: boolean;
  order?: PurchaseOrder | null;
  products: PurchasingProductOption[];
  suppliers: PurchasingSupplierOption[];
  taxRates: PurchasingTaxRateOption[];
  units: PurchasingUnitOption[];
}): JSX.Element {
  const branchScope = useBranchScope();
  const [branchId, setBranchId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState("");
  const [receivedDate, setReceivedDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseItemLineDraft[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReceiveFormTabKey>("source");
  const sourceLocked = Boolean(order ?? invoice);
  const linkedPurchaseOrderLabel = order?.purchaseOrderNumber ?? invoice?.purchaseOrderNumber ?? "";
  const linkedPurchaseInvoiceLabel = invoice?.invoiceNumber ?? "";
  const selectedSourceBranchId = order?.branchId ?? invoice?.branchId;
  const selectableBranches = branches.filter(
    (branch) =>
      branch.id === selectedSourceBranchId ||
      (branchScope.canAccessAllBranches
        ? branch.status === "active"
        : branch.id === branchScope.effectiveBranchId),
  );
  const productOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      products.map((product) => ({
        description: [
          PRODUCT_TYPE_LABELS[product.productType],
          product.productCode,
          product.sku,
          product.unitSymbol,
        ]
          .filter(Boolean)
          .join(" / "),
        keywords: [
          product.productName,
          product.productCode,
          product.sku ?? "",
          product.barcode ?? "",
          PRODUCT_TYPE_LABELS[product.productType],
        ],
        label: product.productName,
        value: product.id,
      })),
    [products],
  );
  const unitOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      units.map((unit) => ({
        description: unit.symbol,
        keywords: [unit.unitName, unit.symbol],
        label: `${unit.unitName} (${unit.symbol})`,
        value: unit.id,
      })),
    [units],
  );

  useEffect(() => {
    if (!open) return;

    setBranchId(order?.branchId ?? invoice?.branchId ?? branchScope.effectiveBranchId ?? "");
    setSupplierId(order?.supplierId ?? invoice?.supplierId ?? "");
    setPurchaseOrderId(order?.id ?? invoice?.purchaseOrderId ?? "");
    setPurchaseInvoiceId(invoice?.id ?? "");
    setReceivedDate(today());
    setNotes("");
    if (order?.items.length) {
      const orderLines = linesFromOrder(order);
      setLines(orderLines.length > 0 ? orderLines : [emptyLine()]);
    } else if (invoice?.items.length) {
      const invoiceLines = linesFromInvoice(invoice);
      setLines(invoiceLines.length > 0 ? invoiceLines : [emptyLine()]);
    } else {
      setLines([emptyLine()]);
    }
    setError(null);
    // Every opening starts on Source, whichever tab the last one closed on.
    setActiveTab("source");
  }, [branchScope.effectiveBranchId, invoice, open, order]);

  const submit = async (): Promise<void> => {
    const result = purchaseReceiveSchema.safeParse({
      branchId,
      items: lines,
      notes,
      purchaseInvoiceId,
      purchaseOrderId,
      receivedDate,
      supplierId,
    });

    if (!result.success) {
      // A failed check switches to the tab that holds the problem before the
      // banner explains it; a hidden error is otherwise a silent no-op.
      const issue = result.error.issues[0];
      setActiveTab(tabForField(issue?.path[0]));
      setError(issue?.message ?? "Please check the receive form.");
      return;
    }

    await onReceive(result.data);
  };

  const formTabs: FormTab<ReceiveFormTabKey>[] = [
    { key: "source", label: "Source" },
    { key: "items", label: "Items", badge: lines.length },
  ];

  const renderItemCell = (line: PurchaseItemLineDraft): JSX.Element => {
    const selectedProduct = products.find((product) => product.id === line.productId) ?? null;

    if (sourceLocked) {
      return (
        <div className="min-w-0">
          <p className="truncate font-semibold text-brand-espresso">
            {line.itemNameSnapshot ?? selectedProduct?.productName ?? "Product"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-brand-mocha">
            <span className="rounded bg-brand-cappuccino/60 px-1.5 py-0.5 font-semibold text-brand-espresso">
              {selectedProduct ? PRODUCT_TYPE_LABELS[selectedProduct.productType] : "Product"}
            </span>
            {selectedProduct?.productCode ? <span>{selectedProduct.productCode}</span> : null}
          </div>
        </div>
      );
    }

    return (
      <SearchableCombobox
        emptyMessage="No matching Product Master items found."
        onValueChange={(productId) => {
          const selected = products.find((product) => product.id === productId);
          setLines(
            updateLine(lines, line.lineId, {
              ingredientId: null,
              itemNameSnapshot: productId.length === 0 ? null : (selected?.productName ?? null),
              itemType: "product",
              lineType: "product",
              packagingItemId: null,
              productId: productId.length === 0 ? null : productId,
              productVariantId: null,
              unitCost: selected?.costPrice ?? line.unitCost,
              unitId: selected?.unitId ?? line.unitId,
            }),
          );
        }}
        options={productOptions}
        placeholder="Select Product Master item"
        searchPlaceholder="Search product, code, SKU, barcode..."
        triggerClassName="h-10"
        value={line.productId ?? ""}
      />
    );
  };

  const renderUnitCell = (line: PurchaseItemLineDraft): JSX.Element => {
    const selectedUnit = units.find((unit) => unit.id === line.unitId);

    if (sourceLocked) {
      return (
        <div className="flex h-10 items-center rounded-md border border-brand-cappuccino/70 bg-brand-latte/40 px-3 text-sm font-semibold text-brand-espresso">
          {selectedUnit?.symbol ?? selectedUnit?.unitName ?? "Unit"}
        </div>
      );
    }

    return (
      <SearchableCombobox
        emptyMessage="No matching units found."
        onValueChange={(unitId) => setLines(updateLine(lines, line.lineId, { unitId }))}
        options={unitOptions}
        placeholder="Select unit"
        searchPlaceholder="Search unit..."
        triggerClassName="h-10"
        value={line.unitId}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-[1280px] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-brand-cappuccino/70 px-6 pt-6 pb-4">
          <DialogTitle>Receive stock</DialogTitle>
          <DialogDescription>
            Confirm supplier stock-in. Stock is received into the branch default location unless an
            advanced workflow overrides it. Accounting inventory updates when the supplier bill is
            posted.
          </DialogDescription>
        </DialogHeader>

        {/* Two tabs on one state: where the stock came from, and what
            physically arrived. Nothing typed on one is lost on the other. */}
        <div className="shrink-0 border-b border-brand-cappuccino/70 px-6 py-3">
          <FormTabs
            active={activeTab}
            aria-label="Receive goods sections"
            onTabChange={setActiveTab}
            panelId={FORM_TABPANEL_ID}
            tabs={formTabs}
          />
        </div>

        <div
          className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-6 py-5"
          id={FORM_TABPANEL_ID}
          role="tabpanel"
          tabIndex={-1}
        >
          {/* Every control carries a visible label: two of these render as
              bare dropdowns, and the date input shows dd/mm/yyyy with nothing
              on screen naming it. */}
          <div
            className={
              activeTab === "source" ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "hidden"
            }
          >
            <div className="grid gap-1.5">
              <Label htmlFor="receive-branch">Branch</Label>
              <Select
                value={branchId || "none"}
                onValueChange={(value) => setBranchId(value === "none" ? "" : value)}
              >
                <SelectTrigger id="receive-branch">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select branch</SelectItem>
                  {selectableBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.branchName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="receive-supplier">Supplier</Label>
              <SupplierLookupSelect
                id="receive-supplier"
                onValueChange={setSupplierId}
                suppliers={suppliers}
                value={supplierId}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="receive-date">Received date</Label>
              <Input
                id="receive-date"
                onChange={(event) => setReceivedDate(event.target.value)}
                type="date"
                value={receivedDate}
              />
            </div>
            {purchaseOrderId ? (
              <div className="flex h-10 items-center rounded-md border border-input bg-brand-latte/40 px-3 text-sm text-brand-espresso">
                <span className="mr-2 text-brand-mocha">Linked PO</span>
                <span className="font-semibold">
                  {linkedPurchaseOrderLabel || "PO number unavailable"}
                </span>
              </div>
            ) : null}
            {purchaseInvoiceId ? (
              <div className="flex h-10 items-center rounded-md border border-input bg-brand-latte/40 px-3 text-sm text-brand-espresso">
                <span className="mr-2 text-brand-mocha">Linked Bill</span>
                <span className="font-semibold">
                  {linkedPurchaseInvoiceLabel || "Bill number unavailable"}
                </span>
              </div>
            ) : null}
            <div className="grid gap-1.5 md:col-span-2 xl:col-span-3">
              <Label htmlFor="receive-notes">Notes</Label>
              <Input
                id="receive-notes"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Delivery note reference, or anything to remember"
                value={notes}
              />
            </div>
          </div>

          <section
            className={
              activeTab === "items"
                ? "rounded-xl border border-brand-cappuccino/70 bg-card shadow-sm"
                : "hidden"
            }
          >
            <div className="border-b border-brand-cappuccino/70 px-4 py-3">
              <h3 className="text-sm font-semibold text-brand-espresso">Items to receive</h3>
              <p className="text-sm text-brand-mocha">
                Confirm quantity, batch, and expiry for product rows only.
              </p>
            </div>

            <div className="hidden lg:block">
              <div className="grid grid-cols-[minmax(220px,1.5fr)_110px_110px_110px_140px_150px_96px_44px] gap-3 border-b border-brand-cappuccino/70 bg-brand-latte/30 px-4 py-2 text-xs font-semibold text-brand-mocha">
                <span>Item</span>
                <span className="text-right">Qty</span>
                <span>Unit</span>
                <span className="text-right">Rate</span>
                <span>Batch</span>
                <span>Expiry</span>
                <span className="text-right">Amount</span>
                <span aria-label="Actions" />
              </div>
              <div className="divide-y divide-brand-cappuccino/70">
                {lines.map((line, index) => (
                  <div
                    className="grid grid-cols-[minmax(220px,1.5fr)_110px_110px_110px_140px_150px_96px_44px] items-start gap-3 px-4 py-3"
                    key={line.lineId}
                  >
                    {renderItemCell(line)}
                    <Input
                      aria-label={`Quantity for receive line ${String(index + 1)}`}
                      className="h-10 text-right"
                      min="0"
                      onChange={(event) =>
                        setLines(
                          updateLine(lines, line.lineId, {
                            quantity: Number(event.target.value),
                          }),
                        )
                      }
                      type="number"
                      value={line.quantity}
                    />
                    {renderUnitCell(line)}
                    <Input
                      aria-label={`Rate for receive line ${String(index + 1)}`}
                      className="h-10 text-right"
                      disabled={sourceLocked}
                      min="0"
                      onChange={(event) =>
                        setLines(
                          updateLine(lines, line.lineId, {
                            unitCost: Number(event.target.value),
                          }),
                        )
                      }
                      type="number"
                      value={line.unitCost}
                    />
                    <Input
                      aria-label={`Batch number for receive line ${String(index + 1)}`}
                      className="h-10"
                      onChange={(event) =>
                        setLines(
                          updateLine(lines, line.lineId, {
                            batchNumber: event.target.value || null,
                          }),
                        )
                      }
                      placeholder="Optional"
                      value={line.batchNumber ?? ""}
                    />
                    <Input
                      aria-label={`Expiry date for receive line ${String(index + 1)}`}
                      className="h-10"
                      onChange={(event) =>
                        setLines(
                          updateLine(lines, line.lineId, {
                            expiryDate: event.target.value || null,
                          }),
                        )
                      }
                      type="date"
                      value={line.expiryDate ?? ""}
                    />
                    <div className="flex h-10 items-center justify-end text-sm font-semibold text-brand-espresso">
                      {formatAmount(lineAmount(line))}
                    </div>
                    <Button
                      aria-label={`Remove receive line ${String(index + 1)}`}
                      disabled={sourceLocked || lines.length === 1}
                      onClick={() => setLines(lines.filter((item) => item.lineId !== line.lineId))}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4 text-danger-text" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {lines.map((line, index) => (
                <div
                  className="space-y-3 rounded-lg border border-brand-cappuccino/70 bg-brand-latte/20 p-3"
                  key={line.lineId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">{renderItemCell(line)}</div>
                    <Button
                      aria-label={`Remove receive line ${String(index + 1)}`}
                      disabled={sourceLocked || lines.length === 1}
                      onClick={() => setLines(lines.filter((item) => item.lineId !== line.lineId))}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4 text-danger-text" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold text-brand-mocha">Quantity</p>
                      <Input
                        aria-label={`Quantity for receive line ${String(index + 1)}`}
                        min="0"
                        onChange={(event) =>
                          setLines(
                            updateLine(lines, line.lineId, {
                              quantity: Number(event.target.value),
                            }),
                          )
                        }
                        type="number"
                        value={line.quantity}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-brand-mocha">Unit</p>
                      {renderUnitCell(line)}
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-brand-mocha">Rate</p>
                      <Input
                        aria-label={`Rate for receive line ${String(index + 1)}`}
                        disabled={sourceLocked}
                        min="0"
                        onChange={(event) =>
                          setLines(
                            updateLine(lines, line.lineId, {
                              unitCost: Number(event.target.value),
                            }),
                          )
                        }
                        type="number"
                        value={line.unitCost}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-brand-mocha">Batch</p>
                      <Input
                        aria-label={`Batch number for receive line ${String(index + 1)}`}
                        onChange={(event) =>
                          setLines(
                            updateLine(lines, line.lineId, {
                              batchNumber: event.target.value || null,
                            }),
                          )
                        }
                        placeholder="Optional"
                        value={line.batchNumber ?? ""}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-brand-mocha">Expiry</p>
                      <Input
                        aria-label={`Expiry date for receive line ${String(index + 1)}`}
                        onChange={(event) =>
                          setLines(
                            updateLine(lines, line.lineId, {
                              expiryDate: event.target.value || null,
                            }),
                          )
                        }
                        type="date"
                        value={line.expiryDate ?? ""}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-brand-mocha">Amount</p>
                      <div className="flex h-10 items-center rounded-md border border-brand-cappuccino/70 bg-card px-3 text-sm font-semibold text-brand-espresso">
                        {formatAmount(lineAmount(line))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!sourceLocked ? (
              <div className="border-t border-brand-cappuccino/70 px-4 py-3">
                <Button
                  className="px-0 text-info-text"
                  onClick={() => setLines([...lines, emptyLine()])}
                  type="button"
                  variant="link"
                >
                  <Plus className="h-4 w-4" />
                  Add product row
                </Button>
              </div>
            ) : null}
          </section>

          {error ? <p className="text-cell font-medium text-danger-text">{error}</p> : null}
        </div>

        <DialogFooter className="border-t border-brand-cappuccino/70 px-6 py-4">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={() => void submit()} type="button">
            Receive stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
