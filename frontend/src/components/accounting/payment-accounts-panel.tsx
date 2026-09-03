"use client";

import { Landmark, Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { PaymentAccountDetailsDrawer } from "@/components/accounting/payment-account-details-drawer";
import { PaymentAccountDialog } from "@/components/accounting/payment-account-dialog";
import { PaymentAccountsCardGrid } from "@/components/accounting/payment-accounts-card-grid";
import { PaymentAccountsTable } from "@/components/accounting/payment-accounts-table";
import { useConfirm } from "@/components/app/confirm-provider";
import { EmptyState, FailedState, FilteredState } from "@/components/shared/collection-state";
import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSIONS } from "@/constants/permissions";
import {
  useChartAccounts,
  useCreatePaymentAccount,
  useDeletePaymentAccount,
  usePaymentAccounts,
  useUpdatePaymentAccount,
  useUpdatePaymentAccountStatus,
} from "@/hooks/use-accounting";
import { useBranches } from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import {
  PAYMENT_ACCOUNT_TYPE_LABELS,
  type PaymentAccount,
  type PaymentAccountPayload,
  type PaymentAccountsFilters,
  type PaymentAccountType,
} from "@/types/accounting";

const defaultFilters: PaymentAccountsFilters = {
  accountType: "all",
  branchId: "",
  limit: 25,
  page: 1,
  search: "",
  sortBy: "account_name",
  sortOrder: "asc",
  status: "all",
};

const paymentAccountTypes = (Object.keys(PAYMENT_ACCOUNT_TYPE_LABELS) as PaymentAccountType[]).map(
  (value) => ({ label: PAYMENT_ACCOUNT_TYPE_LABELS[value], value }),
);

/**
 * The Accounts tab of payment setup: the list, its drawer, and its form.
 */
