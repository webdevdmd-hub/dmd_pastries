"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, Link2, RefreshCw, Scale } from "lucide-react";
import Link from "next/link";
import type { JSX, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { EmptyState } from "@/components/shared/collection-state";
import { PageHeader } from "@/components/shared/page-header";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import {
  useAccountingBackfillReadiness,
  useAccountingReconciliationAp,
  useAccountingReconciliationAr,
  useAccountingReconciliationHealthCheck,
  useAccountingReconciliationInventory,
  useAccountingReconciliationPaymentAccounts,
  useAccountingSettings,
  useAccountMappings,
  useChartAccounts,
  useCloseFinancialYear,
  useFinancialYears,
  useReopenFinancialYear,
  useRunAccountingBackfill,
  useSeedDefaultAccountMappings,
  useUpdateAccountingSettings,
  useUpdateAccountMappings,
  useUpdatePeriodLock,
  useYearEndClosePreview,
} from "@/hooks/use-accounting";
import { useBranches } from "@/hooks/use-branches";
import { usePermission } from "@/hooks/use-permission";
import type {
  AccountingBackfillPayload,
  AccountingBackfillReadinessIssue,
  AccountingBackfillTarget,
  AccountingReconciliationResponse,
  ChartAccount,
} from "@/types/accounting";

// Mirrors the backend's defaultBackfillTargets order: sale_movement_costs
// re-prices zero-cost sale movements before pos_sales posts COGS from them,
// and pos_sale_payments must follow pos_sales (checkout payments are stamped
// by the sale's own journal).
const backfillTargets: AccountingBackfillTarget[] = [
  "sale_movement_costs",
  "pos_sales",
  "pos_sale_payments",
  "bakery_order_payments",
  "payment_refunds",
  "bakery_orders",
  "purchase_invoices",
  "supplier_payments",
  "stock_movements",
  "manufacturing_batches",
  "sales_returns",
  "purchase_returns",
  "expenses",
];

const financialYearMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, index) => ({
  label,
  value: index + 1,
}));

const financialYearDays = Array.from({ length: 31 }, (_, index) => index + 1);
const allBranchesValue = "all";

