"use client";

import { Filter, RefreshCw, TrendingUp } from "lucide-react";
import type { JSX } from "react";
import { Fragment, useState } from "react";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { PageHeader } from "@/components/shared/page-header";
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
import { PERMISSIONS } from "@/constants/permissions";
import { useProfitLossReport } from "@/hooks/use-accounting";
import { useBranches } from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
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
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function StatementAmount({
  strong = false,
  value,
}: {
  strong?: boolean;
  value: number;
}): JSX.Element {
  return (
    <td
      className={cn(
        "w-44 px-6 py-3 text-right tabular-nums",
        strong ? "font-bold text-foreground" : "font-medium text-info-text",
      )}
    >
      {money(value)}
    </td>
  );
}

type GroupedProfitLossRows = {
  amount: number;
  group: string;
  items: ProfitLossItem[];
};

function groupSectionItems(section: ProfitLossSection): GroupedProfitLossRows[] {
  const byGroup = new Map<string, ProfitLossItem[]>();

  section.items.forEach((item) => {
    // Group by the account's header; accounts that were never categorized fall
    // back to a single "Other" bucket so nothing disappears from the statement.
    const groupKey = item.headerAccountName || "Other";
    byGroup.set(groupKey, [...(byGroup.get(groupKey) ?? []), item]);
  });

  return Array.from(byGroup.entries()).map(([group, items]) => ({
    amount: items.reduce((total, item) => total + item.amount, 0),
    group,
    items,
  }));
}

function SectionRows({
  section,
  title,
}: {
  section: ProfitLossSection;
  title: string;
}): JSX.Element {
  const groups = groupSectionItems(section);
  // A single group repeating the section title adds a level without adding
  // information, so it renders flat.
  const showGroupHeadings = groups.length > 1;

  return (
    <>
      <tr className="border-b border-border">
        <td className="px-6 py-3 text-base font-bold text-foreground">{title}</td>
        <td />
      </tr>
      {groups.map((group) => (
        <Fragment key={`${title}-${group.group}`}>
          {showGroupHeadings ? (
            <tr className="border-b border-border">
              <td className="px-10 py-3 font-bold text-foreground">{group.group}</td>
              <td />
            </tr>
          ) : null}
          {group.items.map((item: ProfitLossItem) => (
            <tr
              className="border-b border-border transition-colors hover:bg-muted"
              key={item.accountId}
            >
              <td
                className={cn(
                  "py-3 font-medium text-info-text",
                  showGroupHeadings ? "px-14" : "px-10",
                )}
              >
                {item.accountName}
              </td>
              <StatementAmount value={item.amount} />
            </tr>
          ))}
          {showGroupHeadings ? (
            <tr className="border-b border-border">
              <td className="px-10 py-3 font-bold text-foreground">Total for {group.group}</td>
              <StatementAmount strong value={group.amount} />
            </tr>
          ) : null}
        </Fragment>
      ))}
      <tr className="border-b border-border">
        <td className="px-6 py-3 font-bold text-foreground">Total for {title}</td>
        <StatementAmount strong value={section.total} />
      </tr>
    </>
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
    <div className="mx-auto flex max-w-[96rem] flex-col gap-4">
      <PageHeader
        description="Business overview"
        title={`Profit & Loss • From ${formatDate(filters.dateFrom)} to ${formatDate(filters.dateTo)}`}
      />

      <div className="rounded-2xl border border-workspace-panel-border bg-workspace-panel shadow-sm">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-espresso">
            <Filter className="h-4 w-4" />
            Filters
          </span>
          <Select
            disabled={!canLoadBranches}
            onValueChange={(value) => updateFilters({ branchId: value === allValue ? "" : value })}
            value={filters.branchId || allValue}
          >
            <SelectTrigger className="w-full sm:w-56">
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
            className="w-full sm:w-44"
            onChange={(event) => updateFilters({ dateFrom: event.target.value })}
            type="date"
            value={filters.dateFrom}
          />
          <Input
            aria-label="Date to"
            className="w-full sm:w-44"
            onChange={(event) => updateFilters({ dateTo: event.target.value })}
            type="date"
            value={filters.dateTo}
          />
          <Button
            disabled={profitLossQuery.isFetching}
            onClick={() => void profitLossQuery.refetch()}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Run Report
          </Button>
          <Button
            onClick={() => setFilters(defaultProfitLossFilters())}
            type="button"
            variant="outline"
          >
            Reset
          </Button>
        </div>
      </div>

      {profitLossQuery.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-[34rem] rounded-2xl" />
        </div>
      ) : null}

      {!profitLossQuery.isLoading && profitLossQuery.error ? (
        <Card className="border-danger/30 bg-danger-tint/70">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-xl font-semibold text-brand-espresso">
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
        <Card className="overflow-hidden border-workspace-panel-border bg-workspace-panel shadow-sm">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-end gap-4 border-b border-workspace-panel-border px-4 py-3 text-sm text-brand-mocha">
              <span className="inline-flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Backend calculated
              </span>
              <Badge variant={profitLoss.netProfit >= 0 ? "secondary" : "outline"}>
                {profitLoss.netProfit >= 0 ? "Profit" : "Loss"}
              </Badge>
            </div>

            <div className="overflow-x-auto px-4 py-10">
              <div className="mx-auto min-w-[42rem] max-w-4xl">
                <div className="mb-8 text-center">
                  <p className="text-sm font-medium text-foreground-muted">Accrual basis</p>
                  <h2 className="mt-2 text-2xl font-bold text-foreground">Profit and Loss</h2>
                  <p className="mt-1 text-sm text-foreground-muted">
                    From {formatDate(profitLoss.dateFrom)} to {formatDate(profitLoss.dateTo)}
                  </p>
                </div>

                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-y border-border bg-muted text-xs uppercase tracking-wide text-foreground-muted">
                      <th className="px-6 py-3 text-left font-bold">Account</th>
                      <th className="px-6 py-3 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SectionRows section={profitLoss.income} title="Operating Income" />
                    <SectionRows section={profitLoss.cogs} title="Cost of Goods Sold" />
                    <tr className="border-b border-border bg-muted/60">
                      <td className="px-6 py-3 font-bold text-foreground">Gross Profit</td>
                      <StatementAmount strong value={profitLoss.grossProfit} />
                    </tr>
                    <SectionRows section={profitLoss.operatingExpenses} title="Operating Expense" />
                    <tr className="border-b border-border">
                      <td className="px-6 py-3 font-bold text-foreground">Operating Profit</td>
                      <StatementAmount strong value={profitLoss.netProfit} />
                    </tr>
                    <tr className="border-b border-border">
                      <td className="px-6 py-3 font-bold text-foreground">Non Operating Income</td>
                      <StatementAmount strong value={0} />
                    </tr>
                    <tr className="border-b border-border">
                      <td className="px-6 py-3 font-bold text-foreground">Non Operating Expense</td>
                      <StatementAmount strong value={0} />
                    </tr>
                    <tr className="border-t border-border text-base">
                      <td className="px-6 py-4 font-bold text-foreground">Net Profit/Loss</td>
                      <td
                        className={cn(
                          "px-6 py-4 text-right font-bold tabular-nums",
                          profitLoss.netProfit >= 0 ? "text-foreground" : "text-danger-text",
                        )}
                      >
                        {money(profitLoss.netProfit)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p className="mt-6 text-xs text-foreground-muted">
                  Amounts are shown in AED. Draft journal entries are excluded.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
