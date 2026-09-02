"use client";

import type { JSX } from "react";

import { CustomerActionsMenu } from "@/components/customers/customer-actions-menu";
import { CustomerStatusBadge } from "@/components/customers/customer-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Customer } from "@/types/customer";

type CustomersTableProps = {
  canManage: boolean;
  customers: Customer[];
  onDelete: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onStatusChange: (customer: Customer, status: Customer["status"]) => void;
  onView: (customer: Customer) => void;
};

export function customerInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatCustomerCurrency(value: number | null): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value ?? 0);
}

export function formatCustomerDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Never";
}

/**
 * Clicking anywhere on a row opens the customer's details drawer. The name is
 * also a real button so the keyboard has a focusable target, and the actions
 * cell stops the click so the kebab does not also open the drawer.
 */
export function CustomersTable({
  canManage,
  customers,
  onDelete,
  onEdit,
  onStatusChange,
  onView,
}: CustomersTableProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total sales</TableHead>
          <TableHead className="text-right">Orders</TableHead>
          <TableHead>Last purchase</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((customer) => (
          <TableRow className="cursor-pointer" key={customer.id} onClick={() => onView(customer)}>
            <TableCell>
              <button
                className="flex items-center gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(customer);
                }}
                type="button"
              >
                <Avatar>
                  <AvatarFallback className="bg-brand-cappuccino text-brand-espresso">
                    {customerInitials(customer.fullName)}
                  </AvatarFallback>
                </Avatar>
                <span>
                  <span className="block font-medium">{customer.fullName}</span>
                  <span className="font-mono text-meta text-foreground-muted">
                    {customer.customerCode}
                  </span>
                </span>
              </button>
            </TableCell>
            <TableCell className="tabular-nums">{customer.phone ?? "Not set"}</TableCell>
            <TableCell>{customer.email ?? "Not set"}</TableCell>
            <TableCell>
              <div className="flex max-w-48 flex-wrap gap-1 whitespace-normal">
                {customer.tags.length > 0 ? (
                  customer.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag.id} variant="outline">
                      {tag.tagName}
                    </Badge>
                  ))
                ) : (
                  <span className="text-cell text-foreground-muted">No tags</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <CustomerStatusBadge status={customer.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCustomerCurrency(customer.totalSalesAmount)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {customer.totalOrdersCount ?? "Not tracked"}
            </TableCell>
            <TableCell className="tabular-nums">
              {formatCustomerDate(customer.lastPurchaseAt)}
            </TableCell>
            <TableCell className="tabular-nums">{formatCustomerDate(customer.createdAt)}</TableCell>
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <CustomerActionsMenu
                canManage={canManage}
                customer={customer}
                onDelete={onDelete}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
