"use client";

import { Edit, Plus, Star, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/inventory/access-denied-card";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
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
import {
  useCreateStockLocation,
  useDeleteStockLocation,
  useSetDefaultStockLocation,
  useStockLocations,
  useUpdateStockLocation,
  useUpdateStockLocationStatus,
} from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type {
  InventoryStatus,
  StockLocation,
  StockLocationPayload,
  StockLocationType,
} from "@/types/inventory";

const locationTypes: { label: string; value: StockLocationType }[] = [
  { label: "Kitchen", value: "kitchen" },
  { label: "Store room", value: "store_room" },
  { label: "Front desk", value: "front_desk" },
  { label: "Display counter", value: "display_counter" },
  { label: "Warehouse", value: "warehouse" },
  { label: "Production area", value: "production_area" },
  { label: "Pickup area", value: "pickup_area" },
  { label: "Other", value: "other" },
];

const initialForm: StockLocationPayload = {
  locationName: "",
  locationCode: "",
  locationType: "other",
  description: "",
  isDefault: false,
  status: "active",
};

function readableType(value: StockLocationType): string {
  return locationTypes.find((item) => item.value === value)?.label ?? "Other";
}

export function StockLocationsPageClient(): JSX.Element {
  const branchScope = useBranchScope();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([PERMISSIONS.inventoryLocationsManage]);
  const locationsQuery = useStockLocations(canView && branchScope.hasBranchScope);
  const createMutation = useCreateStockLocation();
  const updateMutation = useUpdateStockLocation();
  const statusMutation = useUpdateStockLocationStatus();
  const defaultMutation = useSetDefaultStockLocation();
  const deleteMutation = useDeleteStockLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StockLocation | null>(null);
  const [form, setForm] = useState<StockLocationPayload>(initialForm);
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const activeCount = useMemo(
    () => locations.filter((location) => location.status === "active").length,
    [locations],
  );
  const defaultLocation = useMemo(
    () => locations.find((location) => location.isDefault) ?? null,
    [locations],
  );

  if (!canView) {
    return <AccessDeniedCard message="You need inventory.view to view stock locations." />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const openCreate = (): void => {
    setEditingLocation(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const openEdit = (location: StockLocation): void => {
    setEditingLocation(location);
    setForm({
      locationName: location.locationName,
      locationCode: location.locationCode,
      locationType: location.locationType,
      ...(location.description ? { description: location.description } : { description: "" }),
      isDefault: location.isDefault,
      status: location.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!form.locationName.trim() || !form.locationCode.trim()) {
      toast.error("Location name and code are required.");
      return;
    }

    try {
      if (editingLocation) {
        await updateMutation.mutateAsync({ locationId: editingLocation.id, payload: form });
        toast.success("Stock location updated.");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Stock location created.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleStatus = async (location: StockLocation, status: InventoryStatus): Promise<void> => {
    try {
      await statusMutation.mutateAsync({ locationId: location.id, status });
      toast.success("Location status updated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleSetDefault = async (location: StockLocation): Promise<void> => {
    try {
      await defaultMutation.mutateAsync(location.id);
      toast.success("Default stock location updated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async (location: StockLocation): Promise<void> => {
    try {
      await deleteMutation.mutateAsync(location.id);
      toast.success("Stock location deleted.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Stock Locations"
        description="Manage physical stock areas inside the active branch, such as Main Stock, Kitchen, Store Room, and Display Counter."
        actions={
          canManage ? (
            <Button onClick={openCreate} type="button">
              <Plus className="h-4 w-4" />
              New location
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-foreground-muted">Total locations</p>
            <p className="mt-2 text-3xl font-medium tabular-nums text-foreground">
              {locations.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-foreground-muted">Active locations</p>
            <p className="mt-2 text-3xl font-medium tabular-nums text-foreground">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-foreground-muted">Default location</p>
            <p className="mt-2 text-xl font-medium text-foreground">
              {defaultLocation?.locationName ?? "Main Stock"}
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              Normal receiving uses this location automatically.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Default</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                      <span>{location.locationName}</span>
                      {location.isDefault ? <Badge>Default</Badge> : null}
                    </div>
                    <div className="text-sm text-foreground-muted">
                      {location.description ?? "No description"}
                    </div>
                  </TableCell>
                  <TableCell>{location.locationCode}</TableCell>
                  <TableCell>{readableType(location.locationType)}</TableCell>
                  <TableCell>
                    <Badge variant={location.status === "active" ? "secondary" : "outline"}>
                      {location.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {location.isDefault ? (
                      <Badge>Default</Badge>
                    ) : (
                      <span className="text-foreground-muted">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {canManage ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEdit(location)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!location.isDefault && location.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleSetDefault(location)}
                            >
                              <Star className="h-4 w-4" />
                              Set default
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void handleStatus(
                                location,
                                location.status === "active" ? "inactive" : "active",
                              )
                            }
                          >
                            {location.status === "active" ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleDelete(location)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-sm text-foreground-muted">View only</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!locationsQuery.isLoading && locations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-foreground-muted">
                    No stock locations found. Backend should create Main Stock automatically for
                    each branch.
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
            <DialogTitle>
              {editingLocation ? "Edit stock location" : "Create stock location"}
            </DialogTitle>
            <DialogDescription>
              Locations are created under the current active branch. Backend prevents deleting
              defaults or locations with stock.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="stock-locations-location-name">Location name</Label>
              <Input
                id="stock-locations-location-name"
                value={form.locationName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, locationName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stock-locations-location-code">Location code</Label>
              <Input
                id="stock-locations-location-code"
                value={form.locationCode}
                onChange={(event) =>
                  setForm((current) => ({ ...current, locationCode: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stock-locations-location-type">Location type</Label>
              <Select
                value={form.locationType}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, locationType: value as StockLocationType }))
                }
              >
                <SelectTrigger id="stock-locations-location-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="stock-locations-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, status: value as InventoryStatus }))
                }
              >
                <SelectTrigger id="stock-locations-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="stock-locations-description">Description</Label>
              <Input
                id="stock-locations-description"
                value={form.description ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createMutation.isPending || updateMutation.isPending}
              onClick={() => void handleSubmit()}
            >
              {editingLocation ? "Save changes" : "Create location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
