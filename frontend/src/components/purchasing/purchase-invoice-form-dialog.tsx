"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";

import { PurchasingItemLineEditor } from "@/components/purchasing/purchasing-item-line-editor";
import { SupplierLookupSelect } from "@/components/purchasing/supplier-lookup-select";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { createUuid } from "@/lib/uuid";
import { purchaseInvoiceSchema } from "@/lib/validators/purchasing.schema";
import type { ChartAccount } from "@/types/accounting";
import type {
  CreatePurchaseInvoicePayload,
  PurchaseInvoice,
  PurchaseItemLineDraft,
  PurchasingBranchOption,
  PurchasingProductOption,
  PurchasingSupplierOption,
  PurchasingTaxRateOption,
  PurchasingUnitOption,
  UpdatePurchaseInvoicePayload,
} from "@/types/purchasing";

export type PurchaseInvoiceFormInitialValues = {
  billDiscountAmount?: number;
  branchId: string;
  dueDate?: string | null;
  invoiceDate?: string | null;
  invoiceNumber?: string;
  items: PurchaseItemLineDraft[];
  notes?: string | null;
  purchaseOrderId?: string | null;
  purchaseOrderNumber?: string | null;
  supplierId: string;
};

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
    lineType: "product",
    lineId: createUuid(),
    packagingItemId: null,
    productId: null,
    productVariantId: null,
    quantity: 1,
    taxRateId: null,
    unitCost: 0,
    unitId: "",
  };
}

