"use client";

import { Filter, RefreshCw, Scale, Settings2 } from "lucide-react";
import Link from "next/link";
import { Fragment, type JSX, useState } from "react";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBalanceSheetReport } from "@/hooks/use-accounting";
import { useBranches } from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import type {
  BalanceSheetFilters,
  BalanceSheetItem,
  BalanceSheetSection,
} from "@/types/accounting";

const allValue = "all";

type GroupedBalanceSheetRows = {
  amount: number;
  group: string;
  items: BalanceSheetItem[];
};

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

function formatGroupName(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function groupSectionItems(section: BalanceSheetSection): GroupedBalanceSheetRows[] {
  const byGroup = new Map<string, BalanceSheetItem[]>();

  section.items.forEach((item) => {
    // Group by the account's header when it has one; accounts that were never
    // categorized fall back to their account group so nothing disappears.
    const groupKey = item.headerAccountName || formatGroupName(item.accountGroup);
    const currentItems = byGroup.get(groupKey) ?? [];
    byGroup.set(groupKey, [...currentItems, item]);
  });

  return Array.from(byGroup.entries()).map(([group, items]) => ({
    amount: items.reduce((total, item) => total + item.amount, 0),
    group,
    items,
  }));
}

function getBalanceSheetItemLabel(item: BalanceSheetItem): string {
  if (!item.isCalculated || item.accountName !== "Current Year Profit / Loss") {
    return item.accountName;
  }

  if (item.amount > 0) {
    return "Current Year Profit";
  }

  if (item.amount < 0) {
    return "Current Year Loss";
  }

  return item.accountName;
}

function getBalanceSheetItemKey(
  item: BalanceSheetItem,
  itemIndex: number,
  group: string,
  title: string,
): string {
  return [
    title,
    group,
    item.accountId || "calculated",
    item.accountCode,
    item.accountName,
    String(item.amount),
    String(itemIndex),
  ].join("-");
}

function AmountCell({ strong = false, value }: { strong?: boolean; value: number }): JSX.Element {
  return (
    <td
      className={cn(
        "w-20 px-2 py-3 sm:w-52 sm:px-6 text-right tabular-nums",
        strong ? "font-bold text-foreground" : "font-medium text-info-text",
      )}
    >
      {money(value)}
    </td>
  );
}

function BalanceSheetRows({
  section,
  title,
}: {
  section: BalanceSheetSection;
  title: string;
}): JSX.Element {
  const groups = groupSectionItems(section);

  return (
    <>
      <tr className="border-b border-border">
        <td className="px-3 py-3 sm:px-6 text-base font-bold text-foreground">{title}</td>
        <td />
      </tr>
      {groups.map((group) => (
        <Fragment key={`${title}-${group.group}`}>
          <tr className="border-b border-border">
            <td className="pl-6 pr-3 py-3 sm:px-10 font-bold text-foreground">{group.group}</td>
            <AmountCell value={0} />
          </tr>
          {group.items.map((item, itemIndex) => (
            <tr
              className="border-b border-border transition-colors hover:bg-muted"
              key={getBalanceSheetItemKey(item, itemIndex, group.group, title)}
            >
              <td className="pl-9 pr-3 py-3 sm:px-14">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 font-medium",
                    item.isCalculated ? "text-foreground-muted" : "text-info-text",
                  )}
                >
                  {getBalanceSheetItemLabel(item)}
                  {item.isCalculated ? (
                    <Badge className="text-meta" variant="secondary">
                      Calculated
                    </Badge>
                  ) : null}
                </span>
              </td>
              <AmountCell value={item.amount} />
            </tr>
          ))}
          <tr className="border-b border-border">
            <td className="pl-6 pr-3 py-3 sm:px-10 font-bold text-foreground">
              Total for {group.group}
            </td>
            <AmountCell strong value={group.amount} />
          </tr>
        </Fragment>
      ))}
      <tr className="border-b border-border bg-muted/60">
        <td className="px-3 py-3 sm:px-6 font-bold text-foreground">Total for {title}</td>
        <AmountCell strong value={section.total} />
      </tr>
    </>
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
    <div className="mx-auto flex max-w-[96rem] flex-col gap-4">
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link href={ROUTES.accountingSettings}>
              <Settings2 className="h-4 w-4" />
              Accounting Settings
            </Link>
          </Button>
        }
        description="Business overview"
        title={`Balance Sheet - As of ${formatDate(filters.asOfDate)}`}
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
            aria-label="As of date"
            className="w-full sm:w-44"
            onChange={(event) => updateFilters({ asOfDate: event.target.value })}
            type="date"
            value={filters.asOfDate}
          />
          <Button
            disabled={balanceSheetQuery.isFetching}
            onClick={() => void balanceSheetQuery.refetch()}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Run Report
          </Button>
          <Button
            onClick={() => setFilters(defaultBalanceSheetFilters())}
            type="button"
            variant="outline"
          >
            Reset
          </Button>
        </div>
      </div>

      {balanceSheetQuery.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-[34rem] rounded-2xl" />
        </div>
      ) : null}

      {!balanceSheetQuery.isLoading && balanceSheetQuery.error ? (
        <Card className="border-danger/30 bg-danger-tint/70">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-xl font-semibold text-brand-espresso">
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
        <Card className="overflow-hidden border-workspace-panel-border bg-workspace-panel shadow-sm">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-end gap-4 border-b border-workspace-panel-border px-4 py-3 text-sm text-brand-mocha">
              <Label className="flex items-center gap-2">
                <Checkbox disabled />
                Collapse sub-accounts
              </Label>
              <span className="inline-flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Report columns
                <Badge variant="secondary">2</Badge>
              </span>
            </div>

            <div className="overflow-x-auto px-0 py-6 sm:px-4 sm:py-10">
              <div className="mx-auto max-w-4xl md:min-w-[42rem]">
                <div className="mb-8 text-center">
                  <p className="text-sm font-medium text-foreground-muted">Accrual basis</p>
                  <h2 className="mt-2 text-2xl font-bold text-foreground">Balance Sheet</h2>
                  <p className="mt-1 text-sm text-foreground-muted">
                    As of {formatDate(balanceSheet.asOfDate)}
                  </p>
                  {balanceSheet.financialYearStartDate ? (
                    <p className="mt-1 text-xs font-medium text-foreground-muted">
                      Financial year starts {formatDate(balanceSheet.financialYearStartDate)}
                    </p>
                  ) : null}
                  {balanceSheet.isBalanced ? (
                    <Badge className="mt-3" variant="secondary">
                      Balanced
                    </Badge>
                  ) : (
                    <Badge
                      className="mt-3 border-danger/30 bg-danger-tint text-danger-text"
                      variant="outline"
                    >
                      Difference {money(balanceSheet.difference)}
                    </Badge>
                  )}
                </div>

                {!balanceSheet.isBalanced ? (
                  <Alert className="mb-6 border-warning/30 bg-warning-tint/80">
                    <Scale className="h-4 w-4" />
                    <AlertTitle>Balance Sheet is not balanced.</AlertTitle>
                    <AlertDescription>
                      Difference: {money(balanceSheet.difference)}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-y border-border bg-muted text-meta text-foreground-muted">
                      <th className="px-3 py-3 sm:px-6 text-left font-bold">Account</th>
                      <th className="px-3 py-3 sm:px-6 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <BalanceSheetRows section={balanceSheet.assets} title="Assets" />
                    <BalanceSheetRows section={balanceSheet.liabilities} title="Liabilities" />
                    <BalanceSheetRows section={balanceSheet.equity} title="Equity" />
                    <tr className="border-t border-border">
                      <td className="px-6 py-4 font-bold text-foreground">
                        Liabilities and Equity
                      </td>
                      <AmountCell strong value={balanceSheet.totalLiabilitiesAndEquity} />
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-6 py-4 font-bold text-foreground">Difference</td>
                      <td
                        className={cn(
                          "px-6 py-4 text-right font-bold tabular-nums",
                          balanceSheet.difference === 0 ? "text-foreground" : "text-danger-text",
                        )}
                      >
                        {money(balanceSheet.difference)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p className="mt-6 text-xs text-foreground-muted">
                  Amounts are shown in AED. Draft journal entries are excluded. Current year
                  profit/loss rows are calculated by the backend from the configured financial year
                  start.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
