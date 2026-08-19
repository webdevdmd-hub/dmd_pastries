"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/inventory/access-denied-card";
import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useLocationBalances, useStockLocations } from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { LocationBalanceFilters } from "@/types/inventory";

function defaultFilters(): LocationBalanceFilters {
  return {
    search: "",
    itemType: "all",
    productType: "all",
    stockLocationId: "all",
    page: 1,
    limit: 100,
    sortBy: "item_name",
    sortOrder: "asc",
  };
}

function formatQuantity(value: number, symbol: string): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${symbol}`.trim();
}

/**
 * The "By location" tab. Was /inventory/location-balances, a sibling route with
 * its own H1 and breadcrumb; it is now a panel, so the header and tab strip
 * above it belong to the module and stay put when you switch tabs.
 *
 * The permission gate stays here rather than moving to the container: the
 * container gates the module broadly, this gates the one thing this panel reads.
 */
export function LocationBalancesPanel(): JSX.Element {
  const branchScope = useBranchScope();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.inventoryView]);
  const [filters, setFilters] = useState<LocationBalanceFilters>(() => defaultFilters());
  const locationsQuery = useStockLocations(canView && branchScope.hasBranchScope);
  const debouncedSearch = useDebouncedValue(filters.search);
  const balancesQueryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [debouncedSearch, filters],
  );
  const balancesQuery = useLocationBalances(
    balancesQueryFilters,
    canView && branchScope.hasBranchScope,
  );
  const balances = balancesQuery.data ?? [];
  const isPermissionDenied =
    balancesQuery.error instanceof ApiError && balancesQuery.error.status === 403;
  // Search shows its own value in the toolbar, so only the popover's own three
  // fields are counted.
  const hiddenFilterCount =
    (filters.itemType !== "all" ? 1 : 0) + (filters.stockLocationId !== "all" ? 1 : 0);

  if (!canView) {
    return <AccessDeniedCard message="You need inventory.view to view location balances." />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  return (
    <>
      <FilterToolbar
        hasAnyFilter={hiddenFilterCount > 0 || filters.search.trim().length > 0}
        hiddenFilterCount={hiddenFilterCount}
        onReset={() => setFilters(defaultFilters())}
        onSearchChange={(search) => setFilters((current) => ({ ...current, search, page: 1 }))}
        popoverTitle="Filter location balances"
        searchAriaLabel="Search location balances"
        searchPlaceholder="Search item name or code"
        searchValue={filters.search}
      >
        <FilterField htmlFor="locationFilterItemType" label="Item type">
          <Select
            value={filters.itemType}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                itemType: value as LocationBalanceFilters["itemType"],
                page: 1,
              }))
            }
          >
            <SelectTrigger id="locationFilterItemType">
              <SelectValue placeholder="Item type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All item types</SelectItem>
              <SelectItem value="product">Products</SelectItem>
              <SelectItem value="product_variant">Variants</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField htmlFor="locationFilterLocation" label="Stock location">
          <Select
            value={filters.stockLocationId}
            onValueChange={(value) =>
              setFilters((current) => ({ ...current, stockLocationId: value, page: 1 }))
            }
          >
            <SelectTrigger id="locationFilterLocation">
              <SelectValue placeholder="Stock location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {(locationsQuery.data ?? []).map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.locationName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterToolbar>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Available</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((balance) => (
                <TableRow key={`${balance.inventoryItemId}-${balance.stockLocationId}`}>
                  <TableCell>
                    <div className="font-semibold text-foreground">{balance.itemName}</div>
                    <div className="text-sm text-foreground-muted">
                      {balance.itemCode || "No code"}
                    </div>
                  </TableCell>
                  <TableCell>{balance.stockLocationName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {balance.itemType === "product_variant" ? "Variant" : balance.itemType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(balance.currentQuantity, balance.unit.symbol)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(balance.reservedQuantity, balance.unit.symbol)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(balance.availableQuantity, balance.unit.symbol)}
                  </TableCell>
                </TableRow>
              ))}
              {!balancesQuery.isLoading && balances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-foreground-muted">
                    {balancesQuery.error
                      ? isPermissionDenied
                        ? "The backend denied access to location balances."
                        : getErrorMessage(balancesQuery.error)
                      : "No location balances found for the active branch."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
