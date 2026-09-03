"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Plus, RadioTower } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useConfirm } from "@/components/app/confirm-provider";
import { SalesChannelDetailsDrawer } from "@/components/settings/sales-channel-details-drawer";
import { SalesChannelsCardGrid } from "@/components/settings/sales-channels-card-grid";
import { SalesChannelsTable } from "@/components/settings/sales-channels-table";
import {
  defaultSalesChannelFilters,
  type SalesChannelFilters,
  SalesChannelsToolbar,
} from "@/components/settings/sales-channels-toolbar";
import { EmptyState, FilteredState } from "@/components/shared/collection-state";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/hooks/use-permission";
import {
  useCreateSalesChannel,
  useDeleteSalesChannel,
  usePaymentMethods,
  useSalesChannels,
  useSetDefaultSalesChannel,
  useUpdateSalesChannel,
  useUpdateSalesChannelStatus,
} from "@/hooks/use-settings-data";
import { getErrorMessage } from "@/lib/api/client";
import { salesChannelSchema, type SalesChannelValues } from "@/lib/validators/sales-channel.schema";
import type { SalesChannel, SalesChannelPayload } from "@/types/settings";

const noPaymentMethodValue = "__none__";

const defaultValues: SalesChannelValues = {
  channelName: "",
  channelType: "walk_in",
  commissionRate: 0,
  defaultPaymentMethodId: null,
  isDefault: false,
  requiresExternalOrderNumber: false,
  status: "active",
};

function toFormValues(channel: SalesChannel | null): SalesChannelValues {
  if (!channel) return defaultValues;

  return {
    channelName: channel.channelName,
    channelType: channel.channelType,
    commissionRate: channel.commissionRate ?? 0,
    defaultPaymentMethodId: channel.defaultPaymentMethodId,
    isDefault: channel.isDefault,
    requiresExternalOrderNumber: channel.requiresExternalOrderNumber,
    status: channel.status,
  };
}

function toPayload(values: SalesChannelValues): SalesChannelPayload {
  return {
    channelName: values.channelName.trim(),
    channelType: values.channelType.trim(),
    commissionRate: values.commissionRate,
    defaultPaymentMethodId: values.defaultPaymentMethodId,
    isDefault: values.isDefault,
    requiresExternalOrderNumber: values.requiresExternalOrderNumber,
    status: values.status,
  };
}

