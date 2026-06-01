import { Edit, Eye, MoreHorizontal, PackageCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants/routes";
import type { BakeryOrder, OrderStatus } from "@/types/orders";

const transitions: Record<OrderStatus, OrderStatus[]> = {
  cancelled: [],
  completed: [],
  confirmed: ["in_production", "cancelled"],
  delivered: ["completed", "cancelled"],
  in_production: ["ready", "cancelled"],
  new: ["confirmed", "cancelled"],
  ready: ["delivered", "completed", "cancelled"],
};

function label(status: OrderStatus): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function OrderActionsMenu({
  canManage,
  onDelete,
  onStatusChange,
  order,
}: {
  canManage: boolean;
  onDelete: (order: BakeryOrder) => void;
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
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`${ROUTES.orders}/${order.id}`}>
            <Eye className="mr-2 h-4 w-4" />
            View details
          </Link>
        </DropdownMenuItem>
        {canManage ? (
          <DropdownMenuItem asChild>
            <Link href={`${ROUTES.orders}/${order.id}?mode=edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit order
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canManage
          ? transitions[order.orderStatus].map((status) => (
              <DropdownMenuItem key={status} onClick={() => onStatusChange(order, status)}>
                <PackageCheck className="mr-2 h-4 w-4" />
                Mark {label(status)}
              </DropdownMenuItem>
            ))
          : null}
        {canManage ? (
          <DropdownMenuItem className="text-red-700" onClick={() => onDelete(order)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete order
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
