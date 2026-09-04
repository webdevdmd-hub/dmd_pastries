"use client";

import {
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
import type { JSX } from "react";
import { useMemo } from "react";

import { AccountingAccessDeniedCard } from "@/components/accounting/accounting-access-denied-card";
import {
  type AccountingHubItem,
  AccountingHubList,
  type AccountingHubSection,
} from "@/components/accounting/accounting-hub-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";

const accountingSections = [
  {
    label: "Books",
    description: "The account structure and every posted debit and credit that moves through it.",
    items: [
      {
        description:
          "Maintain the account structure used by sales, purchases, payments, and reports.",
        href: ROUTES.accountingChartOfAccounts,
        icon: Landmark,
        label: "Chart of Accounts",
        managePermission: PERMISSIONS.accountingAccountsManage,
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
        managePermission: PERMISSIONS.accountingJournalEntriesManage,
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingJournalEntriesManage],
      },
    ],
  },
  {
    label: "Cash and settlements",
    description: "Where money arrives, moves between accounts, and clears from platforms.",
    items: [
      {
        description: "Configure payment methods and the accounts where received money is recorded.",
        href: `${ROUTES.settingsPaymentSetup}?tab=accounts`,
        icon: CreditCard,
        label: "Payment Setup",
        managePermission: PERMISSIONS.accountingAccountsManage,
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingAccountsManage],
      },
      {
        description: "Move balances between cash, bank, and clearing accounts with an audit trail.",
        href: ROUTES.accountingAccountTransfers,
        icon: WalletCards,
        label: "Bank / Cash Movements",
        managePermission: PERMISSIONS.accountingJournalEntriesManage,
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingJournalEntriesManage],
      },
      {
        description: "Track Talabat, Noon, card, and other platform settlement clearing accounts.",
        href: ROUTES.accountingPlatformSettlements,
        icon: ReceiptText,
        label: "Platform Settlements",
        managePermission: PERMISSIONS.accountingJournalEntriesManage,
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingJournalEntriesManage],
      },
      {
        description: "Review operating expenses and the accounting entries they create.",
        href: ROUTES.expenses,
        icon: FileMinus2,
        label: "Expenses",
        managePermission: PERMISSIONS.expensesManage,
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
    description: "Calculated from posted entries only. Draft journals are excluded.",
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
    description: "Setup, mappings, go-live balances, and the tools for repairing history.",
    items: [
      {
        description: "Set financial-year start rules used by backend accounting reports.",
        href: ROUTES.accountingSettings,
        icon: Settings2,
        label: "Accounting Settings",
        managePermission: PERMISSIONS.accountingAccountsManage,
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingAccountsManage],
      },
      {
        description: "Review and seed the chart account mappings used by automated journals.",
        href: ROUTES.accountingAccountMappings,
        icon: ListChecks,
        label: "Account Mappings",
        managePermission: PERMISSIONS.accountingAccountsManage,
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingAccountsManage],
      },
      {
        description: "Enter go-live balances for accounts, customers and suppliers against 3400.",
        href: ROUTES.accountingOpeningBalances,
        icon: Scale,
        label: "Opening Balances",
        managePermission: PERMISSIONS.accountingAccountsManage,
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
        managePermission: PERMISSIONS.accountingJournalEntriesManage,
        permissionAny: [PERMISSIONS.accountingView, PERMISSIONS.accountingJournalEntriesManage],
      },
    ],
  },
] as const satisfies readonly AccountingHubSection[];

/**
 * Three words the rest of the module uses without defining them. Kept from the
 * card layout, but at cell size across the top rather than as a panel: it is
 * orientation, not the thing you came here to open.
 */
const glossary = [
  { term: "Account", meaning: "What receives the debit or the credit." },
  { term: "Ledger", meaning: "That account's history and running balance." },
  { term: "Source", meaning: "The sale, purchase, expense or payment that posted it." },
];

export function AccountingPageClient(): JSX.Element {
  const { hasAnyPermission, hasPermission } = usePermission();
  const canViewAccounting = hasAnyPermission([PERMISSIONS.accountingView]);
  const visibleSections = useMemo(
    () =>
      accountingSections
        .map((section) => ({
          description: section.description,
          label: section.label,
          items: section.items.filter((item) => hasAnyPermission([...item.permissionAny])),
        }))
        .filter((section) => section.items.length > 0),
    [hasAnyPermission],
  );

  if (!canViewAccounting) {
    return <AccountingAccessDeniedCard message="You need `accounting.view` to open Accounting." />;
  }

  const canManage = (item: AccountingHubItem): boolean =>
    item.managePermission !== undefined && hasPermission(item.managePermission);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        actions={
          <Button asChild>
            <Link href={ROUTES.accountingGeneralLedger}>Open General Ledger</Link>
          </Button>
        }
        description="The connected view of accounts, ledgers, journals, cash movement, settlements, and financial statements."
        title="Accounting"
      />

      {/* Scrolls on a phone rather than stacking three panels above the lists. */}
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0">
        {glossary.map((entry) => (
          <Card className="w-52 shrink-0 sm:w-auto sm:min-w-0" key={entry.term}>
            <CardContent className="p-4">
              <p className="text-meta text-foreground-muted">{entry.term}</p>
              <p className="mt-1 break-words text-cell">{entry.meaning}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {visibleSections.map((section) => (
        <section
          aria-labelledby={`accounting-${section.label.replaceAll(" ", "-")}`}
          className="grid gap-4"
          key={section.label}
        >
          <div className="grid gap-1">
            <h2
              className="text-section font-medium"
              id={`accounting-${section.label.replaceAll(" ", "-")}`}
            >
              {section.label}
            </h2>
            <p className="max-w-3xl text-cell text-foreground-muted">{section.description}</p>
          </div>
          <AccountingHubList canManage={canManage} items={section.items} />
        </section>
      ))}
    </div>
  );
}