function SalesChannelDialog({
  channel,
  open,
  paymentMethods,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  channel: SalesChannel | null;
  open: boolean;
  paymentMethods: { id: string; methodName: string; methodType: string; status: string }[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: SalesChannelPayload) => Promise<void>;
}): JSX.Element {
  const form = useForm<SalesChannelValues>({
    defaultValues,
    resolver: zodResolver(salesChannelSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(channel));
    }
  }, [channel, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(toPayload(values));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{channel ? "Edit sales channel" : "Create sales channel"}</DialogTitle>
          <DialogDescription>
            Sales channels track where orders come from, such as Walk-in, WhatsApp, Talabat, or
            partner channels.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <FormField
              control={form.control}
              name="channelName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel name</FormLabel>
                  <FormControl>
                    <Input placeholder="Talabat" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="channelType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel type</FormLabel>
                  <FormControl>
                    <Input placeholder="delivery_platform" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="commissionRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commission rate (%)</FormLabel>
                  <FormControl>
                    <Input
                      min={0}
                      step="0.01"
                      type="number"
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultPaymentMethodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default payment method</FormLabel>
                  <Select
                    value={field.value ?? noPaymentMethodValue}
                    onValueChange={(value) => {
                      field.onChange(value === noPaymentMethodValue ? null : value);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional default method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={noPaymentMethodValue}>No default method</SelectItem>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.methodName} ({method.methodType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requiresExternalOrderNumber"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div>
                    <FormLabel>Requires external order number</FormLabel>
                    <p className="text-xs text-brand-mocha">
                      Use for Talabat, Noon, WhatsApp, or partner order IDs.
                    </p>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div>
                    <FormLabel>Default channel</FormLabel>
                    <p className="text-xs text-brand-mocha">
                      Used automatically when POS or orders do not send a channel.
                    </p>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={submitting} type="submit">
                {submitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : channel ? (
                  "Save changes"
                ) : (
                  "Create channel"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function SalesChannelsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.settingsView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.settingsCompanyUpdate,
    PERMISSIONS.settingsPaymentMethodsManage,
  ]);
  const confirm = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<SalesChannel | null>(null);
  const [drawerChannel, setDrawerChannel] = useState<SalesChannel | null>(null);
  const [filters, setFilters] = useState<SalesChannelFilters>(defaultSalesChannelFilters);
  const salesChannelsQuery = useSalesChannels(canView);
  const paymentMethodsQuery = usePaymentMethods(canView);
  const createMutation = useCreateSalesChannel();
  const updateMutation = useUpdateSalesChannel();
  const statusMutation = useUpdateSalesChannelStatus();
  const defaultMutation = useSetDefaultSalesChannel();
  const deleteMutation = useDeleteSalesChannel();
  const submitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    statusMutation.isPending ||
    defaultMutation.isPending ||
    deleteMutation.isPending;

  const paymentMethods = useMemo(
    () => (paymentMethodsQuery.data ?? []).filter((method) => method.status === "active"),
    [paymentMethodsQuery.data],
  );

  const openCreate = (): void => {
    setSelectedChannel(null);
    setDialogOpen(true);
  };

  // A dialog on top of a sheet on top of the list is one layer too many, so
  // the drawer closes before the form opens.
  const openEdit = (channel: SalesChannel): void => {
    setDrawerChannel(null);
    setSelectedChannel(channel);
    setDialogOpen(true);
  };

  const handleSubmit = async (payload: SalesChannelPayload): Promise<void> => {
    try {
      if (selectedChannel) {
        await updateMutation.mutateAsync({ id: selectedChannel.id, payload });
        toast.success("Sales channel updated.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Sales channel created.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleStatus = async (channel: SalesChannel, status: SalesChannel["status"]) => {
    try {
      await statusMutation.mutateAsync({ id: channel.id, payload: { status } });
      toast.success(`Sales channel marked ${status}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDefault = async (channel: SalesChannel) => {
    try {
      await defaultMutation.mutateAsync(channel.id);
      toast.success("Default sales channel updated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async (channel: SalesChannel) => {
    setDrawerChannel(null);

    // There was no confirmation at all: one click on a menu item deleted the
    // channel that every historical order is attributed to.
    const confirmed = await confirm({
      cancelLabel: "Keep channel",
      confirmLabel: "Delete channel",
      consequence: `This permanently deletes ${channel.channelName}. It cannot be undone.`,
      detail:
        "Orders already recorded against it keep their channel name, but no new order can use it.",
      title: "Delete this sales channel?",
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(channel.id);
      toast.success("Sales channel deleted.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const allChannels = salesChannelsQuery.data ?? [];
  const channelTypes = Array.from(
    new Set(allChannels.map((channel) => channel.channelType).filter(Boolean)),
  ).sort();
  const query = filters.search.trim().toLowerCase();
  const visibleChannels = allChannels.filter((channel) => {
    const matchesQuery =
      query.length === 0 ||
      channel.channelName.toLowerCase().includes(query) ||
      channel.channelType.toLowerCase().includes(query);
    const matchesStatus = filters.status === "all" || channel.status === filters.status;
    const matchesType = filters.type === "all" || channel.channelType === filters.type;

    return matchesQuery && matchesStatus && matchesType;
  });
  const hasActiveFilters = query.length > 0 || filters.status !== "all" || filters.type !== "all";

  const listHandlers = {
    canManage,
    channels: visibleChannels,
    onDelete: (channel: SalesChannel) => {
      void handleDelete(channel);
    },
    onEdit: openEdit,
    onSetDefault: (channel: SalesChannel) => {
      setDrawerChannel(null);
      void handleDefault(channel);
    },
    onStatusChange: (channel: SalesChannel, status: SalesChannel["status"]) => {
      setDrawerChannel(null);
      void handleStatus(channel, status);
    },
    onView: setDrawerChannel,
  };

  if (!canView) {
    return (
      <Alert className="border-danger/30 bg-danger-tint text-danger-text">
        <RadioTower className="h-4 w-4" />
        <AlertTitle>Access denied</AlertTitle>
        <AlertDescription>You do not have permission to view sales channels.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Sales Channels"
        description="Manage order sources for POS and bakery orders."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create channel
            </Button>
          ) : null
        }
      />

      {salesChannelsQuery.error ? (
        <Alert className="border-danger/30 bg-danger-tint text-danger-text">
          <RadioTower className="h-4 w-4" />
          <AlertTitle>Unable to load sales channels</AlertTitle>
          <AlertDescription>{getErrorMessage(salesChannelsQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      <SalesChannelsToolbar
        channelTypes={channelTypes}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {salesChannelsQuery.isLoading ? (
        <div className="grid gap-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : null}

      {/* A filter that matched nothing and a register with no channels need
          opposite remedies. DESIGN.md 8. */}
      {!salesChannelsQuery.isLoading && visibleChannels.length === 0 && hasActiveFilters ? (
        <FilteredState
          noun="sales channels"
          onClearFilters={() => setFilters(defaultSalesChannelFilters)}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!salesChannelsQuery.isLoading && allChannels.length === 0 ? (
        <EmptyState
          description="A channel records where an order came from -- walk-in, WhatsApp, Talabat -- so sales can be reported by source."
          icon={RadioTower}
          title="No sales channels yet"
        />
      ) : null}

      {visibleChannels.length > 0 ? (
        <>
          <div className="md:hidden">
            <SalesChannelsCardGrid {...listHandlers} />
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <SalesChannelsTable {...listHandlers} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <SalesChannelDetailsDrawer
        canManage={canManage}
        channel={drawerChannel}
        onEdit={openEdit}
        onOpenChange={(open) => (!open ? setDrawerChannel(null) : undefined)}
        onSetDefault={(channel) => {
          setDrawerChannel(null);
          void handleDefault(channel);
        }}
        open={drawerChannel !== null}
      />

      <SalesChannelDialog
        channel={selectedChannel}
        open={dialogOpen}
        paymentMethods={paymentMethods}
        submitting={submitting}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
