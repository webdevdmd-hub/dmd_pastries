"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/inventory/access-denied-card";
import { InventoryEmptyState } from "@/components/inventory/inventory-empty-state";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { InventoryTableSkeleton } from "@/components/inventory/inventory-table-skeleton";
import { FilteredState } from "@/components/shared/collection-state";
import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Badge } from "@/components/ui/badge";
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

// Semantic variants so the expiry state carries a dot (DESIGN.md sections 6
// and 9). Expired and expires-today are both danger; anything further out is
// warning -- the same split the className colours already made.
function expiryStateBadge(state: ExpiryState, label: string): JSX.Element {
  if (state === "expired" || state === "expires_today") {
    return <Badge variant="danger">{label}</Badge>;
  }

  return <Badge variant="warning">{label}</Badge>;
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

export function ExpiryAlertsPanel(): JSX.Element {
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
  // The expiry-alerts endpoint takes no search term, so this filters the
  // batches already loaded. That is honest here and nowhere else in the module:
  // the response is bounded by the days window, so there is no page 2 hiding a
  // match. It is kept out of ExpiryAlertFilters so it can never be mistaken for
  // something the query sends.
  const [search, setSearch] = useState("");
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
  // Branch and timezone are scope, not filters: both always carry a value, so
  // counting them would make a genuinely quiet alert list read as a narrow
  // search. The days window is a real filter — 3 days hides what 30 shows.
  const hiddenFilterCount =
    (filters.itemType !== defaultFilters.itemType ? 1 : 0) +
    (filters.productType !== defaultFilters.productType ? 1 : 0) +
    (filters.expiryState !== defaultFilters.expiryState ? 1 : 0) +
    (filters.days !== defaultFilters.days ? 1 : 0);
  const hasActiveFilters = hiddenFilterCount > 0 || search.trim().length > 0;

  const visibleBatches = useMemo(() => {
    const batches = alertsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) {
      return batches;
    }
    return batches.filter((batch) =>
      [batch.itemName, batch.itemCode, batch.batchNumber].some((field) =>
        field?.toLowerCase().includes(term),
      ),
    );
  }, [alertsQuery.data, search]);

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
    <>
      <FilterToolbar
        hasAnyFilter={hasActiveFilters}
        hiddenFilterCount={hiddenFilterCount}
        onReset={() => {
          setSearch("");
          setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId, timezone });
        }}
        onSearchChange={setSearch}
        popoverTitle="Filter expiry alerts"
        searchAriaLabel="Search expiry alerts"
        searchPlaceholder="Search item, code, batch..."
        searchValue={search}
      >
        {branchScope.canAccessAllBranches ? (
          <FilterField htmlFor="expiryFilterBranch" label="Branch">
            <Select
              onValueChange={(branchId) => setFilters({ ...filters, branchId })}
              value={filters.branchId}
            >
              <SelectTrigger id="expiryFilterBranch">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branchOptions.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        ) : null}

        <FilterField htmlFor="expiryFilterItemType" label="Item type">
          <Select
            onValueChange={(itemType) =>
              setFilters({ ...filters, itemType: itemType as ExpiryAlertFilters["itemType"] })
            }
            value={filters.itemType}
          >
            <SelectTrigger id="expiryFilterItemType">
              <SelectValue placeholder="Item type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="product">Products</SelectItem>
              <SelectItem value="product_variant">Variants</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField htmlFor="expiryFilterProductType" label="Product type">
          <Select
            onValueChange={(productType) =>
              setFilters({
                ...filters,
                productType: productType as ExpiryAlertFilters["productType"],
              })
            }
            value={filters.productType}
          >
            <SelectTrigger id="expiryFilterProductType">
              <SelectValue placeholder="Product type" />
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
        </FilterField>

        <FilterField htmlFor="expiryFilterState" label="Expiry state">
          <Select
            onValueChange={(expiryState) =>
              setFilters({
                ...filters,
                expiryState: expiryState as ExpiryAlertFilters["expiryState"],
              })
            }
            value={filters.expiryState}
          >
            <SelectTrigger id="expiryFilterState">
              <SelectValue placeholder="Expiry state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All expiry states</SelectItem>
              <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
              <SelectItem value="expires_today">Expires Today</SelectItem>
              <SelectItem value="expired">Expired / Overdue</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField htmlFor="expiryFilterDays" label="Days ahead">
          <Input
            id="expiryFilterDays"
            min={1}
            onChange={(event) => setFilters({ ...filters, days: Number(event.target.value) })}
            type="number"
            value={filters.days}
          />
        </FilterField>
      </FilterToolbar>

      {alertsQuery.isLoading ? <InventoryTableSkeleton /> : null}
      {!alertsQuery.isLoading && alertsQuery.error ? (
        <InventoryErrorState
          description={getErrorMessage(alertsQuery.error)}
          onRetry={() => {
            void alertsQuery.refetch();
          }}
        />
      ) : null}
      {/* Filtered and empty need opposite remedies. "No expiry alerts" reads as
          nothing is spoiling, which is the wrong thing to believe when a 3-day
          window is hiding batches that expire on Friday. DESIGN.md §8. */}
      {!alertsQuery.isLoading &&
      !alertsQuery.error &&
      visibleBatches.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="expiry alerts"
          onClearFilters={() => {
            setSearch("");
            setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId, timezone });
          }}
          query={undefined}
        />
      ) : null}
      {!alertsQuery.isLoading &&
      !alertsQuery.error &&
      visibleBatches.length === 0 &&
      !hasActiveFilters ? (
        <InventoryEmptyState
          description="No expiry-sensitive batches match the selected alert window."
          title="No expiry alerts found."
        />
      ) : null}
      {!alertsQuery.isLoading && !alertsQuery.error && visibleBatches.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Days Remaining</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleBatches.map((batch) => {
                  const remaining = batch.daysRemaining;
                  return (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {batch.itemName ?? "Item details unavailable"}
                        </div>
                        <div className="text-xs text-foreground-muted">
                          {compactList([
                            batch.sku ? `SKU: ${batch.sku}` : null,
                            batch.itemCode ? `Code: ${batch.itemCode}` : null,
                            batch.categoryName ? `Category: ${batch.categoryName}` : null,
                            batch.productType ? PRODUCT_TYPE_LABELS[batch.productType] : null,
                          ]) || "Item details unavailable"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="border-border bg-muted/70 text-foreground">
                          {itemTypeLabel(batch.itemType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{batch.batchNumber || "-"}</div>
                        <div className="text-xs text-foreground-muted">
                          {batch.purchaseReferenceNumber
                            ? `Purchase: ${batch.purchaseReferenceNumber}`
                            : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{getBranchLabel(batch)}</div>
                        <div className="text-xs text-foreground-muted">
                          {compactList([batch.stockLocationName, batch.supplierName]) || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {batch.quantity}
                        {batch.unitSymbol ? ` ${batch.unitSymbol}` : ""}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(batch.receivedDate)}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatDate(batch.expiryDate)}</TableCell>
                      <TableCell
                        className={
                          remaining < 0
                            ? "font-medium tabular-nums text-danger-text"
                            : "tabular-nums"
                        }
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
    </>
  );
}
