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
    lineId: crypto.randomUUID(),
    packagingItemId: null,
    productId: null,
    productVariantId: null,
    quantity: 1,
    taxRateId: null,
    unitCost: 0,
    unitId: "",
  };
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
  const [error, setError] = useState<string | null>(null);
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
            lineId: item.id || crypto.randomUUID(),
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
    if (isPartialAdjustment || isCorrectionEdit) {
      const missingExistingLine = lines.find((line) => !line.id);
      if (missingExistingLine) {
        setError(
          "Correction edits can only update existing purchase order lines. Add new items using a new purchase order or a supported adjustment flow.",
        );
        return;
      }

      const existingIds = new Set(order.items.map((item) => item.id));
      const submittedIds = new Set(lines.map((line) => line.id).filter(Boolean));
      if (existingIds.size !== submittedIds.size) {
        setError("Correction edits cannot add or remove purchase order lines.");
        return;
      }

      const invalidLine = lines.find((line) => {
        const lock = lineLocks[line.lineId];
        return lock ? line.quantity < lock.minQuantity : true;
      });

      if (invalidLine) {
        setError("Correction quantities cannot be reduced below the already received quantity.");
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
      setError(result.error.issues[0]?.message ?? "Please check the order form.");
      return;
    }

    if (order && isCorrectionEdit) {
      if (!onRevise) {
        setError("Correction edit is not available for this purchase order.");
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

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="flex max-h-[96vh] w-[min(96vw,1500px)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-brand-cappuccino/70 px-5 py-4">
          <DialogTitle className="text-2xl">
            {isPartialAdjustment
              ? "Adjust remaining purchase order"
              : isCorrectionEdit
                ? "Edit with correction"
                : order
                  ? "Edit purchase order"
                  : "Create purchase order"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-5">
            {isPartialAdjustment
              ? "Adjust unreceived quantities, expected delivery, and notes. Received history stays locked."
              : isCorrectionEdit
                ? "Review the edited PO, then save a revision. Posted stock, bills, journals, and payments stay unchanged."
                : order?.status === "ordered"
                  ? "Update this issued purchase order before receiving goods. It remains issued after saving."
                  : "Draft supplier orders with product lines, tax, discount, and delivery dates."}
          </DialogDescription>
        </DialogHeader>
        {pendingRevisionPayload ? (
          <div className="border-b border-brand-cappuccino/70 bg-amber-50 px-5 py-4 text-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-brand-mocha">Original PO total</p>
                <p className="font-semibold tabular-nums">
                  AED {(order?.totalAmount ?? 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-brand-mocha">New estimated total</p>
                <p className="font-semibold tabular-nums">AED {estimatedRevisedTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-brand-mocha">Difference</p>
                <p className="font-semibold tabular-nums">
                  {revisionDifference >= 0 ? "+" : "-"}AED {Math.abs(revisionDifference).toFixed(2)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-amber-900">
              Posted GRNs, stock movements, bills, journals, and payments will not be rewritten. The
              backend will save a PO revision and keep correction impact visible for follow-up.
            </p>
          </div>
        ) : null}
        <div className="grid min-h-0 gap-3 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 lg:grid-cols-4">
            <Select
              disabled={isPartialAdjustment || isCorrectionEdit}
              value={branchId || "none"}
              onValueChange={(value) => setBranchId(value === "none" ? "" : value)}
            >
              <SelectTrigger className="h-10">
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
              disabled={isPartialAdjustment || isCorrectionEdit}
              onValueChange={setSupplierId}
              suppliers={suppliers}
              value={supplierId}
            />
            <Input
              aria-label="Order date"
              className="h-10"
              disabled={isPartialAdjustment || isCorrectionEdit}
              onChange={(event) => setOrderDate(event.target.value)}
              type="date"
              value={orderDate}
            />
            <Input
              aria-label="Expected delivery date"
              className="h-10"
              onChange={(event) => setExpectedDeliveryDate(event.target.value)}
              type="date"
              value={expectedDeliveryDate}
            />
          </div>
          <PurchasingItemLineEditor
            accounts={accounts}
            disableAddRows={isPartialAdjustment || isCorrectionEdit}
            lineLocks={lineLocks}
            lines={lines}
            onLinesChange={setLines}
            products={products}
            showAccountRows={showAccountRows}
            taxRates={taxRates}
            units={units}
          />
          <Input
            aria-label="Notes"
            className="h-10"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes"
            value={notes}
          />
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        </div>
        <DialogFooter className="border-t border-brand-cappuccino/70 bg-white px-5 py-3">
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
            {pendingRevisionPayload
              ? isSubmitting
                ? "Saving revision..."
                : "Save revision and apply corrections"
              : isCorrectionEdit
                ? "Review impact"
                : isPartialAdjustment
                  ? "Save adjustment"
                  : order
                    ? "Save order"
                    : "Create order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
