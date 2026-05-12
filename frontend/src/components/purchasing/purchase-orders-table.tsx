"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";

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
import type { PurchaseOrder, PurchaseOrderStatus } from "@/types/purchasing";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

export function PurchaseOrdersTable({
  canManage,
  onDelete,
  onEdit,
  onReceive,
  onStatusChange,
  orders,
}: {
  canManage: boolean;
  onDelete: (order: PurchaseOrder) => void;
  onEdit: (order: PurchaseOrder) => void;
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
          <TableHead>Branch</TableHead>
          <TableHead>Order Date</TableHead>
          <TableHead>Expected Delivery</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Created By</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell>
              <Link
                className="font-semibold text-brand-espresso"
                href={`${ROUTES.purchasingOrders}/${order.id}`}
              >
                {order.purchaseOrderNumber}
              </Link>
            </TableCell>
            <TableCell>{order.supplierName}</TableCell>
            <TableCell>{order.branchName}</TableCell>
            <TableCell>{formatDate(order.orderDate)}</TableCell>
            <TableCell>{formatDate(order.expectedDeliveryDate)}</TableCell>
            <TableCell>
              <PurchaseOrderStatusBadge status={order.status} />
            </TableCell>
            <TableCell>{formatCurrency(order.totalAmount)}</TableCell>
            <TableCell>{order.createdByUserName}</TableCell>
            <TableCell>
              <PurchaseOrderActionsMenu
                canManage={canManage}
                onDelete={onDelete}
                onEdit={onEdit}
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
