"use client";

import { MoreHorizontal } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/types/purchasing";

export type PurchaseOrderActionHandlers = {
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canConvertToBill: boolean;
  canReceiveOrder: boolean;
  canUpdateStatus: boolean;
  onConvertToBill: (order: PurchaseOrder) => void;
  onDelete: (order: PurchaseOrder) => void;
  onDuplicate: (order: PurchaseOrder) => void;
  onEdit: (order: PurchaseOrder) => void;
  onReopen: (order: PurchaseOrder) => void;
  onReceive: (order: PurchaseOrder) => void;
  onStatusChange: (order: PurchaseOrder, status: PurchaseOrderStatus) => void;
};

/**
 * Actions only. Viewing is the row's own click, so "View details" no longer
 * sits here; a reader with no write rights sees no menu at all.
 */
export function PurchaseOrderActionsMenu({
  canDelete,
  canCreate,
  canEdit,
  canConvertToBill,
  canReceiveOrder,
  canUpdateStatus,
  onConvertToBill,
  onDelete,
  onDuplicate,
  onEdit,
  onReopen,
  onReceive,
  onStatusChange,
  order,
}: PurchaseOrderActionHandlers & { order: PurchaseOrder }): JSX.Element | null {
  const canReceive = order.status === "ordered" || order.status === "partially_received";
  const canEditOrder = canEdit && (order.status === "draft" || order.status === "ordered");
  const canEditWithCorrection = canEdit && order.status === "received";
  const canAdjustRemaining = canEdit && order.status === "partially_received";
  const canReopen = canUpdateStatus && order.status === "cancelled";
  const isConversionEligible = order.status === "received";
  const showWriteActions =
    canEdit || canUpdateStatus || canConvertToBill || canReceiveOrder || canDelete || canCreate;

  if (!showWriteActions) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${order.purchaseOrderNumber}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEditOrder ? (
          <DropdownMenuItem onSelect={() => onEdit(order)}>Edit</DropdownMenuItem>
        ) : null}
        {canEditWithCorrection ? (
          <DropdownMenuItem onSelect={() => onEdit(order)}>Edit with correction</DropdownMenuItem>
        ) : null}
        {canAdjustRemaining ? (
          <DropdownMenuItem onSelect={() => onEdit(order)}>Adjust remaining</DropdownMenuItem>
        ) : null}
        {canUpdateStatus && order.status === "draft" ? (
          <DropdownMenuItem onSelect={() => onStatusChange(order, "ordered")}>
            Mark as issued
          </DropdownMenuItem>
        ) : null}
        {canConvertToBill && isConversionEligible ? (
          <DropdownMenuItem onSelect={() => onConvertToBill(order)}>
            Convert to bill
          </DropdownMenuItem>
        ) : null}
        {canReceiveOrder && canReceive ? (
          <DropdownMenuItem onSelect={() => onReceive(order)}>Receive goods</DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {canUpdateStatus && order.status !== "received" && order.status !== "cancelled" ? (
          <DropdownMenuItem onSelect={() => onStatusChange(order, "cancelled")}>
            Cancel order
          </DropdownMenuItem>
        ) : null}
        {canReopen ? (
          <DropdownMenuItem onSelect={() => onReopen(order)}>Reopen</DropdownMenuItem>
        ) : null}
        {canCreate ? (
          <DropdownMenuItem onSelect={() => onDuplicate(order)}>
            Duplicate as draft
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <DropdownMenuItem className="text-danger-text" onSelect={() => onDelete(order)}>
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
