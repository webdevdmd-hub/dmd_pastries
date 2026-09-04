"use client";

import { BookOpenText, Edit, MoreHorizontal, Trash2 } from "lucide-react";
import type { JSX } from "react";

import {
  ChartAccountStatusBadge,
  ChartAccountTypeBadge,
} from "@/components/accounting/chart-account-badges";
import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ChartAccount,
  LedgerDetailsResponse,
  LedgerDetailsTransaction,
} from "@/types/accounting";

function money(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function formatAccountingLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(date);
}

const transactionColumns: ReportColumn<LedgerDetailsTransaction>[] = [
  {
    cell: (transaction) =>
      transaction.narration.trim().length > 0
        ? transaction.narration
        : transaction.lineDescription.trim().length > 0
          ? transaction.lineDescription
          : "--",
    header: "Transaction details",
    key: "details",
    primary: true,
  },
  {
    cell: (transaction) =>
      `${transaction.entryNumber}${
        transaction.referenceNumber ? ` - Ref ${transaction.referenceNumber}` : ""
      }`,
    header: "Entry",
    key: "entry",
    secondary: true,
  },
  {
    align: "right",
    cell: (transaction) => (
      <span className="tabular-nums">{formatDate(transaction.entryDate)}</span>
    ),
    header: "Date",
    key: "date",
  },
  {
    cell: (transaction) => formatAccountingLabel(transaction.accountType),
    header: "Type",
    key: "type",
  },
  {
    align: "right",
    cell: (transaction) => (
      <span className="tabular-nums">
        {transaction.debitAmount ? money(transaction.debitAmount) : "-"}
      </span>
    ),
    header: "Debit",
    key: "debit",
  },
  {
    align: "right",
    cell: (transaction) => (
      <span className="tabular-nums">
        {transaction.creditAmount ? money(transaction.creditAmount) : "-"}
      </span>
    ),
    header: "Credit",
    key: "credit",
  },
];

type ChartAccountDetailPanelProps = {
  account: ChartAccount;
  canManage: boolean;
  isLoading: boolean;
  ledgerError: unknown;
  ledgerErrorMessage: string;
  ledgerPreview: LedgerDetailsResponse | undefined;
  onDelete: () => void;
  onEdit: () => void;
  onRetryLedger: () => void;
  onShowFullLedger: () => void;
  onToggleStatus: () => void;
  /** The drawer supplies its own heading, so the inline copy hides this one. */
  showHeader?: boolean | undefined;
};

/**
 * One account's balances and recent activity.
 *
 * Extracted so the desktop split view and the phone drawer render the same
 * thing. Below lg the page has no room for a second column, and the panel used
 * to sit under a full page of account rows where nobody scrolled to it.
 */
