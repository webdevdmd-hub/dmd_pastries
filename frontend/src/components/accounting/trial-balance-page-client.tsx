"use client";

import { Filter, RefreshCw, Scale, Settings2 } from "lucide-react";
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
import { useTrialBalanceReport } from "@/hooks/use-accounting";
import { useBranches } from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import type {
  AccountingAccountType,
  TrialBalanceFilters,
  TrialBalanceItem,
} from "@/types/accounting";

const allValue = "all";

const accountTypeOrder: AccountingAccountType[] = [
  "asset",
  "liability",
  "equity",
  "income",
  "cogs",
  "expense",
];

const accountTypeLabels: Record<AccountingAccountType, string> = {
  asset: "Assets",
  cogs: "Cost of Goods Sold",
  equity: "Equity",
  expense: "Expenses",
  income: "Income",
  liability: "Liabilities",
};

type TrialBalanceGroup = {
  closingCredit: number;
  closingDebit: number;
  group: string;
  items: TrialBalanceItem[];
};

type TrialBalanceSection = {
  groups: TrialBalanceGroup[];
  label: string;
  type: AccountingAccountType;
};

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${String(year)}-${month}-${day}`;
}

function defaultTrialBalanceFilters(): TrialBalanceFilters {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    branchId: "",
    dateFrom: dateInputValue(firstDay),
    dateTo: dateInputValue(lastDay),
    includeZeroBalances: false,
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

function sumDebit(items: readonly TrialBalanceItem[]): number {
  return items.reduce((total, item) => total + item.closingDebit, 0);
}

function sumCredit(items: readonly TrialBalanceItem[]): number {
  return items.reduce((total, item) => total + item.closingCredit, 0);
}

function groupTrialBalanceItems(items: readonly TrialBalanceItem[]): TrialBalanceSection[] {
  return accountTypeOrder.map((type) => {
    const typeItems = items.filter((item) => item.accountType === type);
    const byGroup = new Map<string, TrialBalanceItem[]>();

    typeItems.forEach((item) => {
      const currentItems = byGroup.get(item.accountGroup) ?? [];
      byGroup.set(item.accountGroup, [...currentItems, item]);
    });

    const groups = Array.from(byGroup.entries()).map(([group, groupItems]) => ({
      closingCredit: sumCredit(groupItems),
      closingDebit: sumDebit(groupItems),
      group,
      items: groupItems,
    }));

    return {
      groups,
      label: accountTypeLabels[type],
      type,
    };
  });
}

function AmountCell({ value }: { value: number }): JSX.Element {
  return (
    <td className="w-24 px-3 py-3 sm:w-40 sm:px-6 text-right tabular-nums text-info-text">
      {money(value)}
    </td>
  );
}

export function TrialBalancePageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.accountingView]);
  const canLoadBranches = hasAnyPermission([PERMISSIONS.branchesView, PERMISSIONS.branchesSwitch]);
  const [filters, setFilters] = useState<TrialBalanceFilters>(defaultTrialBalanceFilters);
  const trialBalanceQuery = useTrialBalanceReport(filters, canView);
  const branchesQuery = useBranches(canView && canLoadBranches);
  const branches = (branchesQuery.data ?? []).filter((branch) => branch.status === "active");
  const trialBalance = trialBalanceQuery.data;
  const sections = groupTrialBalanceItems(trialBalance?.items ?? []);

  if (!canView) {
    return (
      <AccountingAccessDeniedCard message="You need `accounting.view` to view Trial Balance." />
    );
  }

  const updateFilters = (patch: Partial<TrialBalanceFilters>): void => {
    setFilters((current) => ({
      ...current,
      ...patch,
    }));
  };

  return (
    <div className="mx-auto flex max-w-[96rem] flex-col gap-4">
      <PageHeader
        description="Accountant"
        title={`Trial Balance • As of ${formatDate(filters.dateTo)}`}
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
          <Label className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-brand-cappuccino/70 bg-brand-latte px-4 text-sm text-brand-espresso sm:w-auto">
            <Checkbox
              checked={filters.includeZeroBalances}
              onCheckedChange={(checked) =>
                updateFilters({ includeZeroBalances: checked === true })
              }
            />
            Include zero balances
          </Label>
          <Button
            disabled={trialBalanceQuery.isFetching}
            onClick={() => void trialBalanceQuery.refetch()}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Run Report
          </Button>
          <Button
            onClick={() => setFilters(defaultTrialBalanceFilters())}
            type="button"
            variant="outline"
          >
            Reset
          </Button>
        </div>
      </div>

      {trialBalanceQuery.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-[34rem] rounded-2xl" />
        </div>
      ) : null}

      {!trialBalanceQuery.isLoading && trialBalanceQuery.error ? (
        <Card className="border-danger/30 bg-danger-tint/70">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-xl font-semibold text-brand-espresso">
              Unable to load Trial Balance
            </h2>
            <p className="max-w-xl text-sm text-brand-mocha">
              {getErrorMessage(trialBalanceQuery.error)}
            </p>
            <Button
              onClick={() => void trialBalanceQuery.refetch()}
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!trialBalanceQuery.isLoading && !trialBalanceQuery.error && trialBalance ? (
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
                <Badge variant="secondary">3</Badge>
              </span>
            </div>

            <div className="overflow-x-auto px-4 py-10">
              <div className="mx-auto max-w-5xl md:min-w-[48rem]">
                <div className="mb-8 text-center">
                  <p className="text-sm font-medium text-foreground-muted">Accrual basis</p>
                  <h2 className="mt-2 text-2xl font-bold text-foreground">Trial Balance</h2>
                  <p className="mt-1 text-sm text-foreground-muted">
                    From {formatDate(trialBalance.dateFrom)} to {formatDate(trialBalance.dateTo)}
                  </p>
                  {trialBalance.isBalanced ? (
                    <Badge className="mt-3" variant="secondary">
                      Balanced
                    </Badge>
                  ) : (
                    <Badge
                      className="mt-3 border-danger/30 bg-danger-tint text-danger-text"
                      variant="outline"
                    >
                      Debit / credit mismatch
                    </Badge>
                  )}
                </div>

                {!trialBalance.isBalanced ? (
                  <Alert className="mb-6 border-warning/30 bg-warning-tint/80">
                    <Scale className="h-4 w-4" />
                    <AlertTitle>Trial balance mismatch</AlertTitle>
                    <AlertDescription>
                      Total debit and credit do not match for the selected period.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-y border-border bg-muted text-meta text-foreground-muted">
                      <th className="px-3 py-3 sm:px-6 text-left font-bold">Account</th>
                      <th className="px-3 py-3 sm:px-6 text-right font-bold">Net Debit</th>
                      <th className="px-3 py-3 sm:px-6 text-right font-bold">Net Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((section) => (
                      <Fragment key={section.type}>
                        <tr className="border-b border-border">
                          <td className="px-3 py-3 sm:px-6 text-base font-bold text-foreground">
                            {section.label}
                          </td>
                          <td />
                          <td />
                        </tr>

                        {section.groups.map((group) => (
                          <Fragment key={`${section.type}-${group.group}`}>
                            <tr className="border-b border-border">
                              <td className="pl-6 pr-3 py-3 sm:px-10 font-semibold text-foreground">
                                {formatGroupName(group.group)}
                              </td>
                              <AmountCell value={0} />
                              <AmountCell value={0} />
                            </tr>
                            {group.items.map((item) => (
                              <tr
                                className="border-b border-border transition-colors hover:bg-muted"
                                key={item.accountId}
                              >
                                <td className="pl-9 pr-3 py-3 sm:px-14 font-medium text-info-text">
                                  {item.accountName}
                                </td>
                                <AmountCell value={item.closingDebit} />
                                <AmountCell value={item.closingCredit} />
                              </tr>
                            ))}
                            <tr className="border-b border-border">
                              <td className="pl-6 pr-3 py-3 sm:px-10 font-bold text-foreground">
                                Total for {formatGroupName(group.group)}
                              </td>
                              <AmountCell value={group.closingDebit} />
                              <AmountCell value={group.closingCredit} />
                            </tr>
                          </Fragment>
                        ))}
                      </Fragment>
                    ))}
                    <tr className="border-t border-border text-base font-bold text-foreground">
                      <td className="px-6 py-4">Total for Trial Balance</td>
                      <td className="px-6 py-4 text-right tabular-nums">
                        {money(trialBalance.totalDebit)}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums">
                        {money(trialBalance.totalCredit)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p
                  className={cn(
                    "mt-6 text-xs",
                    trialBalance.isBalanced
                      ? "text-foreground-muted"
                      : "font-semibold text-danger-text",
                  )}
                >
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
