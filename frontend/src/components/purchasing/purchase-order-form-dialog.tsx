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
import type {
  CreatePurchaseOrderPayload,
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
  branches,
  isSubmitting,
  onClose,
  onCreate,
  onUpdate,
  open,
  order,
  products,
  suppliers,
  taxRates,
  units,
}: {
  branches: PurchasingBranchOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (payload: CreatePurchaseOrderPayload) => Promise<void>;
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
  const isPartialAdjustment = order?.status === "partially_received";
  const lineLocks =
    order?.status === "partially_received"
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
            batchNumber: null,
            discountAmount: item.discountAmount,
            expiryDate: null,
            ingredientId: item.ingredientId,
            itemType: "product",
            itemNameSnapshot: item.itemNameSnapshot,
            lineId: item.id || crypto.randomUUID(),
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
  }, [branchScope.effectiveBranchId, open, order]);

  const submit = async (): Promise<void> => {
    if (isPartialAdjustment) {
      const invalidLine = lines.find((line) => {
        const lock = lineLocks[line.lineId];
        return lock ? line.quantity < lock.minQuantity : true;
      });

      if (invalidLine) {
        setError("Partially received lines cannot be reduced below the received quantity.");
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

    if (order) {
      await onUpdate(order.id, result.data);
    } else {
      await onCreate(result.data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="flex max-h-[96vh] w-[min(96vw,1500px)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-brand-cappuccino/70 px-5 py-4">
          <DialogTitle className="text-2xl">
            {isPartialAdjustment
              ? "Adjust remaining purchase order"
              : order
                ? "Edit purchase order"
                : "Create purchase order"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-5">
            {isPartialAdjustment
              ? "Adjust unreceived quantities, expected delivery, and notes. Received history stays locked."
              : order?.status === "ordered"
                ? "Update this issued purchase order before receiving goods. It remains issued after saving."
                : "Draft supplier orders with product lines, tax, discount, and delivery dates."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-3 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 lg:grid-cols-4">
            <Select
              disabled={isPartialAdjustment}
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
              disabled={isPartialAdjustment}
              onValueChange={setSupplierId}
              suppliers={suppliers}
              value={supplierId}
            />
            <Input
              aria-label="Order date"
              className="h-10"
              disabled={isPartialAdjustment}
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
            disableAddRows={isPartialAdjustment}
            lineLocks={lineLocks}
            lines={lines}
            onLinesChange={setLines}
            products={products}
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
          <Button disabled={isSubmitting} onClick={() => void submit()} type="button">
            {isPartialAdjustment ? "Save adjustment" : order ? "Save order" : "Create order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
