"use client";

import { BookOpenText, Landmark, Scale, WalletCards } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";

const accountingReportCards = [
  {
    description: "Review posted journal entry activity by account, branch, and date range.",
    href: ROUTES.accountingGeneralLedger,
    icon: BookOpenText,
    title: "General Ledger",
  },
  {
    description: "Check debit and credit balances by account for a selected period.",
    href: ROUTES.accountingTrialBalance,
    icon: Scale,
    title: "Trial Balance",
  },
  {
    description: "Review income, COGS, operating expenses, and net profit.",
    href: ROUTES.accountingProfitLoss,
    icon: WalletCards,
    title: "Profit & Loss",
  },
  {
    description: "View assets, liabilities, equity, and balance status as of a date.",
    href: ROUTES.accountingBalanceSheet,
    icon: Landmark,
    title: "Balance Sheet",
  },
] as const;

export function AccountingReportsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.accountingView]);

  if (!canView) {
    return (
      <AccountingAccessDeniedCard message="You need `accounting.view` to view Accounting Reports." />
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        description="Choose the accounting statement or ledger report you want to review."
        title="Accounting Reports"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {accountingReportCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card
              className="border-workspace-panel-border bg-workspace-panel shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
              key={card.title}
            >
              <CardHeader className="gap-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-2xl bg-brand-latte p-3 text-brand-mocha">
                    <Icon className="h-5 w-5" />
                  </span>
                  <Badge variant="secondary">Ready</Badge>
                </div>
                <CardTitle className="text-lg text-brand-espresso">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="min-h-14 text-sm leading-6 text-brand-mocha">{card.description}</p>
                <Button asChild>
                  <Link href={card.href}>Open report</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
