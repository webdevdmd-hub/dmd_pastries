"use client";

import type { JSX } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { AccessDeniedCard } from "@/components/stock-movements/access-denied-card";
import { AuditResultCard } from "@/components/stock-movements/audit-result-card";
import { AuditSummaryCard } from "@/components/stock-movements/audit-summary-card";
import { MovementsErrorState } from "@/components/stock-movements/movements-error-state";
import { MovementsTable } from "@/components/stock-movements/movements-table";
import { MovementsTableSkeleton } from "@/components/stock-movements/movements-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/hooks/use-permission";
import { useInventoryAudit, useInventoryItemMovements } from "@/hooks/use-stock-movements";
import { getErrorMessage } from "@/lib/api/client";

type AuditPageClientProps = {
  inventoryItemId: string;
};

export function AuditPageClient({ inventoryItemId }: AuditPageClientProps): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([
    PERMISSIONS.stockMovementsAuditView,
    PERMISSIONS.stockMovementsView,
    PERMISSIONS.inventoryMovementsView,
    PERMISSIONS.inventoryView,
  ]);
  const auditQuery = useInventoryAudit(inventoryItemId, canView);
  const movementsQuery = useInventoryItemMovements(inventoryItemId, {}, canView);

  if (!canView) {
    return <AccessDeniedCard message="You do not have permission to view inventory audits." />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Inventory Audit"
        description="Verify whether stock quantity matches the movement ledger."
      />
      {auditQuery.isLoading ? <MovementsTableSkeleton /> : null}
      {!auditQuery.isLoading && auditQuery.error ? (
        <MovementsErrorState
          description={getErrorMessage(auditQuery.error)}
          onRetry={() => {
            void auditQuery.refetch();
          }}
        />
      ) : null}
      {auditQuery.data ? (
        <>
          <AuditSummaryCard audit={auditQuery.data} />
          <AuditResultCard audit={auditQuery.data} />
        </>
      ) : null}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {movementsQuery.isLoading ? (
            <div className="p-4">
              <MovementsTableSkeleton />
            </div>
          ) : (
            <MovementsTable
              canReverse={false}
              movements={movementsQuery.data ?? []}
              onReverse={() => undefined}
              onView={() => undefined}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
