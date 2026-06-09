"use client";

import type { JSX } from "react";
import { useState } from "react";

import { AccessDeniedCard } from "@/components/inventory/access-denied-card";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useLocationBalances, useStockLocations } from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { LocationBalanceFilters } from "@/types/inventory";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/types/product";

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

export function LocationBalancesPageClient(): JSX.Element {
  const branchScope = useBranchScope();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.inventoryView]);
  const [filters, setFilters] = useState<LocationBalanceFilters>(() => defaultFilters());
  const locationsQuery = useStockLocations(canView && branchScope.hasBranchScope);
  const balancesQuery = useLocationBalances(filters, canView && branchScope.hasBranchScope);
  const balances = balancesQuery.data ?? [];
  const isPermissionDenied =
    balancesQuery.error instanceof ApiError && balancesQuery.error.status === 403;

  if (!canView) {
    return <AccessDeniedCard message="You need inventory.view to view location balances." />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Location Balances"
        description="View the physical breakdown of branch inventory by stock location. Branch total stock remains the sum of all location balances."
      />

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Search item</Label>
            <Input
              placeholder="Search item name or code"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Item type</Label>
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All item types</SelectItem>
                <SelectItem value="product">Products</SelectItem>
                <SelectItem value="product_variant">Variants</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Product type</Label>
            <Select
              value={filters.productType}
              onValueChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  productType: value as LocationBalanceFilters["productType"],
                  page: 1,
                }))
              }
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
          </div>
          <div className="space-y-1">
            <Label>Stock location</Label>
            <Select
              value={filters.stockLocationId}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, stockLocationId: value, page: 1 }))
              }
            >
              <SelectTrigger>
                <SelectValue />
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Available</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((balance) => (
                <TableRow key={`${balance.inventoryItemId}-${balance.stockLocationId}`}>
                  <TableCell>
                    <div className="font-semibold text-brand-espresso">{balance.itemName}</div>
                    <div className="text-sm text-brand-mocha">{balance.itemCode || "No code"}</div>
                  </TableCell>
                  <TableCell>{balance.stockLocationName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {balance.itemType === "product_variant" ? "Variant" : balance.itemType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatQuantity(balance.currentQuantity, balance.unit.symbol)}
                  </TableCell>
                  <TableCell>
                    {formatQuantity(balance.reservedQuantity, balance.unit.symbol)}
                  </TableCell>
                  <TableCell>
                    {formatQuantity(balance.availableQuantity, balance.unit.symbol)}
                  </TableCell>
                </TableRow>
              ))}
              {!balancesQuery.isLoading && balances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-brand-mocha">
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
    </div>
  );
}
