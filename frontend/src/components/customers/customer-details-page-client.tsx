"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/customers/access-denied-card";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomerNotesSection } from "@/components/customers/customer-notes-section";
import { CustomerProfileCard } from "@/components/customers/customer-profile-card";
import { CustomerStatsCards } from "@/components/customers/customer-stats-cards";
import { CustomerStatusBadge } from "@/components/customers/customer-status-badge";
import { CustomerTagsSection } from "@/components/customers/customer-tags-section";
import { CustomersErrorState } from "@/components/customers/customers-error-state";
import { CustomersTableSkeleton } from "@/components/customers/customers-table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useCustomer, useCustomerStats, useUpdateCustomer } from "@/hooks/use-customers";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type { UpdateCustomerPayload } from "@/types/customer";

export function CustomerDetailsPageClient({ customerId }: { customerId: string }): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.customersView, PERMISSIONS.posView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.customersEdit,
    PERMISSIONS.customersStatusUpdate,
    PERMISSIONS.customersNotesManage,
    PERMISSIONS.customersTagsManage,
    PERMISSIONS.posSell,
  ]);
  const [editOpen, setEditOpen] = useState(false);
  const customerQuery = useCustomer(customerId, canView);
  const statsQuery = useCustomerStats(customerId, canView);
  const updateMutation = useUpdateCustomer();
  const noopCreate = (): Promise<void> => Promise.resolve();

  if (!canView) {
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            className="text-sm font-semibold text-brand-mocha hover:text-brand-espresso"
            href={ROUTES.customers}
          >
            Back to Customers
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl text-brand-espresso">{customer.fullName}</h1>
            <CustomerStatusBadge status={customer.status} />
          </div>
          <p className="mt-2 text-sm text-brand-mocha">{customer.customerCode}</p>
        </div>
        {canManage ? (
          <Button onClick={() => setEditOpen(true)} type="button">
            Edit customer
          </Button>
        ) : null}
      </div>

      <CustomerStatsCards stats={statsQuery.data} />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <CustomerProfileCard customer={customer} />
        <CustomerTagsSection canManage={canManage} customer={customer} />
      </div>

      <CustomerNotesSection canManage={canManage} customerId={customer.id} />

      <Card className="bg-white/80">
        <CardHeader>
          <CardTitle>Purchase history</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-brand-mocha">
            Purchase history will be connected from POS sales as the sales timeline API matures.
          </p>
        </CardContent>
      </Card>

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
