"use client";

import {
  BookOpenText,
  Edit,
  Landmark,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { ChartAccountDetailPanel } from "@/components/accounting/chart-account-detail-panel";
import { ChartAccountFormDialog } from "@/components/accounting/chart-account-form-dialog";
import { LedgerDetailsDrawer } from "@/components/accounting/ledger-details-drawer";
import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useIsDesktop } from "@/hooks/use-media-query";
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

function formatAccountingLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  // Below lg the detail has no column to live in, so tapping a row opens it
  // over the list instead of parking it under a full page of accounts.
  const [detailOpen, setDetailOpen] = useState(false);
  // Not a CSS class: hiding only the sheet content still mounts the overlay,
  // which dimmed and blurred the desktop page behind nothing.
  const isDesktop = useIsDesktop();
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
  const displayAccount = selectedAccount;
  // Branch is scope, not a filter, and never counts toward the badge.
  const hiddenFilterCount =
    (filters.accountType === "all" ? 0 : 1) +
    (filters.status === "all" ? 0 : 1) +
    (filters.sortBy === defaultFilters.sortBy ? 0 : 1);
  const hasAnyFilter = hiddenFilterCount > 0 || filters.search.length > 0;

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
      setDetailOpen(false);
      setLedgerAccount(displayAccount);
    }
  };

  const resetFilters = (): void => {
    updateFilters({
      accountType: defaultFilters.accountType,
      search: "",
      sortBy: defaultFilters.sortBy,
      status: defaultFilters.status,
    });
  };

  /** One set of handlers for both the inline panel and the phone drawer. */
  const detailPanelProps = (account: ChartAccount) => ({
    account,
    canManage,
    isLoading: ledgerPreviewQuery.isLoading,
    ledgerError: ledgerPreviewQuery.error,
    ledgerErrorMessage: ledgerPreviewQuery.error ? getErrorMessage(ledgerPreviewQuery.error) : "",
    ledgerPreview,
    onDelete: () => {
      setDetailOpen(false);
      setPendingAction({ account, type: "delete" });
    },
    onEdit: () => {
      setDetailOpen(false);
      openEditAccount(account);
    },
    onRetryLedger: () => void ledgerPreviewQuery.refetch(),
    onShowFullLedger: openFullLedger,
    onToggleStatus: () => {
      setDetailOpen(false);
      setPendingAction({
        account,
        status: account.status === "active" ? "inactive" : "active",
        type: "status",
      });
    },
  });

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

      {/* The forced 720px only makes sense once there is a second column to
          fill; on a phone it padded the page with empty card. */}
      <div className="grid overflow-hidden rounded-3xl border border-brand-cappuccino/70 bg-card shadow-sm lg:min-h-[720px] lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="flex min-h-0 min-w-0 flex-col border-b border-brand-cappuccino/70 bg-card lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 border-b border-brand-cappuccino/60 px-4 py-4">
            <div className="min-w-0">
              <h2 className="text-section font-medium text-brand-espresso">All accounts</h2>
              <p className="text-meta tabular-nums text-brand-mocha">
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

          <div className="min-w-0 border-b border-brand-cappuccino/60 bg-brand-latte/25 p-4">
            <FilterToolbar
              hasAnyFilter={hasAnyFilter}
              hiddenFilterCount={hiddenFilterCount}
              hideDensityBelowMd
              onReset={resetFilters}
              onSearchChange={(search) => updateFilters({ search })}
              popoverTitle="Filter accounts"
              searchAriaLabel="Search chart accounts"
              searchPlaceholder="Search name or code..."
              searchValue={filters.search}
            >
              <FilterField htmlFor="account-type-filter" label="Account type">
                <Select
                  onValueChange={(accountType: ChartAccountsFilters["accountType"]) =>
                    updateFilters({ accountType })
                  }
                  value={filters.accountType}
                >
                  <SelectTrigger id="account-type-filter">
                    <SelectValue placeholder="All types" />
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
              </FilterField>

              <FilterField htmlFor="account-status-filter" label="Status">
                <Select
                  onValueChange={(status: ChartAccountsFilters["status"]) =>
                    updateFilters({ status })
                  }
                  value={filters.status}
                >
                  <SelectTrigger id="account-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField htmlFor="account-sort" label="Sort by">
                <Select
                  onValueChange={(sortBy) => updateFilters({ sortBy })}
                  value={filters.sortBy}
                >
                  <SelectTrigger id="account-sort">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account_code">Code</SelectItem>
                    <SelectItem value="account_name">Name</SelectItem>
                    <SelectItem value="account_type">Type</SelectItem>
                    <SelectItem value="created_at">Created</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
            </FilterToolbar>
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
                      onClick={() => {
                        setSelectedAccountId(account.id);
                        setDetailOpen(true);
                      }}
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

        <section className="hidden min-w-0 bg-card lg:block">
          {!displayAccount ? (
            <div className="flex min-h-[620px] flex-col items-center justify-center gap-3 p-8 text-center">
              <BookOpenText className="h-12 w-12 text-brand-mocha" />
              <p className="text-section font-medium text-brand-espresso">Select an account</p>
              <p className="max-w-md text-cell text-brand-mocha">
                Choose an account from the left to view balances and recent ledger transactions.
              </p>
            </div>
          ) : (
            <ChartAccountDetailPanel {...detailPanelProps(displayAccount)} />
          )}
        </section>
      </div>

      {/* The same panel as the desktop column, over the list. */}
      <Sheet
        onOpenChange={setDetailOpen}
        open={detailOpen && !isDesktop && displayAccount !== null}
      >
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl" side="right">
          {displayAccount ? (
            <>
              <SheetHeader className="space-y-0 border-b border-brand-cappuccino/60 bg-brand-latte/20 px-4 py-5">
                <p className="text-meta font-medium text-brand-mocha">
                  {formatAccountingLabel(displayAccount.accountType)}
                </p>
                <SheetTitle className="break-words text-section">
                  {displayAccount.accountName}
                </SheetTitle>
                <SheetDescription className="text-cell text-brand-mocha">
                  Account code {displayAccount.accountCode}
                  {displayAccount.parentAccountName
                    ? ` - Parent ${displayAccount.parentAccountName}`
                    : ""}
                </SheetDescription>
                <div className="flex flex-wrap gap-2 pt-3">
                  <Button
                    disabled={!canManage}
                    onClick={() => {
                      setDetailOpen(false);
                      openEditAccount(displayAccount);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  {canManage ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label="Account actions"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Account actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => {
                            setDetailOpen(false);
                            setPendingAction({
                              account: displayAccount,
                              status: displayAccount.status === "active" ? "inactive" : "active",
                              type: "status",
                            });
                          }}
                        >
                          {displayAccount.status === "active" ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-danger-text focus:text-danger-text"
                          disabled={displayAccount.isSystemAccount}
                          onClick={() => {
                            setDetailOpen(false);
                            setPendingAction({ account: displayAccount, type: "delete" });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </SheetHeader>
              <ChartAccountDetailPanel {...detailPanelProps(displayAccount)} showHeader={false} />
            </>
          ) : (
            // Radix requires a title on every open sheet.
            <SheetHeader className="p-4">
              <SheetTitle className="sr-only">Account</SheetTitle>
              <SheetDescription>No account selected.</SheetDescription>
            </SheetHeader>
          )}
        </SheetContent>
      </Sheet>

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
