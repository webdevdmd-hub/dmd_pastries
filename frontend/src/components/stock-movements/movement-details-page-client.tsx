"use client";

import Link from "next/link";
import type { JSX } from "react";

import { AccountingJournalLink } from "@/components/shared/accounting-reference-links";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDeniedCard } from "@/components/stock-movements/access-denied-card";
import { MovementDirectionBadge } from "@/components/stock-movements/movement-direction-badge";
import { MovementTypeBadge } from "@/components/stock-movements/movement-type-badge";
import { MovementsErrorState } from "@/components/stock-movements/movements-error-state";
import { MovementsTableSkeleton } from "@/components/stock-movements/movements-table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/hooks/use-permission";
import { useStockMovement } from "@/hooks/use-stock-movements";
import { getErrorMessage } from "@/lib/api/client";
import {
  sourceModuleLabel,
  sourceReferenceLabel,
  stockMovementDescription,
} from "@/lib/inventory/stock-movement-display";

type MovementDetailsPageClientProps = {
  movementId: string;
};

function formatQuantity(value: number, unit: string): string {
  return `${new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 }).format(value)} ${unit}`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function locationName(value: string | null): string {
  return value && value.trim().length > 0 ? value : "Unknown location";
}

export function MovementDetailsPageClient({
  movementId,
}: MovementDetailsPageClientProps): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([
    PERMISSIONS.stockMovementsView,
    PERMISSIONS.inventoryMovementsView,
    PERMISSIONS.inventoryView,
  ]);
  const movementQuery = useStockMovement(movementId, canView);
  const movement = movementQuery.data;

  if (!canView) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Movement Details"
        description="Inspect a single stock ledger movement and its audit context."
        actions={
          <Button asChild type="button" variant="outline">
            <Link href="/inventory/movements">Back to movements</Link>
          </Button>
        }
      />
      {movementQuery.isLoading ? <MovementsTableSkeleton /> : null}
      {!movementQuery.isLoading && movementQuery.error ? (
        <MovementsErrorState
          description={getErrorMessage(movementQuery.error)}
          onRetry={() => {
            void movementQuery.refetch();
          }}
        />
      ) : null}
      {movement ? (
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-wrap gap-2">
              <MovementTypeBadge type={movement.movementType} />
              <MovementDirectionBadge direction={movement.movementDirection} />
            </div>
            <div className="rounded-2xl bg-brand-latte p-4">
              <p className="text-sm text-brand-mocha">What happened</p>
              <p className="mt-1 font-bold text-brand-espresso">
                {stockMovementDescription(movement)}
              </p>
              <p className="mt-1 text-sm text-brand-mocha">
                {sourceModuleLabel(movement)} - {sourceReferenceLabel(movement)}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-sm text-brand-mocha">Item</p>
                <p className="font-bold text-brand-espresso">{movement.itemName}</p>
              </div>
              <div>
                <p className="text-sm text-brand-mocha">Branch</p>
                <p className="font-bold text-brand-espresso">{movement.branchName}</p>
              </div>
              <div>
                <p className="text-sm text-brand-mocha">Quantity</p>
                <p className="font-bold text-brand-espresso">
                  {formatQuantity(movement.quantity, movement.unitSymbol)}
                </p>
              </div>
              <div>
                <p className="text-sm text-brand-mocha">Before / After</p>
                <p className="font-bold text-brand-espresso">
                  {formatQuantity(movement.beforeQuantity, movement.unitSymbol)} →{" "}
                  {formatQuantity(movement.afterQuantity, movement.unitSymbol)}
                </p>
              </div>
              <div>
                <p className="text-sm text-brand-mocha">Reference</p>
                <p className="font-bold text-brand-espresso">
                  {movement.referenceNumber ?? movement.referenceType ?? "Manual"}
                </p>
              </div>
              {movement.movementType === "transfer" ? (
                <>
                  <div>
                    <p className="text-sm text-brand-mocha">From location</p>
                    <p className="font-bold text-brand-espresso">
                      {locationName(movement.fromStockLocationName)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-brand-mocha">To location</p>
                    <p className="font-bold text-brand-espresso">
                      {locationName(movement.toStockLocationName)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-brand-mocha">Transfer number</p>
                    <p className="font-bold text-brand-espresso">
                      {movement.referenceNumber ?? "None"}
                    </p>
                  </div>
                </>
              ) : null}
              <div>
                <p className="text-sm text-brand-mocha">Total cost</p>
                <p className="font-bold text-brand-espresso">
                  {movement.totalCost > 0 ? formatMoney(movement.totalCost) : "Not costed"}
                </p>
              </div>
              <div>
                <p className="text-sm text-brand-mocha">Unit cost</p>
                <p className="font-bold text-brand-espresso">
                  {movement.unitCostSnapshot > 0
                    ? formatMoney(movement.unitCostSnapshot)
                    : "Not costed"}
                </p>
              </div>
              <div>
                <p className="text-sm text-brand-mocha">Valuation method</p>
                <p className="font-bold text-brand-espresso">
                  {movement.valuationMethod ?? "Not available"}
                </p>
              </div>
              <div>
                <p className="text-sm text-brand-mocha">Created by</p>
                <p className="font-bold text-brand-espresso">{movement.createdByUserName}</p>
              </div>
              <div>
                <p className="text-sm text-brand-mocha">Created at</p>
                <p className="font-bold text-brand-espresso">
                  {movement.createdAt ? new Date(movement.createdAt).toLocaleString("en-AE") : "-"}
                </p>
              </div>
            </div>
            {movement.accountingJournalEntryId ? (
              <div className="rounded-2xl border border-brand-cappuccino bg-white/70 p-4">
                <p className="text-sm text-brand-mocha">Accounting journal</p>
                <p className="mt-1 text-brand-espresso">{movement.accountingJournalEntryId}</p>
                <div className="mt-3">
                  <AccountingJournalLink id={movement.accountingJournalEntryId} />
                </div>
              </div>
            ) : null}
            <div className="rounded-2xl bg-brand-latte p-4">
              <p className="text-sm text-brand-mocha">Reason</p>
              <p className="mt-1 text-brand-espresso">
                {movement.reason ?? stockMovementDescription(movement)}
              </p>
            </div>
            <Button asChild type="button">
              <Link href={`/inventory/audit/${movement.inventoryItemId}`}>
                Audit inventory item
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
