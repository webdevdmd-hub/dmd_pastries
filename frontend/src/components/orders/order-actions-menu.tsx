import { Edit, MoreHorizontal, PackageCheck, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { allowedOrderTransitions, canEditOrder } from "@/lib/orders/status-rules";
import type { BakeryOrder, OrderStatus } from "@/types/orders";

function label(status: OrderStatus): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function OrderActionsMenu({
  canManage,
  onDelete,
  onEdit,
  onStatusChange,
  order,
}: {
  canManage: boolean;
  onDelete: (order: BakeryOrder) => void;
  onEdit: (order: BakeryOrder) => void;
  onStatusChange: (order: BakeryOrder, status: OrderStatus) => void;
  order: BakeryOrder;
}): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Actions for ${order.orderNumber}`} size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      {/* Viewing is not in here: clicking the row or card itself opens the
          details drawer, so the menu holds only the actions. */}
      <DropdownMenuContent align="end" className="w-52">
        {canManage && canEditOrder(order.orderStatus) ? (
          <DropdownMenuItem onClick={() => onEdit(order)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit order
          </DropdownMenuItem>
        ) : null}
        {canManage
          ? allowedOrderTransitions(order.orderStatus).map((status) => (
              <DropdownMenuItem key={status} onClick={() => onStatusChange(order, status)}>
                <PackageCheck className="mr-2 h-4 w-4" />
                Mark {label(status)}
              </DropdownMenuItem>
            ))
          : null}
        {canManage ? (
          <DropdownMenuItem className="text-danger-text" onClick={() => onDelete(order)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete order
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
