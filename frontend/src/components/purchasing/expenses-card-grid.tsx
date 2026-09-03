"use client";

import type { JSX } from "react";

import { ExpenseActionsMenu } from "@/components/purchasing/expense-actions-menu";
import {
  expenseCounterpartyLabel,
  formatExpenseDate,
  formatExpenseMoney,
} from "@/components/purchasing/expense-details-panel";
import { ExpenseStatusBadge } from "@/components/purchasing/expense-status-badge";
import type { ExpensesListProps } from "@/components/purchasing/expenses-table";
import { Card } from "@/components/ui/card";

/**
 * The register as cards, for phones. Seven columns, two of them account names,
 * have no honest layout at 375px.
 */
export function ExpensesCardGrid({ expenses, onView, ...actions }: ExpensesListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {expenses.map((expense) => (
        <Card
          className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          key={expense.id}
          onClick={() => onView(expense)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <button
              className="grid min-w-0 gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                onView(expense);
              }}
              type="button"
            >
              <span className="truncate font-mono font-medium">{expense.expenseNumber}</span>
              <span className="truncate text-meta text-foreground-muted">
                {expense.branchName} ·{" "}
                <span className="tabular-nums">{formatExpenseDate(expense.expenseDate)}</span>
              </span>
            </button>
            <div onClick={(event) => event.stopPropagation()}>
              <ExpenseActionsMenu {...actions} expense={expense} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="text-section font-medium tabular-nums">
              {formatExpenseMoney(expense.amount)}
            </span>
            <ExpenseStatusBadge status={expense.status} />
          </div>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Account</p>
              <p className="mt-1 break-words text-cell font-medium">{expense.expenseAccountName}</p>
            </div>
            <div className="min-w-0 px-4 py-3">
              <p className="text-meta text-foreground-muted">Paid through</p>
              <p className="mt-1 break-words text-cell font-medium">
                {expense.paidThroughAccountName}
              </p>
            </div>
          </div>

          <p className="border-t border-workspace-border px-4 py-2 text-meta text-foreground-muted">
            {expenseCounterpartyLabel(expense)}
          </p>
        </Card>
      ))}
    </div>
  );
}
