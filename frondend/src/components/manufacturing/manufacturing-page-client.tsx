"use client";

import { Factory, ListChecks } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/manufacturing/access-denied-card";
import { ManufacturingErrorState } from "@/components/manufacturing/manufacturing-error-state";
import { ManufacturingSummaryCards } from "@/components/manufacturing/manufacturing-summary-cards";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useManufacturingSummary } from "@/hooks/use-manufacturing";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";

const actions = [
  {
    description: "Create and manage production batches from active product recipes.",
    href: ROUTES.manufacturingBatches,
    icon: Factory,
    label: "Create Batch",
  },
  {
    description: "Review production lifecycle, consumption, outputs, and wastage.",
    href: ROUTES.manufacturingBatches,
    icon: ListChecks,
    label: "View Batches",
  },
];

export function ManufacturingPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.manufacturingView, PERMISSIONS.inventoryView]);
  const summaryQuery = useManufacturingSummary(canView);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Manufacturing"
        description="Manage production batches, ingredient consumption, output creation, and wastage tracking."
      />

      {summaryQuery.error ? (
        <ManufacturingErrorState
          description={getErrorMessage(summaryQuery.error)}
          onRetry={() => {
            void summaryQuery.refetch();
          }}
        />
      ) : (
        <ManufacturingSummaryCards summary={summaryQuery.data} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link href={action.href} key={action.label}>
              <Card className="h-full bg-white/85 transition hover:-translate-y-0.5 hover:shadow-float">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl bg-brand-latte p-3 text-brand-mocha">
                      <Icon className="h-5 w-5" />
                    </span>
                    <CardTitle className="text-lg">{action.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brand-mocha">{action.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
