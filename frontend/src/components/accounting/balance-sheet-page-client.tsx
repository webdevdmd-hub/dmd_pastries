"use client";

import { Landmark, RefreshCw, Scale } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { ChartAccountTypeBadge } from "@/components/accounting/chart-account-badges";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { useBalanceSheetReport } from "@/hooks/use-accounting";
import { useBranches } from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type {
  BalanceSheetFilters,
  BalanceSheetItem,
  BalanceSheetSection,
} from "@/types/accounting";

const allValue = "all";

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${String(year)}-${month}-${day}`;
}

function defaultBalanceSheetFilters(): BalanceSheetFilters {
  return {
    asOfDate: dateInputValue(new Date()),
    branchId: "",
  };
}

function money(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function BalanceSheetSectionCard({
  section,
  title,
}: {
  section: BalanceSheetSection;
  title: string;
}): JSX.Element {
  return (
    <Card className="overflow-hidden border-brand-cappuccino/70 bg-white/85">
      <CardContent className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-brand-cappuccino/70 bg-white/80 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-brand-espresso">{title}</p>
            <p className="text-xs text-brand-mocha">{section.items.length} accounts</p>
          </div>
          <p className="text-lg font-bold text-brand-espresso">{money(section.total)}</p>
        </div>
        {section.items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-brand-mocha">
            No accounts reported in this section.
          </div>
        ) : (
          <div className="overflow-x-auto bg-white/75 [&>div]:rounded-none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.items.map((item: BalanceSheetItem) => (
                  <TableRow key={item.accountId}>
                    <TableCell>
                      <span className="block font-bold text-brand-espresso">
                        {item.accountCode} - {item.accountName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ChartAccountTypeBadge accountType={item.accountType} />
                    </TableCell>
                    <TableCell className="text-brand-mocha">{item.accountGroup}</TableCell>
                    <TableCell className="text-right font-semibold">{money(item.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BalanceSheetPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.accountingView]);
  const canLoadBranches = hasAnyPermission([PERMISSIONS.branchesView, PERMISSIONS.branchesSwitch]);
  const [filters, setFilters] = useState<BalanceSheetFilters>(defaultBalanceSheetFilters);
  const balanceSheetQuery = useBalanceSheetReport(filters, canView);
  const branchesQuery = useBranches(canView && canLoadBranches);
  const branches = (branchesQuery.data ?? []).filter((branch) => branch.status === "active");
  const balanceSheet = balanceSheetQuery.data;

  if (!canView) {
    return (
      <AccountingAccessDeniedCard message="You need `accounting.view` to view Balance Sheet." />
    );
  }

  const updateFilters = (patch: Partial<BalanceSheetFilters>): void => {
    setFilters((current) => ({
      ...current,
      ...patch,
    }));
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        description="Review assets, liabilities, and equity balances as of a selected date."
        title="Balance Sheet"
      />

      <Alert
        className={
          balanceSheet && !balanceSheet.isBalanced ? "border-amber-300 bg-amber-50/80" : undefined
        }
      >
        <Scale className="h-4 w-4" />
        <AlertTitle>
          {balanceSheet && !balanceSheet.isBalanced
            ? "Balance Sheet is not balanced."
            : "Balance check"}
        </AlertTitle>
        <AlertDescription>
          {balanceSheet && !balanceSheet.isBalanced
            ? `Difference: ${money(balanceSheet.difference)}`
            : "Draft vouchers are excluded. Totals are calculated by the backend from posted and reversed entries."}
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4 lg:grid-cols-[1fr_1fr_0.7fr_0.7fr]">
        <Select
          disabled={!canLoadBranches}
          onValueChange={(value) => updateFilters({ branchId: value === allValue ? "" : value })}
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
          aria-label="As of date"
          onChange={(event) => updateFilters({ asOfDate: event.target.value })}
          type="date"
          value={filters.asOfDate}
        />
        <Button
          disabled={balanceSheetQuery.isFetching}
          onClick={() => void balanceSheetQuery.refetch()}
          type="button"
          variant="outline"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
        <Button
          onClick={() => setFilters(defaultBalanceSheetFilters())}
          type="button"
          variant="outline"
        >
          Reset
        </Button>
      </div>

      {balanceSheetQuery.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      ) : null}

      {!balanceSheetQuery.isLoading && balanceSheetQuery.error ? (
        <Card className="border-red-200 bg-red-50/70">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-2xl font-semibold text-brand-espresso">
              Unable to load Balance Sheet
            </h2>
            <p className="max-w-xl text-sm text-brand-mocha">
              {getErrorMessage(balanceSheetQuery.error)}
            </p>
            <Button
              onClick={() => void balanceSheetQuery.refetch()}
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!balanceSheetQuery.isLoading && !balanceSheetQuery.error && balanceSheet ? (
        <>
          <div className="grid gap-3 md:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Total Assets</p>
                <p className="mt-1 text-xl font-bold text-brand-espresso">
                  {money(balanceSheet.totalAssets)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">
                  Total Liabilities
                </p>
                <p className="mt-1 text-xl font-bold text-brand-espresso">
                  {money(balanceSheet.totalLiabilities)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Total Equity</p>
                <p className="mt-1 text-xl font-bold text-brand-espresso">
                  {money(balanceSheet.totalEquity)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">
                  Liabilities + Equity
                </p>
                <p className="mt-1 text-xl font-bold text-brand-espresso">
                  {money(balanceSheet.totalLiabilitiesAndEquity)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Status</p>
                <Badge
                  className={
                    balanceSheet.isBalanced ? "mt-2" : "mt-2 border-red-200 bg-red-50 text-red-700"
                  }
                  variant={balanceSheet.isBalanced ? "default" : "outline"}
                >
                  {balanceSheet.isBalanced ? "Balanced" : "Difference"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4">
            <BalanceSheetSectionCard section={balanceSheet.assets} title="Assets" />
            <BalanceSheetSectionCard section={balanceSheet.liabilities} title="Liabilities" />
            <BalanceSheetSectionCard section={balanceSheet.equity} title="Equity" />

            <Card className="border-brand-cappuccino/70 bg-white/85">
              <CardContent className="grid gap-3 p-4 md:grid-cols-3">
                <div className="flex items-center justify-between rounded-2xl bg-brand-latte/60 px-4 py-3">
                  <p className="font-semibold text-brand-espresso">Assets</p>
                  <p className="font-bold text-brand-espresso">{money(balanceSheet.totalAssets)}</p>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-brand-latte/60 px-4 py-3">
                  <p className="font-semibold text-brand-espresso">Liabilities + Equity</p>
                  <p className="font-bold text-brand-espresso">
                    {money(balanceSheet.totalLiabilitiesAndEquity)}
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-brand-cappuccino/25 px-4 py-3">
                  <p className="font-semibold text-brand-espresso">Difference</p>
                  <p className="font-bold text-brand-espresso">{money(balanceSheet.difference)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {!balanceSheetQuery.isLoading &&
      !balanceSheetQuery.error &&
      balanceSheet?.assets.items.length === 0 &&
      balanceSheet.liabilities.items.length === 0 &&
      balanceSheet.equity.items.length === 0 ? (
        <Card className="border-brand-cappuccino/70 bg-white/80">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
            <Landmark className="h-10 w-10 text-brand-mocha" />
            <h2 className="text-2xl font-semibold text-brand-espresso">
              No balance sheet rows found.
            </h2>
            <p className="max-w-xl text-sm text-brand-mocha">
              Post journal entries or adjust the as-of date and branch filter to review balances.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
