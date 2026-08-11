"use client";

import { ArrowRight, Construction } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/reports/access-denied-card";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";

type ReportUnavailablePageClientProps = {
  slug: string[];
};

type KnownUnavailableReport = {
  secondaryHref?: string;
  secondaryLabel?: string;
  title: string;
};

const knownUnavailableReports: Record<string, KnownUnavailableReport> = {
  customers: {
    title: "Customer Reports",
  },
  payments: {
    secondaryHref: ROUTES.reportsFinancialPayments,
    secondaryLabel: "Open Financial Payments",
    title: "Payments Report",
  },
  purchasing: {
    title: "Purchasing Reports",
  },
};

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function fallbackTitle(slug: string[]): string {
  const label = slug.map(titleCase).join(" ");
  return label ? `${label} Report` : "Report Not Available";
}

export function ReportUnavailablePageClient({
  slug,
}: ReportUnavailablePageClientProps): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.reportsView]);
  const reportKey = slug.join("/");
  const knownReport = knownUnavailableReports[reportKey];
  const title = knownReport?.title ?? fallbackTitle(slug);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ReportPageHeader
        title={title}
        description="This report is not available yet. Please go back to the Reports Index to view available reports."
      />
      <Card className="bg-white/85 shadow-soft">
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="flex items-start gap-4">
            <span className="rounded-2xl bg-brand-latte p-3 text-brand-mocha">
              <Construction className="h-6 w-6" />
            </span>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-brand-espresso">Coming Soon</p>
              <p className="max-w-2xl text-sm leading-6 text-brand-mocha">
                This report is not available yet. Please go back to the Reports Index to view
                available reports.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={ROUTES.reports}>
                Reports Index
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {knownReport?.secondaryHref ? (
              <Button asChild variant="outline">
                <Link href={knownReport.secondaryHref}>
                  {knownReport.secondaryLabel ?? "Open Related Report"}
                </Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
