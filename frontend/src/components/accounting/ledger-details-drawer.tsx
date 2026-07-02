"use client";

import { BookOpenText, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useEffect, useState } from "react";

import {
  ChartAccountStatusBadge,
  ChartAccountTypeBadge,
} from "@/components/accounting/chart-account-badges";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { ROUTES } from "@/constants/routes";
import { useLedgerDetails } from "@/hooks/use-accounting";
import { useBranches } from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type { ChartAccount, LedgerDetailsFilters } from "@/types/accounting";

const allValue = "all";

type LedgerDetailsDrawerProps = {
  account: ChartAccount | null;
  onEdit: (account: ChartAccount) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

function defaultFilters(accountId: string): LedgerDetailsFilters {
  return {
    accountId,
    branchId: "",
    dateFrom: "",
    dateTo: "",
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

export function LedgerDetailsDrawer({
  account,
  onEdit,
  onOpenChange,
  open,
}: LedgerDetailsDrawerProps): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canLoadBranches = hasAnyPermission([PERMISSIONS.branchesView, PERMISSIONS.branchesSwitch]);
  const [filters, setFilters] = useState<LedgerDetailsFilters>(defaultFilters(account?.id ?? ""));
  const ledgerQuery = useLedgerDetails(filters, open && account !== null);
  const branchesQuery = useBranches(open && canLoadBranches);
  const branches = (branchesQuery.data ?? []).filter((branch) => branch.status === "active");
  const ledger = ledgerQuery.data;
  const displayAccount = ledger?.account ?? account;
  const currentPage = ledger?.page ?? filters.page;
  const totalPages = ledger?.totalPages ?? 1;

  useEffect(() => {
    if (account?.id) {
      setFilters(defaultFilters(account.id));
    }
  }, [account?.id]);

  const updateFilters = (patch: Partial<LedgerDetailsFilters>, resetPage = true): void => {
    setFilters((current) => ({
      ...current,
      ...patch,
      ...(resetPage ? { page: 1 } : {}),
    }));
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-5xl" side="right">
        <SheetHeader>
          <SheetTitle className="pr-8 text-2xl">
            {displayAccount
              ? `${displayAccount.accountCode} - ${displayAccount.accountName}`
              : "Ledger details"}
          </SheetTitle>
          <SheetDescription>
            Account statement, balances, and posted journal transaction history.
          </SheetDescription>
        </SheetHeader>

        {!displayAccount ? (
          <Skeleton className="mt-6 h-72 rounded-2xl" />
        ) : (
          <div className="mt-6 grid gap-5">
            <Card className="border-brand-cappuccino/70 bg-white/85">
              <CardContent className="grid gap-4 p-4 md:grid-cols-[1.4fr_repeat(3,1fr)]">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Account</p>
                  <p className="mt-1 font-bold text-brand-espresso">
                    {displayAccount.accountCode} - {displayAccount.accountName}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ChartAccountTypeBadge accountType={displayAccount.accountType} />
                    <ChartAccountStatusBadge status={displayAccount.status} />
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Group</p>
                  <p className="mt-1 font-semibold text-brand-espresso">
                    {displayAccount.accountGroup || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Normal</p>
                  <p className="mt-1 font-semibold capitalize text-brand-espresso">
                    {displayAccount.normalBalance}
                  </p>
                </div>
                <div className="flex items-start justify-end">
                  <Button onClick={() => onEdit(displayAccount)} type="button" variant="outline">
                    Edit Account
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Opening</p>
                  <p className="mt-1 text-xl font-bold text-brand-espresso">
                    {money(ledger?.summary.openingBalance ?? 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Debit</p>
                  <p className="mt-1 text-xl font-bold text-brand-espresso">
                    {money(ledger?.summary.periodDebit ?? 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Credit</p>
                  <p className="mt-1 text-xl font-bold text-brand-espresso">
                    {money(ledger?.summary.periodCredit ?? 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Closing</p>
                  <p className="mt-1 text-xl font-bold text-brand-espresso">
                    {money(ledger?.summary.closingBalance ?? 0)}{" "}
                    <span className="text-sm text-brand-mocha">{ledger?.summary.balanceLabel}</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4 lg:grid-cols-[1fr_1fr_1fr_0.8fr]">
              <Select
                disabled={!canLoadBranches}
                onValueChange={(value) =>
                  updateFilters({ branchId: value === allValue ? "" : value })
                }
                value={filters.branchId || allValue}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={allValue}>All branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                aria-label="Date from"
                onChange={(event) => updateFilters({ dateFrom: event.target.value })}
                type="date"
                value={filters.dateFrom}
              />
              <Input
                aria-label="Date to"
                onChange={(event) => updateFilters({ dateTo: event.target.value })}
                type="date"
                value={filters.dateTo}
              />
              <Select
                onValueChange={(sortOrder: "asc" | "desc") => updateFilters({ sortOrder })}
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
            </div>

            {ledgerQuery.isLoading ? <Skeleton className="h-72 rounded-3xl" /> : null}

            {!ledgerQuery.isLoading && ledgerQuery.error ? (
              <Card className="border-red-200 bg-red-50/70">
                <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                  <p className="font-semibold text-brand-espresso">Unable to load ledger details</p>
                  <p className="text-sm text-brand-mocha">{getErrorMessage(ledgerQuery.error)}</p>
                  <Button
                    onClick={() => void ledgerQuery.refetch()}
                    type="button"
                    variant="outline"
                  >
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {!ledgerQuery.isLoading && !ledgerQuery.error && ledger ? (
              ledger.transactions.length === 0 ? (
                <Card className="border-brand-cappuccino/70 bg-white/80">
                  <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                    <BookOpenText className="h-10 w-10 text-brand-mocha" />
                    <p className="font-semibold text-brand-espresso">
                      No posted ledger transactions found.
                    </p>
                    <p className="text-sm text-brand-mocha">
                      Draft journal entries are excluded from account ledgers.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden border-brand-cappuccino/70 bg-white/85">
                  <CardContent className="overflow-hidden p-0">
                    <div className="flex flex-col gap-2 border-b border-brand-cappuccino/70 bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-brand-espresso">
                          Ledger transactions
                        </p>
                        <p className="text-xs text-brand-mocha">
                          Showing {ledger.transactions.length} of {ledger.total} transactions
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
                            <TableHead>Journal Entry No</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Narration</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                            <TableHead className="text-right">Running</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ledger.transactions.map((transaction) => (
                            <TableRow
                              key={`${transaction.entryId}-${transaction.entryDate}-${String(transaction.runningBalance)}`}
                            >
                              <TableCell>{transaction.entryDate}</TableCell>
                              <TableCell className="font-semibold">
                                {transaction.entryNumber}
                              </TableCell>
                              <TableCell>{transaction.referenceNumber || "-"}</TableCell>
                              <TableCell className="max-w-60 truncate">
                                {transaction.narration || "-"}
                              </TableCell>
                              <TableCell className="max-w-60 truncate">
                                {transaction.lineDescription || "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {money(transaction.debitAmount)}
                              </TableCell>
                              <TableCell className="text-right">
                                {money(transaction.creditAmount)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {money(transaction.runningBalance ?? 0)}
                              </TableCell>
                              <TableCell>{transaction.branchName || "Business-level"}</TableCell>
                              <TableCell className="text-right">
                                <Button asChild size="sm" type="button" variant="outline">
                                  <Link href={ROUTES.accountingJournalEntries}>
                                    <ExternalLink className="h-4 w-4" />
                                    View
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
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
                            updateFilters({ page: Math.max(1, currentPage - 1) }, false)
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
              )
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
