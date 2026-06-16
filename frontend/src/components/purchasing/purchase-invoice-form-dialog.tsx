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
import { purchaseInvoiceSchema } from "@/lib/validators/purchasing.schema";
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

export function PurchaseInvoiceFormDialog({
  branches,
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
  branches: PurchasingBranchOption[];
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
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
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

    setBranchId(invoice?.branchId ?? branchScope.effectiveBranchId ?? "");
    setSupplierId(invoice?.supplierId ?? "");
    setPurchaseOrderId(invoice?.purchaseOrderId ?? "");
    setInvoiceNumber(invoice?.invoiceNumber ?? "");
    setInvoiceDate(invoice ? invoice.invoiceDate.slice(0, 10) : today());
    setDueDate(invoice?.dueDate?.slice(0, 10) ?? "");
    setNotes(invoice?.notes ?? "");
    setLines(
      invoice?.items.length
        ? invoice.items.map((item) => ({
            batchNumber: item.batchNumber,
            discountAmount: item.discountAmount,
            expiryDate: item.expiryDate,
            ingredientId: item.ingredientId,
            itemType: "product",
            itemNameSnapshot: item.itemNameSnapshot,
            lineId: item.id || crypto.randomUUID(),
            packagingItemId: item.packagingItemId,
            productId: item.productId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            taxRateId: item.taxRateId,
            unitCost: item.unitCost,
            unitId: item.unitId,
          }))
        : [emptyLine()],
    );
    setError(null);
  }, [branchScope.effectiveBranchId, invoice, open]);

  const submit = async (): Promise<void> => {
    const result = purchaseInvoiceSchema.safeParse({
      branchId,
      dueDate,
      invoiceDate,
      invoiceNumber,
      items: lines,
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
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice ? "Edit bill" : "Create bill"}</DialogTitle>
          <DialogDescription>
            Record supplier bill totals. Backend posting remains the final authority.
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
            aria-label="Bill number"
            onChange={(event) => setInvoiceNumber(event.target.value)}
            placeholder="Internal bill number"
            value={invoiceNumber}
          />
          <Input
            aria-label="Bill date"
            onChange={(event) => setInvoiceDate(event.target.value)}
            type="date"
            value={invoiceDate}
          />
          <Input
            aria-label="Due date"
            onChange={(event) => setDueDate(event.target.value)}
            type="date"
            value={dueDate}
          />
        </div>
        <PurchasingItemLineEditor
          allowBatchFields
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
            {invoice ? "Save bill" : "Create bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
