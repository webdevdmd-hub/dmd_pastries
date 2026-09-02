"use client";

import { ArrowRight, Plus } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/inventory/access-denied-card";
import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useCancelStockTransfer,
  useCompleteStockTransfer,
  useCreateStockTransfer,
  useInventory,
  useStockLocations,
  useStockTransfers,
} from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type {
  StockTransferFilters,
  StockTransferPayload,
  StockTransferStatus,
} from "@/types/inventory";

function defaultFilters(): StockTransferFilters {
  return {
    search: "",
    status: "all",
    itemType: "all",
    productType: "all",
    stockLocationId: "all",
    page: 1,
    limit: 100,
    sortBy: "created_at",
    sortOrder: "desc",
  };
}

const emptyPayload: StockTransferPayload = {
  inventoryItemId: "",
  fromStockLocationId: "",
  toStockLocationId: "",
  quantity: 0,
  reason: "",
  notes: "",
};

function statusVariant(status: StockTransferStatus): "default" | "outline" | "secondary" {
  if (status === "completed") return "secondary";
  if (status === "cancelled") return "outline";
  return "default";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function StockTransfersPanel(): JSX.Element {
  const branchScope = useBranchScope();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.inventoryView]);
  const canCreate = hasAnyPermission([PERMISSIONS.inventoryTransferCreate]);
  const canComplete = hasAnyPermission([PERMISSIONS.inventoryTransferComplete]);
  const canCancel = hasAnyPermission([PERMISSIONS.inventoryTransferCancel]);
  const [filters, setFilters] = useState<StockTransferFilters>(() => defaultFilters());
  // Search shows its own value in the toolbar, so only the popover's three
  // fields are counted.
  const transferHiddenFilterCount =
    (filters.status !== "all" ? 1 : 0) + (filters.itemType !== "all" ? 1 : 0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payload, setPayload] = useState<StockTransferPayload>(emptyPayload);
  const debouncedSearch = useDebouncedValue(filters.search);
  const transfersQueryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [debouncedSearch, filters],
  );
  const transfersQuery = useStockTransfers(
    transfersQueryFilters,
    canView && branchScope.hasBranchScope,
  );
  const locationsQuery = useStockLocations(canView && branchScope.hasBranchScope);
  const inventoryQuery = useInventory(
    {
      search: "",
      branchId: branchScope.defaultBranchId,
      itemType: "all",
      productType: "all",
      status: "active",
      lowStockOnly: false,
      expiryTrackedOnly: false,
      includeUninitialized: false,
    },
    canCreate && branchScope.hasBranchScope,
  );
  const createMutation = useCreateStockTransfer();
  const completeMutation = useCompleteStockTransfer();
  const cancelMutation = useCancelStockTransfer();
  const transfers = transfersQuery.data ?? [];
  const locations = (locationsQuery.data ?? []).filter((location) => location.status === "active");
  const inventoryItemOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      (inventoryQuery.data?.items ?? []).map((item) => ({
        value: item.id,
        label: item.itemName,
        description: [
          item.itemType === "product_variant" ? "Variant" : item.itemType,
          item.itemCode,
          `${item.availableQuantity.toLocaleString(undefined, {
            maximumFractionDigits: 3,
          })} ${item.unitSymbol} available`,
        ]
          .filter((part) => part.length > 0)
          .join(" / "),
        keywords: [
          item.itemName,
          item.itemCode,
          item.itemType,
          item.productType ?? "",
          item.branchName,
          item.unitSymbol,
        ],
        disabled: item.availableQuantity <= 0,
      })),
    [inventoryQuery.data],
  );
  const locationOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      locations.map((location) => ({
        value: location.id,
        label: location.locationName,
        description: [
          location.locationCode,
          location.locationType,
          location.isDefault ? "Default" : "",
        ]
          .filter((part) => part.length > 0)
          .join(" / "),
        keywords: [location.locationName, location.locationCode, location.locationType],
      })),
    [locations],
  );

  if (!canView) {
    return <AccessDeniedCard message="You need inventory.view to view stock transfers." />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const openCreate = (): void => {
    setPayload(emptyPayload);
    setDialogOpen(true);
  };

  const handleCreate = async (): Promise<void> => {
    if (!payload.inventoryItemId || !payload.fromStockLocationId || !payload.toStockLocationId) {
      toast.error("Select item, source location, and target location.");
      return;
    }

    if (payload.fromStockLocationId === payload.toStockLocationId) {
      toast.error("Source and target locations must be different.");
      return;
    }

    if (payload.quantity <= 0 || !payload.reason.trim()) {
      toast.error("Quantity and reason are required.");
      return;
    }

    try {
      await createMutation.mutateAsync(payload);
      toast.success("Draft stock transfer created.");
      setDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleComplete = async (transferId: string): Promise<void> => {
    try {
      await completeMutation.mutateAsync(transferId);
      toast.success("Stock transfer completed.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleCancel = async (transferId: string): Promise<void> => {
    try {
      await cancelMutation.mutateAsync(transferId);
      toast.success("Stock transfer cancelled.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <>
      {canCreate ? (
        <div className="flex justify-end">
          <Button onClick={openCreate} type="button">
            <Plus className="h-4 w-4" />
            New transfer
          </Button>
        </div>
      ) : null}

      <FilterToolbar
        hasAnyFilter={transferHiddenFilterCount > 0 || filters.search.trim().length > 0}
        hiddenFilterCount={transferHiddenFilterCount}
        onReset={() => setFilters(defaultFilters())}
        onSearchChange={(search) => setFilters((current) => ({ ...current, search, page: 1 }))}
        popoverTitle="Filter transfers"
        searchAriaLabel="Search stock transfers"
        searchPlaceholder="Search item or reference"
        searchValue={filters.search}
      >
        <FilterField htmlFor="transferFilterStatus" label="Status">
          <Select
            value={filters.status}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                status: value as StockTransferStatus | "all",
                page: 1,
              }))
            }
          >
            <SelectTrigger id="transferFilterStatus">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField htmlFor="transferFilterItemType" label="Item type">
          <Select
            value={filters.itemType}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                itemType: value as StockTransferFilters["itemType"],
                page: 1,
              }))
            }
          >
            <SelectTrigger id="transferFilterItemType">
              <SelectValue placeholder="Item type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All item types</SelectItem>
              <SelectItem value="product">Products</SelectItem>
              <SelectItem value="product_variant">Variants</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterToolbar>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Transfer</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell>
                    <div className="font-semibold text-foreground">{transfer.itemName}</div>
                    <div className="text-sm text-foreground-muted">{transfer.reason}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <span>{transfer.fromStockLocationName}</span>
                      <ArrowRight className="h-4 w-4 text-foreground-muted" />
                      <span>{transfer.toStockLocationName}</span>
                    </div>
                    {transfer.notes ? (
                      <div className="text-sm text-foreground-muted">{transfer.notes}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {transfer.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(transfer.status)}>{transfer.status}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDate(transfer.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {transfer.status === "draft" && canComplete ? (
                        <Button size="sm" onClick={() => void handleComplete(transfer.id)}>
                          Complete
                        </Button>
                      ) : null}
                      {transfer.status === "draft" && canCancel ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleCancel(transfer.id)}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!transfersQuery.isLoading && transfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-foreground-muted">
                    No stock transfers found for the active branch.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create stock transfer</DialogTitle>
            <DialogDescription>
              Create a draft transfer first. Complete it after confirming the physical stock move.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="stock-transfers-panel-inventory-item">Inventory item</Label>
              <SearchableCombobox
                id="stock-transfers-panel-inventory-item"
                emptyMessage="No matching inventory items found."
                isLoading={inventoryQuery.isLoading}
                loadingMessage="Loading inventory items..."
                onRetry={() => {
                  void inventoryQuery.refetch();
                }}
                value={payload.inventoryItemId}
                onValueChange={(value) =>
                  setPayload((current) => ({ ...current, inventoryItemId: value }))
                }
                options={inventoryItemOptions}
                placeholder="Select inventory item"
                searchPlaceholder="Search item, code, type..."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stock-transfers-panel-from-location">From location</Label>
              <SearchableCombobox
                id="stock-transfers-panel-from-location"
                emptyMessage="No matching source locations found."
                value={payload.fromStockLocationId}
                onValueChange={(value) =>
                  setPayload((current) => ({ ...current, fromStockLocationId: value }))
                }
                options={locationOptions}
                placeholder="Source"
                searchPlaceholder="Search source location..."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stock-transfers-panel-to-location">To location</Label>
              <SearchableCombobox
                id="stock-transfers-panel-to-location"
                emptyMessage="No matching target locations found."
                value={payload.toStockLocationId}
                onValueChange={(value) =>
                  setPayload((current) => ({ ...current, toStockLocationId: value }))
                }
                options={locationOptions}
                placeholder="Target"
                searchPlaceholder="Search target location..."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stock-transfers-panel-quantity">Quantity</Label>
              <Input
                id="stock-transfers-panel-quantity"
                type="number"
                step="0.001"
                value={payload.quantity}
                onChange={(event) =>
                  setPayload((current) => ({ ...current, quantity: Number(event.target.value) }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stock-transfers-panel-reason">Reason</Label>
              <Input
                id="stock-transfers-panel-reason"
                value={payload.reason}
                onChange={(event) =>
                  setPayload((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="stock-transfers-panel-notes">Notes</Label>
              <Input
                id="stock-transfers-panel-notes"
                value={payload.notes ?? ""}
                onChange={(event) =>
                  setPayload((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createMutation.isPending} onClick={() => void handleCreate()}>
              Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
