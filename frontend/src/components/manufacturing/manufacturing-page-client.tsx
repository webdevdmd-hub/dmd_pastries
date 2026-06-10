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
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">
            Production Hub
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950">
            Manufacturing
          </h1>
          <p className="mt-2 max-w-2xl text-base text-neutral-600">
            Create production from active recipes. Component consumption, packaging consumption,
            finished output, costing, and accounting are handled automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            className="border-neutral-300 bg-white text-neutral-950 hover:bg-neutral-100"
            variant="outline"
          >
            <Link href={ROUTES.reportsManufacturing}>
              <BarChart3 className="h-4 w-4" />
              View Reports
            </Link>
          </Button>
          <Button asChild className="bg-black text-white hover:bg-neutral-800">
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
              className="group rounded-2xl border border-neutral-300 bg-white p-6 text-neutral-950 transition hover:border-neutral-950"
              href={action.href}
              key={action.label}
            >
              <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-6">
                <div className="flex items-center gap-3">
                  <Icon
                    className={
                      action.label === "Production History" ? "h-6 w-6 text-red-600" : "h-6 w-6"
                    }
                  />
                  <h2 className="text-xl font-semibold">{action.label}</h2>
                </div>
                <span className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-neutral-700">
                  Active workflow
                </span>
              </div>
              <p className="mt-6 text-sm leading-6 text-neutral-600">{action.description}</p>
              <div className="mt-8 flex items-center justify-between rounded-xl border border-neutral-300 px-4 py-3 text-sm font-semibold group-hover:bg-neutral-950 group-hover:text-white">
                {action.cta}
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.48fr]">
        <section className="flex min-h-64 items-end rounded-2xl border border-neutral-300 bg-[radial-gradient(circle_at_1px_1px,#d4d4d4_1px,transparent_0)] bg-[length:22px_22px] p-8">
          <div>
            <p className="text-xl font-semibold text-neutral-950">Global Efficiency</p>
            <p className="mt-2 max-w-2xl text-neutral-600">
              Production variance and cost snapshots are captured on each backend production record.
              Use production details for component stock movement and journal links.
            </p>
          </div>
        </section>
        <section className="flex min-h-64 flex-col justify-end rounded-2xl bg-black p-8 text-white">
          <PackageCheck className="mb-auto h-7 w-7" />
          <p className="font-mono text-4xl font-semibold">
            {summaryQuery.data?.totalProductionOutput ?? 0}
          </p>
          <p className="mt-2 text-neutral-300">Recorded production output</p>
        </section>
      </div>
    </div>
  );
}
