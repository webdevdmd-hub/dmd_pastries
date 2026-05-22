"use client";

import { Scale } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { ChartAccountTypeBadge } from "@/components/accounting/chart-account-badges";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS } from "@/constants/permissions";
import { useTrialBalanceReport } from "@/hooks/use-accounting";
import { useBranches } from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type { TrialBalanceFilters } from "@/types/accounting";

const allValue = "all";

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
    currency: "AED",
    style: "currency",
  }).format(value);
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
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        description="Review account debit and credit balances from posted journal entries."
        title="Trial Balance"
      />

      <Alert
        className={
          trialBalance && !trialBalance.isBalanced ? "border-amber-300 bg-amber-50/80" : undefined
        }
      >
        <Scale className="h-4 w-4" />
        <AlertTitle>
          {trialBalance && !trialBalance.isBalanced ? "Trial balance mismatch" : "Balance check"}
        </AlertTitle>
        <AlertDescription>
          {trialBalance && !trialBalance.isBalanced
            ? "Total debit and credit do not match for the selected period."
            : "Draft vouchers are excluded. Posted and reversed entries are included."}
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4 lg:grid-cols-[1fr_1fr_1fr_1.2fr_0.6fr]">
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
        <Label className="flex min-h-11 items-center gap-3 rounded-2xl border border-brand-cappuccino/70 bg-brand-latte px-4 text-sm text-brand-espresso">
          <Checkbox
            checked={filters.includeZeroBalances}
            onCheckedChange={(checked) => updateFilters({ includeZeroBalances: checked === true })}
          />
          Include zero balances
        </Label>
        <Button
          onClick={() => setFilters(defaultTrialBalanceFilters())}
          type="button"
          variant="outline"
        >
          Reset
        </Button>
      </div>

      {trialBalanceQuery.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      ) : null}

      {!trialBalanceQuery.isLoading && trialBalanceQuery.error ? (
        <Card className="border-red-200 bg-red-50/70">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
            <h2 className="text-2xl font-semibold text-brand-espresso">
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
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Total Debit</p>
                <p className="mt-1 text-xl font-bold text-brand-espresso">
                  {money(trialBalance.totalDebit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Total Credit</p>
                <p className="mt-1 text-xl font-bold text-brand-espresso">
                  {money(trialBalance.totalCredit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-mocha">Status</p>
                <Badge
                  className={
                    trialBalance.isBalanced ? "mt-2" : "mt-2 border-red-200 bg-red-50 text-red-700"
                  }
                  variant={trialBalance.isBalanced ? "default" : "outline"}
                >
                  {trialBalance.isBalanced ? "Balanced" : "Mismatch"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {trialBalance.items.length === 0 ? (
            <Card className="border-brand-cappuccino/70 bg-white/80">
              <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
                <Scale className="h-10 w-10 text-brand-mocha" />
                <h2 className="text-2xl font-semibold text-brand-espresso">
                  No trial balance rows found.
                </h2>
                <p className="max-w-xl text-sm text-brand-mocha">
                  Adjust the branch, date range, or include zero balances to review accounts.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden border-brand-cappuccino/70 bg-white/85">
              <CardContent className="overflow-hidden p-0">
                <div className="flex flex-col gap-2 border-b border-brand-cappuccino/70 bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-brand-espresso">Trial balance rows</p>
                    <p className="text-xs text-brand-mocha">
                      {trialBalance.dateFrom} to {trialBalance.dateTo}
                    </p>
                  </div>
                  <p className="text-xs text-brand-mocha">
                    Showing {trialBalance.items.length} accounts
                  </p>
                </div>
                <div className="overflow-x-auto bg-white/75 [&>div]:rounded-none">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Group</TableHead>
                        <TableHead className="text-right">Opening</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Closing Dr</TableHead>
                        <TableHead className="text-right">Closing Cr</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trialBalance.items.map((item) => (
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
                          <TableCell className="text-right">{money(item.openingBalance)}</TableCell>
                          <TableCell className="text-right">{money(item.periodDebit)}</TableCell>
                          <TableCell className="text-right">{money(item.periodCredit)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {money(item.closingDebit)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {money(item.closingCredit)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
