"use client";

import Link from "next/link";
import type { JSX } from "react";

import { MovementDirectionBadge } from "@/components/stock-movements/movement-direction-badge";
import { MovementTypeBadge } from "@/components/stock-movements/movement-type-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { StockMovement } from "@/types/stock-movements";

type MovementDetailsDrawerProps = {
  movement: StockMovement | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleString("en-AE") : "Not recorded";
}

function formatQuantity(value: number, unit: string): string {
  return `${new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 }).format(value)} ${unit}`;
}

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-brand-cappuccino bg-white/70 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-brand-mocha">{label}</p>
      <p className="mt-1 font-semibold text-brand-espresso">{value}</p>
    </div>
  );
}

export function MovementDetailsDrawer({
  movement,
  onOpenChange,
  open,
}: MovementDetailsDrawerProps): JSX.Element {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" side="right">
        <SheetHeader>
          <SheetTitle>{movement?.itemName ?? "Stock movement"}</SheetTitle>
          <SheetDescription>Complete stock ledger entry and reversal context.</SheetDescription>
        </SheetHeader>
        {movement ? (
          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap gap-2">
              <MovementTypeBadge type={movement.movementType} />
              <MovementDirectionBadge direction={movement.movementDirection} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DetailRow label="Movement ID" value={movement.id} />
              <DetailRow label="Branch" value={movement.branchName} />
              <DetailRow label="Item type" value={movement.itemType} />
              <DetailRow
                label="Quantity"
                value={formatQuantity(movement.quantity, movement.unitSymbol)}
              />
              <DetailRow
                label="Before"
                value={formatQuantity(movement.beforeQuantity, movement.unitSymbol)}
              />
              <DetailRow
                label="After"
                value={formatQuantity(movement.afterQuantity, movement.unitSymbol)}
              />
              <DetailRow label="Reference type" value={movement.referenceType ?? "Manual"} />
              <DetailRow label="Reference number" value={movement.referenceNumber ?? "None"} />
              <DetailRow label="Created by" value={movement.createdByUserName} />
              <DetailRow label="Created at" value={formatDate(movement.createdAt)} />
            </div>
            <div className="rounded-2xl border border-brand-cappuccino bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-brand-mocha">Reason</p>
              <p className="mt-2 text-sm text-brand-espresso">{movement.reason ?? "No reason"}</p>
              {movement.notes ? (
                <>
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-brand-mocha">Notes</p>
                  <p className="mt-2 text-sm text-brand-espresso">{movement.notes}</p>
                </>
              ) : null}
            </div>
            {movement.reversedMovementId ? (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <p className="font-bold text-brand-espresso">Reversal information</p>
                <p className="mt-1 text-sm text-brand-mocha">
                  Related movement: {movement.reversedMovementId}
                </p>
                <Button asChild className="mt-3" size="sm" type="button" variant="outline">
                  <Link href={`/inventory/movements/${movement.reversedMovementId}`}>
                    Open related movement
                  </Link>
                </Button>
              </div>
            ) : null}
            <Button asChild type="button" variant="outline">
              <Link href={`/inventory/audit/${movement.inventoryItemId}`}>Audit this item</Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