function todayString(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function yesterdayString(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatStatus(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBackfillTarget(value: string): string {
  return formatStatus(value);
}

function issueBadgeClass(severity: string): string {
  if (readinessIssueBlocks(severity)) {
    return "border-danger/30 bg-danger-tint text-danger-text";
  }

  if (severity === "warning") {
    return "border-warning/30 bg-warning-tint text-warning-text";
  }

  return "";
}

function readinessIssueBlocks(severity: string): boolean {
  return severity === "blocking" || severity === "error";
}

function formatReadinessIssueDetails(issue: AccountingBackfillReadinessIssue): string {
  const detailEntries = Object.entries(issue.details);
  if (detailEntries.length === 0) {
    return formatBackfillTarget(issue.target);
  }

  return detailEntries
    .filter(([, value]) => value !== "" && value !== null)
    .map(([key, value]) => `${formatStatus(key)}: ${String(value)}`)
    .join(" | ");
}

function canManageAccounting(hasAnyPermission: (permissions: string[]) => boolean): boolean {
  return hasAnyPermission([
    PERMISSIONS.accountingAccountsManage,
    PERMISSIONS.accountingJournalEntriesManage,
  ]);
}

function ErrorNotice({ message }: { message: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm text-danger-text">
      {message}
    </div>
  );
}

function FieldLabel({ children, htmlFor }: { children: string; htmlFor?: string }): JSX.Element {
  // Some of these sit above a control and some above a read-only value.
  // Only the first kind is a label; the second renders as a caption so it
  // does not claim an association it does not have.
  return htmlFor ? (
    <label className="text-xs font-semibold text-muted-foreground" htmlFor={htmlFor}>
      {children}
    </label>
  ) : (
    <p className="text-xs font-semibold text-muted-foreground">{children}</p>
  );
}

function StatusBadge({ matched, status }: { matched: boolean; status: string }): JSX.Element {
  return (
    <Badge
      className={matched ? "" : "border-danger/30 bg-danger-tint text-danger-text"}
      variant={matched ? "secondary" : "outline"}
    >
      {matched ? "Matched" : formatStatus(status || "unmatched")}
    </Badge>
  );
}

function chartAccountOptions(accounts: ChartAccount[]): SearchableComboboxOption[] {
  return accounts.map((account) => ({
    value: account.id,
    label: `${account.accountCode} - ${account.accountName}`,
    description: `${account.accountType} / ${account.accountGroup}`,
    keywords: [
      account.accountCode,
      account.accountName,
      account.accountType,
      account.accountGroup,
      account.normalBalance,
    ],
  }));
}

function RecoveryCard({ children, title }: { children: ReactNode; title: string }): JSX.Element {
  return (
    <Card className="border-workspace-panel-border bg-workspace-panel shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AccountingSettingsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.accountingView]);
  const canManage = canManageAccounting(hasAnyPermission);
  const canLockPeriods = hasAnyPermission([PERMISSIONS.accountingPeriodLock]);
  const settingsQuery = useAccountingSettings(canView);
  const updateSettings = useUpdateAccountingSettings();
  const updateLock = useUpdatePeriodLock();
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [lockDate, setLockDate] = useState("");
  const [lockReason, setLockReason] = useState("");

  const settings = settingsQuery.data;

  useEffect(() => {
    if (settings) {
      setMonth(settings.financialYearStartMonth);
      setDay(settings.financialYearStartDay);
      setLockDate(settings.booksClosedThrough ?? "");
    }
  }, [settings]);

  if (!canView) {
    return (
      <AccountingAccessDeniedCard message="You need `accounting.view` to open Accounting Settings." />
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link href={ROUTES.accountingBalanceSheet}>Open Balance Sheet</Link>
          </Button>
        }
        description="Control the financial-year start used by backend accounting reports."
        title="Accounting Settings"
      />

      {settingsQuery.isError ? <ErrorNotice message={settingsQuery.error.message} /> : null}

      <RecoveryCard title="Financial year">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <FieldLabel>Current setting</FieldLabel>
            <p className="text-2xl font-semibold text-foreground">
              {settings?.financialYearStartLabel ?? "Loading..."}
            </p>
            <p className="text-sm text-muted-foreground">
              {settings?.usesDefaultFinancialYear ? "Using backend default" : "Custom setting"}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="recovery-start-month">Start month</FieldLabel>
            <Select
              disabled={!canManage}
              onValueChange={(value) => setMonth(Number(value))}
              value={String(month)}
            >
              <SelectTrigger id="recovery-start-month">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {financialYearMonths.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="recovery-start-day">Start day</FieldLabel>
            <Select
              disabled={!canManage}
              onValueChange={(value) => setDay(Number(value))}
              value={String(day)}
            >
              <SelectTrigger id="recovery-start-day">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {financialYearDays.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    Day {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Reports remain backend-authoritative. This page only saves the report period setting.
          </p>
          <Button
            disabled={!canManage || updateSettings.isPending}
            onClick={() =>
              updateSettings.mutate({
                financialYearStartDay: day,
                financialYearStartMonth: month,
              })
            }
          >
            Save settings
          </Button>
        </div>
        {updateSettings.isError ? <ErrorNotice message={updateSettings.error.message} /> : null}
      </RecoveryCard>

      <RecoveryCard title="Close the books">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <FieldLabel>Current lock</FieldLabel>
            <p className="text-2xl font-semibold text-foreground">
              {settings ? (settings.booksClosedThrough ?? "Not locked") : "Loading..."}
            </p>
            <p className="text-sm text-muted-foreground">
              {settings?.booksClosedThrough
                ? "Journals dated on or before this date cannot be created, edited, deleted, or reversed."
                : "All periods are open for posting and edits."}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="recovery-closed-through">Closed through</FieldLabel>
            <Input
              id="recovery-closed-through"
              disabled={!canLockPeriods}
              max={yesterdayString()}
              onChange={(event) => setLockDate(event.target.value)}
              type="date"
              value={lockDate}
            />
            <p className="text-xs text-muted-foreground">
              Must be a past date — locking today would block live sales.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="recovery-reason-optional">Reason (optional)</FieldLabel>
            <Input
              id="recovery-reason-optional"
              disabled={!canLockPeriods}
              onChange={(event) => setLockReason(event.target.value)}
              placeholder="e.g. VAT Q2 filed"
              value={lockReason}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {canLockPeriods
              ? "Unlock (audited), correct, then re-lock to fix locked history — there is no override."
              : "You need `accounting.period.lock` to change the lock."}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={!canLockPeriods || updateLock.isPending || !settings?.booksClosedThrough}
              onClick={() => {
                setLockDate("");
                updateLock.mutate({ closedThrough: null, reason: lockReason });
              }}
              variant="outline"
            >
              Clear lock
            </Button>
            <Button
              disabled={!canLockPeriods || updateLock.isPending || !lockDate}
              onClick={() => updateLock.mutate({ closedThrough: lockDate, reason: lockReason })}
            >
              {settings?.booksClosedThrough ? "Update lock" : "Close the books"}
            </Button>
          </div>
        </div>
        {updateLock.isError ? <ErrorNotice message={updateLock.error.message} /> : null}
      </RecoveryCard>

      <YearEndCloseCard canManagePeriods={canLockPeriods} enabled={canView} />
    </div>
  );
}

function YearEndCloseCard({
  canManagePeriods,
  enabled,
}: {
  canManagePeriods: boolean;
  enabled: boolean;
}): JSX.Element {
  const yearsQuery = useFinancialYears(enabled);
  const closeYear = useCloseFinancialYear();
  const reopenYear = useReopenFinancialYear();
  const [confirmingYearEnd, setConfirmingYearEnd] = useState<string | null>(null);
  const previewQuery = useYearEndClosePreview(confirmingYearEnd, enabled);

  const years = yearsQuery.data ?? [];
  // Only the most recently closed year can be reopened: earlier ones sit
  // behind it in the oldest-first close order.
  const latestClosedEnd =
    years.filter((year) => year.status === "closed").at(-1)?.financialYearEnd ?? null;

  return (
    <RecoveryCard title="Year-end close">
      <p className="mb-4 text-sm text-muted-foreground">
        Closing a year moves its income and expenses into Retained Earnings (3100) for each branch,
        then locks the books through the year end. Close years oldest first.
      </p>

      {yearsQuery.isError ? <ErrorNotice message={yearsQuery.error.message} /> : null}
      {!yearsQuery.isLoading && years.length === 0 ? (
        <EmptyState
          description="A financial year can only be closed once it has posted journals. Record some activity first."
          icon={CalendarClock}
          title="No accounting history yet"
        />
      ) : null}

      <div className="flex flex-col gap-3">
        {years.map((year) => {
          const closedProfit = year.branches.reduce((total, branch) => total + branch.netProfit, 0);

          return (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
              key={year.financialYearEnd}
            >
              <div>
                <p className="font-medium text-foreground">
                  {year.financialYearStart} to {year.financialYearEnd}
                </p>
                <p className="text-sm text-muted-foreground">
                  {year.status === "closed"
                    ? `Closed · ${String(year.branches.length)} branch journal(s) · net ${formatNumber(closedProfit)}`
                    : year.status === "current"
                      ? "Current year — closes once it ends"
                      : "Open"}
                </p>
              </div>
              <div className="flex gap-2">
                {year.status === "open" ? (
                  <Button
                    disabled={!canManagePeriods || closeYear.isPending}
                    onClick={() => setConfirmingYearEnd(year.financialYearEnd)}
                  >
                    Close year
                  </Button>
                ) : null}
                {year.status === "closed" && year.financialYearEnd === latestClosedEnd ? (
                  <Button
                    disabled={!canManagePeriods || reopenYear.isPending}
                    onClick={() => reopenYear.mutate(year.financialYearEnd)}
                    variant="outline"
                  >
                    Reopen
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {closeYear.isError ? <ErrorNotice message={closeYear.error.message} /> : null}
      {reopenYear.isError ? <ErrorNotice message={reopenYear.error.message} /> : null}

      <Dialog
        open={confirmingYearEnd !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmingYearEnd(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close financial year</DialogTitle>
            <DialogDescription>
              This posts a close journal per branch and locks the books through {confirmingYearEnd}.
              You can reopen the most recent closed year afterwards.
            </DialogDescription>
          </DialogHeader>

          {previewQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Calculating each branch&apos;s result...
            </p>
          ) : null}
          {previewQuery.isError ? <ErrorNotice message={previewQuery.error.message} /> : null}
          {previewQuery.data ? (
            <div className="flex flex-col gap-2">
              {previewQuery.data.branches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No branch has income or expense activity in this year — nothing will be posted.
                </p>
              ) : (
                previewQuery.data.branches.map((branch) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                    key={branch.branchId}
                  >
                    <span>{branch.branchName || "Branch"}</span>
                    <span className="font-medium">
                      {formatNumber(branch.netProfit)} · {branch.lineCount} lines
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setConfirmingYearEnd(null)} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={closeYear.isPending || !confirmingYearEnd}
              onClick={() => {
                if (!confirmingYearEnd) return;
                closeYear.mutate(confirmingYearEnd, {
                  onSuccess: () => setConfirmingYearEnd(null),
                });
              }}
            >
              Close year
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RecoveryCard>
  );
}

export function AccountMappingsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.accountingView]);
  const canManage = canManageAccounting(hasAnyPermission);
  const mappingsQuery = useAccountMappings(canView);
  const chartAccountsQuery = useChartAccounts(
    {
      accountGroup: "",
      accountType: "all",
      limit: 100,
      page: 1,
      parentAccountId: "",
      search: "",
      sortBy: "account_code",
      sortOrder: "asc",
      status: "active",
    },
    canView,
  );
  const seedMappings = useSeedDefaultAccountMappings();
  const updateMappings = useUpdateAccountMappings();
  const mappingItems = useMemo(() => mappingsQuery.data?.items ?? [], [mappingsQuery.data?.items]);
  const accountOptions = useMemo(
    () => chartAccountOptions(chartAccountsQuery.data?.items ?? []),
    [chartAccountsQuery.data?.items],
  );
  const initialMappings = useMemo<Record<string, string>>(() => {
    return Object.fromEntries(
      mappingItems.map((mapping) => [mapping.mappingKey, mapping.chartAccountId ?? ""]),
    );
  }, [mappingItems]);
  const [draftMappings, setDraftMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraftMappings(initialMappings);
  }, [initialMappings]);

  const changedMappings = useMemo(() => {
    return Object.fromEntries(
      mappingItems
        .map((mapping) => {
          const draftValue = draftMappings[mapping.mappingKey] ?? "";
          const initialValue = initialMappings[mapping.mappingKey] ?? "";

          return [mapping.mappingKey, draftValue, initialValue] as const;
        })
        .filter(([, draftValue, initialValue]) => draftValue !== "" && draftValue !== initialValue)
        .map(([mappingKey, draftValue]) => [mappingKey, draftValue]),
    );
  }, [draftMappings, initialMappings, mappingItems]);
  const changedMappingCount = Object.keys(changedMappings).length;
  const canEditMappings = canManage && !chartAccountsQuery.isError;

  if (!canView) {
    return (
      <AccountingAccessDeniedCard message="You need `accounting.view` to open Account Mappings." />
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={!canManage || seedMappings.isPending}
              onClick={() => seedMappings.mutate()}
              type="button"
              variant="outline"
            >
              Seed defaults
            </Button>
            <Button
              disabled={!canEditMappings || updateMappings.isPending || changedMappingCount === 0}
              onClick={() => updateMappings.mutate({ mappings: changedMappings })}
              type="button"
            >
              Save mappings
            </Button>
          </div>
        }
        description="Review backend account mappings used by automated journals and recovery tools."
        title="Account Mappings"
      />

      {mappingsQuery.isError ? <ErrorNotice message={mappingsQuery.error.message} /> : null}
      {chartAccountsQuery.isError ? (
        <ErrorNotice
          message={`Unable to load chart accounts: ${chartAccountsQuery.error.message}`}
        />
      ) : null}
      {seedMappings.isError ? <ErrorNotice message={seedMappings.error.message} /> : null}
      {updateMappings.isError ? <ErrorNotice message={updateMappings.error.message} /> : null}

      <Card className="overflow-hidden border-workspace-panel-border bg-workspace-panel shadow-sm">
        <div className="grid gap-4 border-b bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground md:grid-cols-[minmax(0,1.25fr)_minmax(0,2fr)_minmax(0,1fr)_8rem]">
          <span>Mapping</span>
          <span>Chart account</span>
          <span>Type / group</span>
          <span>Status</span>
        </div>
        {mappingItems.map((mapping) => {
          const selectedAccount = chartAccountsQuery.data?.items.find(
            (account) => account.id === (draftMappings[mapping.mappingKey] ?? ""),
          );

          return (
            <div
              className="grid min-w-0 items-center gap-4 border-b px-4 py-4 last:border-b-0 [&>*]:min-w-0 md:grid-cols-[minmax(0,1.25fr)_minmax(0,2fr)_minmax(0,1fr)_8rem]"
              key={mapping.mappingKey}
            >
              <div>
                <p className="font-semibold text-foreground [overflow-wrap:anywhere]">
                  {mapping.mappingKey}
                </p>
                <p className="text-sm text-muted-foreground">
                  {mapping.description || "No description"}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <SearchableCombobox
                  disabled={!canEditMappings}
                  emptyMessage="No active chart accounts."
                  errorMessage={
                    chartAccountsQuery.isError ? chartAccountsQuery.error.message : null
                  }
                  groupLabel="Active chart accounts"
                  isLoading={chartAccountsQuery.isLoading}
                  loadingMessage="Loading chart accounts..."
                  onRetry={() => void chartAccountsQuery.refetch()}
                  onValueChange={(value) =>
                    setDraftMappings((current) => ({
                      ...current,
                      [mapping.mappingKey]: value,
                    }))
                  }
                  options={accountOptions}
                  placeholder="Select chart account"
                  searchPlaceholder="Search account code or name..."
                  value={draftMappings[mapping.mappingKey] ?? ""}
                />
                {mapping.chartAccountName ? (
                  <p className="text-xs text-muted-foreground">
                    Current: {mapping.chartAccountCode || "-"} {mapping.chartAccountName}
                  </p>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedAccount
                  ? `${selectedAccount.accountType} / ${selectedAccount.accountGroup}`
                  : [mapping.chartAccountType, mapping.chartAccountGroup]
                      .filter(Boolean)
                      .join(" / ") || "-"}
              </p>
              <Badge
                className={
                  draftMappings[mapping.mappingKey]
                    ? ""
                    : "border-danger/30 bg-danger-tint text-danger-text"
                }
                variant={draftMappings[mapping.mappingKey] ? "secondary" : "outline"}
              >
                {draftMappings[mapping.mappingKey] ? "Mapped" : "Missing"}
              </Badge>
            </div>
          );
        })}
        {mappingItems.length === 0 ? (
          <EmptyState
            description="Mappings tell each transaction type which ledger account to post to. Seed the defaults to start."
            icon={Link2}
            title="No account mappings yet"
          />
        ) : null}
        {changedMappingCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {changedMappingCount} mapping{changedMappingCount === 1 ? "" : "s"} changed.
            </p>
            <Button
              onClick={() => setDraftMappings(initialMappings)}
              type="button"
              variant="outline"
            >
              Reset changes
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function ReconciliationSection({
  actionHref,
  actionLabel,
  errorMessage,
  isLoading,
  onRetry,
  response,
  title,
}: {
  actionHref?: string | undefined;
  actionLabel?: string | undefined;
  errorMessage?: string | undefined;
  isLoading?: boolean | undefined;
  onRetry?: (() => void) | undefined;
  response: AccountingReconciliationResponse | undefined;
  title: string;
}): JSX.Element {
  const items = response?.items ?? [];
  const unmatchedCount = items.filter((item) => !item.isMatched).length;
  const totalDifference = items.reduce((sum, item) => sum + Math.abs(item.difference), 0);

  return (
    <RecoveryCard title={title}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {items.length} check{items.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-muted-foreground">
              Total difference: {formatNumber(totalDifference)}
            </p>
          </div>
          <Badge
            className={unmatchedCount > 0 ? "border-danger/30 bg-danger-tint text-danger-text" : ""}
            variant={unmatchedCount > 0 ? "outline" : "secondary"}
          >
            {unmatchedCount > 0 ? `${String(unmatchedCount)} unmatched` : "All matched"}
          </Badge>
          {actionHref && actionLabel ? (
            <Button asChild size="sm" type="button" variant="outline">
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <p className="rounded-xl border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
            Loading reconciliation checks...
          </p>
        ) : null}

        {errorMessage ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm text-danger-text">
            <span>{errorMessage}</span>
            {onRetry ? (
              <Button onClick={onRetry} size="sm" type="button" variant="outline">
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}

        {items.map((item) => (
          <div
            className="grid gap-3 rounded-xl border bg-background px-4 py-3 md:grid-cols-[1.4fr_8rem_1fr_1fr]"
            key={item.id}
          >
            <div>
              <p className="font-semibold text-foreground">{item.label}</p>
              <p className="text-sm text-muted-foreground">
                {item.details || "Backend reconciliation check"}
              </p>
            </div>
            <StatusBadge matched={item.isMatched} status={item.status} />
            <p className="text-sm text-muted-foreground">
              Operational: {formatNumber(item.operationalAmount)}
            </p>
            <p className="text-sm text-muted-foreground">
              Ledger: {formatNumber(item.ledgerAmount)} / Difference:{" "}
              {formatNumber(item.difference)}
            </p>
          </div>
        ))}
        {!isLoading && !errorMessage && items.length === 0 ? (
          <EmptyState
            description="Rows appear once inventory movements have been posted for this period."
            icon={Scale}
            title="No reconciliation rows"
          />
        ) : null}
      </div>
    </RecoveryCard>
  );
}

export function AccountingReconciliationPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.accountingView]);
  const canLoadBranches = hasAnyPermission([PERMISSIONS.branchesView, PERMISSIONS.branchesSwitch]);
  const [asOfDate, setAsOfDate] = useState(todayString());
  const [branchId, setBranchId] = useState("");
  const filters = useMemo(() => ({ asOfDate, branchId }), [asOfDate, branchId]);
  const branchesQuery = useBranches(canView && canLoadBranches);
  const healthQuery = useAccountingReconciliationHealthCheck(filters, canView);
  const inventoryQuery = useAccountingReconciliationInventory(filters, canView);
  const apQuery = useAccountingReconciliationAp(filters, canView);
  const arQuery = useAccountingReconciliationAr(filters, canView);
  const paymentAccountsQuery = useAccountingReconciliationPaymentAccounts(filters, canView);
  const branches = (branchesQuery.data ?? []).filter((branch) => branch.status === "active");
  const responses = [
    healthQuery.data,
    inventoryQuery.data,
    apQuery.data,
    arQuery.data,
    paymentAccountsQuery.data,
  ];
  const allRows = responses.flatMap((response) => response?.items ?? []);
  const unmatchedRows = allRows.filter((item) => !item.isMatched);
  const totalDifference = allRows.reduce((sum, item) => sum + Math.abs(item.difference), 0);
  const isFetching =
    healthQuery.isFetching ||
    inventoryQuery.isFetching ||
    apQuery.isFetching ||
    arQuery.isFetching ||
    paymentAccountsQuery.isFetching;

  function refetchAll(): void {
    void healthQuery.refetch();
    void inventoryQuery.refetch();
    void apQuery.refetch();
    void arQuery.refetch();
    void paymentAccountsQuery.refetch();
  }

  if (!canView) {
    return (
      <AccountingAccessDeniedCard message="You need `accounting.view` to open Accounting Reconciliation." />
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        actions={
          <Button disabled={isFetching} onClick={refetchAll} type="button">
            <RefreshCw className="h-4 w-4" />
            Run checks
          </Button>
        }
        description="Compare operational balances with posted journal ledgers."
        title="Accounting Reconciliation"
      />

      <Card className="border-workspace-panel-border bg-workspace-panel shadow-sm">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_1fr_auto]">
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="recovery-as-of-date">As of date</FieldLabel>
            <Input
              id="recovery-as-of-date"
              onChange={(event) => setAsOfDate(event.target.value)}
              type="date"
              value={asOfDate}
            />
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="recovery-branch">Branch</FieldLabel>
            <Select
              disabled={!canLoadBranches || branchesQuery.isLoading}
              onValueChange={(value) => setBranchId(value === allBranchesValue ? "" : value)}
              value={branchId || allBranchesValue}
            >
              <SelectTrigger id="recovery-branch">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allBranchesValue}>All branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={refetchAll} type="button" variant="outline">
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <RecoveryCard title="Checks loaded">
          <p className="text-3xl font-semibold text-foreground">{allRows.length}</p>
          <p className="text-sm text-muted-foreground">
            Across health, inventory, AP, AR, and payments.
          </p>
        </RecoveryCard>
        <RecoveryCard title="Unmatched">
          <p
            className={
              unmatchedRows.length > 0
                ? "text-3xl font-semibold text-danger-text"
                : "text-3xl font-semibold text-foreground"
            }
          >
            {unmatchedRows.length}
          </p>
          <p className="text-sm text-muted-foreground">Rows requiring accounting review.</p>
        </RecoveryCard>
        <RecoveryCard title="Total difference">
          <p className="text-3xl font-semibold text-foreground">{formatNumber(totalDifference)}</p>
          <p className="text-sm text-muted-foreground">Absolute difference from backend checks.</p>
        </RecoveryCard>
      </div>

      {branchesQuery.isError ? <ErrorNotice message={branchesQuery.error.message} /> : null}
      <ReconciliationSection
        errorMessage={healthQuery.isError ? healthQuery.error.message : undefined}
        isLoading={healthQuery.isLoading}
        onRetry={() => void healthQuery.refetch()}
        response={healthQuery.data}
        title="Health check"
      />
      <ReconciliationSection
        actionHref={ROUTES.reportsInventoryAccountingReconciliation}
        actionLabel="Open detail report"
        errorMessage={inventoryQuery.isError ? inventoryQuery.error.message : undefined}
        isLoading={inventoryQuery.isLoading}
        onRetry={() => void inventoryQuery.refetch()}
        response={inventoryQuery.data}
        title="Inventory"
      />
      <ReconciliationSection
        errorMessage={apQuery.isError ? apQuery.error.message : undefined}
        isLoading={apQuery.isLoading}
        onRetry={() => void apQuery.refetch()}
        response={apQuery.data}
        title="Accounts payable"
      />
      <ReconciliationSection
        errorMessage={arQuery.isError ? arQuery.error.message : undefined}
        isLoading={arQuery.isLoading}
        onRetry={() => void arQuery.refetch()}
        response={arQuery.data}
        title="Accounts receivable"
      />
      <ReconciliationSection
        errorMessage={paymentAccountsQuery.isError ? paymentAccountsQuery.error.message : undefined}
        isLoading={paymentAccountsQuery.isLoading}
        onRetry={() => void paymentAccountsQuery.refetch()}
        response={paymentAccountsQuery.data}
        title="Payment accounts"
      />
    </div>
  );
}

export function AccountingBackfillPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canManage = canManageAccounting(hasAnyPermission);
  const canLoadBranches = hasAnyPermission([PERMISSIONS.branchesView, PERMISSIONS.branchesSwitch]);
  const [dateFrom, setDateFrom] = useState(`${String(new Date().getFullYear())}-01-01`);
  const [dateTo, setDateTo] = useState(todayString());
  const [branchId, setBranchId] = useState("");
  const [limit, setLimit] = useState(100);
  const [selectedTargets, setSelectedTargets] =
    useState<AccountingBackfillTarget[]>(backfillTargets);
  const [dryRunCompleted, setDryRunCompleted] = useState(false);
  const [confirmRealRunOpen, setConfirmRealRunOpen] = useState(false);
  const filters = useMemo(
    () => ({
      branchId,
      dateFrom,
      dateTo,
      limit,
      targets: selectedTargets,
    }),
    [branchId, dateFrom, dateTo, limit, selectedTargets],
  );
  const branchesQuery = useBranches(canManage && canLoadBranches);
  const readinessQuery = useAccountingBackfillReadiness(
    filters,
    canManage && selectedTargets.length > 0,
  );
  const runBackfill = useRunAccountingBackfill();
  const readiness = readinessQuery.data;
  const branches = (branchesQuery.data ?? []).filter((branch) => branch.status === "active");
  const readinessLoaded = readinessQuery.isSuccess && readiness !== undefined;
  const blockingIssues =
    readiness?.issues.filter((issue) => readinessIssueBlocks(issue.severity)) ?? [];
  const warningIssues =
    readiness?.issues.filter((issue) => !readinessIssueBlocks(issue.severity)) ?? [];
  const candidateCount =
    readiness?.targets.reduce((sum, target) => sum + target.candidateCount, 0) ?? 0;
  const wouldPostCount =
    readiness?.targets.reduce((sum, target) => sum + target.wouldPostCount, 0) ?? 0;
  const blockedCount =
    readiness?.targets.reduce((sum, target) => sum + target.blockedCount, 0) ?? 0;
  const canRunDryRun =
    canManage && readinessLoaded && !readinessQuery.isFetching && selectedTargets.length > 0;
  const canRunRealBackfill =
    canManage && readiness?.ready === true && dryRunCompleted && selectedTargets.length > 0;

  function resetDryRun(): void {
    setDryRunCompleted(false);
  }

  function toggleTarget(target: AccountingBackfillTarget, checked: boolean): void {
    resetDryRun();
    setSelectedTargets((current) => {
      if (checked) {
        return current.includes(target) ? current : [...current, target];
      }

      return current.filter((item) => item !== target);
    });
  }

  function submitBackfill(dryRun: boolean): void {
    const payload: AccountingBackfillPayload = {
      ...filters,
      dryRun,
    };

    runBackfill.mutate(payload, {
      onSuccess: () => {
        if (dryRun) {
          setDryRunCompleted(true);
        } else {
          setConfirmRealRunOpen(false);
        }
      },
    });
  }

  if (!canManage) {
    return <AccountingAccessDeniedCard message="You do not have permission to access this page." />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        actions={
          <Button
            disabled={readinessQuery.isFetching || selectedTargets.length === 0}
            onClick={() => void readinessQuery.refetch()}
            type="button"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" />
            Run readiness
          </Button>
        }
        description="Run readiness first, then dry run, then real journal backfill only when setup is clean."
        title="Journal Backfill"
      />

      <Card className="border-workspace-panel-border bg-workspace-panel shadow-sm">
        <CardContent className="grid gap-4 p-4 md:grid-cols-4">
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="recovery-date-from">Date from</FieldLabel>
            <Input
              id="recovery-date-from"
              onChange={(event) => {
                resetDryRun();
                setDateFrom(event.target.value);
              }}
              type="date"
              value={dateFrom}
            />
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="recovery-date-to">Date to</FieldLabel>
            <Input
              id="recovery-date-to"
              onChange={(event) => {
                resetDryRun();
                setDateTo(event.target.value);
              }}
              type="date"
              value={dateTo}
            />
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="recovery-branch-2">Branch</FieldLabel>
            <Select
              disabled={!canLoadBranches || branchesQuery.isLoading}
              onValueChange={(value) => {
                resetDryRun();
                setBranchId(value === allBranchesValue ? "" : value);
              }}
              value={branchId || allBranchesValue}
            >
              <SelectTrigger id="recovery-branch-2">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allBranchesValue}>All branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="recovery-limit">Limit</FieldLabel>
            <Input
              id="recovery-limit"
              onChange={(event) => {
                resetDryRun();
                setLimit(Math.max(1, Number(event.target.value) || 1));
              }}
              min={1}
              type="number"
              value={limit}
            />
          </div>
        </CardContent>
      </Card>

      <RecoveryCard title="Backfill targets">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {backfillTargets.map((target) => (
            <label
              className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3 text-sm font-medium"
              key={target}
            >
              <Checkbox
                checked={selectedTargets.includes(target)}
                onCheckedChange={(checked) => toggleTarget(target, checked === true)}
              />
              {formatBackfillTarget(target)}
            </label>
          ))}
        </div>
        {selectedTargets.length === 0 ? (
          <p className="mt-3 text-sm text-danger-text">
            Select at least one target before readiness.
          </p>
        ) : null}
      </RecoveryCard>

      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <RecoveryCard title="Readiness">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {readinessQuery.isLoading ? (
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : readiness?.ready ? (
                <CheckCircle2 className="h-6 w-6 text-money-text" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-warning-text" />
              )}
              <div>
                <p className="font-semibold">
                  {readinessQuery.isLoading
                    ? "Checking readiness"
                    : readiness?.ready
                      ? "Ready for dry run"
                      : "Setup review required"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Real backfill stays blocked until readiness is clean and dry run succeeds.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs font-semibold text-muted-foreground">Candidates</p>
                <p className="mt-1 text-2xl font-semibold">{candidateCount}</p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs font-semibold text-muted-foreground">Would post</p>
                <p className="mt-1 text-2xl font-semibold">{wouldPostCount}</p>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs font-semibold text-muted-foreground">Blocked</p>
                <p className="mt-1 text-2xl font-semibold text-danger-text">{blockedCount}</p>
              </div>
            </div>
            {blockingIssues.length > 0 ? (
              <p className="rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-sm text-danger-text">
                Fix blocking readiness issues before running a real backfill.
              </p>
            ) : null}
            {(readiness?.issues ?? []).map((issue) => (
              <div
                className="rounded-xl border bg-background px-4 py-3"
                key={`${issue.code}-${issue.message}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{issue.message}</p>
                  <Badge
                    className={issueBadgeClass(issue.severity)}
                    variant={readinessIssueBlocks(issue.severity) ? "outline" : "secondary"}
                  >
                    {formatStatus(issue.severity)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatReadinessIssueDetails(issue)}
                </p>
              </div>
            ))}
            {readiness?.issues.length === 0 ? (
              <p className="rounded-xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                No readiness issues — everything required is in place.
              </p>
            ) : null}
            {readinessQuery.isError ? <ErrorNotice message={readinessQuery.error.message} /> : null}
            {warningIssues.length > 0 && blockingIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Warnings do not block dry run. Review them before real backfill.
              </p>
            ) : null}
          </div>
        </RecoveryCard>

        <RecoveryCard title="Actions">
          <div className="flex flex-col gap-3">
            <Button
              className="w-full"
              disabled={!canRunDryRun || runBackfill.isPending}
              onClick={() => submitBackfill(true)}
              variant="outline"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Run dry run
            </Button>
            <Button
              className="w-full"
              disabled={!canRunRealBackfill || runBackfill.isPending}
              onClick={() => setConfirmRealRunOpen(true)}
            >
              Run real backfill
            </Button>
            <div className="rounded-xl border bg-background px-4 py-3 text-sm text-muted-foreground">
              <p>Dry run completed: {dryRunCompleted ? "Yes" : "No"}</p>
              <p>Readiness ready: {readiness?.ready ? "Yes" : "No"}</p>
            </div>
            {runBackfill.isError ? <ErrorNotice message={runBackfill.error.message} /> : null}
          </div>
        </RecoveryCard>
      </div>

      <RecoveryCard title="Targets">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(readiness?.targets ?? []).map((target) => (
            <div className="rounded-xl border bg-background p-4" key={target.target}>
              <p className="font-semibold">{formatBackfillTarget(target.target)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Candidates: {target.candidateCount} / Would post: {target.wouldPostCount} / Blocked:{" "}
                {target.blockedCount}
              </p>
            </div>
          ))}
        </div>
      </RecoveryCard>

      {runBackfill.data ? (
        <RecoveryCard title={runBackfill.data.dryRun ? "Dry run results" : "Backfill results"}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left">Target</th>
                  <th className="px-3 py-2 text-right">Scanned</th>
                  <th className="px-3 py-2 text-right">Would post</th>
                  <th className="px-3 py-2 text-right">Posted</th>
                  <th className="px-3 py-2 text-right">Skipped</th>
                  <th className="px-3 py-2 text-right">Failed</th>
                </tr>
              </thead>
              <tbody>
                {runBackfill.data.results.map((result) => (
                  <tr className="border-b last:border-b-0" key={result.target}>
                    <td className="px-3 py-3 font-medium">{formatBackfillTarget(result.target)}</td>
                    <td className="px-3 py-3 text-right">{result.scannedCount}</td>
                    <td className="px-3 py-3 text-right">{result.wouldPostCount}</td>
                    <td className="px-3 py-3 text-right">{result.postedCount}</td>
                    <td className="px-3 py-3 text-right">{result.skippedCount}</td>
                    <td className="px-3 py-3 text-right text-danger-text">{result.failedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {runBackfill.data.results.some((result) => result.errors.length > 0) ? (
            <div className="mt-4 flex flex-col gap-3">
              {runBackfill.data.results
                .filter((result) => result.errors.length > 0)
                .map((result) => (
                  <div
                    className="rounded-xl border border-danger/30 bg-danger-tint px-4 py-3"
                    key={result.target}
                  >
                    <p className="font-semibold text-danger-text">
                      {formatBackfillTarget(result.target)}
                    </p>
                    <ul className="mt-2 list-disc pl-5 text-sm text-danger-text">
                      {result.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ) : null}
        </RecoveryCard>
      ) : null}

      <Dialog onOpenChange={setConfirmRealRunOpen} open={confirmRealRunOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run real accounting backfill?</DialogTitle>
            <DialogDescription>
              This can create posted journal entries for historical documents. Run it only after
              readiness is clean and dry run results are acceptable.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Targets: {selectedTargets.map(formatBackfillTarget).join(", ")}
          </div>
          <DialogFooter>
            <Button onClick={() => setConfirmRealRunOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={!canRunRealBackfill || runBackfill.isPending}
              onClick={() => submitBackfill(false)}
              type="button"
            >
              Confirm real backfill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
