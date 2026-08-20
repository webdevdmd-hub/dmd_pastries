"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, MoreHorizontal, Plus, RadioTower, Star, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/collection-state";
import { CollectionStateRow } from "@/components/shared/collection-state-row";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function statusBadge(status: SalesChannel["status"]): JSX.Element {
  return <Badge variant={status === "active" ? "secondary" : "default"}>{status}</Badge>;
}

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<SalesChannel | null>(null);
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

  const openEdit = (channel: SalesChannel): void => {
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
    try {
      await deleteMutation.mutateAsync(channel.id);
      toast.success("Sales channel deleted.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
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

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Default payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesChannelsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-brand-mocha">
                    Loading sales channels...
                  </TableCell>
                </TableRow>
              ) : null}
              {(salesChannelsQuery.data ?? []).map((channel) => (
                <TableRow key={channel.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-brand-espresso">{channel.channelName}</span>
                      {channel.isDefault ? (
                        <Badge className="gap-1">
                          <Star className="h-3 w-3" />
                          Default
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{channel.channelType}</TableCell>
                  <TableCell>{(channel.commissionRate ?? 0).toFixed(2)}%</TableCell>
                  <TableCell>
                    {channel.requiresExternalOrderNumber ? "Required" : "Not required"}
                  </TableCell>
                  <TableCell>{channel.defaultPaymentMethodName || "-"}</TableCell>
                  <TableCell>{statusBadge(channel.status)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={!canManage} onSelect={() => openEdit(channel)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={
                            !canManage || channel.isDefault || channel.status === "inactive"
                          }
                          onSelect={() => {
                            void handleDefault(channel);
                          }}
                        >
                          Set as default
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canManage || channel.status === "active"}
                          onSelect={() => {
                            void handleStatus(channel, "active");
                          }}
                        >
                          Mark active
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canManage || channel.status === "inactive"}
                          onSelect={() => {
                            void handleStatus(channel, "inactive");
                          }}
                        >
                          Mark inactive
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-danger-text focus:text-danger-text"
                          disabled={!canManage || channel.isDefault}
                          onSelect={() => {
                            void handleDelete(channel);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!salesChannelsQuery.isLoading && (salesChannelsQuery.data ?? []).length === 0 ? (
                <CollectionStateRow colSpan={7}>
                  <EmptyState
                    description="A channel records where an order came from — walk-in, WhatsApp, Talabat — so sales can be reported by source."
                    icon={RadioTower}
                    title="No sales channels yet"
                  />
                </CollectionStateRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-4 text-sm text-brand-mocha">
        <p className="text-sm font-medium leading-none text-brand-espresso">Quick distinction</p>
        <p className="mt-1">
          Sales Channel is where the order came from. Payment Method is how the customer paid.
          Payment Account is where that money is held for accounting.
        </p>
      </div>

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