export function PaymentAccountsPanel(): JSX.Element {
  const confirm = useConfirm();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.accountingView]);
  const canManage = hasAnyPermission([PERMISSIONS.accountingAccountsManage]);
  const [filters, setFilters] = useState<PaymentAccountsFilters>(defaultFilters);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<PaymentAccount | null>(null);
  const [detailsAccount, setDetailsAccount] = useState<PaymentAccount | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const accountsQuery = usePaymentAccounts(filters, canView);
  // Form-only data: fetched once on first open and reused after that.
  const branchesQuery = useBranches(canView && dialogOpen);
  const assetAccountsQuery = useChartAccounts(
    {
      accountGroup: "",
      accountType: "asset",
      limit: 100,
      page: 1,
      parentAccountId: "",
      search: "",
      sortBy: "account_code",
      sortOrder: "asc",
      status: "active",
    },
    canView && dialogOpen,
  );
  const createMutation = useCreatePaymentAccount();
  const updateMutation = useUpdatePaymentAccount();
  const statusMutation = useUpdatePaymentAccountStatus();
  const deleteMutation = useDeletePaymentAccount();
  const submitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    statusMutation.isPending ||
    deleteMutation.isPending;
  const hiddenFilterCount =
    (filters.accountType !== "all" ? 1 : 0) + (filters.status !== "all" ? 1 : 0);
  const hasAnyFilter = hiddenFilterCount > 0 || filters.search.trim().length > 0;

  if (!canView) return <AccountingAccessDeniedCard />;

  const update = (patch: Partial<PaymentAccountsFilters>): void => {
    setFilters((current) => ({ ...current, ...patch, page: 1 }));
  };

  const openCreate = (): void => {
    setSelectedAccount(null);
    setDialogOpen(true);
  };

  const openDetails = (account: PaymentAccount): void => {
    setDetailsAccount(account);
    setDetailsOpen(true);
  };

  const openEdit = (account: PaymentAccount): void => {
    // A form on top of a sheet on top of the list is one layer too many, so
    // the drawer closes first. Closing or saving then lands on the list.
    setDetailsOpen(false);
    setSelectedAccount(account);
    setDialogOpen(true);
  };

  const submitAccount = async (payload: PaymentAccountPayload): Promise<void> => {
    try {
      if (selectedAccount) {
        await updateMutation.mutateAsync({ id: selectedAccount.id, payload });
        toast.success("Payment account updated.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Payment account created.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const updateStatus = async (
    account: PaymentAccount,
    status: PaymentAccount["status"],
  ): Promise<void> => {
    try {
      await statusMutation.mutateAsync({ id: account.id, payload: { status } });
      toast.success(`Payment account marked ${status}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const deleteAccount = async (account: PaymentAccount): Promise<void> => {
    setDetailsOpen(false);
    // The one irreversible action here, so it asks first and names the row.
    const confirmed = await confirm({
      cancelLabel: "Keep account",
      confirmLabel: "Delete account",
      consequence: `This permanently deletes ${account.accountName}. It cannot be undone.`,
      detail: "Payment methods linked to it will need a new account before checkout can use them.",
      title: "Delete this payment account?",
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(account.id);
      toast.success("Payment account deleted.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const accounts = accountsQuery.data?.items ?? [];
  const listHandlers = {
    accounts,
    canManage,
    onDelete: (account: PaymentAccount) => {
      void deleteAccount(account);
    },
    onEdit: openEdit,
    onStatusChange: (account: PaymentAccount, status: PaymentAccount["status"]) => {
      void updateStatus(account, status);
    },
    onView: openDetails,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-title">Payment accounts</h2>
          <p className="text-cell text-foreground-muted">
            Manage where cash, bank, card, and platform money is held and accounted.
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreate} type="button">
            <Plus className="h-4 w-4" />
            Create account
          </Button>
        ) : null}
      </div>

      <FilterToolbar
        hasAnyFilter={hasAnyFilter}
        hiddenFilterCount={hiddenFilterCount}
        hideDensityBelowMd
        onReset={() => setFilters(defaultFilters)}
        onSearchChange={(search) => update({ search })}
        popoverTitle="Filter payment accounts"
        searchAriaLabel="Search payment accounts"
        searchPlaceholder="Search account..."
        searchValue={filters.search}
      >
        <FilterField htmlFor="paymentAccountsFilterType" label="Account type">
          <Select
            onValueChange={(accountType) =>
              update({ accountType: accountType as PaymentAccountsFilters["accountType"] })
            }
            value={filters.accountType}
          >
            <SelectTrigger id="paymentAccountsFilterType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {paymentAccountTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField htmlFor="paymentAccountsFilterStatus" label="Status">
          <Select
            onValueChange={(status) =>
              update({ status: status as PaymentAccountsFilters["status"] })
            }
            value={filters.status}
          >
            <SelectTrigger id="paymentAccountsFilterStatus">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterToolbar>

      {accountsQuery.isLoading ? (
        <Card>
          <CardContent className="p-6 text-cell text-foreground-muted">
            Loading payment accounts...
          </CardContent>
        </Card>
      ) : null}

      {accountsQuery.error ? (
        <FailedState
          detail={getErrorMessage(accountsQuery.error)}
          noun="payment accounts"
          onRetry={() => {
            void accountsQuery.refetch();
          }}
        />
      ) : null}

      {!accountsQuery.isLoading && !accountsQuery.error && accounts.length === 0 && hasAnyFilter ? (
        <FilteredState
          noun="payment accounts"
          onClearFilters={() => setFilters(defaultFilters)}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!accountsQuery.isLoading &&
      !accountsQuery.error &&
      accounts.length === 0 &&
      !hasAnyFilter ? (
        <EmptyState
          action={canManage ? { label: "Create account", onClick: openCreate } : undefined}
          description="Payment accounts are where money is held and reconciled, such as Cash Box, Card Clearing, or a bank account. Each links to an asset ledger."
          icon={Landmark}
          title="No payment accounts yet"
        />
      ) : null}

      {/* Cards below md, the table from md up. */}
      {!accountsQuery.isLoading && !accountsQuery.error && accounts.length > 0 ? (
        <>
          <div className="md:hidden">
            <PaymentAccountsCardGrid {...listHandlers} />
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <PaymentAccountsTable {...listHandlers} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <PaymentAccountDetailsDrawer
        account={detailsAccount}
        canManage={canManage}
        onEdit={openEdit}
        onOpenChange={setDetailsOpen}
        open={detailsOpen}
      />

      <PaymentAccountDialog
        account={selectedAccount}
        branches={branchesQuery.data ?? []}
        chartAccounts={assetAccountsQuery.data?.items ?? []}
        onOpenChange={setDialogOpen}
        onSubmit={submitAccount}
        open={dialogOpen}
        submitting={submitting}
      />
    </div>
  );
}
