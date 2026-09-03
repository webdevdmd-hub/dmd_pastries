"use client";

import type { JSX } from "react";

import {
  type ExpenseActionHandlers,
  ExpenseActionsMenu,
} from "@/components/purchasing/expense-actions-menu";
import {
  expenseCounterpartyLabel,
  formatExpenseDate,
  formatExpenseMoney,
} from "@/components/purchasing/expense-details-panel";
import { ExpenseStatusBadge } from "@/components/purchasing/expense-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Expense } from "@/types/expenses";

export type ExpensesListProps = ExpenseActionHandlers & {
  expenses: Expense[];
  /** Opens the expense's details; the whole row is the target. */
  onView: (expense: Expense) => void;
};

/**
 * Nine columns became seven.
 *
 * Branch moved under the expense number, where it identifies a row you have
 * found rather than competing for width with the two account columns that are
 * the register's actual subject. Everything dropped is in the drawer.
 */
export function ExpensesTable({ expenses, onView, ...actions }: ExpensesListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Expense</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Paid through</TableHead>
          <TableHead>Vendor / customer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((expense) => (
          // The row opens the drawer; the number is also a button so the
          // keyboard has a focusable target for the same action.
          <TableRow className="cursor-pointer" key={expense.id} onClick={() => onView(expense)}>
            <TableCell>
              <button
                className="grid gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(expense);
                }}
                type="button"
              >
                <span className="font-mono font-medium">{expense.expenseNumber}</span>
                <span className="text-meta text-foreground-muted">{expense.branchName}</span>
              </button>
            </TableCell>
            <TableCell className="tabular-nums">{formatExpenseDate(expense.expenseDate)}</TableCell>
            <TableCell>{expense.expenseAccountName}</TableCell>
            <TableCell>{expense.paidThroughAccountName}</TableCell>
            <TableCell>{expenseCounterpartyLabel(expense)}</TableCell>
            <TableCell>
              <ExpenseStatusBadge status={expense.status} />
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatExpenseMoney(expense.amount)}
            </TableCell>
            {/* The menu must not also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <ExpenseActionsMenu {...actions} expense={expense} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
