"use client";

import { AlertTriangle } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useEffect, useState } from "react";

import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import { PurchasingItemLineEditor } from "@/components/purchasing/purchasing-item-line-editor";
import { SupplierLookupSelect } from "@/components/purchasing/supplier-lookup-select";
import { type FormTab, FormTabs } from "@/components/shared/form-tabs";
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

type PurchaseOrderFormTabKey = "details" | "items" | "notes";

const FORM_TABPANEL_ID = "purchase-order-form-tabpanel";

/** Which tab each field lives on, so a validation error can open the right one. */
function tabForField(field: FormFieldName | null): PurchaseOrderFormTabKey {
  if (field === "items") return "items";
  if (field === "notes") return "notes";
  return "details";
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

type FormSnapshot = {
  branchId: string;
  expectedDeliveryDate: string;
  lines: PurchaseItemLineDraft[];
  notes: string;
  orderDate: string;
  supplierId: string;
};

/**
 * A stable string for "has anything been typed since this opened". Only the
 * fields a person edits go in, so re-deriving a line's id or snapshot does not
 * register as a change.
 */
function serializeForm(snapshot: FormSnapshot): string {
  return JSON.stringify({
    branchId: snapshot.branchId,
    expectedDeliveryDate: snapshot.expectedDeliveryDate,
    lines: snapshot.lines.map((line) => ({
      accountId: line.accountId ?? null,
      description: line.description ?? "",
      discountAmount: line.discountAmount,
      itemType: line.itemType,
      productId: line.productId,
      productVariantId: line.productVariantId,
      quantity: line.quantity,
      taxRateId: line.taxRateId,
      unitCost: line.unitCost,
      unitId: line.unitId,
    })),
    notes: snapshot.notes,
    orderDate: snapshot.orderDate,
    supplierId: snapshot.supplierId,
  });
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
    <span aria-hidden="true" className="text-danger-text">
      {" "}
      *
    </span>
  );
}

