"use client";

import {
  BarChart3,
  Boxes,
  ChevronRight,
  Download,
  PackageSearch,
  ReceiptText,
  ShoppingBag,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/reports/access-denied-card";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";

type ReportCardStatus = "available" | "coming_soon" | "partial";

type ReportCardBase = {
  description: string;
  icon: typeof BarChart3;
  status: ReportCardStatus;
  title: string;
};

type LinkedReportCard = ReportCardBase & {
  href: string;
  status: "available" | "partial";
};

type UnavailableReportCard = ReportCardBase & {
  status: "coming_soon";
};

type ReportCard = LinkedReportCard | UnavailableReportCard;

const reportStatusLabels: Record<ReportCardStatus, string> = {
  available: "Available",
  coming_soon: "Coming Soon",
  partial: "In Progress",
};

const reportCards: ReportCard[] = [
  {
    description: "High-level sales, payment, inventory, order, and production KPIs.",
    href: ROUTES.reportsDashboard,
    icon: BarChart3,
    status: "available",
    title: "Reports Dashboard",
  },
  {
    description: "Export report data as CSV for review, accounting, or backup.",
    href: ROUTES.reportsExport,
    icon: Download,
    status: "available",
    title: "Export Center",
  },
  {
    description: "Detailed product, category, branch, and cashier sales reporting.",
    href: ROUTES.reportsSales,
    icon: ReceiptText,
    status: "available",
    title: "Sales Reports",
  },
  {
    description: "Completed POS sales, receipt view history, and printable bill details.",
    href: ROUTES.reportsReceipts,
    icon: ReceiptText,
    status: "available",
    title: "Sales Receipts",
  },
  {
    description: "Collections, refunds, balances, supplier payables, and reconciliation reporting.",
    href: ROUTES.reportsFinancial,
    icon: WalletCards,
    status: "available",
    title: "Financial Reports",
  },
  {
    description: "Low stock, expiry, stock movement, and valuation signals.",
    href: ROUTES.reportsInventory,
    icon: PackageSearch,
    status: "available",
    title: "Inventory Reports",
  },
  {
    description: "Production batches, output, wastage, and recipe performance.",
    href: ROUTES.reportsManufacturing,
    icon: Boxes,
    status: "available",
    title: "Manufacturing Reports",
  },
  {
    description: "Custom cake order status, payment, and pickup/delivery reporting.",
    href: ROUTES.reportsBakeryOrders,
    icon: ShoppingBag,
    status: "available",
    title: "Bakery Orders Reports",
  },
  {
    description: "Supplier purchasing, receiving, and invoice performance.",
    icon: Truck,
    status: "coming_soon",
    title: "Purchasing Reports",
  },
  {
    description: "Customer frequency, value, tags, and notes reporting foundation.",
    icon: UserRound,
    status: "coming_soon",
    title: "Customer Reports",
  },
];

export function ReportsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.reportsView]);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Reports"
        description="Review sales, payments, inventory, manufacturing, purchasing, and bakery order performance."
      />
      {/* A list, not a card grid. The grid gave ten destinations identical
          weight, put each behind a 60px "Open" button while the card itself
          carried a hover-lift it could not honour, and spent two full cells on
          reports that do not exist yet. Rows are scannable in one pass and the
          whole row is the target. */}
      <div className="overflow-hidden rounded-lg border border-border">
        <ul className="grid gap-px bg-border">
          {reportCards.map((card) => {
            const Icon = card.icon;

            if (card.status === "coming_soon") {
              return (
                <li className="bg-card" key={card.title}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Icon className="h-4 w-4 shrink-0 text-foreground-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-cell font-medium text-foreground-muted">
                        {card.title}
                      </span>
                      <span className="block text-meta text-foreground-muted">
                        {card.description}
                      </span>
                    </span>
                    <span className="shrink-0 text-meta text-foreground-muted">
                      {reportStatusLabels[card.status]}
                    </span>
                  </div>
                </li>
              );
            }

            return (
              <li className="bg-card" key={card.title}>
                <Link
                  className="flex min-h-tap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  href={card.href}
                >
                  <Icon className="h-4 w-4 shrink-0 text-foreground-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-cell font-medium text-foreground">
                      {card.title}
                    </span>
                    <span className="block text-meta text-foreground-muted">
                      {card.description}
                    </span>
                  </span>
                  {card.status === "partial" ? (
                    <span className="shrink-0 text-meta text-foreground-muted">
                      {reportStatusLabels[card.status]}
                    </span>
                  ) : null}
                  <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-foreground-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
