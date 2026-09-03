"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import {
  type ExpenseDetailTabKey,
  parseExpenseDetailTab,
} from "@/components/purchasing/expense-detail-tabs";
import {
  ExpenseDetailsPanel,
  formatExpenseDate,
  formatExpenseMoney,
} from "@/components/purchasing/expense-details-panel";
import { ExpenseStatusBadge } from "@/components/purchasing/expense-status-badge";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useExpense } from "@/hooks/use-expenses";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";

export function ExpenseDetailsPageClient({ expenseId }: { expenseId: string }): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([
    PERMISSIONS.expensesView,
    PERMISSIONS.expensesManage,
    PERMISSIONS.purchasingView,
  ]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const expenseQuery = useExpense(expenseId, canView);

  const activeTab = parseExpenseDetailTab(searchParams.get("tab"));

  const changeTab = (tab: ExpenseDetailTabKey): void => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (!canView) {
    return <AccessDeniedCard message="You need `expenses.view` to view this expense." />;
  }

  if (expenseQuery.isLoading) {
    return <PurchaseTableSkeleton />;
  }

  if (expenseQuery.error || !expenseQuery.data) {
    return (
      <PurchaseErrorState
        description={
          expenseQuery.error ? getErrorMessage(expenseQuery.error) : "Expense not found."
        }
        onRetry={() => void expenseQuery.refetch()}
      />
    );
  }

  const expense = expenseQuery.data;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="min-w-0">
        <Link
          className="inline-flex items-center gap-1.5 text-cell text-foreground-muted transition-colors hover:text-foreground"
          href={ROUTES.expenses}
        >
          Back to expenses
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-page">{expense.expenseNumber}</h1>
          <ExpenseStatusBadge status={expense.status} />
        </div>
        <p className="mt-1 text-meta text-foreground-muted">
          <span className="tabular-nums">{formatExpenseMoney(expense.amount)}</span> ·{" "}
          {expense.branchName} ·{" "}
          <span className="tabular-nums">{formatExpenseDate(expense.expenseDate)}</span>
        </p>
      </div>

      <ExpenseDetailsPanel activeTab={activeTab} expense={expense} onTabChange={changeTab} />
    </div>
  );
}
