"use client";

import type { JSX, ReactNode } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
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

function Field({
  children,
  htmlFor,
  label,
  required = false,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
  required?: boolean;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <Label className="text-meta" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger-text">
            {" "}
            *
          </span>
        ) : null}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
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
  // W3: "" = business default on create; edits carry the stored mode.
  const [taxMode, setTaxMode] = useState<"" | "inclusive" | "exclusive" | "no_tax">("");
  const { hasPermission } = usePermission();
  const canApplyNoTax = hasPermission(PERMISSIONS.salesNoTaxApply);
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
    setTaxMode(invoice?.taxMode ?? "");
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
      taxMode: taxMode === "" ? null : taxMode,
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
          <div className="rounded-lg border border-warning/30 bg-warning-tint px-3 py-2 text-sm text-warning-text">
            Editing a posted bill will update payable/accounting records. Bills with payments,
            vendor credits, or received stock cannot be edited.
          </div>
        ) : null}
        {/* Every field carries a visible label. This dialog had none at all --
            six controls identified by aria-label and placeholder only, and two
            of them are adjacent type=date inputs that both render dd/mm/yyyy,
            so nothing on screen said which was the bill date and which was the
            due date. Create Purchase Order labels everything; so does this. */}
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Field htmlFor="bill-branch" label="Branch" required>
            <Select
              value={branchId || "none"}
              onValueChange={(value) => setBranchId(value === "none" ? "" : value)}
            >
              <SelectTrigger className="h-9 text-xs" id="bill-branch">
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
          </Field>
          <Field htmlFor="bill-supplier" label="Supplier" required>
            <div id="bill-supplier">
              <SupplierLookupSelect
                onValueChange={setSupplierId}
                suppliers={suppliers}
                value={supplierId}
              />
            </div>
          </Field>
          {purchaseOrderId ? (
            <div className="flex h-9 items-center rounded-md border border-input bg-brand-latte/40 px-3 text-xs text-brand-espresso">
              <span className="mr-2 text-brand-mocha">Linked PO</span>
              <span className="font-semibold">{linkedPurchaseOrderLabel}</span>
            </div>
          ) : null}
          <Field htmlFor="bill-number" label="Bill number">
            <Input
              className="h-9 text-xs"
              id="bill-number"
              onChange={(event) => setInvoiceNumber(event.target.value)}
              placeholder="Internal bill number"
              value={invoiceNumber}
            />
          </Field>
          <Field htmlFor="bill-date" label="Bill date" required>
            <Input
              className="h-9 text-xs"
              id="bill-date"
              onChange={(event) => setInvoiceDate(event.target.value)}
              type="date"
              value={invoiceDate}
            />
          </Field>
          <Field htmlFor="bill-due-date" label="Due date">
            <Input
              className="h-9 text-xs"
              id="bill-due-date"
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
          </Field>
          <Field htmlFor="bill-vat-mode" label="VAT mode">
            <Select
              onValueChange={(value) =>
                setTaxMode(value === "default" ? "" : (value as typeof taxMode))
              }
              value={taxMode === "" ? "default" : taxMode}
            >
              <SelectTrigger className="h-9 text-xs" id="bill-vat-mode">
                <SelectValue placeholder="VAT mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">VAT: Business default</SelectItem>
                <SelectItem value="inclusive">VAT: Inclusive</SelectItem>
                <SelectItem value="exclusive">VAT: Exclusive</SelectItem>
                {canApplyNoTax ? <SelectItem value="no_tax">VAT: No tax</SelectItem> : null}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <PurchasingItemLineEditor
          accounts={accounts}
          allowBatchFields
          compactLayout
          extrasDefaultOpen
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
        <Field htmlFor="bill-notes" label="Notes">
          <Textarea
            className="min-h-[42px] text-xs"
            id="bill-notes"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Supplier reference, delivery notes, or anything to remember"
            value={notes}
          />
        </Field>
        {error ? <p className="text-sm font-semibold text-danger-text">{error}</p> : null}
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
