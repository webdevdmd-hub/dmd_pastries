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
import { purchaseReceiveSchema } from "@/lib/validators/purchasing.schema";
import type {
  PurchaseInvoice,
  PurchaseItemLineDraft,
  PurchaseOrder,
  PurchasingBranchOption,
  PurchasingIngredientOption,
  PurchasingProductOption,
  PurchasingSupplierOption,
  PurchasingTaxRateOption,
  PurchasingUnitOption,
  ReceivePurchasePayload,
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
    quantity: 1,
    taxRateId: null,
    unitCost: 0,
    unitId: "",
  };
}

function linesFromOrder(order: PurchaseOrder): PurchaseItemLineDraft[] {
  return order.items.map((item) => ({
    batchNumber: null,
    discountAmount: item.discountAmount,
    expiryDate: null,
    ingredientId: item.ingredientId,
    itemType: item.itemType,
    itemNameSnapshot: item.itemNameSnapshot,
    lineId: item.id || crypto.randomUUID(),
    packagingItemId: item.packagingItemId,
    productId: item.productId,
    quantity: Math.max(item.quantityOrdered - item.quantityReceived, 1),
    taxRateId: item.taxRateId,
    unitCost: item.unitCost,
    unitId: item.unitId,
  }));
}

function linesFromInvoice(invoice: PurchaseInvoice): PurchaseItemLineDraft[] {
  return invoice.items.map((item) => ({
    batchNumber: item.batchNumber,
    discountAmount: item.discountAmount,
    expiryDate: item.expiryDate,
    ingredientId: item.ingredientId,
    itemType: item.itemType,
    itemNameSnapshot: item.itemNameSnapshot,
    lineId: item.id || crypto.randomUUID(),
    packagingItemId: item.packagingItemId,
    productId: item.productId,
    quantity: item.quantity,
    taxRateId: item.taxRateId,
    unitCost: item.unitCost,
    unitId: item.unitId,
  }));
}

export function PurchaseReceiveDialog({
  branches,
  invoice,
  ingredients,
  isSubmitting,
  onClose,
  onReceive,
  open,
  order,
  products,
  suppliers,
  taxRates,
  units,
}: {
  branches: PurchasingBranchOption[];
  invoice?: PurchaseInvoice | null;
  ingredients: PurchasingIngredientOption[];
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
  const selectedSourceBranchId = order?.branchId ?? invoice?.branchId;
  const selectableBranches = branches.filter(
    (branch) =>
      branch.id === selectedSourceBranchId ||
      (branchScope.canAccessAllBranches
        ? branch.status === "active"
        : branch.id === branchScope.effectiveBranchId),
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
      setLines(linesFromOrder(order));
    } else if (invoice?.items.length) {
      setLines(linesFromInvoice(invoice));
    } else {
      setLines([emptyLine()]);
    }
    setError(null);
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
      setError(result.error.issues[0]?.message ?? "Please check the receive form.");
      return;
    }

    await onReceive(result.data);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive stock</DialogTitle>
          <DialogDescription>
            Confirm supplier stock-in. The backend creates inventory movements after posting.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            value={branchId || "none"}
            onValueChange={(value) => setBranchId(value === "none" ? "" : value)}
          >
            <SelectTrigger>
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
          <Input
            aria-label="Purchase order ID"
            onChange={(event) => setPurchaseOrderId(event.target.value)}
            placeholder="Linked PO ID optional"
            value={purchaseOrderId}
          />
          <Input
            aria-label="Purchase invoice ID"
            onChange={(event) => setPurchaseInvoiceId(event.target.value)}
            placeholder="Linked invoice ID optional"
            value={purchaseInvoiceId}
          />
          <Input
            aria-label="Received date"
            onChange={(event) => setReceivedDate(event.target.value)}
            type="date"
            value={receivedDate}
          />
        </div>
        <PurchasingItemLineEditor
          allowBatchFields
          ingredients={ingredients}
          lines={lines}
          onLinesChange={setLines}
          products={products}
          taxRates={taxRates}
          units={units}
        />
        <Input
          aria-label="Notes"
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
            Receive stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
