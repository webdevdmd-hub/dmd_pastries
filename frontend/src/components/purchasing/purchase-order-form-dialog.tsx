"use client";

import { AlertTriangle } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useEffect, useState } from "react";

import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
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
import { useBranchScope } from "@/hooks/use-branch-scope";
import { cn } from "@/lib/utils/cn";
import { createUuid } from "@/lib/uuid";
import { purchaseOrderSchema } from "@/lib/validators/purchasing.schema";
import type { ChartAccount } from "@/types/accounting";
import type {
  CreatePurchaseOrderPayload,
  CreatePurchaseOrderRevisionPayload,
  PurchaseItemLineDraft,
  PurchaseOrder,
  PurchasingBranchOption,
  PurchasingProductOption,
  PurchasingSupplierOption,
  PurchasingTaxRateOption,
  PurchasingUnitOption,
  UpdatePurchaseOrderPayload,
} from "@/types/purchasing";

type FormFieldName =
  | "branchId"
  | "supplierId"
  | "orderDate"
  | "expectedDeliveryDate"
  | "notes"
  | "items";

type FormError = {
  field: FormFieldName | null;
  message: string;
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function resolveErrorField(path: (number | string)[] | undefined): FormFieldName | null {
  const key = path?.[0];

  if (
    key === "branchId" ||
    key === "supplierId" ||
    key === "orderDate" ||
    key === "expectedDeliveryDate" ||
    key === "notes" ||
    key === "items"
  ) {
    return key;
  }

  return null;
}

function lockedFieldReason(isPartialAdjustment: boolean, isCorrectionEdit: boolean): string | null {
  if (isPartialAdjustment) return "Locked while adjusting a partially received order.";
  if (isCorrectionEdit)
    return "Locked for correction edits — only items, delivery date, and notes can change.";
  return null;
}

function RequiredMark(): JSX.Element {
  return (
    <span aria-hidden="true" className="text-red-600">
      {" "}
      *
    </span>
  );
}

function FieldError({ message }: { message?: string | undefined }): JSX.Element | null {
  if (!message) return null;

  return <p className="mt-1.5 text-xs font-medium text-red-700">{message}</p>;
}

function FieldHint({ children }: { children: ReactNode }): JSX.Element {
  return <p className="mt-1.5 text-xs text-workspace-muted">{children}</p>;
}

function FormSection({
  children,
  description,
  required = false,
  title,
}: {
  children: ReactNode;
  description?: string;
  required?: boolean;
  title: string;
}): JSX.Element {
  return (
    <section className="rounded-md border border-workspace-border bg-white">
      <div className="border-b border-workspace-border px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-workspace-muted">
          {title}
          {required ? <RequiredMark /> : null}
        </p>
        {description ? <p className="mt-1 text-sm text-brand-mocha">{description}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function StepBadge({
  active,
  label,
  step,
}: {
  active: boolean;
  label: string;
  step: number;
}): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        active
          ? "border-brand-espresso bg-brand-espresso text-white"
          : "border-workspace-border bg-white text-workspace-muted",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
          active ? "bg-white/25" : "bg-workspace-border/70",
        )}
      >
        {step}
      </span>
      {label}
    </span>
  );
}

