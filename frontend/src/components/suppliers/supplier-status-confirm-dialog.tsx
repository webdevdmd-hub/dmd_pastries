"use client";

import { Check, X } from "lucide-react";
import type { JSX } from "react";

import { SUPPLIER_STATUS_COPY } from "@/components/suppliers/supplier-status-copy";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Supplier, SupplierStatus } from "@/types/supplier";

export type SupplierPendingAction =
  | { type: "status"; supplier: Supplier; status: SupplierStatus }
  | { type: "delete"; supplier: Supplier }
  | null;

type SupplierStatusConfirmDialogProps = {
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  pendingAction: SupplierPendingAction;
};

/**
 * The confirm step for a status change or a delete.
 *
 * It used to say "Update Midun Bakes to blocked?" and stop there, which tells
 * you what you clicked and nothing about what it does. Blocking a supplier
 * stops billing as well as ordering; deactivating one does not. That is the
 * difference worth showing before the button, not after.
 */
export function SupplierStatusConfirmDialog({
  isSubmitting,
  onCancel,
  onConfirm,
  pendingAction,
}: SupplierStatusConfirmDialogProps): JSX.Element {
  const isDelete = pendingAction?.type === "delete";
  const copy = pendingAction?.type === "status" ? SUPPLIER_STATUS_COPY[pendingAction.status] : null;
  const supplierName = pendingAction?.supplier.supplierName ?? "this supplier";

  return (
    <Dialog open={pendingAction !== null} onOpenChange={(open) => (!open ? onCancel() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isDelete ? `Delete ${supplierName}?` : `${copy?.verb ?? "Update"} ${supplierName}?`}
          </DialogTitle>
          <DialogDescription>
            {isDelete
              ? "This removes the supplier from active purchasing. Documents already raised against it are kept."
              : copy?.summary}
          </DialogDescription>
        </DialogHeader>

        {copy ? (
          <div className="grid gap-2 rounded-xl bg-muted p-4">
            {copy.effects.map((effect) => (
              <div className="flex items-start gap-2" key={effect.text}>
                {effect.allowed ? (
                  <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                ) : (
                  <X aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger-text" />
                )}
                <span className="text-cell">
                  {effect.text}
                  <span className="sr-only">{effect.allowed ? " allowed" : " not allowed"}</span>
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {copy ? (
          <p className="text-meta text-foreground-muted">
            Reversible at any time from the same menu.
          </p>
        ) : null}

        <DialogFooter>
          <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={onConfirm}
            type="button"
            variant={isDelete ? "danger" : "default"}
          >
            {isSubmitting ? "Saving…" : isDelete ? "Delete supplier" : (copy?.verb ?? "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
