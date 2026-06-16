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
  canEdit,
  canConvertToBill,
  canReceiveOrder,
  canUpdateStatus,
  onConvertToBill,
  onDelete,
  onEdit,
  onReceive,
  onStatusChange,
  onView,
  order,
}: {
  canDelete: boolean;
  canEdit: boolean;
  canConvertToBill: boolean;
  canReceiveOrder: boolean;
  canUpdateStatus: boolean;
  onConvertToBill: (order: PurchaseOrder) => void;
  onDelete: (order: PurchaseOrder) => void;
  onEdit: (order: PurchaseOrder) => void;
  onReceive: (order: PurchaseOrder) => void;
  onStatusChange: (order: PurchaseOrder, status: PurchaseOrderStatus) => void;
  onView: (order: PurchaseOrder) => void;
  order: PurchaseOrder;
}): JSX.Element {
  const canReceive = order.status === "ordered" || order.status === "partially_received";
  const canHardDelete =
    canDelete && order.status !== "received" && order.status !== "partially_received";
  const isConversionEligible = order.status === "received";
  const showWriteActions =
    canEdit || canUpdateStatus || canConvertToBill || canReceiveOrder || canHardDelete;

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
            {canEdit ? (
              <DropdownMenuItem disabled={order.status !== "draft"} onSelect={() => onEdit(order)}>
                Edit
              </DropdownMenuItem>
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
            {canHardDelete ? (
              <DropdownMenuItem className="text-red-700" onSelect={() => onDelete(order)}>
                Delete
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
