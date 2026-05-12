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
  canManage,
  onDelete,
  onEdit,
  onReceive,
  onStatusChange,
  onView,
  order,
}: {
  canManage: boolean;
  onDelete: (order: PurchaseOrder) => void;
  onEdit: (order: PurchaseOrder) => void;
  onReceive: (order: PurchaseOrder) => void;
  onStatusChange: (order: PurchaseOrder, status: PurchaseOrderStatus) => void;
  onView: (order: PurchaseOrder) => void;
  order: PurchaseOrder;
}): JSX.Element {
  const canReceive = order.status === "ordered" || order.status === "partially_received";

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
        {canManage ? (
          <>
            <DropdownMenuItem disabled={order.status !== "draft"} onSelect={() => onEdit(order)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={order.status !== "draft"}
              onSelect={() => onStatusChange(order, "ordered")}
            >
              Mark ordered
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canReceive} onSelect={() => onReceive(order)}>
              Receive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={order.status === "received" || order.status === "cancelled"}
              onSelect={() => onStatusChange(order, "cancelled")}
            >
              Cancel
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-700" onSelect={() => onDelete(order)}>
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
