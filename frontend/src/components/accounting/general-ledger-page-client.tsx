"use client";

import { BookOpenText } from "lucide-react";
import type { Dispatch, JSX, SetStateAction } from "react";
import { useMemo, useState } from "react";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { ChartAccountTypeBadge } from "@/components/accounting/chart-account-badges";
import { PageHeader } from "@/components/shared/page-header";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useChartAccounts, useGeneralLedgerReport } from "@/hooks/use-accounting";
import { useBranches } from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type { GeneralLedgerFilters } from "@/types/accounting";

const allValue = "all";

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${String(year)}-${month}-${day}`;
}

function defaultLedgerFilters(): GeneralLedgerFilters {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    accountId: "",
    branchId: "",
    dateFrom: dateInputValue(firstDay),
    dateTo: dateInputValue(lastDay),
    limit: 20,
    page: 1,
    sortOrder: "asc",
  };
}

function money(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function updateFilters(
  setFilters: Dispatch<SetStateAction<GeneralLedgerFilters>>,
  patch: Partial<GeneralLedgerFilters>,
  resetPage = true,
): void {
  setFilters((current) => ({
    ...current,
    ...patch,
    ...(resetPage ? { page: 1 } : {}),
  }));
}

export function GeneralLedgerPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.accountingView]);
  const canLoadBranches = hasAnyPermission([PERMISSIONS.branchesView, PERMISSIONS.branchesSwitch]);
  const [filters, setFilters] = useState<GeneralLedgerFilters>(defaultLedgerFilters);
  const ledgerQuery = useGeneralLedgerReport(filters, canView);
  const accountsQuery = useChartAccounts(
    {
      accountGroup: "",
      accountType: "all",
      limit: 500,
      page: 1,
      parentAccountId: "",
      search: "",
      sortBy: "account_code",
      sortOrder: "asc",
      status: "all",
    },
    canView,
  );
  const branchesQuery = useBranches(canView && canLoadBranches);
  const accounts = useMemo(() => accountsQuery.data?.items ?? [], [accountsQuery.data?.items]);
  const branches = useMemo(
    () => (branchesQuery.data ?? []).filter((branch) => branch.status === "active"),
    [branchesQuery.data],
  );
  const ledger = ledgerQuery.data;
  const showRunningBalance = ledger?.showRunningBalance === true;
  const currentPage = ledger?.page ?? filters.page;
  const totalPages = ledger?.totalPages ?? 1;
  const accountOptions = useMemo(
    () => [
      {
        description: "Combined ledger activity",
        label: "All accounts",
        value: allValue,
      },
      ...accounts.map((account) => ({
        description: account.accountType.replace(/_/g, " "),
        keywords: [account.accountCode, account.accountName, account.accountGroup],
        label: `${account.accountCode} - ${account.accountName}`,
        value: account.id,
      })),
    ],
    [accounts],
  );
  const branchOptions = useMemo(
    () => [
      {
        description: "Business-wide ledger activity",
        label: "All branches",
        value: allValue,
      },
      ...branches.map((branch) => ({
        description: branch.code,
        keywords: [branch.code, branch.name],
        label: branch.name,
        value: branch.id,
      })),
    ],
    [branches],
  );

  if (!canView) {
    return (
      <AccountingAccessDeniedCard message="You need `accounting.view` to view General Ledger." />
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        description="Review posted journal entry activity by account, branch, and date range."
        title="General Ledger"
      />

      <Alert>
        <BookOpenText className="h-4 w-4" />
        <AlertTitle>Posted entries only</AlertTitle>
        <AlertDescription>
          Draft vouchers are excluded. Reversed entries and reversal entries are included so ledger
          totals net correctly.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_0.8fr]">
        <SearchableSelect
          ariaLabel="Filter General Ledger by account"
          clearable={false}
          emptyMessage="No accounts found."
          loading={accountsQuery.isLoading}
          loadingMessage="Loading accounts..."
          onValueChange={(value) =>
            updateFilters(setFilters, { accountId: !value || value === allValue ? "" : value })
          }
          options={accountOptions}
          placeholder="All accounts"
          searchPlaceholder="Search by account name or code..."
          value={filters.accountId || allValue}
        />
        <SearchableSelect
          ariaLabel="Filter General Ledger by branch"
          clearable={false}
          disabled={!canLoadBranches}
          emptyMessage="No branches found."
          loading={branchesQuery.isLoading}
          loadingMessage="Loading branches..."
          onValueChange={(value) =>
            updateFilters(setFilters, { branchId: !value || value === allValue ? "" : value })
          }
          options={branchOptions}
          placeholder="All branches"
          searchPlaceholder="Search by branch name or code..."
          value={filters.branchId || allValue}
        />
        <Input
          aria-label="Date from"
          onChange={(event) => updateFilters(setFilters, { dateFrom: event.target.value })}
          type="date"
          value={filters.dateFrom}
        />
        <Input
          aria-label="Date to"
          onChange={(event) => updateFilters(setFilters, { dateTo: event.target.value })}
          type="date"
          value={filters.dateTo}
        />
        <div className="flex gap-2">
          <Select
            onValueChange={(sortOrder: "asc" | "desc") => updateFilters(setFilters, { sortOrder })}
            value={filters.sortOrder}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Oldest first</SelectItem>
              <SelectItem value="desc">Newest first</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => setFilters(defaultLedgerFilters())}
            type="button"
            variant="outline"
          >
            Reset
          </Button>
        </div>
      </div>

      {ledgerQuery.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      ) : null}

      {!ledgerQuery.isLoading && ledgerQuery.error ? (
        <Card className="border-red-200 bg-red-50/70">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-2xl font-semibold text-brand-espresso">
              Unable to load General Ledger
            </h2>
            <p className="max-w-xl text-sm text-brand-mocha">
              {getErrorMessage(ledgerQuery.error)}
            </p>
            <Button onClick={() => void ledgerQuery.refetch()} type="button" variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!ledgerQuery.isLoading && !ledgerQuery.error && ledger ? (
        <>
          <div className={`grid gap-3 ${showRunningBalance ? "md:grid-cols-4" : "md:grid-cols-2"}`}>
            {showRunningBalance ? (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Opening</p>
                  <p className="mt-1 text-xl font-bold text-brand-espresso">
                    {money(ledger.openingBalance)}
                  </p>
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Debit</p>
                <p className="mt-1 text-xl font-bold text-brand-espresso">
                  {money(ledger.periodDebit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Credit</p>
                <p className="mt-1 text-xl font-bold text-brand-espresso">
                  {money(ledger.periodCredit)}
                </p>
              </CardContent>
            </Card>
            {showRunningBalance ? (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Closing</p>
                  <p className="mt-1 text-xl font-bold text-brand-espresso">
                    {money(ledger.closingBalance)}
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </div>

          {ledger.items.length === 0 ? (
            <Card className="border-brand-cappuccino/70 bg-white/80">
              <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
                <BookOpenText className="h-10 w-10 text-brand-mocha" />
                <h2 className="text-2xl font-semibold text-brand-espresso">
                  No ledger activity found.
                </h2>
                <p className="max-w-xl text-sm text-brand-mocha">
                  Adjust the account, branch, or date range to review posted voucher activity.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden border-brand-cappuccino/70 bg-white/85">
              <CardContent className="overflow-hidden p-0">
                <div className="flex flex-col gap-2 border-b border-brand-cappuccino/70 bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-brand-espresso">
                      {ledger.account
                        ? `Account Ledger - ${ledger.account.accountCode} ${ledger.account.accountName}`
                        : "Combined General Ledger"}
                    </p>
                    <p className="text-xs text-brand-mocha">
                      {showRunningBalance
                        ? "Running balance is scoped to this selected account."
                        : "Running balance is hidden because this view combines multiple accounts."}{" "}
                      Showing {ledger.items.length} of {ledger.total} ledger rows
                    </p>
                  </div>
                  <p className="text-xs text-brand-mocha">
                    Page {currentPage} of {totalPages}
                  </p>
                </div>
                <div className="overflow-x-auto bg-white/75 [&>div]:rounded-none">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Entry</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        {showRunningBalance ? (
                          <TableHead className="text-right">Running</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledger.items.map((item) => (
                        <TableRow key={`${item.entryId}-${item.accountId}-${item.lineDescription}`}>
                          <TableCell>{item.entryDate}</TableCell>
                          <TableCell>
                            <span className="block font-bold text-brand-espresso">
                              {item.entryNumber}
                            </span>
                            <span className="block max-w-xs truncate text-xs text-brand-mocha">
                              {item.referenceNumber || item.narration || item.lineDescription}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="block font-semibold text-brand-espresso">
                              {item.accountCode} - {item.accountName}
                            </span>
                            <ChartAccountTypeBadge accountType={item.accountType} />
                          </TableCell>
                          <TableCell>{item.branchName || "Business-level"}</TableCell>
                          <TableCell className="text-right">{money(item.debitAmount)}</TableCell>
                          <TableCell className="text-right">{money(item.creditAmount)}</TableCell>
                          {showRunningBalance ? (
                            <TableCell className="text-right font-semibold">
                              {money(item.runningBalance ?? 0)}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col gap-3 border-t border-brand-cappuccino/70 bg-white/80 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-brand-mocha">Rows per page</span>
                    <Select
                      onValueChange={(value) => updateFilters(setFilters, { limit: Number(value) })}
                      value={String(filters.limit)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <Button
                      disabled={currentPage <= 1 || ledgerQuery.isFetching}
                      onClick={() =>
                        updateFilters(setFilters, { page: Math.max(1, currentPage - 1) }, false)
                      }
                      type="button"
                      variant="outline"
                    >
                      Previous
                    </Button>
                    <span className="min-w-28 text-center text-sm text-brand-mocha">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      disabled={currentPage >= totalPages || ledgerQuery.isFetching}
                      onClick={() => updateFilters(setFilters, { page: currentPage + 1 }, false)}
                      type="button"
                      variant="outline"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