export function PurchaseInvoiceFormDialog({
  accounts,
  branches,
  createButtonLabel = "Create bill",
  createDescription = "Record supplier bill totals. Backend posting remains the final authority.",
  createTitle = "Create bill",
  initialValues,
  invoice,
  isSubmitting,
  onClose,
  onCreate,
  onUpdate,
  open,
  products,
  suppliers,
  taxRates,
  units,
}: {
  accounts: ChartAccount[];
  branches: PurchasingBranchOption[];
  createButtonLabel?: string;
  createDescription?: string;
  createTitle?: string;
  initialValues?: PurchaseInvoiceFormInitialValues | null;
  invoice: PurchaseInvoice | null;
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (payload: CreatePurchaseInvoicePayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdatePurchaseInvoicePayload) => Promise<void>;
  open: boolean;
  products: PurchasingProductOption[];
  suppliers: PurchasingSupplierOption[];
  taxRates: PurchasingTaxRateOption[];
  units: PurchasingUnitOption[];
}): JSX.Element {
  const branchScope = useBranchScope();
  const [branchId, setBranchId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [billDiscountAmount, setBillDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseItemLineDraft[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const selectableBranches = branches.filter(
    (branch) =>
      branch.id === invoice?.branchId ||
      (branchScope.canAccessAllBranches
        ? branch.status === "active"
        : branch.id === branchScope.effectiveBranchId),
  );

  useEffect(() => {
    if (!open) return;

    const source: PurchaseInvoiceFormInitialValues | null | undefined = invoice
      ? {
          billDiscountAmount: invoice.billDiscountAmount,
          branchId: invoice.branchId,
          dueDate: invoice.dueDate,
          invoiceDate: invoice.invoiceDate,
          invoiceNumber: invoice.invoiceNumber,
          items: invoice.items.map((item) => ({
            accountId: item.accountId,
            batchNumber: item.batchNumber,
            description: item.description,
            discountAmount: item.discountAmount,
            expiryDate: item.expiryDate,
            ingredientId: item.ingredientId,
            itemType: item.lineType === "account" ? ("account" as const) : ("product" as const),
            itemNameSnapshot: item.itemNameSnapshot,
            lineId: item.id || createUuid(),
            lineType: item.lineType,
            packagingItemId: item.packagingItemId,
            productId: item.productId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            taxRateId: item.taxRateId,
            unitCost: item.unitCost,
            unitId: item.unitId,
          })),
          notes: invoice.notes,
          purchaseOrderId: invoice.purchaseOrderId,
          purchaseOrderNumber: invoice.purchaseOrderNumber,
          supplierId: invoice.supplierId,
        }
      : initialValues;

    setBranchId(source?.branchId ?? branchScope.effectiveBranchId ?? "");
    setSupplierId(source?.supplierId ?? "");
    setPurchaseOrderId(source?.purchaseOrderId ?? "");
    setPurchaseOrderNumber(source?.purchaseOrderNumber ?? "");
    setInvoiceNumber(source?.invoiceNumber ?? "");
    setInvoiceDate(source?.invoiceDate ? source.invoiceDate.slice(0, 10) : today());
    setDueDate(source?.dueDate?.slice(0, 10) ?? "");
    setBillDiscountAmount(source?.billDiscountAmount ?? 0);
    setNotes(source?.notes ?? "");
    setLines(
      source?.items.length
        ? source.items.map((item) => ({ ...item, lineId: item.lineId || createUuid() }))
        : [emptyLine()],
    );
    setError(null);
  }, [branchScope.effectiveBranchId, initialValues, invoice, open]);

  const linkedPurchaseOrderLabel =
    purchaseOrderNumber || (purchaseOrderId ? "PO number unavailable" : "");
  const isPostedEdit = invoice?.status === "posted";

  const submit = async (): Promise<void> => {
    const result = purchaseInvoiceSchema.safeParse({
      branchId,
      dueDate,
      invoiceDate,
      invoiceNumber,
      items: lines,
      billDiscountAmount,
      notes,
      purchaseOrderId,
      supplierId,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please check the bill form.");
      return;
    }

    if (invoice) {
      await onUpdate(invoice.id, result.data);
    } else {
      await onCreate(result.data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="flex max-h-[92vh] max-w-[min(96vw,1500px)] flex-col gap-3 overflow-hidden p-4">
        <DialogHeader>
          <DialogTitle>{invoice ? "Edit bill" : createTitle}</DialogTitle>
          <DialogDescription>
            {invoice
              ? "Record supplier bill totals. Backend posting remains the final authority."
              : createDescription}
          </DialogDescription>
        </DialogHeader>
        {isPostedEdit ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Editing a posted bill will update payable/accounting records. Bills with payments,
            vendor credits, or received stock cannot be edited.
          </div>
        ) : null}
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Select
            value={branchId || "none"}
            onValueChange={(value) => setBranchId(value === "none" ? "" : value)}
          >
            <SelectTrigger className="h-9 text-xs">
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
          <SupplierLookupSelect
            onValueChange={setSupplierId}
            suppliers={suppliers}
            value={supplierId}
          />
          {purchaseOrderId ? (
            <div className="flex h-9 items-center rounded-md border border-input bg-brand-latte/40 px-3 text-xs text-brand-espresso">
              <span className="mr-2 text-brand-mocha">Linked PO</span>
              <span className="font-semibold">{linkedPurchaseOrderLabel}</span>
            </div>
          ) : null}
          <Input
            aria-label="Bill number"
            className="h-9 text-xs"
            onChange={(event) => setInvoiceNumber(event.target.value)}
            placeholder="Internal bill number"
            value={invoiceNumber}
          />
          <Input
            aria-label="Bill date"
            className="h-9 text-xs"
            onChange={(event) => setInvoiceDate(event.target.value)}
            type="date"
            value={invoiceDate}
          />
          <Input
            aria-label="Due date"
            className="h-9 text-xs"
            onChange={(event) => setDueDate(event.target.value)}
            type="date"
            value={dueDate}
          />
        </div>
        <PurchasingItemLineEditor
          accounts={accounts}
          allowBatchFields
          billDiscountAmount={billDiscountAmount}
          legacyChargeAmount={invoice?.chargeAmount ?? 0}
          legacyChargeTaxAmount={invoice?.chargeTaxAmount ?? 0}
          lines={lines}
          onBillDiscountAmountChange={setBillDiscountAmount}
          onLinesChange={setLines}
          paidAmount={invoice?.paidAmount ?? 0}
          products={products}
          showAccountRows
          taxRates={taxRates}
          units={units}
        />
        <Input
          aria-label="Notes"
          className="h-9 text-xs"
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes"
          value={notes}
        />
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={() => void submit()} type="button">
            {invoice ? "Save bill" : createButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
