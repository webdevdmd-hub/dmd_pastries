"use client";

import {
  BookOpenText,
  Edit,
  Landmark,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import {
  ChartAccountStatusBadge,
  ChartAccountTypeBadge,
} from "@/components/accounting/chart-account-badges";
import { ChartAccountFormDialog } from "@/components/accounting/chart-account-form-dialog";
import { LedgerDetailsDrawer } from "@/components/accounting/ledger-details-drawer";
import { PageHeader } from "@/components/shared/page-header";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS } from "@/constants/permissions";
import {
  useChartAccounts,
  useCreateChartAccount,
  useDeleteChartAccount,
  useLedgerDetails,
  useSeedDefaultChartAccounts,
  useUpdateChartAccount,
  useUpdateChartAccountStatus,
} from "@/hooks/use-accounting";
import { useBranchScope } from "@/hooks/use-branch-scope";
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
  branchId: "",
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

function money(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function formatAccountingLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "-";
}

export function ChartOfAccountsPageClient(): JSX.Element {
  const branchScope = useBranchScope();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([
    PERMISSIONS.accountingView,
    PERMISSIONS.accountingAccountsManage,
  ]);
  const canManage = hasAnyPermission([PERMISSIONS.accountingAccountsManage]);
  const [filters, setFilters] = useState<ChartAccountsFilters>({
    ...defaultFilters,
    branchId: branchScope.effectiveBranchId ?? "",
  });
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartAccount | null>(null);
  const [ledgerAccount, setLedgerAccount] = useState<ChartAccount | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const accountsQuery = useChartAccounts(filters, canView && Boolean(filters.branchId));
  const seedMutation = useSeedDefaultChartAccounts();
  const createMutation = useCreateChartAccount();
  const updateMutation = useUpdateChartAccount();
  const statusMutation = useUpdateChartAccountStatus();
  const deleteMutation = useDeleteChartAccount();
  const accounts = useMemo(() => accountsQuery.data?.items ?? [], [accountsQuery.data?.items]);
  const totalAccounts = accountsQuery.data?.total ?? accounts.length;
  const currentPage = filters.page;
  const totalPages = Math.max(1, Math.ceil(totalAccounts / filters.limit));
  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;
  const ledgerPreviewFilters = useMemo(
    () => ({
      accountId: selectedAccount?.id ?? "",
      branchId: filters.branchId ?? "",
      dateFrom: "",
      dateTo: "",
      limit: 5,
      page: 1,
      sortOrder: "desc" as const,
    }),
    [filters.branchId, selectedAccount?.id],
  );
  const ledgerPreviewQuery = useLedgerDetails(
    ledgerPreviewFilters,
    canView && selectedAccount !== null,
  );
  const ledgerPreview = ledgerPreviewQuery.data;
  const displayAccount = ledgerPreview?.account ?? selectedAccount;
  const recentTransactions = ledgerPreview?.transactions ?? [];

  useEffect(() => {
    const branchID = branchScope.effectiveBranchId ?? "";
    setFilters((current) =>
      current.branchId === branchID ? current : { ...current, branchId: branchID, page: 1 },
    );
    setSelectedAccountId("");
  }, [branchScope.effectiveBranchId]);

  useEffect(() => {
    if (accounts.length === 0) {
      if (selectedAccountId) {
        setSelectedAccountId("");
      }
      return;
    }

    if (!selectedAccountId || !accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0]?.id ?? "");
    }
  }, [accounts, selectedAccountId]);

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
      const createdAccount = await createMutation.mutateAsync({
        ...payload,
        branchId: filters.branchId ?? "",
      });
      toast.success("Chart account created.");
      setSelectedAccountId(createdAccount.id);
      setFormOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string, payload: UpdateChartAccountPayload): Promise<void> => {
    try {
      const updatedAccount = await updateMutation.mutateAsync({ id, payload });
      toast.success("Chart account updated.");
      setSelectedAccountId(updatedAccount.id);
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
        if (selectedAccountId === pendingAction.account.id) {
          setSelectedAccountId("");
        }
      } else {
        const updatedAccount = await statusMutation.mutateAsync({
          id: pendingAction.account.id,
          payload: { status: pendingAction.status },
        });
        toast.success("Chart account status updated.");
        setSelectedAccountId(updatedAccount.id);
      }
      setPendingAction(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const openEditAccount = (account: ChartAccount): void => {
    setEditingAccount(account);
    setFormOpen(true);
  };

  const openFullLedger = (): void => {
    if (displayAccount) {
      setLedgerAccount(displayAccount);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
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
        description="Open a ledger to review balances, recent transactions, and full account history."
        title="Chart of Accounts"
      />

      <div className="grid min-h-[720px] overflow-hidden rounded-3xl border border-brand-cappuccino/70 bg-card shadow-sm lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-brand-cappuccino/70 bg-card lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 border-b border-brand-cappuccino/60 px-4 py-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-brand-espresso">All Accounts</h2>
                <Select
                  onValueChange={(accountType: ChartAccountsFilters["accountType"]) =>
                    updateFilters({ accountType })
                  }
                  value={filters.accountType}
                >
                  <SelectTrigger
                    aria-label="Filter account type"
                    className="h-8 w-9 border-0 bg-transparent p-0 shadow-none"
                  >
                    <SelectValue />
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
              </div>
              <p className="text-xs text-brand-mocha">
                Showing {accounts.length} of {totalAccounts} accounts
              </p>
            </div>
            {canManage ? (
              <div className="flex gap-2">
                <Button aria-label="Create account" onClick={openCreate} size="icon" type="button">
                  <Plus className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label="More account actions"
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={seedMutation.isPending}
                      onClick={() => void handleSeedDefaults()}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Seed defaults
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>

          <div className="border-b border-brand-cappuccino/60 bg-brand-latte/25 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mocha" />
              <Input
                aria-label="Search chart accounts"
                className="pl-9"
                onChange={(event) => updateFilters({ search: event.target.value })}
                placeholder="Search account name or code..."
                value={filters.search}
              />
            </div>
            {filters.search ? (
              <div className="mt-3 rounded-2xl border border-money/30 bg-money-tint/80 p-3 text-sm text-money-text">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold italic">Search Criteria</p>
                    <ul className="mt-1 list-disc pl-4 text-xs">
                      <li>
                        Account Name contains <strong>{filters.search}</strong>
                      </li>
                      <li>
                        Account Code contains <strong>{filters.search}</strong>
                      </li>
                    </ul>
                  </div>
                  <Button
                    aria-label="Clear search"
                    className="h-7 w-7"
                    onClick={() => updateFilters({ search: "" })}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    ×
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Select
                onValueChange={(status: ChartAccountsFilters["status"]) =>
                  updateFilters({ status })
                }
                value={filters.status}
              >
                <SelectTrigger aria-label="Filter status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={(sortBy) => updateFilters({ sortBy })} value={filters.sortBy}>
                <SelectTrigger aria-label="Sort accounts">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account_code">Code</SelectItem>
                  <SelectItem value="account_name">Name</SelectItem>
                  <SelectItem value="account_type">Type</SelectItem>
                  <SelectItem value="created_at">Created</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {accountsQuery.isLoading ? (
              <div className="grid gap-2 p-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 rounded-2xl" />
                ))}
              </div>
            ) : null}

            {!accountsQuery.isLoading && accountsQuery.error ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
                <Landmark className="h-10 w-10 text-danger-text" />
                <p className="font-semibold text-brand-espresso">Unable to load accounts</p>
                <p className="text-sm text-brand-mocha">{getErrorMessage(accountsQuery.error)}</p>
                <Button
                  onClick={() => void accountsQuery.refetch()}
                  type="button"
                  variant="outline"
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {!accountsQuery.isLoading && !accountsQuery.error && accounts.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
                <Landmark className="h-10 w-10 text-brand-mocha" />
                <p className="font-semibold text-brand-espresso">No chart accounts found.</p>
                <p className="text-sm text-brand-mocha">
                  Seed defaults or create a new account to start the account master.
                </p>
                {canManage ? (
                  <Button onClick={openCreate} type="button">
                    Create Account
                  </Button>
                ) : null}
              </div>
            ) : null}

            {!accountsQuery.isLoading && !accountsQuery.error
              ? accounts.map((account) => {
                  const isSelected = account.id === selectedAccount?.id;

                  return (
                    <button
                      className={`flex w-full items-start gap-3 border-b border-brand-cappuccino/40 px-4 py-4 text-left transition-colors hover:bg-brand-latte/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-caramel ${
                        isSelected ? "bg-brand-latte/60" : "bg-card"
                      }`}
                      key={account.id}
                      onClick={() => setSelectedAccountId(account.id)}
                      type="button"
                    >
                      <span
                        className={`mt-1 h-4 w-4 rounded border ${
                          isSelected
                            ? "border-brand-caramel bg-brand-caramel"
                            : "border-brand-cappuccino bg-card"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-brand-espresso">
                          {account.accountCode} - {account.accountName}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-brand-mocha">
                          <span>{formatAccountingLabel(account.accountType)}</span>
                          {account.accountGroup ? (
                            <span>· {formatAccountingLabel(account.accountGroup)}</span>
                          ) : null}
                          {!account.allowManualPosting ? <span>· Control</span> : null}
                        </span>
                      </span>
                    </button>
                  );
                })
              : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-brand-cappuccino/60 px-4 py-3">
            <Button
              disabled={currentPage <= 1 || accountsQuery.isFetching}
              onClick={() => updateFilters({ page: Math.max(1, currentPage - 1) }, false)}
              size="sm"
              type="button"
              variant="outline"
            >
              Previous
            </Button>
            <span className="text-xs text-brand-mocha">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              disabled={currentPage >= totalPages || accountsQuery.isFetching}
              onClick={() => updateFilters({ page: currentPage + 1 }, false)}
              size="sm"
              type="button"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </aside>

        <section className="min-w-0 bg-card">
          {!displayAccount ? (
            <div className="flex min-h-[620px] flex-col items-center justify-center gap-3 p-8 text-center">
              <BookOpenText className="h-12 w-12 text-brand-mocha" />
              <p className="text-xl font-semibold text-brand-espresso">Select an account</p>
              <p className="max-w-md text-sm text-brand-mocha">
                Choose an account from the left to view balances and recent ledger transactions.
              </p>
            </div>
          ) : (
            <div className="flex min-h-full flex-col">
              <div className="flex flex-col gap-4 border-b border-brand-cappuccino/60 bg-brand-latte/20 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold text-brand-mocha">
                    {formatAccountingLabel(displayAccount.accountType)}
                  </p>
                  <h2 className="mt-1 text-3xl font-bold tracking-tight text-brand-espresso">
                    {displayAccount.accountName}
                  </h2>
                  <p className="mt-1 text-sm text-brand-mocha">
                    Account code {displayAccount.accountCode}
                    {displayAccount.parentAccountName
                      ? ` · Parent ${displayAccount.parentAccountName}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!canManage}
                    onClick={() => openEditAccount(displayAccount)}
                    type="button"
                    variant="outline"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  {canManage ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-label="Account actions" type="button" variant="outline">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Account actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() =>
                            setPendingAction({
                              account: displayAccount,
                              status: displayAccount.status === "active" ? "inactive" : "active",
                              type: "status",
                            })
                          }
                        >
                          {displayAccount.status === "active" ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-danger-text focus:text-danger-text"
                          disabled={displayAccount.isSystemAccount}
                          onClick={() =>
                            setPendingAction({ account: displayAccount, type: "delete" })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-6 px-6 py-6">
                <div>
                  <p className="text-xs font-semibold text-brand-mocha">Closing Balance</p>
                  {ledgerPreviewQuery.isLoading ? (
                    <Skeleton className="mt-2 h-10 w-64 rounded-xl" />
                  ) : (
                    <p className="mt-1 text-4xl font-semibold tracking-tight text-brand-caramel">
                      {money(ledgerPreview?.summary.closingBalance ?? 0)}
                      <span className="ml-2 text-lg text-brand-mocha">
                        ({ledgerPreview?.summary.balanceLabel ?? displayAccount.normalBalance})
                      </span>
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ChartAccountTypeBadge accountType={displayAccount.accountType} />
                    <ChartAccountStatusBadge status={displayAccount.status} />
                    <span className="rounded-full border border-brand-cappuccino/70 px-3 py-1 text-xs font-medium text-brand-mocha">
                      {formatAccountingLabel(
                        displayAccount.accountGroup ? displayAccount.accountGroup : "No group",
                      )}
                    </span>
                    <span className="rounded-full border border-brand-cappuccino/70 px-3 py-1 text-xs font-medium text-brand-mocha">
                      {displayAccount.allowManualPosting
                        ? "Manual posting allowed"
                        : "Control account"}
                    </span>
                  </div>
                  {displayAccount.description ? (
                    <p className="mt-5 max-w-4xl text-base text-brand-espresso">
                      <span className="font-semibold italic">Description :</span>{" "}
                      {displayAccount.description}
                    </p>
                  ) : (
                    <p className="mt-5 max-w-4xl text-base text-brand-mocha">
                      No description is set for this account.
                    </p>
                  )}
                </div>

                <Separator className="border-dashed bg-transparent" />

                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    ["Opening", ledgerPreview?.summary.openingBalance ?? 0],
                    ["Debit", ledgerPreview?.summary.periodDebit ?? 0],
                    ["Credit", ledgerPreview?.summary.periodCredit ?? 0],
                    ["Closing", ledgerPreview?.summary.closingBalance ?? 0],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-2xl border border-brand-cappuccino/60 bg-brand-latte/20 p-4"
                      key={label}
                    >
                      <p className="text-xs font-semibold text-brand-mocha">{label}</p>
                      <p className="mt-2 text-lg font-bold text-brand-espresso">
                        {money(Number(value))}
                      </p>
                    </div>
                  ))}
                </div>

                <Card className="overflow-hidden border-brand-cappuccino/70 bg-card shadow-none">
                  <CardContent className="p-0">
                    <div className="flex flex-col gap-3 border-b border-brand-cappuccino/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-brand-espresso">
                          Recent Transactions
                        </h3>
                        <p className="text-sm text-brand-mocha">
                          Latest posted ledger activity for this account.
                        </p>
                      </div>
                      <Button
                        disabled={ledgerPreviewQuery.isLoading || ledgerPreviewQuery.isError}
                        onClick={openFullLedger}
                        type="button"
                        variant="outline"
                      >
                        Show more details
                      </Button>
                    </div>

                    {ledgerPreviewQuery.isLoading ? (
                      <div className="grid gap-2 p-4">
                        <Skeleton className="h-12 rounded-xl" />
                        <Skeleton className="h-12 rounded-xl" />
                        <Skeleton className="h-12 rounded-xl" />
                      </div>
                    ) : null}

                    {!ledgerPreviewQuery.isLoading && ledgerPreviewQuery.error ? (
                      <div className="flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-center">
                        <p className="font-semibold text-brand-espresso">
                          Unable to load recent transactions
                        </p>
                        <p className="text-sm text-brand-mocha">
                          {getErrorMessage(ledgerPreviewQuery.error)}
                        </p>
                        <Button
                          onClick={() => void ledgerPreviewQuery.refetch()}
                          type="button"
                          variant="outline"
                        >
                          Retry
                        </Button>
                      </div>
                    ) : null}

                    {!ledgerPreviewQuery.isLoading && !ledgerPreviewQuery.error ? (
                      recentTransactions.length === 0 ? (
                        <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center">
                          <BookOpenText className="h-9 w-9 text-brand-mocha" />
                          <p className="font-semibold text-brand-espresso">
                            No posted transactions yet.
                          </p>
                          <p className="text-sm text-brand-mocha">
                            Draft journals are excluded until posted.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Transaction Details</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {recentTransactions.map((transaction) => (
                                <TableRow
                                  key={`${transaction.entryId}-${String(transaction.runningBalance)}`}
                                >
                                  <TableCell>{formatDate(transaction.entryDate)}</TableCell>
                                  <TableCell>
                                    <p className="font-medium text-brand-espresso">
                                      {transaction.narration.trim().length > 0
                                        ? transaction.narration
                                        : transaction.lineDescription.trim().length > 0
                                          ? transaction.lineDescription
                                          : "--"}
                                    </p>
                                    <p className="text-xs text-brand-mocha">
                                      {transaction.entryNumber}
                                      {transaction.referenceNumber
                                        ? ` - Ref ${transaction.referenceNumber}`
                                        : ""}
                                    </p>
                                  </TableCell>
                                  <TableCell>
                                    {formatAccountingLabel(transaction.accountType)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {transaction.debitAmount ? money(transaction.debitAmount) : "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {transaction.creditAmount
                                      ? money(transaction.creditAmount)
                                      : "-"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </section>
      </div>

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
