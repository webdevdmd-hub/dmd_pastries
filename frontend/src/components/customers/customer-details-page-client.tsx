"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/customers/access-denied-card";
import {
  CUSTOMER_DETAIL_TAB_QUERY_KEY,
  type CustomerDetailTabKey,
  parseCustomerDetailTab,
} from "@/components/customers/customer-detail-tabs";
import { CustomerDetailsPanel } from "@/components/customers/customer-details-panel";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomerStatusBadge } from "@/components/customers/customer-status-badge";
import { CustomersErrorState } from "@/components/customers/customers-error-state";
import { CustomersTableSkeleton } from "@/components/customers/customers-table-skeleton";
import { useCustomerDetailPermissions } from "@/components/customers/use-customer-detail-permissions";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useCustomer, useUpdateCustomer } from "@/hooks/use-customers";
import { getErrorMessage } from "@/lib/api/client";
import type { UpdateCustomerPayload } from "@/types/customer";

/**
 * The full-page view of one customer at `/customers/[id]`. The customers list
 * opens the same content in a drawer; this page remains for deep links and
 * "open in new tab" from the drawer.
 */
export function CustomerDetailsPageClient({ customerId }: { customerId: string }): JSX.Element {
  const permissions = useCustomerDetailPermissions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const customerQuery = useCustomer(customerId, permissions.canView);
  const updateMutation = useUpdateCustomer();
  const noopCreate = (): Promise<void> => Promise.resolve();

  const activeTab = parseCustomerDetailTab(searchParams.get(CUSTOMER_DETAIL_TAB_QUERY_KEY));

  const changeTab = (tab: CustomerDetailTabKey): void => {
    const next = new URLSearchParams(window.location.search);
    if (tab === "profile") {
      next.delete(CUSTOMER_DETAIL_TAB_QUERY_KEY);
    } else {
      next.set(CUSTOMER_DETAIL_TAB_QUERY_KEY, tab);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (!permissions.canView) {
    return <AccessDeniedCard />;
  }

  if (customerQuery.isLoading) {
    return <CustomersTableSkeleton />;
  }

  if (customerQuery.error || !customerQuery.data) {
    return (
      <CustomersErrorState
        description={
          customerQuery.error ? getErrorMessage(customerQuery.error) : "Customer not found."
        }
        onRetry={() => {
          void customerQuery.refetch();
        }}
      />
    );
  }

  const customer = customerQuery.data;

  const updateCustomer = async (id: string, payload: UpdateCustomerPayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Customer updated.");
      setEditOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            className="inline-flex items-center gap-1.5 text-cell text-foreground-muted transition-colors hover:text-foreground"
            href={ROUTES.customers}
          >
            Back to customers
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-page">{customer.fullName}</h1>
            <CustomerStatusBadge status={customer.status} />
          </div>
          <p className="mt-1 font-mono text-meta text-foreground-muted">{customer.customerCode}</p>
        </div>
        {permissions.canManage ? (
          <Button onClick={() => setEditOpen(true)} type="button" variant="outline">
            Edit customer
          </Button>
        ) : null}
      </div>

      <CustomerDetailsPanel
        activeTab={activeTab}
        canManage={permissions.canManage}
        canView={permissions.canView}
        customer={customer}
        onTabChange={changeTab}
      />

      <CustomerFormDialog
        customer={customer}
        isSubmitting={updateMutation.isPending}
        onClose={() => setEditOpen(false)}
        onCreate={noopCreate}
        onUpdate={updateCustomer}
        open={editOpen}
      />
    </div>
  );
}
