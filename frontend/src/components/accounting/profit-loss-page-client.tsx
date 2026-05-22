"use client";

import { TrendingUp } from "lucide-react";
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
import { useProfitLossReport } from "@/hooks/use-accounting";
import { useBranches } from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type { ProfitLossFilters, ProfitLossItem, ProfitLossSection } from "@/types/accounting";

const allValue = "all";

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${String(year)}-${month}-${day}`;
}

function defaultProfitLossFilters(): ProfitLossFilters {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    branchId: "",
    dateFrom: dateInputValue(firstDay),
    dateTo: dateInputValue(lastDay),
  };
}

function money(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function ReportSection({
  section,
  title,
}: {
  section: ProfitLossSection;
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
                {section.items.map((item: ProfitLossItem) => (
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

export function ProfitLossPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.accountingView]);
  const canLoadBranches = hasAnyPermission([PERMISSIONS.branchesView, PERMISSIONS.branchesSwitch]);
  const [filters, setFilters] = useState<ProfitLossFilters>(defaultProfitLossFilters);
  const profitLossQuery = useProfitLossReport(filters, canView);
  const branchesQuery = useBranches(canView && canLoadBranches);
  const branches = (branchesQuery.data ?? []).filter((branch) => branch.status === "active");
  const profitLoss = profitLossQuery.data;

  if (!canView) {
    return (
      <AccountingAccessDeniedCard message="You need `accounting.view` to view Profit & Loss." />
    );
  }

  const updateFilters = (patch: Partial<ProfitLossFilters>): void => {
    setFilters((current) => ({
      ...current,
      ...patch,
    }));
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        description="Review income, cost of goods sold, expenses, and net profit from posted accounting entries."
        title="Profit & Loss"
      />

      <Alert>
        <TrendingUp className="h-4 w-4" />
        <AlertTitle>Backend-calculated report</AlertTitle>
        <AlertDescription>
          Draft vouchers are excluded. Totals are calculated by the backend from posted and reversed
          journal entries.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4 lg:grid-cols-[1fr_1fr_1fr_0.6fr]">
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
        <Button
          onClick={() => setFilters(defaultProfitLossFilters())}
          type="button"
          variant="outline"
        >
          Reset
        </Button>
      </div>

      {profitLossQuery.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      ) : null}

      {!profitLossQuery.isLoading && profitLossQuery.error ? (
        <Card className="border-red-200 bg-red-50/70">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-2xl font-semibold text-brand-espresso">
              Unable to load Profit & Loss
            </h2>
            <p className="max-w-xl text-sm text-brand-mocha">
              {getErrorMessage(profitLossQuery.error)}
            </p>
            <Button onClick={() => void profitLossQuery.refetch()} type="button" variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!profitLossQuery.isLoading && !profitLossQuery.error && profitLoss ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Income</p>
                <p className="mt-1 text-xl font-bold text-brand-espresso">
                  {money(profitLoss.income.total)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">COGS</p>
                <p className="mt-1 text-xl font-bold text-brand-espresso">
                  {money(profitLoss.cogs.total)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Gross Profit</p>
                <p className="mt-1 text-xl font-bold text-brand-espresso">
                  {money(profitLoss.grossProfit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Net Result</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-xl font-bold text-brand-espresso">
                    {money(profitLoss.netProfit)}
                  </p>
                  <Badge
                    className={
                      profitLoss.netProfit >= 0
                        ? undefined
                        : "border-red-200 bg-red-50 text-red-700"
                    }
                    variant={profitLoss.netProfit >= 0 ? "default" : "outline"}
                  >
                    {profitLoss.netProfit >= 0 ? "Profit" : "Loss"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4">
            <ReportSection section={profitLoss.income} title="Income" />
            <ReportSection section={profitLoss.cogs} title="Cost of Goods Sold" />

            <Card className="border-brand-caramel/60 bg-brand-latte/70">
              <CardContent className="flex items-center justify-between p-4">
                <p className="font-semibold text-brand-espresso">Gross Profit</p>
                <p className="text-xl font-bold text-brand-espresso">
                  {money(profitLoss.grossProfit)}
                </p>
              </CardContent>
            </Card>

            <ReportSection section={profitLoss.operatingExpenses} title="Operating Expenses" />

            <Card className="border-brand-cappuccino/70 bg-white/85">
              <CardContent className="grid gap-3 p-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl bg-brand-latte/60 px-4 py-3">
                  <p className="font-semibold text-brand-espresso">Total Expenses</p>
                  <p className="font-bold text-brand-espresso">{money(profitLoss.totalExpenses)}</p>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-brand-cappuccino/25 px-4 py-3">
                  <p className="font-semibold text-brand-espresso">Net Profit / Loss</p>
                  <p className="font-bold text-brand-espresso">{money(profitLoss.netProfit)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
