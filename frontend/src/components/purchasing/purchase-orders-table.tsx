"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX, MouseEvent as ReactMouseEvent } from "react";

import { PurchaseOrderActionsMenu } from "@/components/purchasing/purchase-order-actions-menu";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { formatDateOnly } from "@/lib/format/date";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/types/purchasing";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return formatDateOnly(value);
}

/**
 * Branch and who raised it are how you recognise a row once you have found it,
 * not how you find it -- nobody scans a column of "Main Branch (MAIN)" looking
 * for one order. They ride under the number they belong to, the same move the
 * movements ledger made when it went to eight columns.
 */
function orderSubline(order: PurchaseOrder): string {
  return [order.branchName, order.createdByUserName].filter(Boolean).join(" · ");
}

/**
 * A click anywhere in the row opens the order, except where the row already
 * has something else to do: the number is a link, the last cell is a menu, and
 * a click that ends a text selection is a read, not a navigation.
 */
function shouldOpenOrder(event: ReactMouseEvent<HTMLTableRowElement>): boolean {
  if (event.target instanceof Element && event.target.closest("a,button,[role='menuitem']")) {
    return false;
  }

  return (window.getSelection()?.toString().length ?? 0) === 0;
}

type NextStepPermissions = {
  canConvertToBill: boolean;
  canReceiveOrder: boolean;
  canUpdateStatus: boolean;
};

/**
 * The next step depends on who is reading it. This used to instruct every
 * viewer to "Mark as issued" or "Receive goods" regardless of their role, so a
 * view-only user was told to take an action the row's own menu denied them.
 * Without the permission, the cell reports the state instead.
 */
function nextStepForOrder(order: PurchaseOrder, permissions: NextStepPermissions): string {
  if (order.status === "draft") {
    return permissions.canUpdateStatus ? "Mark as issued" : "Awaiting issue";
  }

  if (order.status === "ordered") {
    return permissions.canReceiveOrder ? "Receive goods" : "Awaiting delivery";
  }

  if (order.status === "partially_received") {
    return permissions.canReceiveOrder ? "Receive remaining goods" : "Part delivered";
  }

  if (order.status === "received") {
    // The list response carries no document chain, so this cannot yet tell a
    // billable order from one that is already billed. See TODOS.md.
    return permissions.canConvertToBill ? "Ready to bill" : "Received in full";
  }

  return "No action";
}

export function PurchaseOrdersTable({
  canCreate,
  canDelete,
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
  orders,
}: {
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
  orders: PurchaseOrder[];
}): JSX.Element {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>PO Number</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Order Date</TableHead>
          <TableHead>Expected Delivery</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Next Step</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow
            className="cursor-pointer"
            key={order.id}
            onClick={(event) => {
              if (!shouldOpenOrder(event)) return;
              router.push(`${ROUTES.purchasingOrders}/${order.id}`);
            }}
          >
            <TableCell>
              <div>
                <Link
                  className="font-semibold text-brand-espresso"
                  href={`${ROUTES.purchasingOrders}/${order.id}`}
                >
                  {order.purchaseOrderNumber}
                </Link>
                <p className="text-meta text-foreground-muted">{orderSubline(order)}</p>
              </div>
            </TableCell>
            <TableCell>{order.supplierName}</TableCell>
            <TableCell className="tabular-nums">{formatDate(order.orderDate)}</TableCell>
            <TableCell className="tabular-nums">{formatDate(order.expectedDeliveryDate)}</TableCell>
            <TableCell>
              <PurchaseOrderStatusBadge status={order.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(order.totalAmount)}
            </TableCell>
            <TableCell>
              <span className="text-meta text-foreground-muted">
                {nextStepForOrder(order, {
                  canConvertToBill,
                  canReceiveOrder,
                  canUpdateStatus,
                })}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <PurchaseOrderActionsMenu
                canCreate={canCreate}
                canDelete={canDelete}
                canEdit={canEdit}
                canConvertToBill={canConvertToBill}
                canReceiveOrder={canReceiveOrder}
                canUpdateStatus={canUpdateStatus}
                onConvertToBill={onConvertToBill}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onEdit={onEdit}
                onReopen={onReopen}
                onReceive={onReceive}
                onStatusChange={onStatusChange}
                onView={(selectedOrder) =>
                  router.push(`${ROUTES.purchasingOrders}/${selectedOrder.id}`)
                }
                order={order}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
