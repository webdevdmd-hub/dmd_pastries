"use client";

import { Landmark, Plus, RefreshCcw } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { ChartAccountFormDialog } from "@/components/accounting/chart-account-form-dialog";
import { ChartAccountsTable } from "@/components/accounting/chart-accounts-table";
import { LedgerDetailsDrawer } from "@/components/accounting/ledger-details-drawer";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PERMISSIONS } from "@/constants/permissions";
import {
  useChartAccounts,
  useCreateChartAccount,
  useDeleteChartAccount,
  useSeedDefaultChartAccounts,
  useUpdateChartAccount,
  useUpdateChartAccountStatus,
} from "@/hooks/use-accounting";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type {
  AccountingAccountStatus,
  AccountingAccountType,
  ChartAccount,
  ChartAccountsFilters,
  CreateChartAccountPayload,
  UpdateChartAccountPayload,
} from "@/types/accounting";

const defaultFilters: ChartAccountsFilters = {
  accountGroup: "",
  accountType: "all",
  limit: 25,
  page: 1,
  parentAccountId: "",
  search: "",
  sortBy: "account_code",
  sortOrder: "asc",
  status: "all",
};

const accountTypes: { label: string; value: AccountingAccountType }[] = [
  { label: "Asset", value: "asset" },
  { label: "Liability", value: "liability" },
  { label: "Equity", value: "equity" },
  { label: "Income", value: "income" },
  { label: "COGS", value: "cogs" },
  { label: "Expense", value: "expense" },
];

type PendingAction =
  | { account: ChartAccount; type: "delete" }
  | { account: ChartAccount; status: AccountingAccountStatus; type: "status" }
  | null;

