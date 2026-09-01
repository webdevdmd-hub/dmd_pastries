"use client";

import { ArrowRight, BarChart3, Factory, PackageCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/manufacturing/access-denied-card";
import { ManufacturingErrorState } from "@/components/manufacturing/manufacturing-error-state";
import { ManufacturingSummaryCards } from "@/components/manufacturing/manufacturing-summary-cards";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useManufacturingSummary } from "@/hooks/use-manufacturing";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";

const actions = [
  {
    cta: "Create production",
    description:
      "Choose an active recipe and quantity. Backend handles consumption, output, costing, and accounting.",
    href: ROUTES.manufacturingBatches,
    icon: Factory,
    label: "Create Production",
  },
  {
    cta: "Review history",
    description:
      "Review backend-generated component usage, output stock, wastage, and journal links.",
    href: ROUTES.manufacturingBatches,
    icon: Trash2,
    label: "Production History",
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
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold text-foreground-muted">Production Hub</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
            Manufacturing
          </h1>
          <p className="mt-2 max-w-2xl text-base text-foreground-muted">
            Create production from active recipes. Component consumption, packaging consumption,
            finished output, costing, and accounting are handled automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            className="border-border bg-card text-foreground hover:bg-muted"
            variant="outline"
          >
            <Link href={ROUTES.reportsManufacturing}>
              <BarChart3 className="h-4 w-4" />
              View Reports
            </Link>
          </Button>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary">
            <Link href={ROUTES.manufacturingBatches}>
              <Factory className="h-4 w-4" />
              Create Production
            </Link>
          </Button>
        </div>
      </section>

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

      <div className="grid gap-6 lg:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              className="group rounded-2xl border border-border bg-card p-6 text-foreground transition hover:border-primary"
              href={action.href}
              key={action.label}
            >
              <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
                <div className="flex items-center gap-3">
                  <Icon
                    className={
                      action.label === "Production History" ? "h-6 w-6 text-danger-text" : "h-6 w-6"
                    }
                  />
                  <h2 className="text-xl font-semibold">{action.label}</h2>
                </div>
                <span className="rounded-full bg-muted px-4 py-2 text-xs font-bold text-foreground-muted">
                  Active workflow
                </span>
              </div>
              <p className="mt-6 text-sm leading-6 text-foreground-muted">{action.description}</p>
              <div className="mt-8 flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm font-semibold group-hover:bg-primary group-hover:text-primary-foreground">
                {action.cta}
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.48fr]">
        <section className="flex min-h-64 items-end rounded-2xl border border-border bg-[radial-gradient(circle_at_1px_1px,#d4d4d4_1px,transparent_0)] bg-[length:22px_22px] p-8">
          <div>
            <p className="text-xl font-semibold text-foreground">Global Efficiency</p>
            <p className="mt-2 max-w-2xl text-foreground-muted">
              Production variance and cost snapshots are captured on each backend production record.
              Use production details for component stock movement and journal links.
            </p>
          </div>
        </section>
        <section className="flex min-h-64 flex-col justify-end rounded-2xl bg-primary p-8 text-primary-foreground">
          <PackageCheck className="mb-auto h-7 w-7" />
          <p className="text-kpi tabular-nums text-foreground">
            {summaryQuery.data?.totalProductionOutput ?? 0}
          </p>
          <p className="mt-2 text-primary-foreground/70">Recorded production output</p>
        </section>
      </div>
    </div>
  );
}
