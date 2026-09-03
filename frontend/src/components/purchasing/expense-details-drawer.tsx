"use client";

import { ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import {
  DEFAULT_EXPENSE_DETAIL_TAB,
  type ExpenseDetailTabKey,
} from "@/components/purchasing/expense-detail-tabs";
import {
  ExpenseDetailsPanel,
  formatExpenseMoney,
} from "@/components/purchasing/expense-details-panel";
import { ExpenseStatusBadge } from "@/components/purchasing/expense-status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";
import type { Expense } from "@/types/expenses";

type ExpenseDetailsDrawerProps = {
  canDelete: boolean;
  canEdit: boolean;
  /** Closes the drawer and opens the host's delete confirmation. */
  onDelete: (expense: Expense) => void;
  /** Closes the drawer and opens the host's form dialog. */
  onEdit: (expense: Expense) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  expense: Expense | null;
};

/**
 * An expense, over the register.
 *
 * The tab state is in memory, not in the URL: a `router.replace` here would
 * remount the page segment about a second later and Radix would dismiss the
 * sheet. The full page is the URL-addressable copy, linked from the header.
 */
export function ExpenseDetailsDrawer({
  canDelete,
  canEdit,
  expense,
  onDelete,
  onEdit,
  onOpenChange,
  open,
}: ExpenseDetailsDrawerProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<ExpenseDetailTabKey>(DEFAULT_EXPENSE_DETAIL_TAB);

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" side="right">
        {expense ? (
          // Keyed by expense: opening a different row resets the tab rather
          // than landing on Receipt because that is where the last one was left.
          <div className="grid min-w-0 gap-6" key={expense.id}>
            <SheetHeader className="space-y-0 p-0">
              <SheetTitle className="font-mono text-section">{expense.expenseNumber}</SheetTitle>
              <SheetDescription className="sr-only">
                Expense overview, accounting journal and receipt.
              </SheetDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ExpenseStatusBadge status={expense.status} />
                <span className="text-cell font-medium tabular-nums">
                  {formatExpenseMoney(expense.amount)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" type="button" variant="outline">
                  <Link href={`${ROUTES.expenses}/${expense.id}`}>
                    <ArrowUpRight className="h-4 w-4" />
                    Open full page
                  </Link>
                </Button>
                {canEdit ? (
                  <Button onClick={() => onEdit(expense)} size="sm" type="button" variant="outline">
                    <Pencil className="h-4 w-4" />
                    Edit expense
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    className="text-danger-text"
                    onClick={() => onDelete(expense)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </SheetHeader>

            <ExpenseDetailsPanel
              activeTab={activeTab}
              expense={expense}
              onTabChange={setActiveTab}
            />
          </div>
        ) : (
          // Radix requires a title on every open sheet, including this one.
          <SheetHeader>
            <SheetTitle className="sr-only">Expense</SheetTitle>
            <SheetDescription>No expense selected.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
