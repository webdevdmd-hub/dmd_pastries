"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { ROUTES } from "@/constants/routes";
import type { Customer } from "@/types/customer";

type CustomersTableProps = {
  canManage: boolean;
  customers: Customer[];
  onDelete: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onStatusChange: (customer: Customer, status: Customer["status"]) => void;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatCurrency(value: number | null): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value ?? 0);
}

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Never";
}

export function CustomersTable({
  canManage,
  customers,
  onDelete,
  onEdit,
  onStatusChange,
}: CustomersTableProps): JSX.Element {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Total Sales</TableHead>
          <TableHead>Total Orders</TableHead>
          <TableHead>Last Purchase</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((customer) => (
          <TableRow key={customer.id}>
            <TableCell>
              <Link className="flex items-center gap-3" href={`${ROUTES.customers}/${customer.id}`}>
                <Avatar>
                  <AvatarFallback className="bg-brand-cappuccino text-brand-espresso">
                    {initials(customer.fullName)}
                  </AvatarFallback>
                </Avatar>
                <span>
                  <span className="block font-semibold">{customer.fullName}</span>
                  <span className="text-xs text-brand-mocha">{customer.customerCode}</span>
                </span>
              </Link>
            </TableCell>
            <TableCell>{customer.phone ?? "Not set"}</TableCell>
            <TableCell>{customer.email ?? "Not set"}</TableCell>
            <TableCell>
              <div className="flex max-w-48 flex-wrap gap-1">
                {customer.tags.length > 0 ? (
                  customer.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag.id} variant="outline">
                      {tag.tagName}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-brand-mocha">No tags</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <CustomerStatusBadge status={customer.status} />
            </TableCell>
            <TableCell>{formatCurrency(customer.totalSalesAmount)}</TableCell>
            <TableCell>{customer.totalOrdersCount ?? "Not tracked"}</TableCell>
            <TableCell>{formatDate(customer.lastPurchaseAt)}</TableCell>
            <TableCell>{formatDate(customer.createdAt)}</TableCell>
            <TableCell>
              <CustomerActionsMenu
                canManage={canManage}
                customer={customer}
                onDelete={onDelete}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
                onView={(selectedCustomer) =>
                  router.push(`${ROUTES.customers}/${selectedCustomer.id}`)
                }
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
