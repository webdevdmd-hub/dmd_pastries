"use client";

import { Mail, Phone } from "lucide-react";
import type { JSX } from "react";

import { CustomerActionsMenu } from "@/components/customers/customer-actions-menu";
import { CustomerStatusBadge } from "@/components/customers/customer-status-badge";
import {
  customerInitials,
  formatCustomerCurrency,
  formatCustomerDate,
} from "@/components/customers/customers-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Customer } from "@/types/customer";

type CustomersCardGridProps = {
  canManage: boolean;
  customers: Customer[];
  onDelete: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onStatusChange: (customer: Customer, status: Customer["status"]) => void;
  onView: (customer: Customer) => void;
};

/**
 * The customers list as cards, for phones: a ten-column ledger has no honest
 * layout below md. Clicking a card opens the details drawer; the kebab stops
 * the click so it does not also open the drawer.
 */
export function CustomersCardGrid({
  canManage,
  customers,
  onDelete,
  onEdit,
  onStatusChange,
  onView,
}: CustomersCardGridProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {customers.map((customer) => (
        <Card
          className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          key={customer.id}
          onClick={() => onView(customer)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <button
              className="flex min-w-0 items-center gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
              <span className="min-w-0">
                <span className="block truncate font-medium text-brand-espresso">
                  {customer.fullName}
                </span>
                <span className="font-mono text-meta text-foreground-muted">
                  {customer.customerCode}
                </span>
              </span>
            </button>
            <div onClick={(event) => event.stopPropagation()}>
              <CustomerActionsMenu
                canManage={canManage}
                customer={customer}
                onDelete={onDelete}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
              />
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <CustomerStatusBadge status={customer.status} />
              {customer.tags.slice(0, 2).map((tag) => (
                <Badge key={tag.id} variant="outline">
                  {tag.tagName}
                </Badge>
              ))}
            </div>
            <div className="grid gap-1.5 text-cell text-brand-espresso">
              <span className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
                <span className="tabular-nums">{customer.phone ?? "No phone"}</span>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
                <span className="truncate">{customer.email ?? "No email"}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Total sales</p>
              <p className="mt-1 text-cell font-medium tabular-nums text-brand-espresso">
                {formatCustomerCurrency(customer.totalSalesAmount)}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-meta text-foreground-muted">Last purchase</p>
              <p className="mt-1 text-cell font-medium tabular-nums text-brand-espresso">
                {formatCustomerDate(customer.lastPurchaseAt)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
