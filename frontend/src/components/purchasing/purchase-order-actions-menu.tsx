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
  onView,
  order,
}: {
  canDelete: boolean;
  canCreate: boolean;
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
  onView: (order: PurchaseOrder) => void;
  order: PurchaseOrder;
}): JSX.Element {
  const canReceive = order.status === "ordered" || order.status === "partially_received";
  const canHardDelete = canDelete;
  const canEditOrder = canEdit && (order.status === "draft" || order.status === "ordered");
  const canEditWithCorrection = canEdit && order.status === "received";
  const canAdjustRemaining = canEdit && order.status === "partially_received";
  const canReopen = canUpdateStatus && order.status === "cancelled";
  const isConversionEligible = order.status === "received";
  const showWriteActions =
    canEdit ||
    canUpdateStatus ||
    canConvertToBill ||
    canReceiveOrder ||
    canHardDelete ||
    canReopen ||
    canCreate;

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
        <DropdownMenuItem onSelect={() => onView(order)}>View details</DropdownMenuItem>
        {showWriteActions ? (
          <>
            {canEditOrder ? (
              <DropdownMenuItem onSelect={() => onEdit(order)}>Edit</DropdownMenuItem>
            ) : null}
            {canEditWithCorrection ? (
              <DropdownMenuItem onSelect={() => onEdit(order)}>
                Edit with correction
              </DropdownMenuItem>
            ) : null}
            {canAdjustRemaining ? (
              <DropdownMenuItem onSelect={() => onEdit(order)}>Adjust remaining</DropdownMenuItem>
            ) : null}
            {canUpdateStatus ? (
              <DropdownMenuItem
                disabled={order.status !== "draft"}
                onSelect={() => onStatusChange(order, "ordered")}
              >
                Mark as issued
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              disabled={!canConvertToBill || !isConversionEligible}
              onSelect={() => onConvertToBill(order)}
            >
              Convert to bill
            </DropdownMenuItem>
            {canReceiveOrder ? (
              <DropdownMenuItem disabled={!canReceive} onSelect={() => onReceive(order)}>
                Receive goods
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            {canUpdateStatus ? (
              <DropdownMenuItem
                disabled={order.status === "received" || order.status === "cancelled"}
                onSelect={() => onStatusChange(order, "cancelled")}
              >
                Cancel
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
            {canHardDelete ? (
              <DropdownMenuItem className="text-danger-text" onSelect={() => onDelete(order)}>
                Delete
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
