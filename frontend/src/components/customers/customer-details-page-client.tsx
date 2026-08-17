"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/customers/access-denied-card";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomerNotesSection } from "@/components/customers/customer-notes-section";
import { CustomerProfileCard } from "@/components/customers/customer-profile-card";
import { CustomerRecentTransactionsTable } from "@/components/customers/customer-recent-transactions-table";
import { CustomerStatsCards } from "@/components/customers/customer-stats-cards";
import { CustomerStatusBadge } from "@/components/customers/customer-status-badge";
import { CustomerTagsSection } from "@/components/customers/customer-tags-section";
import { CustomersErrorState } from "@/components/customers/customers-error-state";
import { CustomersTableSkeleton } from "@/components/customers/customers-table-skeleton";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useCustomerCredits } from "@/hooks/use-customer-credits";
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
  const creditsQuery = useCustomerCredits(customerId, canView);
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
            <h1 className="font-serif text-4xl text-brand-espresso">{customer.fullName}</h1>
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

      <CustomerStatsCards creditBalance={creditsQuery.data?.balance ?? 0} stats={statsQuery.data} />

      {(creditsQuery.data?.items.length ?? 0) > 0 ? (
        <section className="rounded-3xl border border-brand-cappuccino/60 bg-white/85 p-5">
          <h2 className="text-xl font-semibold text-brand-espresso">Store credit history</h2>
          <div className="mt-4 grid gap-2">
            {(creditsQuery.data?.items ?? []).map((credit) => (
              <div
                className="flex items-center justify-between rounded-2xl border border-brand-cappuccino/60 p-3 text-sm"
                key={credit.id}
              >
                <span className="text-brand-espresso">
                  {credit.notes ||
                    (credit.sourceType === "sales_return"
                      ? "Sales return credit"
                      : credit.sourceType === "bakery_order"
                        ? "Bakery order credit"
                        : "Manual credit")}
                </span>
                <span className="font-semibold text-brand-espresso">
                  {new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(
                    credit.balance,
                  )}
                  <span className="ml-1 text-xs font-normal text-brand-mocha">
                    of{" "}
                    {new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(
                      credit.amount,
                    )}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <CustomerProfileCard customer={customer} />
        <CustomerTagsSection canManage={canManage} customer={customer} />
      </div>

      <CustomerNotesSection canManage={canManage} customerId={customer.id} />

      <CustomerRecentTransactionsTable transactions={statsQuery.data?.recentTransactions ?? []} />

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
