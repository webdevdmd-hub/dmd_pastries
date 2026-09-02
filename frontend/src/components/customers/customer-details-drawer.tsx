"use client";

import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import { AccessDeniedCard } from "@/components/customers/access-denied-card";
import {
  type CustomerDetailTabKey,
  DEFAULT_CUSTOMER_DETAIL_TAB,
} from "@/components/customers/customer-detail-tabs";
import { CustomerDetailsPanel } from "@/components/customers/customer-details-panel";
import { CustomerStatusBadge } from "@/components/customers/customer-status-badge";
import { CustomersErrorState } from "@/components/customers/customers-error-state";
import { CustomersTableSkeleton } from "@/components/customers/customers-table-skeleton";
import { useCustomerDetailPermissions } from "@/components/customers/use-customer-detail-permissions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";
import { useCustomer } from "@/hooks/use-customers";
import { getErrorMessage } from "@/lib/api/client";
import type { Customer } from "@/types/customer";

type CustomerDetailsDrawerProps = {
  customerId: string | null;
  /** Opens the edit form in the host's own modal flow. */
  onEdit?: ((customer: Customer) => void) | undefined;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

/**
 * One customer's details in a sheet over the customers list, the way a
 * product's details open over the products list. The tab is plain state here:
 * the list's URL stays the list's, and the header offers the full page for
 * anyone who wants a URL to share.
 */
export function CustomerDetailsDrawer({
  customerId,
  onEdit,
  onOpenChange,
  open,
}: CustomerDetailsDrawerProps): JSX.Element {
  const permissions = useCustomerDetailPermissions();
  const customerQuery = useCustomer(customerId, open && customerId !== null && permissions.canView);

  // Radix requires a title in every dialog. The body renders the customer's
  // name; the states before it name the sheet invisibly.
  const fallbackTitle = (
    <SheetHeader className="sr-only">
      <SheetTitle>Customer details</SheetTitle>
      <SheetDescription>Details of the selected customer.</SheetDescription>
    </SheetHeader>
  );

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {!permissions.canView ? (
          <>
            {fallbackTitle}
            <AccessDeniedCard />
          </>
        ) : customerQuery.isLoading ? (
          <>
            {fallbackTitle}
            <CustomersTableSkeleton />
          </>
        ) : customerQuery.error || !customerQuery.data ? (
          <>
            {fallbackTitle}
            <CustomersErrorState
              description={
                customerQuery.error ? getErrorMessage(customerQuery.error) : "Customer not found."
              }
              onRetry={() => void customerQuery.refetch()}
            />
          </>
        ) : (
          // Keyed by customer so switching customers resets the tab.
          <CustomerDetailsDrawerBody
            canManage={permissions.canManage}
            canView={permissions.canView}
            customer={customerQuery.data}
            key={customerQuery.data.id}
            onEdit={onEdit}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CustomerDetailsDrawerBody({
  canManage,
  canView,
  customer,
  onEdit,
}: {
  canManage: boolean;
  canView: boolean;
  customer: Customer;
  onEdit: ((customer: Customer) => void) | undefined;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<CustomerDetailTabKey>(DEFAULT_CUSTOMER_DETAIL_TAB);
  const detailHref = `${ROUTES.customers}/${customer.id}`;

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <SheetTitle className="text-page">{customer.fullName}</SheetTitle>
          <CustomerStatusBadge status={customer.status} />
        </div>
        <SheetDescription className="font-mono text-meta">{customer.customerCode}</SheetDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href={detailHref}>
              <ExternalLink className="h-4 w-4" />
              Open full page
            </Link>
          </Button>
          {canManage && onEdit ? (
            <Button onClick={() => onEdit(customer)} size="sm" type="button" variant="outline">
              <Pencil className="h-4 w-4" />
              Edit customer
            </Button>
          ) : null}
        </div>
      </SheetHeader>

      <CustomerDetailsPanel
        activeTab={activeTab}
        canManage={canManage}
        canView={canView}
        customer={customer}
        onTabChange={setActiveTab}
      />
    </div>
  );
}
