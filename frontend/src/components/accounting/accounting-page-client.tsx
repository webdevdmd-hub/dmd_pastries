"use client";

import {
  ArrowRight,
  BookOpenText,
  CreditCard,
  FileMinus2,
  Landmark,
  ListChecks,
  ReceiptText,
  RefreshCw,
  Scale,
  Settings2,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, JSX } from "react";
import { useMemo } from "react";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import type { Permission } from "@/types/permission";

type AccountingHubItem = {
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  permissionAny: readonly Permission[];
  status?: string;
};

type AccountingHubSection = {
  items: readonly AccountingHubItem[];
  label: string;
};

const accountingSections = [
  {
    label: "Books",
    items: [
      {
        description:
          "Maintain the account structure used by sales, purchases, payments, and reports.",
        href: ROUTES.accountingChartOfAccounts,
        icon: Landmark,
        label: "Chart of Accounts",
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingAccountsManage],
      },
      {
        description: "Review posted debit and credit activity by account, branch, and date range.",
        href: ROUTES.accountingGeneralLedger,
        icon: BookOpenText,
        label: "General Ledger",
        permissionAny: [PERMISSIONS.accountingView],
      },
      {
        description: "Create and review manual journal entries with linked source documents.",
        href: ROUTES.accountingJournalEntries,
        icon: ListChecks,
        label: "Journal Entries",
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingJournalEntriesManage],
      },
    ],
  },
  {
    label: "Cash and settlements",
    items: [
      {
        description: "Configure payment methods and the accounts where received money is recorded.",
        href: `${ROUTES.settingsPaymentSetup}?tab=accounts`,
        icon: CreditCard,
        label: "Payment Setup",
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingAccountsManage],
      },
      {
        description: "Move balances between cash, bank, and clearing accounts with an audit trail.",
        href: ROUTES.accountingAccountTransfers,
        icon: WalletCards,
        label: "Bank / Cash Movements",
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingJournalEntriesManage],
      },
      {
        description: "Track Talabat, Noon, card, and other platform settlement clearing accounts.",
        href: ROUTES.accountingPlatformSettlements,
        icon: ReceiptText,
        label: "Platform Settlements",
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingJournalEntriesManage],
      },
      {
        description: "Review operating expenses and the accounting entries they create.",
        href: ROUTES.expenses,
        icon: FileMinus2,
        label: "Expenses",
        permissionAny: [
          PERMISSIONS.accountingView,
          PERMISSIONS.expensesView,
          PERMISSIONS.expensesManage,
        ],
      },
    ],
  },
  {
    label: "Financial statements",
    items: [
      {
        description: "Check account debit and credit balances before reviewing statements.",
        href: ROUTES.accountingTrialBalance,
        icon: Scale,
        label: "Trial Balance",
        permissionAny: [PERMISSIONS.accountingView],
        status: "Statement",
      },
      {
        description: "Review income, cost of goods sold, expenses, and net profit or loss.",
        href: ROUTES.accountingProfitLoss,
        icon: WalletCards,
        label: "Profit & Loss",
        permissionAny: [PERMISSIONS.accountingView],
        status: "Statement",
      },
      {
        description: "View assets, liabilities, equity, and backend-calculated balance rows.",
        href: ROUTES.accountingBalanceSheet,
        icon: Landmark,
        label: "Balance Sheet",
        permissionAny: [PERMISSIONS.accountingView],
        status: "Statement",
      },
      {
        description: "Open the accounting report selector for all statement and ledger reports.",
        href: ROUTES.accountingReports,
        icon: BookOpenText,
        label: "Accounting Reports",
        permissionAny: [PERMISSIONS.accountingView],
      },
    ],
  },
  {
    label: "Recovery and controls",
    items: [
      {
        description: "Set financial-year start rules used by backend accounting reports.",
        href: ROUTES.accountingSettings,
        icon: Settings2,
        label: "Accounting Settings",
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingAccountsManage],
      },
      {
        description: "Review and seed the chart account mappings used by automated journals.",
        href: ROUTES.accountingAccountMappings,
        icon: ListChecks,
        label: "Account Mappings",
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingAccountsManage],
      },
      {
        description: "Compare operational balances with posted journal ledgers.",
        href: ROUTES.accountingReconciliation,
        icon: ShieldCheck,
        label: "Reconciliation",
        permissionAny: [PERMISSIONS.accountingView],
      },
      {
        description: "Check readiness and run journal backfill for historical source documents.",
        href: ROUTES.accountingBackfill,
        icon: RefreshCw,
        label: "Journal Backfill",
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingJournalEntriesManage],
      },
    ],
  },
] as const satisfies readonly AccountingHubSection[];

function AccountingCard({ item }: { item: AccountingHubItem }): JSX.Element {
  const Icon = item.icon;

  return (
    <Link className="group block h-full" href={item.href}>
      <Card className="h-full border-workspace-panel-border bg-workspace-panel shadow-sm transition hover:-translate-y-0.5 hover:border-brand-caramel hover:shadow-soft">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-latte text-brand-mocha">
              <Icon className="h-5 w-5" />
            </span>
            {item.status ? <Badge variant="secondary">{item.status}</Badge> : null}
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-brand-espresso">{item.label}</h3>
            <p className="text-sm leading-6 text-brand-mocha">{item.description}</p>
          </div>
          <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-brand-espresso">
            Open
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export function AccountingPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canViewAccounting = hasAnyPermission([PERMISSIONS.accountingView]);
  const visibleSections = useMemo(
    () =>
      accountingSections
        .map((section) => ({
          label: section.label,
          items: section.items.filter((item) => hasAnyPermission([...item.permissionAny])),
        }))
        .filter((section) => section.items.length > 0),
    [hasAnyPermission],
  );

  if (!canViewAccounting) {
    return <AccountingAccessDeniedCard message="You need `accounting.view` to open Accounting." />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        actions={
          <Button asChild>
            <Link href={ROUTES.accountingGeneralLedger}>Open General Ledger</Link>
          </Button>
        }
        description="Use Accounting as the connected view of accounts, ledgers, journals, cash movement, settlements, and financial statements."
        title="Accounting"
      />

      <div className="rounded-2xl border border-brand-cappuccino/70 bg-white/80 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-mocha">
              Account
            </p>
            <p className="mt-1 text-sm text-brand-espresso">
              The account that receives debit and credit entries.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-mocha">
              Ledger
            </p>
            <p className="mt-1 text-sm text-brand-espresso">
              The transaction history and running balance for that account.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-mocha">
              Source
            </p>
            <p className="mt-1 text-sm text-brand-espresso">
              POS, purchase, order, expense, payment, or settlement document that posted the entry.
            </p>
          </div>
        </div>
      </div>

      {visibleSections.map((section) => (
        <section className="grid gap-3" key={section.label}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-mocha">
            {section.label}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {section.items.map((item) => (
              <AccountingCard item={item} key={item.href} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
