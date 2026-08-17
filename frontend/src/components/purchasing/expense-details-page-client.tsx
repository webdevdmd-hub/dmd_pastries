"use client";

import { ArrowLeft, FileMinus2, Landmark, ReceiptText } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useExpense } from "@/hooks/use-expenses";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";

function money(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "-";
}

export function ExpenseDetailsPageClient({ expenseId }: { expenseId: string }): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([
    PERMISSIONS.expensesView,
    PERMISSIONS.expensesManage,
    PERMISSIONS.purchasingView,
  ]);
  const expenseQuery = useExpense(expenseId, canView);
  const expense = expenseQuery.data;

  if (!canView) {
    return <AccessDeniedCard message="You need `expenses.view` to view this expense." />;
  }

  if (expenseQuery.error) {
    return (
      <PurchaseErrorState
        description={getErrorMessage(expenseQuery.error)}
        onRetry={() => void expenseQuery.refetch()}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        actions={
          <Button asChild type="button" variant="outline">
            <Link href={ROUTES.expenses}>
              <ArrowLeft className="h-4 w-4" />
              Back to Expenses
            </Link>
          </Button>
        }
        description="Review expense source, paid-through account, and generated accounting link."
        title={expense?.expenseNumber ?? "Expense details"}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileMinus2 className="h-4 w-4" />
              Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-brand-espresso">
              {expense ? money(expense.amount) : "Loading..."}
            </p>
            {expense ? (
              <Badge
                className="mt-3"
                variant={expense.status === "posted" ? "default" : "secondary"}
              >
                {expense.status === "posted" ? "Posted" : "Voided"}
              </Badge>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4" />
              Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p>
              <span className="text-brand-mocha">Debit:</span>{" "}
              <strong>{expense?.expenseAccountName ?? "Loading..."}</strong>
            </p>
            <p>
              <span className="text-brand-mocha">Credit:</span>{" "}
              <strong>{expense?.paidThroughAccountName ?? "Loading..."}</strong>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ReceiptText className="h-4 w-4" />
              Reference
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p>{expense ? formatDate(expense.expenseDate) : "Loading..."}</p>
            <p className="text-brand-mocha">{expense?.referenceNumber ?? "No reference"}</p>
          </CardContent>
        </Card>
      </div>

      {expense ? (
        <Card>
          <CardContent className="grid gap-4 p-6 md:grid-cols-2">
            <Detail label="Branch" value={expense.branchName} />
            <Detail label="Vendor" value={expense.supplierName ?? "Not tagged"} />
            <Detail label="Customer" value={expense.customerName ?? "Not tagged"} />
            <Detail label="Created by" value={expense.createdByUserName} />
            <Detail label="Journal entry" value={expense.journalEntryId || "Not available"} />
            <Detail label="Receipt file" value={expense.receiptFileId ?? "No receipt file"} />
            <div className="md:col-span-2">
              <Detail label="Notes" value={expense.notes ?? "No notes"} />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-brand-cappuccino/60 bg-card/80 p-4">
      <p className="text-xs text-brand-mocha">{label}</p>
      <p className="mt-1 break-words font-semibold text-brand-espresso">{value}</p>
    </div>
  );
}
