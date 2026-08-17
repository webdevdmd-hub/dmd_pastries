"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/inventory/access-denied-card";
import { InventoryEmptyState } from "@/components/inventory/inventory-empty-state";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { InventoryTableSkeleton } from "@/components/inventory/inventory-table-skeleton";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useBranches } from "@/hooks/use-branches";
import { useExpiryAlerts } from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import { resolveDashboardTimezone } from "@/lib/reports/dashboard-filters";
import type { ExpiryAlertFilters, ExpiryBatch, ExpiryState } from "@/types/inventory";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/types/product";

const defaultFilters: ExpiryAlertFilters = {
  branchId: "",
  itemType: "all",
  productType: "all",
  expiryState: "all",
  days: 30,
};

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleDateString("en-AE") : "Not recorded";
}

function expiryStateBadge(state: ExpiryState, label: string): JSX.Element {
  if (state === "expired") {
    return <Badge className="border-danger/30 bg-danger-tint text-danger-text">{label}</Badge>;
  }

  if (state === "expires_today") {
    return <Badge className="border-orange-200 bg-orange-100 text-orange-900">{label}</Badge>;
  }

  return <Badge className="bg-warning-tint text-warning-text hover:bg-warning-tint">{label}</Badge>;
}

function itemTypeLabel(itemType: ExpiryBatch["itemType"]): string {
  if (itemType === "product_variant") {
    return "Variant";
  }

  if (itemType === "product") {
    return "Product";
  }

  if (itemType === "ingredient") {
    return "Ingredient";
  }

  if (itemType === "packaging") {
    return "Packaging";
  }

  return "Inventory item";
}

function shortId(value: string): string {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function compactList(values: (string | null | undefined)[]): string {
  return values.filter((value): value is string => Boolean(value?.trim())).join(" · ");
}

export function ExpiryAlertsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const timezone = useMemo(resolveDashboardTimezone, []);
  const canView = hasAnyPermission([PERMISSIONS.inventoryExpiryView, PERMISSIONS.inventoryView]);
  const [filters, setFilters] = useState<ExpiryAlertFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
    timezone,
  });
  const alertsQuery = useExpiryAlerts(filters, canView && branchScope.hasBranchScope);
  const branchesQuery = useBranches(canView);
  const branchOptions = useMemo(
    () =>
      (branchesQuery.data ?? []).filter(
        (branch) => branchScope.canAccessAllBranches || branchScope.isBranchAllowed(branch.id),
      ),
    [branchScope, branchesQuery.data],
  );
  const branchNameById = useMemo(
    () => new Map((branchesQuery.data ?? []).map((branch) => [branch.id, branch.name])),
    [branchesQuery.data],
  );

  function getBranchLabel(batch: ExpiryBatch): string {
    return (
      batch.branchName ?? branchNameById.get(batch.branchId) ?? `Branch ${shortId(batch.branchId)}`
    );
  }

  useEffect(() => {
    setFilters((currentFilters) => {
      const branchId = normalizeBranchId(currentFilters.branchId);
      return branchId === currentFilters.branchId
        ? currentFilters
        : { ...currentFilters, branchId };
    });
  }, [normalizeBranchId]);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Expiry Alerts"
        description="Track stock batches that are expiring soon or already expired."
      />
      <div className="grid gap-3 rounded-3xl border border-brand-cappuccino bg-card/70 p-4 shadow-soft md:grid-cols-6">
        <Select
          onValueChange={(branchId) => setFilters({ ...filters, branchId })}
          value={filters.branchId}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {branchScope.canAccessAllBranches ? (
              <SelectItem value="all">All branches</SelectItem>
            ) : null}
            {branchOptions.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          onValueChange={(itemType) =>
            setFilters({ ...filters, itemType: itemType as ExpiryAlertFilters["itemType"] })
          }
          value={filters.itemType}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="product">Products</SelectItem>
            <SelectItem value="product_variant">Variants</SelectItem>
          </SelectContent>
        </Select>
        <Select
          onValueChange={(productType) =>
            setFilters({
              ...filters,
              productType: productType as ExpiryAlertFilters["productType"],
            })
          }
          value={filters.productType}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All product types</SelectItem>
            {PRODUCT_TYPES.map((productType) => (
              <SelectItem key={productType} value={productType}>
                {PRODUCT_TYPE_LABELS[productType]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          onValueChange={(expiryState) =>
            setFilters({
              ...filters,
              expiryState: expiryState as ExpiryAlertFilters["expiryState"],
            })
          }
          value={filters.expiryState}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All expiry states</SelectItem>
            <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
            <SelectItem value="expires_today">Expires Today</SelectItem>
            <SelectItem value="expired">Expired / Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Input
          aria-label="Days window"
          min={1}
          onChange={(event) => setFilters({ ...filters, days: Number(event.target.value) })}
          type="number"
          value={filters.days}
        />
        <Button
          onClick={() =>
            setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId, timezone })
          }
          type="button"
          variant="outline"
        >
          Reset
        </Button>
      </div>

      {alertsQuery.isLoading ? <InventoryTableSkeleton /> : null}
      {!alertsQuery.isLoading && alertsQuery.error ? (
        <InventoryErrorState
          description={getErrorMessage(alertsQuery.error)}
          onRetry={() => {
            void alertsQuery.refetch();
          }}
        />
      ) : null}
      {!alertsQuery.isLoading && !alertsQuery.error && (alertsQuery.data ?? []).length === 0 ? (
        <InventoryEmptyState
          description="No expiry-sensitive batches match the selected alert window."
          title="No expiry alerts found."
        />
      ) : null}
      {!alertsQuery.isLoading && !alertsQuery.error && (alertsQuery.data ?? []).length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Days Remaining</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(alertsQuery.data ?? []).map((batch) => {
                  const remaining = batch.daysRemaining;
                  return (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <div className="font-bold text-brand-espresso">
                          {batch.itemName ?? "Item details unavailable"}
                        </div>
                        <div className="text-xs text-brand-mocha">
                          {compactList([
                            batch.sku ? `SKU: ${batch.sku}` : null,
                            batch.itemCode ? `Code: ${batch.itemCode}` : null,
                            batch.categoryName ? `Category: ${batch.categoryName}` : null,
                            batch.productType ? PRODUCT_TYPE_LABELS[batch.productType] : null,
                          ]) || "Item details unavailable"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="border-brand-cappuccino bg-brand-latte/70 text-brand-espresso">
                          {itemTypeLabel(batch.itemType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold">{batch.batchNumber || "-"}</div>
                        <div className="text-xs text-brand-mocha">
                          {batch.purchaseReferenceNumber
                            ? `Purchase: ${batch.purchaseReferenceNumber}`
                            : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{getBranchLabel(batch)}</div>
                        <div className="text-xs text-brand-mocha">
                          {compactList([batch.stockLocationName, batch.supplierName]) || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {batch.quantity}
                        {batch.unitSymbol ? ` ${batch.unitSymbol}` : ""}
                      </TableCell>
                      <TableCell>{formatDate(batch.receivedDate)}</TableCell>
                      <TableCell>{formatDate(batch.expiryDate)}</TableCell>
                      <TableCell
                        className={remaining < 0 ? "font-bold text-danger-text" : undefined}
                      >
                        {remaining < 0
                          ? `${String(Math.abs(remaining))} days overdue`
                          : `${String(remaining)} days`}
                      </TableCell>
                      <TableCell>
                        {expiryStateBadge(batch.expiryState, batch.expiryStateLabel)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
