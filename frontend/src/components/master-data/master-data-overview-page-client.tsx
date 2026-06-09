"use client";

import { Database, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useMasterDataOverview } from "@/hooks/use-master-data";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";

const overviewCards = [
  { label: "Units", key: "unitsCount", href: "/settings/master-data/units" },
  {
    label: "Product Categories",
    key: "productCategoriesCount",
    href: "/settings/master-data/product-categories",
  },
  {
    label: "Order Statuses",
    key: "orderStatusesCount",
    href: "/settings/master-data/order-statuses",
  },
  {
    label: "Payment Statuses",
    key: "paymentStatusesCount",
    href: "/settings/master-data/payment-statuses",
  },
] as const;

export function MasterDataOverviewPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.masterDataView]);
  const overviewQuery = useMasterDataOverview(canView);

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert className="border-brand-cappuccino bg-white/80">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>
            You need master_data.view permission to view master data.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Master Data Overview"
        description="Backend-connected counts for reusable units, categories, order statuses, and payment statuses."
      />

      {overviewQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <div
              className="h-40 animate-pulse rounded-3xl border border-brand-cappuccino bg-white/60"
              key={card.key}
            />
          ))}
        </div>
      ) : null}

      {overviewQuery.error ? (
        <Alert className="border-red-200 bg-red-50 text-red-950">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Unable to load master data overview</AlertTitle>
          <AlertDescription>{getErrorMessage(overviewQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      {overviewQuery.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <Card key={card.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-brand-mocha">
                  <Database className="h-4 w-4" />
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-4xl text-brand-espresso">
                  {overviewQuery.data[card.key]}
                </p>
                <Button asChild className="mt-4 w-full" variant="outline">
                  <Link href={card.href}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