function FieldError({ message }: { message?: string | undefined }): JSX.Element | null {
  if (!message) return null;

  return <p className="mt-1.5 text-xs font-medium text-danger-text">{message}</p>;
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
    <section className="rounded-md border border-workspace-border bg-card">
      <div className="border-b border-workspace-border px-4 py-3">
        <p className="text-xs font-semibold text-workspace-muted">
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
          ? "border-brand-espresso bg-brand-espresso text-primary-foreground"
          : "border-workspace-border bg-card text-workspace-muted",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-meta",
          active ? "bg-card/25" : "bg-workspace-border/70",
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
      <p className="text-meta font-medium text-workspace-muted">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "increase"
            ? "text-danger-text"
            : tone === "decrease"
              ? "text-money-text"
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
  const [baseline, setBaseline] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [activeTab, setActiveTab] = useState<PurchaseOrderFormTabKey>("details");

  // A validation problem switches to the tab that holds it before the
  // banner explains it; a hidden error is otherwise a silent no-op.
  useEffect(() => {
    if (error) {
      setActiveTab(tabForField(error.field));
    }
  }, [error]);
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

    const nextBranchId = order?.branchId ?? branchScope.effectiveBranchId ?? "";
    const nextSupplierId = order?.supplierId ?? "";
    const nextOrderDate = order ? order.orderDate.slice(0, 10) : today();
    const nextExpectedDeliveryDate = order?.expectedDeliveryDate?.slice(0, 10) ?? "";
    const nextNotes = order?.notes ?? "";

    setBranchId(nextBranchId);
    setSupplierId(nextSupplierId);
    setOrderDate(nextOrderDate);
    setExpectedDeliveryDate(nextExpectedDeliveryDate);
    setNotes(nextNotes);

    const nextLines: PurchaseItemLineDraft[] = order?.items.length
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
      : [emptyLine()];

    setLines(nextLines);
    setBaseline(
      serializeForm({
        branchId: nextBranchId,
        expectedDeliveryDate: nextExpectedDeliveryDate,
        lines: nextLines,
        notes: nextNotes,
        orderDate: nextOrderDate,
        supplierId: nextSupplierId,
      }),
    );
    setError(null);
    setLineErrors({});
    setPendingRevisionPayload(null);
    setConfirmDiscard(false);
    // Every opening starts on Details, whichever tab the last one closed on.
    setActiveTab("details");
  }, [branchScope.effectiveBranchId, open, order]);

  const estimatedRevisedTotal = lines.reduce((sum, line) => {
    const subtotal = Math.max(line.quantity * line.unitCost - line.discountAmount, 0);
    const taxRate = taxRates.find((rate) => rate.id === line.taxRateId);
    const tax = taxRate ? (subtotal * taxRate.taxPercentage) / 100 : 0;
    return sum + subtotal + tax;
  }, 0);
  const revisionDifference = estimatedRevisedTotal - (order?.totalAmount ?? 0);
  const orderTotalDisplay = new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(estimatedRevisedTotal);

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
      // Zod reports the offending line index in path[1]. Keeping only path[0]
      // threw it away, so an accurate message ("Quantity must be greater than
      // 0.") landed in a banner above a grid of identical-looking rows with no
      // clue which one it meant. Map every issue back onto its row instead.
      const nextLineErrors: Record<string, string> = {};

      for (const issue of result.error.issues) {
        if (issue.path[0] !== "items") continue;

        const lineIndex = issue.path[1];
        if (typeof lineIndex !== "number") continue;

        const line = lines[lineIndex];
        if (!line || nextLineErrors[line.lineId]) continue;

        nextLineErrors[line.lineId] = issue.message;
      }

      setLineErrors(nextLineErrors);

      const firstIssue = result.error.issues[0];
      const firstLineIndex = firstIssue?.path[0] === "items" ? firstIssue.path[1] : undefined;
      const rowPrefix =
        typeof firstLineIndex === "number" ? `Item ${String(firstLineIndex + 1)}: ` : "";
      const affectedRows = Object.keys(nextLineErrors).length;

      setError({
        field: resolveErrorField(firstIssue?.path),
        message: `${rowPrefix}${firstIssue?.message ?? "Please check the order form."}${
          affectedRows > 1 ? ` ${String(affectedRows)} item lines need attention.` : ""
        }`,
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

  const isDirty =
    baseline !== "" &&
    serializeForm({ branchId, expectedDeliveryDate, lines, notes, orderDate, supplierId }) !==
      baseline;

  /**
   * A half-built purchase order is expensive to retype. Esc or a click outside
   * used to discard it without a word.
   */
  const requestClose = (): void => {
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }

    onClose();
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
  const errorTab =
    error?.field !== undefined && error.field !== null ? tabForField(error.field) : null;
  const formTabs: FormTab<PurchaseOrderFormTabKey>[] = [
    { key: "details", label: "Details", badge: errorTab === "details" ? 1 : 0 },
    {
      key: "items",
      label: "Items",
      badge: errorTab === "items" ? Math.max(Object.keys(lineErrors).length, 1) : lines.length,
    },
    { key: "notes", label: "Notes", badge: errorTab === "notes" ? 1 : 0 },
  ];

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
  // Every path reports its own pending state. Only the revision path used to,
  // so "Create order" sat there looking idle while the request was in flight.
  const submitLabel = pendingRevisionPayload
    ? isSubmitting
      ? "Saving revision..."
      : "Save revision and apply corrections"
    : isCorrectionEdit
      ? "Review impact"
      : isPartialAdjustment
        ? isSubmitting
          ? "Saving adjustment..."
          : "Save adjustment"
        : order
          ? isSubmitting
            ? "Saving order..."
            : "Save order"
          : isSubmitting
            ? "Creating order..."
            : "Create order";

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? requestClose() : undefined)}>
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
                  ? "mt-1 inline-flex w-fit items-center gap-1.5 rounded-md border border-info/30 bg-info-tint px-2.5 py-1 text-info-text"
                  : undefined,
              )}
            >
              {descriptionText}
            </DialogDescription>
          </DialogHeader>
          {/* Tabs rather than one long scroll: one state holds every field,
              and a tab only decides which section is visible. The review
              step replaces the whole panel, so the strip hides with it. */}
          {!isReviewStep ? (
            <div className="shrink-0 border-b border-workspace-border px-5 py-3">
              <FormTabs
                active={activeTab}
                aria-label="Purchase order form sections"
                onTabChange={setActiveTab}
                panelId={FORM_TABPANEL_ID}
                tabs={formTabs}
              />
            </div>
          ) : null}
          <div
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-4"
            id={FORM_TABPANEL_ID}
            role="tabpanel"
            tabIndex={-1}
          >
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
                <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-tint px-4 py-3">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-warning-text"
                  />
                  <p className="text-sm text-warning-text">
                    Posted GRNs, stock movements, bills, journals, and payments will not be
                    rewritten. The backend will save a PO revision and keep correction impact
                    visible for follow-up.
                  </p>
                </div>
              </FormSection>
            ) : (
              <>
                {generalFieldError ? (
                  <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-tint px-4 py-3 text-sm text-danger-text">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="font-medium">{generalFieldError}</p>
                  </div>
                ) : null}

                <div className={activeTab === "details" ? undefined : "hidden"}>
                  <FormSection title="Order details">
                    {/* Four fields, one row. At lg:grid-cols-3 the fourth wrapped
                      and cost 82px of section height to save 24px elsewhere. */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                        <div className="mt-1.5">
                          <SupplierLookupSelect
                            disabled={fieldsDisabled}
                            id="po-supplier"
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
                    </div>
                  </FormSection>
                </div>

                <div className={activeTab === "items" ? undefined : "hidden"}>
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
                      <p className="mb-3 rounded-md border border-danger/30 bg-danger-tint px-3 py-2 text-sm font-medium text-danger-text">
                        {itemsFieldError}
                      </p>
                    ) : null}
                    <PurchasingItemLineEditor
                      accounts={accounts}
                      compactLayout
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
                </div>

                <div className={activeTab === "notes" ? undefined : "hidden"}>
                  <FormSection title="Notes">
                    <div>
                      <div>
                        <Label className="sr-only" htmlFor="po-notes">
                          Notes
                        </Label>
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
                </div>
              </>
            )}
          </div>
          <DialogFooter className="shrink-0 flex-row items-center justify-end gap-3 border-t border-workspace-border bg-card px-5 py-3">
            {/* The order total lived only at the bottom of the line editor,
                inside the scroll area. The submit button is pinned; the number
                it commits should be pinned beside it. */}
            <span className="mr-auto text-cell text-brand-mocha">
              Order total{" "}
              <span className="font-semibold tabular-nums text-brand-espresso">
                {orderTotalDisplay}
              </span>
            </span>
            <Button onClick={requestClose} type="button" variant="outline">
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

      <Dialog
        open={confirmDiscard}
        onOpenChange={(nextOpen) => (!nextOpen ? setConfirmDiscard(false) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this purchase order?</DialogTitle>
            <DialogDescription>
              {order
                ? `Your changes to ${order.purchaseOrderNumber} have not been saved and will be lost.`
                : `This draft has ${String(lines.length)} item line${lines.length === 1 ? "" : "s"} and has not been saved. Closing loses it.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setConfirmDiscard(false)} type="button" variant="outline">
              Keep editing
            </Button>
            <Button
              className="bg-danger text-primary-foreground hover:bg-danger"
              onClick={() => {
                setConfirmDiscard(false);
                onClose();
              }}
              type="button"
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
