"use client";

import type { JSX } from "react";

import { OrderFormPage } from "@/components/orders/order-form-page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type POSCreateOrderDialogProps = {
  branchId: string;
  branchName: string;
  canCreate: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function POSCreateOrderDialog({
  canCreate,
  onOpenChange,
  open,
}: POSCreateOrderDialogProps): JSX.Element {
  return (
    <Dialog onOpenChange={onOpenChange} open={open && canCreate}>
      <DialogContent
        className="top-3 flex h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-7xl translate-y-0 gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:top-6 sm:h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100vw-3rem)]"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Create bakery order from POS</DialogTitle>
          <DialogDescription>
            Create a bakery order with customer, schedule, item, packaging, charge, and notes
            details.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1">
          <OrderFormPage
            onClose={() => {
              onOpenChange(false);
            }}
            orderId={null}
            presentation="modal"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