function ReviewFigure({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "increase" | "decrease";
  value: string;
}): JSX.Element {
  return (
    <div className="rounded-md border border-workspace-border bg-brand-latte/30 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-workspace-muted">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-bold tabular-nums",
          tone === "increase"
            ? "text-red-700"
            : tone === "decrease"
              ? "text-emerald-700"
              : "text-brand-espresso",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function PurchaseOrderFormDialog({
  accounts,
  branches,
  isSubmitting,
  onClose,
  onCreate,
  onRevise,
  onUpdate,
  open,
  order,
  products,
  suppliers,
  taxRates,
  units,
}: {
  accounts: ChartAccount[];
  branches: PurchasingBranchOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (payload: CreatePurchaseOrderPayload) => Promise<void>;
  onRevise?: (id: string, payload: CreatePurchaseOrderRevisionPayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdatePurchaseOrderPayload) => Promise<void>;
  open: boolean;
  order: PurchaseOrder | null;
  products: PurchasingProductOption[];
  suppliers: PurchasingSupplierOption[];
  taxRates: PurchasingTaxRateOption[];
  units: PurchasingUnitOption[];
}): JSX.Element {
  const branchScope = useBranchScope();
  const [branchId, setBranchId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(today());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseItemLineDraft[]>([emptyLine()]);
  const [error, setError] = useState<FormError | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [pendingRevisionPayload, setPendingRevisionPayload] =
    useState<CreatePurchaseOrderRevisionPayload | null>(null);
  const isPartialAdjustment = order?.status === "partially_received";
  const isCorrectionEdit = order?.status === "received";
  const hasAccountRows = lines.some(
    (line) => line.lineType === "account" || line.itemType === "account" || Boolean(line.accountId),
  );
  const showAccountRows = (!isPartialAdjustment && !isCorrectionEdit) || hasAccountRows;
  const lineLocks =
    order?.status === "partially_received" || order?.status === "received"
      ? Object.fromEntries(
          order.items.map((item) => [
            item.id,
            { minQuantity: item.quantityReceived, receivedQuantity: item.quantityReceived },
          ]),
        )
      : {};
  const selectableBranches = branches.filter(
    (branch) =>
      branch.id === order?.branchId ||
      (branchScope.canAccessAllBranches
        ? branch.status === "active"
        : branch.id === branchScope.effectiveBranchId),
  );

  useEffect(() => {
    if (!open) return;

    setBranchId(order?.branchId ?? branchScope.effectiveBranchId ?? "");
    setSupplierId(order?.supplierId ?? "");
    setOrderDate(order ? order.orderDate.slice(0, 10) : today());
    setExpectedDeliveryDate(order?.expectedDeliveryDate?.slice(0, 10) ?? "");
    setNotes(order?.notes ?? "");
    setLines(
      order?.items.length
        ? order.items.map((item) => ({
            id: item.id,
            accountId: item.accountId,
            batchNumber: null,
            description: item.description,
            discountAmount: item.discountAmount,
            expiryDate: null,
            ingredientId: item.ingredientId,
            itemType: item.lineType === "account" ? ("account" as const) : ("product" as const),
            itemNameSnapshot: item.itemNameSnapshot,
            lineId: item.id || createUuid(),
            lineType: item.lineType,
            packagingItemId: item.packagingItemId,
            productId: item.productId,
            productVariantId: item.productVariantId,
            quantity: item.quantityOrdered,
            taxRateId: item.taxRateId,
            unitCost: item.unitCost,
            unitId: item.unitId,
          }))
        : [emptyLine()],
    );
    setError(null);
    setLineErrors({});
    setPendingRevisionPayload(null);
  }, [branchScope.effectiveBranchId, open, order]);

  const estimatedRevisedTotal = lines.reduce((sum, line) => {
    const subtotal = Math.max(line.quantity * line.unitCost - line.discountAmount, 0);
    const taxRate = taxRates.find((rate) => rate.id === line.taxRateId);
    const tax = taxRate ? (subtotal * taxRate.taxPercentage) / 100 : 0;
    return sum + subtotal + tax;
  }, 0);
  const revisionDifference = estimatedRevisedTotal - (order?.totalAmount ?? 0);

  const submit = async (): Promise<void> => {
    setLineErrors({});

    if (isPartialAdjustment || isCorrectionEdit) {
      const missingExistingLine = lines.find((line) => !line.id);
      if (missingExistingLine) {
        setError({
          field: "items",
          message:
            "Correction edits can only update existing purchase order lines. Add new items using a new purchase order or a supported adjustment flow.",
        });
        return;
      }

      const existingIds = new Set(order.items.map((item) => item.id));
      const submittedIds = new Set(lines.map((line) => line.id).filter(Boolean));
      if (existingIds.size !== submittedIds.size) {
        setError({
          field: "items",
          message: "Correction edits cannot add or remove purchase order lines.",
        });
        return;
      }

      const invalidLine = lines.find((line) => {
        const lock = lineLocks[line.lineId];
        return lock ? line.quantity < lock.minQuantity : true;
      });

      if (invalidLine) {
        const message =
          "Correction quantities cannot be reduced below the already received quantity.";
        setLineErrors({ [invalidLine.lineId]: message });
        setError({ field: "items", message });
        return;
      }
    }

    const result = purchaseOrderSchema.safeParse({
      branchId,
      expectedDeliveryDate,
      items: lines,
      notes,
      orderDate,
      supplierId,
    });

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      setError({
        field: resolveErrorField(firstIssue?.path),
        message: firstIssue?.message ?? "Please check the order form.",
      });
      return;
    }

    if (order && isCorrectionEdit) {
      if (!onRevise) {
        setError({
          field: null,
          message: "Correction edit is not available for this purchase order.",
        });
        return;
      }
      setPendingRevisionPayload({
        ...result.data,
        paymentExcessAction: "supplier_advance",
        reason: "PO correction edit",
      });
      return;
    }

    if (order) {
      await onUpdate(order.id, result.data);
    } else {
      await onCreate(result.data);
    }
  };

  const confirmRevision = async (): Promise<void> => {
    if (!order || !pendingRevisionPayload || !onRevise) return;
    await onRevise(order.id, pendingRevisionPayload);
  };

  const fieldsDisabled = isPartialAdjustment || isCorrectionEdit;
  const lockReason = lockedFieldReason(isPartialAdjustment, isCorrectionEdit);
  const branchFieldError = error?.field === "branchId" ? error.message : undefined;
  const supplierFieldError = error?.field === "supplierId" ? error.message : undefined;
  const orderDateFieldError = error?.field === "orderDate" ? error.message : undefined;
  const expectedDeliveryFieldError =
    error?.field === "expectedDeliveryDate" ? error.message : undefined;
  const notesFieldError = error?.field === "notes" ? error.message : undefined;
  const itemsFieldError = error?.field === "items" ? error.message : undefined;
  const generalFieldError = error?.field === null ? error.message : undefined;
  const isReviewStep = Boolean(pendingRevisionPayload);
  const isOrderedEdit = !fieldsDisabled && order?.status === "ordered";

  const titleText = isPartialAdjustment
    ? "Adjust remaining purchase order"
    : isCorrectionEdit
      ? "Edit with correction"
      : order
        ? "Edit purchase order"
        : "Create purchase order";
  const descriptionText = isPartialAdjustment
    ? "Adjust unreceived quantities, expected delivery, and notes. Received history stays locked."
    : isCorrectionEdit
      ? "Review the edited PO, then save a revision. Posted stock, bills, journals, and payments stay unchanged."
      : order?.status === "ordered"
        ? "Update this issued purchase order before receiving goods. It remains issued after saving."
        : "Draft supplier orders with product lines, tax, discount, and delivery dates.";
  const submitLabel = pendingRevisionPayload
    ? isSubmitting
      ? "Saving revision..."
      : "Save revision and apply corrections"
    : isCorrectionEdit
      ? "Review impact"
      : isPartialAdjustment
        ? "Save adjustment"
        : order
          ? "Save order"
          : "Create order";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-md p-0 sm:max-w-7xl sm:rounded-md">
        <DialogHeader className="shrink-0 border-b border-workspace-border px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-2xl">{titleText}</DialogTitle>
              {order ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-brand-mocha">
                  <span className="font-semibold text-brand-espresso">
                    {order.purchaseOrderNumber}
                  </span>
                  <PurchaseOrderStatusBadge status={order.status} />
                  <span>
                    {order.supplierName} · {order.branchName}
                  </span>
                </div>
              ) : null}
            </div>
            {isCorrectionEdit ? (
              <div className="flex shrink-0 items-center gap-2">
                <StepBadge active={!isReviewStep} label="Edit" step={1} />
                <span aria-hidden="true" className="h-px w-4 bg-workspace-border" />
                <StepBadge active={isReviewStep} label="Review impact" step={2} />
              </div>
            ) : null}
          </div>
          <DialogDescription
            className={cn(
              "text-sm leading-5",
              isOrderedEdit
                ? "mt-1 inline-flex w-fit items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-900"
                : undefined,
            )}
          >
            {descriptionText}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {isReviewStep ? (
            <FormSection
              description="Confirm the recalculated totals before saving this correction as a new revision."
              title="Review revision impact"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <ReviewFigure
                  label="Original PO total"
                  value={formatCurrency(order?.totalAmount ?? 0)}
                />
                <ReviewFigure
                  label="New estimated total"
                  value={formatCurrency(estimatedRevisedTotal)}
                />
                <ReviewFigure
                  label="Difference"
                  tone={revisionDifference >= 0 ? "increase" : "decrease"}
                  value={`${revisionDifference >= 0 ? "+" : "-"}${formatCurrency(Math.abs(revisionDifference))}`}
                />
              </div>
              <p className="mt-3 text-xs text-workspace-muted">
                Applies to {lines.length} item line{lines.length === 1 ? "" : "s"} on{" "}
                {order?.purchaseOrderNumber ?? "this order"}.
              </p>
              <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                />
                <p className="text-sm text-amber-900">
                  Posted GRNs, stock movements, bills, journals, and payments will not be rewritten.
                  The backend will save a PO revision and keep correction impact visible for
                  follow-up.
                </p>
              </div>
            </FormSection>
          ) : (
            <>
              {generalFieldError ? (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="font-medium">{generalFieldError}</p>
                </div>
              ) : null}

              <FormSection
                description="Who this order is for, and where it will be received."
                title="Order details"
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label htmlFor="po-branch">
                      Branch
                      <RequiredMark />
                    </Label>
                    <Select
                      disabled={fieldsDisabled}
                      value={branchId || "none"}
                      onValueChange={(value) => setBranchId(value === "none" ? "" : value)}
                    >
                      <SelectTrigger className="mt-1.5 h-10" id="po-branch">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No branch selected</SelectItem>
                        {selectableBranches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.branchName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {lockReason ? <FieldHint>{lockReason}</FieldHint> : null}
                    {selectableBranches.length === 0 ? (
                      <FieldHint>
                        No branches available for your access — contact an administrator.
                      </FieldHint>
                    ) : null}
                    <FieldError message={branchFieldError} />
                  </div>
                  <div>
                    <Label htmlFor="po-supplier">
                      Supplier
                      <RequiredMark />
                    </Label>
                    <div className="mt-1.5" id="po-supplier">
                      <SupplierLookupSelect
                        disabled={fieldsDisabled}
                        onValueChange={setSupplierId}
                        suppliers={suppliers}
                        value={supplierId}
                      />
                    </div>
                    {lockReason ? <FieldHint>{lockReason}</FieldHint> : null}
                    {suppliers.length === 0 ? (
                      <FieldHint>No suppliers available — add a supplier first.</FieldHint>
                    ) : null}
                    <FieldError message={supplierFieldError} />
                  </div>
                  <div>
                    <Label htmlFor="po-order-date">
                      Order date
                      <RequiredMark />
                    </Label>
                    <Input
                      className="mt-1.5 h-10"
                      disabled={fieldsDisabled}
                      id="po-order-date"
                      onChange={(event) => setOrderDate(event.target.value)}
                      type="date"
                      value={orderDate}
                    />
                    {lockReason ? <FieldHint>{lockReason}</FieldHint> : null}
                    <FieldError message={orderDateFieldError} />
                  </div>
                </div>
              </FormSection>

              <FormSection
                description={
                  isPartialAdjustment
                    ? "Only unreceived quantities can change. Received history stays locked at the line level."
                    : isCorrectionEdit
                      ? "Only quantities, rates, and tax on existing lines can change — lines can't be added or removed."
                      : "Add product or account lines exactly as they should move through receiving and billing."
                }
                required
                title="Items"
              >
                {itemsFieldError ? (
                  <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                    {itemsFieldError}
                  </p>
                ) : null}
                <PurchasingItemLineEditor
                  accounts={accounts}
                  disableAddRows={fieldsDisabled}
                  lineErrors={lineErrors}
                  lineLocks={lineLocks}
                  lines={lines}
                  onLinesChange={setLines}
                  products={products}
                  showAccountRows={showAccountRows}
                  taxRates={taxRates}
                  units={units}
                />
              </FormSection>

              <FormSection
                description="Optional delivery expectations and internal notes for this order."
                title="Delivery & notes"
              >
                <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
                  <div>
                    <Label htmlFor="po-expected-delivery">Expected delivery date</Label>
                    <Input
                      className="mt-1.5 h-10"
                      id="po-expected-delivery"
                      onChange={(event) => setExpectedDeliveryDate(event.target.value)}
                      type="date"
                      value={expectedDeliveryDate}
                    />
                    <FieldError message={expectedDeliveryFieldError} />
                  </div>
                  <div>
                    <Label htmlFor="po-notes">Notes</Label>
                    <Textarea
                      className="mt-1.5 min-h-[42px]"
                      id="po-notes"
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Delivery instructions, supplier reference, or internal notes"
                      value={notes}
                    />
                    <FieldError message={notesFieldError} />
                  </div>
                </div>
              </FormSection>
            </>
          )}
        </div>
        <DialogFooter className="shrink-0 border-t border-workspace-border bg-white px-5 py-3">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          {pendingRevisionPayload ? (
            <Button
              disabled={isSubmitting}
              onClick={() => setPendingRevisionPayload(null)}
              type="button"
              variant="outline"
            >
              Back to edit
            </Button>
          ) : null}
          <Button
            disabled={isSubmitting}
            onClick={() => void (pendingRevisionPayload ? confirmRevision() : submit())}
            type="button"
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
