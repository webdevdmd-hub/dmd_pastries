"use client";

import type { JSX, ReactNode } from "react";

import type { ExpenseDetailTabKey } from "@/components/purchasing/expense-detail-tabs";
import {
  EXPENSE_DETAIL_TABPANEL_ID,
  ExpenseDetailViewTabs,
} from "@/components/purchasing/expense-detail-view-tabs";
import { AccountingJournalLink } from "@/components/shared/accounting-reference-links";
import type { Expense } from "@/types/expenses";

export function formatExpenseMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function formatExpenseDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

export function formatExpenseDateTime(value: string): string {
  return value ? new Date(value).toLocaleString("en-AE") : "Not recorded";
}

/** Vendor, else customer, else neither. The register shows one column for both. */
export function expenseCounterpartyLabel(expense: Expense): string {
  return expense.supplierName ?? expense.customerName ?? "Not tagged";
}

function InfoField({
  label,
  mono = false,
  numeric = false,
  value,
}: {
  label: string;
  mono?: boolean;
  numeric?: boolean;
  value: ReactNode;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-meta text-foreground-muted">{label}</p>
      <p
        className={[
          "mt-0.5 break-words text-cell font-medium",
          mono ? "font-mono" : "",
          numeric ? "tabular-nums" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function SectionCard({ children }: { children: ReactNode }): JSX.Element {
  return <div className="rounded-lg border border-border bg-card p-4">{children}</div>;
}

type ExpenseDetailsPanelProps = {
  activeTab: ExpenseDetailTabKey;
  expense: Expense;
  onTabChange: (tab: ExpenseDetailTabKey) => void;
};

/**
 * The body of an expense, shared by the drawer over the register and the full
 * page at /expenses/[id]. One component so the two cannot drift.
 */
export function ExpenseDetailsPanel({
  activeTab,
  expense,
  onTabChange,
}: ExpenseDetailsPanelProps): JSX.Element {
  return (
    <div className="grid min-w-0 gap-6">
      <ExpenseDetailViewTabs active={activeTab} expenseId={expense.id} onTabChange={onTabChange} />

      <div className="min-w-0" id={EXPENSE_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {activeTab === "overview" ? (
          <div className="grid gap-4">
            {/* The amount is why the record exists, so it leads at display
                size rather than sitting in the eighth column of a grid. */}
            <SectionCard>
              <p className="text-meta text-foreground-muted">Amount</p>
              <p className="mt-1 text-section font-medium tabular-nums">
                {formatExpenseMoney(expense.amount)}
              </p>
              <p className="mt-1 text-cell text-foreground-muted">
                <span className="tabular-nums">{formatExpenseDate(expense.expenseDate)}</span> ·{" "}
                {expense.branchName}
              </p>
            </SectionCard>

            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
              <InfoField
                label="Expense account"
                value={`${expense.expenseAccountCode} · ${expense.expenseAccountName}`}
              />
              <InfoField
                label="Paid through"
                value={`${expense.paidThroughAccountCode} · ${expense.paidThroughAccountName}`}
              />
              <InfoField label="Vendor" value={expense.supplierName ?? "Not tagged"} />
              <InfoField label="Customer" value={expense.customerName ?? "Not tagged"} />
              <InfoField label="Reference number" mono value={expense.referenceNumber ?? "None"} />
              <InfoField label="Billable" value={expense.isBillable ? "Yes" : "No"} />
            </div>
          </div>
        ) : null}

        {activeTab === "accounting" ? (
          <div className="grid gap-4">
            {/* Which account was debited and which credited is the whole
                content of the journal, and it was previously stated only as
                two bare account names under a "Accounts" card heading. */}
            <SectionCard>
              <p className="text-meta text-foreground-muted">Journal posted by the backend</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <InfoField
                  label="Debit"
                  value={`${expense.expenseAccountCode} · ${expense.expenseAccountName}`}
                />
                <InfoField
                  label="Credit"
                  value={`${expense.paidThroughAccountCode} · ${expense.paidThroughAccountName}`}
                />
              </div>
              <p className="mt-3 text-cell tabular-nums text-foreground-muted">
                {formatExpenseMoney(expense.amount)}
              </p>
            </SectionCard>

            <SectionCard>
              <p className="text-meta text-foreground-muted">Journal entry</p>
              {expense.journalEntryId ? (
                <>
                  <p className="mt-1 break-words font-mono text-cell font-medium">
                    {expense.journalEntryId}
                  </p>
                  <div className="mt-3">
                    <AccountingJournalLink id={expense.journalEntryId} />
                  </div>
                </>
              ) : (
                <p className="mt-1 text-cell text-foreground-muted">
                  No journal entry is recorded against this expense.
                </p>
              )}
            </SectionCard>

            {/* A voided expense has a second journal that undoes the first.
                Nothing in the old detail page mentioned it existed. */}
            {expense.reversalJournalEntryId ? (
              <div className="rounded-lg border border-warning/30 bg-warning-tint p-4">
                <p className="text-cell font-medium">Reversal journal</p>
                <p className="mt-1 break-words font-mono text-cell text-foreground-muted">
                  {expense.reversalJournalEntryId}
                </p>
                <div className="mt-3">
                  <AccountingJournalLink id={expense.reversalJournalEntryId} />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "receipt" ? (
          <div className="grid gap-4">
            <SectionCard>
              <p className="text-meta text-foreground-muted">Receipt file</p>
              <p className="mt-1 break-words font-mono text-cell font-medium">
                {expense.receiptFileId ?? "No receipt was attached."}
              </p>
            </SectionCard>

            <SectionCard>
              <p className="text-meta text-foreground-muted">Notes</p>
              <p className="mt-1 text-cell">{expense.notes ?? "No notes."}</p>
            </SectionCard>

            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
              <InfoField label="Recorded by" value={expense.createdByUserName} />
              <InfoField
                label="Recorded at"
                numeric
                value={formatExpenseDateTime(expense.createdAt)}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