export function ChartAccountDetailPanel({
  account,
  canManage,
  isLoading,
  ledgerError,
  ledgerErrorMessage,
  ledgerPreview,
  onDelete,
  onEdit,
  onRetryLedger,
  onShowFullLedger,
  onToggleStatus,
  showHeader = true,
}: ChartAccountDetailPanelProps): JSX.Element {
  const recentTransactions = ledgerPreview?.transactions ?? [];

  return (
    <div className="flex min-w-0 flex-col">
      {showHeader ? (
        <div className="flex flex-col gap-4 border-b border-brand-cappuccino/60 bg-brand-latte/20 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-meta font-medium text-brand-mocha">
              {formatAccountingLabel(account.accountType)}
            </p>
            <h2 className="mt-1 break-words text-2xl font-semibold tracking-tight text-brand-espresso">
              {account.accountName}
            </h2>
            <p className="mt-1 text-cell text-brand-mocha">
              Account code {account.accountCode}
              {account.parentAccountName ? ` - Parent ${account.parentAccountName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!canManage} onClick={onEdit} type="button" variant="outline">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            {canManage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button aria-label="Account actions" type="button" variant="outline">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Account actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={onToggleStatus}>
                    {account.status === "active" ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-danger-text focus:text-danger-text"
                    disabled={account.isSystemAccount}
                    onClick={onDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete account
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-6 px-4 py-6 sm:px-6">
        <div className="min-w-0">
          <p className="text-meta font-medium text-brand-mocha">Closing balance</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-10 w-64 rounded-xl" />
          ) : (
            <p className="mt-1 break-words text-3xl font-semibold tracking-tight tabular-nums text-brand-caramel">
              {money(ledgerPreview?.summary.closingBalance ?? 0)}
              <span className="ml-2 text-base text-brand-mocha">
                ({ledgerPreview?.summary.balanceLabel ?? account.normalBalance})
              </span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <ChartAccountTypeBadge accountType={account.accountType} />
            <ChartAccountStatusBadge status={account.status} />
            <span className="rounded-full border border-brand-cappuccino/70 px-3 py-1 text-meta font-medium text-brand-mocha">
              {formatAccountingLabel(account.accountGroup ? account.accountGroup : "No group")}
            </span>
            <span className="rounded-full border border-brand-cappuccino/70 px-3 py-1 text-meta font-medium text-brand-mocha">
              {account.allowManualPosting ? "Manual posting allowed" : "Control account"}
            </span>
          </div>
          {account.description ? (
            <p className="mt-5 max-w-4xl text-cell text-brand-espresso">
              <span className="font-medium">Description:</span> {account.description}
            </p>
          ) : (
            <p className="mt-5 max-w-4xl text-cell text-brand-mocha">
              No description is set for this account.
            </p>
          )}
        </div>

        <Separator className="border-dashed bg-transparent" />

        {/* Two across on a phone rather than four: at 375px a four-column row
            breaks the amounts mid-figure. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Opening", ledgerPreview?.summary.openingBalance ?? 0],
            ["Debit", ledgerPreview?.summary.periodDebit ?? 0],
            ["Credit", ledgerPreview?.summary.periodCredit ?? 0],
            ["Closing", ledgerPreview?.summary.closingBalance ?? 0],
          ].map(([label, value]) => (
            <div
              className="min-w-0 rounded-2xl border border-brand-cappuccino/60 bg-brand-latte/20 p-4"
              key={label}
            >
              <p className="text-meta font-medium text-brand-mocha">{label}</p>
              <p className="mt-2 break-words text-cell font-semibold tabular-nums text-brand-espresso">
                {money(Number(value))}
              </p>
            </div>
          ))}
        </div>

        <Card className="overflow-hidden border-brand-cappuccino/70 bg-card shadow-none">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-brand-cappuccino/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-section font-medium text-brand-espresso">
                  Recent transactions
                </h3>
                <p className="text-cell text-brand-mocha">
                  Latest posted ledger activity for this account.
                </p>
              </div>
              <Button
                disabled={isLoading || Boolean(ledgerError)}
                onClick={onShowFullLedger}
                type="button"
                variant="outline"
              >
                Show more details
              </Button>
            </div>

            {isLoading ? (
              <div className="grid gap-2 p-4">
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
              </div>
            ) : null}

            {!isLoading && ledgerError ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="font-medium text-brand-espresso">
                  Unable to load recent transactions
                </p>
                <p className="text-cell text-brand-mocha">{ledgerErrorMessage}</p>
                <Button onClick={onRetryLedger} type="button" variant="outline">
                  Retry
                </Button>
              </div>
            ) : null}

            {!isLoading && !ledgerError ? (
              recentTransactions.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center">
                  <BookOpenText className="h-9 w-9 text-brand-mocha" />
                  <p className="font-medium text-brand-espresso">No posted transactions yet.</p>
                  <p className="text-cell text-brand-mocha">
                    Draft journals are excluded until posted.
                  </p>
                </div>
              ) : (
                <ReportDataTable
                  columns={transactionColumns}
                  rowKey={(transaction, index) => `${transaction.entryId}-${String(index)}`}
                  rows={recentTransactions}
                />
              )
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
