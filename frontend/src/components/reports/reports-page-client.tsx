"use client";

import {
  BarChart3,
  Boxes,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function reportStatusVariant(status: ReportCardStatus): "outline" | "secondary" {
  return status === "available" ? "secondary" : "outline";
}

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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((card) => {
          const Icon = card.icon;
          const isOpenable = card.status !== "coming_soon";

          return (
            <Card
              className={`bg-white/85 shadow-soft ${
                isOpenable ? "transition hover:-translate-y-0.5 hover:shadow-float" : ""
              }`}
              key={card.title}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-2xl bg-brand-latte p-3 text-brand-mocha">
                    <Icon className="h-5 w-5" />
                  </span>
                  <Badge variant={reportStatusVariant(card.status)}>
                    {reportStatusLabels[card.status]}
                  </Badge>
                </div>
                <CardTitle className="text-brand-espresso">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="min-h-12 text-sm text-brand-mocha">{card.description}</p>
                {isOpenable ? (
                  <Button asChild>
                    <Link href={card.href}>Open</Link>
                  </Button>
                ) : (
                  <p className="text-sm font-medium text-brand-mocha">
                    This report is not available yet.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