export function ChartOfAccountsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([
    PERMISSIONS.accountingView,
    PERMISSIONS.accountingAccountsManage,
  ]);
  const canManage = hasAnyPermission([PERMISSIONS.accountingAccountsManage]);
  const [filters, setFilters] = useState<ChartAccountsFilters>(defaultFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartAccount | null>(null);
  const [ledgerAccount, setLedgerAccount] = useState<ChartAccount | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const accountsQuery = useChartAccounts(filters, canView);
  const seedMutation = useSeedDefaultChartAccounts();
  const createMutation = useCreateChartAccount();
  const updateMutation = useUpdateChartAccount();
  const statusMutation = useUpdateChartAccountStatus();
  const deleteMutation = useDeleteChartAccount();
  const accounts = accountsQuery.data?.items ?? [];
  const totalAccounts = accountsQuery.data?.total ?? accounts.length;
  const currentPage = filters.page;
  const totalPages = Math.max(1, Math.ceil(totalAccounts / filters.limit));

  if (!canView) {
    return (
      <AccountingAccessDeniedCard message="You need `accounting.view` to view Chart of Accounts." />
    );
  }

  const updateFilters = (patch: Partial<ChartAccountsFilters>, resetPage = true): void => {
    setFilters((current) => ({
      ...current,
      ...patch,
      ...(resetPage ? { page: 1 } : {}),
    }));
  };

  const openCreate = (): void => {
    setEditingAccount(null);
    setFormOpen(true);
  };

  const handleCreate = async (payload: CreateChartAccountPayload): Promise<void> => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Chart account created.");
      setFormOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string, payload: UpdateChartAccountPayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Chart account updated.");
      setEditingAccount(null);
      setFormOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleSeedDefaults = async (): Promise<void> => {
    try {
      await seedMutation.mutateAsync();
      setFilters((current) => ({ ...current, page: 1 }));
      toast.success("Default chart accounts seeded.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmAction = async (): Promise<void> => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "delete") {
        await deleteMutation.mutateAsync(pendingAction.account.id);
        toast.success("Chart account deleted.");
      } else {
        await statusMutation.mutateAsync({
          id: pendingAction.account.id,
          payload: { status: pendingAction.status },
        });
        toast.success("Chart account status updated.");
      }
      setPendingAction(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={seedMutation.isPending}
                onClick={() => void handleSeedDefaults()}
                type="button"
                variant="outline"
              >
                <RefreshCcw className="h-4 w-4" />
                Seed Defaults
              </Button>
              <Button onClick={openCreate} type="button">
                <Plus className="h-4 w-4" />
                Create Account
              </Button>
            </div>
          ) : undefined
        }
        description="Manage the business-level accounting account master used for future ledger and financial statements."
        title="Chart of Accounts"
      />

      <Alert>
        <Landmark className="h-4 w-4" />
        <AlertTitle>Accounting foundation</AlertTitle>
        <AlertDescription>
          Chart of Accounts is business-level. Branch-wise accounting will be handled later through
          journal entries.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4 lg:grid-cols-[1.5fr_repeat(5,minmax(0,1fr))]">
        <Input
          aria-label="Search chart accounts"
          onChange={(event) => updateFilters({ search: event.target.value })}
          placeholder="Search code, name, group..."
          value={filters.search}
        />
        <Select
          onValueChange={(accountType: ChartAccountsFilters["accountType"]) =>
            updateFilters({ accountType })
          }
          value={filters.accountType}
        >
          <SelectTrigger>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {accountTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Account group"
          onChange={(event) => updateFilters({ accountGroup: event.target.value })}
          placeholder="Group"
          value={filters.accountGroup}
        />
        <Select
          onValueChange={(status: ChartAccountsFilters["status"]) => updateFilters({ status })}
          value={filters.status}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select onValueChange={(sortBy) => updateFilters({ sortBy })} value={filters.sortBy}>
          <SelectTrigger>
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="account_code">Account code</SelectItem>
            <SelectItem value="account_name">Account name</SelectItem>
            <SelectItem value="account_type">Account type</SelectItem>
            <SelectItem value="created_at">Created date</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Select
            onValueChange={(sortOrder: "asc" | "desc") => updateFilters({ sortOrder })}
            value={filters.sortOrder}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Asc</SelectItem>
              <SelectItem value="desc">Desc</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setFilters(defaultFilters)} type="button" variant="outline">
            Reset
          </Button>
        </div>
      </div>

      {accountsQuery.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      ) : null}

      {!accountsQuery.isLoading && accountsQuery.error ? (
        <Card className="border-red-200 bg-red-50/70">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-2xl font-semibold text-brand-espresso">
              Unable to load Chart of Accounts
            </h2>
            <p className="max-w-xl text-sm text-brand-mocha">
              {getErrorMessage(accountsQuery.error)}
            </p>
            <Button onClick={() => void accountsQuery.refetch()} type="button" variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!accountsQuery.isLoading && !accountsQuery.error && accounts.length === 0 ? (
        <Card className="border-brand-cappuccino/70 bg-white/80">
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-2xl bg-brand-latte p-4 text-brand-mocha">
              <Landmark className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-brand-espresso">
                No chart accounts found.
              </h2>
              <p className="mt-2 max-w-xl text-sm text-brand-mocha">
                Seed default accounts or create a custom account to start the accounting master.
              </p>
            </div>
            {canManage ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  disabled={seedMutation.isPending}
                  onClick={() => void handleSeedDefaults()}
                  type="button"
                  variant="outline"
                >
                  Seed Defaults
                </Button>
                <Button onClick={openCreate} type="button">
                  Create Account
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!accountsQuery.isLoading && !accountsQuery.error && accounts.length > 0 ? (
        <Card className="overflow-hidden border-brand-cappuccino/70 bg-white/85">
          <CardContent className="overflow-hidden p-0">
            <div className="flex flex-col gap-2 border-b border-brand-cappuccino/70 bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-espresso">Account master</p>
                <p className="text-xs text-brand-mocha">
                  Showing {accounts.length} of {totalAccounts} accounts
                </p>
              </div>
              <p className="text-xs text-brand-mocha">
                Page {currentPage} of {totalPages}
              </p>
            </div>
            <ChartAccountsTable
              accounts={accounts}
              canManage={canManage}
              onDelete={(account) => setPendingAction({ account, type: "delete" })}
              onEdit={(account) => {
                setEditingAccount(account);
                setFormOpen(true);
              }}
              onViewLedger={setLedgerAccount}
              onStatusChange={(account, status) =>
                setPendingAction({ account, status, type: "status" })
              }
            />
            <div className="flex flex-col gap-3 border-t border-brand-cappuccino/70 bg-white/80 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-brand-mocha">Rows per page</span>
                <Select
                  onValueChange={(value) => updateFilters({ limit: Number(value) })}
                  value={String(filters.limit)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <Button
                  disabled={currentPage <= 1 || accountsQuery.isFetching}
                  onClick={() => updateFilters({ page: Math.max(1, currentPage - 1) }, false)}
                  type="button"
                  variant="outline"
                >
                  Previous
                </Button>
                <span className="min-w-28 text-center text-sm text-brand-mocha">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  disabled={currentPage >= totalPages || accountsQuery.isFetching}
                  onClick={() => updateFilters({ page: currentPage + 1 }, false)}
                  type="button"
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ChartAccountFormDialog
        account={editingAccount}
        accounts={accounts}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setEditingAccount(null);
          setFormOpen(false);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        open={formOpen}
      />

      <LedgerDetailsDrawer
        account={ledgerAccount}
        onEdit={(account) => {
          setLedgerAccount(null);
          setEditingAccount(account);
          setFormOpen(true);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setLedgerAccount(null);
          }
        }}
        open={ledgerAccount !== null}
      />

      <Dialog
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
        open={pendingAction !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "delete" ? "Delete account" : "Change account status"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "delete"
                ? "Only custom accounts without child accounts can be deleted. System accounts are protected."
                : "System accounts cannot be deactivated. Backend accounting rules remain the final authority."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={deleteMutation.isPending || statusMutation.isPending}
              onClick={() => void confirmAction()}
              type="button"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
