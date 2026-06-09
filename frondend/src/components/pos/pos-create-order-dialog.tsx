"use client";

import { CalendarPlus, Loader2, Store } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { OrderCustomerSelector } from "@/components/orders/order-customer-selector";
import { OrderItemsSection } from "@/components/orders/order-items-section";
import { OrderPackagingSection } from "@/components/orders/order-packaging-section";
import { OrderScheduleCard } from "@/components/orders/order-schedule-card";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAddOrderPackaging, useCreateOrder } from "@/hooks/use-orders";
import { usePOSProducts, usePOSReferenceData } from "@/hooks/use-pos-products";
import { getErrorMessage } from "@/lib/api/client";
import { createOrderSchema } from "@/lib/validators/orders.schema";
import type {
  AddOrderPackagingPayload,
  CreateOrderItemPayload,
  CreateOrderPayload,
  OrderType,
} from "@/types/orders";
import type { POSProduct } from "@/types/pos";
import type { Product } from "@/types/product";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialOrderState() {
  return {
    customerId: null as string | null,
    customerName: null as string | null,
    customerPhone: null as string | null,
    deliveryAddress: "",
    deliveryTime: "",
    draftPackaging: [] as AddOrderPackagingPayload[],
    eventDate: today(),
    externalOrderNumber: "",
    items: [] as CreateOrderItemPayload[],
    notes: "",
    orderType: "pickup" as OrderType,
    pickupTime: "",
    salesChannelId: "",
  };
}

function toOrderProducts(products: POSProduct[], fallbackUnitId: string): Product[] {
  return products.map((product) => ({
    id: product.id,
    productName: product.productName,
    productCode: product.productCode,
    sku: product.sku,
    barcode: product.barcode,
    description: null,
    categoryId: product.categoryId ?? "",
    categoryName: product.categoryName,
    unitId: product.unitId ?? fallbackUnitId,
    unitName: product.unitName,
    taxRateId: product.taxRateId,
    taxRateName: product.taxRateName,
    productType: product.productType,
    itemStructure: product.itemStructure,
    salePrice: product.salePrice,
    costPrice: null,
    compareAtPrice: null,
    imageUrl: product.imageUrl,
    imageFileId: product.imageFileId,
    isPosVisible: product.isPosVisible,
    isStockTracked: product.isStockTracked,
    isExpiryTracked: false,
    isCustomOrderAvailable: true,
    preparationTimeMinutes: null,
    status: product.status,
    variants: product.variants.map((variant, index) => ({
      id: variant.id,
      productId: variant.productId,
      variantName: variant.variantName,
      sku: variant.sku,
      barcode: variant.barcode,
      salePrice: variant.salePrice,
      costPrice: null,
      imageUrl: variant.imageUrl,
      imageFileId: variant.imageFileId,
      sortOrder: index + 1,
      status: variant.status,
      createdAt: "",
      updatedAt: "",
    })),
    createdAt: "",
    updatedAt: "",
  }));
}

type POSCreateOrderDialogProps = {
  branchId: string;
  branchName: string;
  canCreate: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function POSCreateOrderDialog({
  branchId,
  branchName,
  canCreate,
  onOpenChange,
  open,
}: POSCreateOrderDialogProps): JSX.Element {
  const [state, setState] = useState(initialOrderState);
  const productsQuery = usePOSProducts(
    {
      categoryId: "all",
      limit: 100,
      search: "",
    },
    open && canCreate,
  );
  const referenceDataQuery = usePOSReferenceData(branchId || null, open && canCreate);
  const createOrderMutation = useCreateOrder();
  const addPackagingMutation = useAddOrderPackaging();
  const salesChannels = useMemo(
    () =>
      (referenceDataQuery.data?.salesChannels ?? []).filter(
        (channel) => channel.status === "active",
      ),
    [referenceDataQuery.data?.salesChannels],
  );
  const selectedSalesChannel =
    salesChannels.find((channel) => channel.id === state.salesChannelId) ?? null;
  const orderProducts = useMemo(
    () => toOrderProducts(productsQuery.data ?? [], referenceDataQuery.data?.units[0]?.id ?? ""),
    [productsQuery.data, referenceDataQuery.data?.units],
  );
  const salesChannelOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      salesChannels.map((channel) => ({
        value: channel.id,
        label: channel.channelName,
        description: [
          channel.channelType,
          channel.isDefault ? "Default" : "",
          channel.requiresExternalOrderNumber ? "External order #" : "",
          channel.commissionRate ? `${String(channel.commissionRate)}% commission` : "",
        ]
          .filter((part) => part.length > 0)
          .join(" - "),
        keywords: [channel.channelName, channel.channelType],
      })),
    [salesChannels],
  );
  const isSaving = createOrderMutation.isPending || addPackagingMutation.isPending;

  useEffect(() => {
    if (!open) {
      return;
    }

    setState(initialOrderState());
  }, [branchId, open]);

  useEffect(() => {
    if (selectedSalesChannel?.requiresExternalOrderNumber !== true && state.externalOrderNumber) {
      setState((current) => ({ ...current, externalOrderNumber: "" }));
    }
  }, [selectedSalesChannel?.requiresExternalOrderNumber, state.externalOrderNumber]);

  const buildPayload = (): CreateOrderPayload => ({
    branchId,
    customerId: state.customerId,
    customerName: state.customerName,
    customerPhone: state.customerPhone,
    salesChannelId: state.salesChannelId || null,
    externalOrderNumber:
      state.externalOrderNumber.trim().length > 0 ? state.externalOrderNumber.trim() : null,
    deliveryAddress: state.orderType === "delivery" ? state.deliveryAddress || null : null,
    deliveryTime: state.orderType === "delivery" ? state.deliveryTime || null : null,
    eventDate: state.eventDate,
    items: state.items,
    charges: [],
    notes: state.notes || null,
    orderType: state.orderType,
    pickupTime: state.orderType === "pickup" ? state.pickupTime || null : null,
  });

  const submitOrder = async (): Promise<void> => {
    if (!branchId) {
      toast.error("No active branch is selected. Switch branch before creating an order.");
      return;
    }

    const payload = buildPayload();
    if (
      selectedSalesChannel?.requiresExternalOrderNumber === true &&
      !payload.externalOrderNumber
    ) {
      toast.error(`External order number is required for ${selectedSalesChannel.channelName}.`);
      return;
    }

    const result = createOrderSchema.safeParse(payload);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Please check order details.");
      return;
    }

    try {
      const created = await createOrderMutation.mutateAsync(result.data);
      await Promise.all(
        state.draftPackaging.map((packagingPayload) =>
          addPackagingMutation.mutateAsync({
            orderId: created.id,
            payload: packagingPayload,
          }),
        ),
      );
      toast.success(`Bakery order ${created.orderNumber} created.`);
      onOpenChange(false);
      setState(initialOrderState());
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!isSaving) {
          onOpenChange(nextOpen);
        }
      }}
      open={open}
    >
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto rounded-lg border-[#d4d4d8] bg-white p-0 text-[#09090b] shadow-lg">
        <div className="border-b border-[#d4d4d8] bg-[#fafafa] px-5 py-4 sm:px-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-black tracking-tight">
              <CalendarPlus className="h-5 w-5 text-[#09090b]" />
              Create bakery order
            </DialogTitle>
            <DialogDescription className="text-[#52525b]">
              Create custom cakes, advance orders, pickup, or delivery requests without leaving POS.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-5 p-5 sm:p-6">
          <section className="rounded-lg border border-[#d4d4d8] bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-[#09090b]">Order source</h2>
                <p className="mt-1 text-sm text-[#52525b]">
                  The order is created under the active POS branch. Choose a source only when it is
                  not the default walk-in flow.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-md border border-[#d4d4d8] bg-[#fafafa] px-4 py-3 text-sm font-semibold text-[#09090b]">
                <Store className="h-4 w-4 text-[#52525b]" />
                {branchName}
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <SearchableCombobox
                  emptyMessage="No active sales channels found."
                  isLoading={referenceDataQuery.isLoading}
                  loadingMessage="Loading sales channels..."
                  onRetry={() => void referenceDataQuery.refetch()}
                  onValueChange={(salesChannelId) =>
                    setState((current) => ({ ...current, salesChannelId }))
                  }
                  options={salesChannelOptions}
                  placeholder="Default sales channel"
                  searchPlaceholder="Search channel..."
                  value={state.salesChannelId}
                />
                <button
                  className="w-fit text-xs font-semibold text-[#52525b] underline-offset-4 hover:underline"
                  onClick={() =>
                    setState((current) => ({
                      ...current,
                      externalOrderNumber: "",
                      salesChannelId: "",
                    }))
                  }
                  type="button"
                >
                  Use default channel
                </button>
              </div>
              {selectedSalesChannel?.requiresExternalOrderNumber ? (
                <div className="grid gap-2">
                  <Input
                    aria-label="External order number"
                    onChange={(event) =>
                      setState((current) => ({
                        ...current,
                        externalOrderNumber: event.target.value,
                      }))
                    }
                    placeholder="Platform / partner order number"
                    value={state.externalOrderNumber}
                  />
                  <p className="text-xs text-[#52525b]">
                    Required for {selectedSalesChannel.channelName}.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
            <div className="grid gap-5">
              <OrderCustomerSelector
                customerId={state.customerId}
                customerName={state.customerName}
                customerPhone={state.customerPhone}
                onCustomerChange={(customer) =>
                  setState((current) => ({
                    ...current,
                    customerId: customer.id,
                    customerName: customer.name,
                    customerPhone: customer.phone,
                  }))
                }
              />
              <OrderScheduleCard
                deliveryAddress={state.deliveryAddress}
                deliveryTime={state.deliveryTime}
                eventDate={state.eventDate}
                notes={state.notes}
                onChange={(patch) =>
                  setState((current) => ({
                    ...current,
                    deliveryAddress: patch.deliveryAddress ?? current.deliveryAddress,
                    deliveryTime: patch.deliveryTime ?? current.deliveryTime,
                    eventDate: patch.eventDate ?? current.eventDate,
                    notes: patch.notes ?? current.notes,
                    orderType: patch.orderType ?? current.orderType,
                    pickupTime: patch.pickupTime ?? current.pickupTime,
                  }))
                }
                orderType={state.orderType}
                pickupTime={state.pickupTime}
              />
              <OrderItemsSection
                items={state.items}
                onChange={(items) => setState((current) => ({ ...current, items }))}
                products={orderProducts}
                units={referenceDataQuery.data?.units ?? []}
              />
            </div>
            <div className="grid content-start gap-5">
              <section className="rounded-lg border border-[#d4d4d8] bg-white p-5">
                <h2 className="text-lg font-black text-[#09090b]">POS quick order</h2>
                <p className="mt-2 text-sm leading-6 text-[#52525b]">
                  This creates a bakery order only. It does not add items to the current POS cart or
                  collect payment automatically.
                </p>
                <div className="mt-4 rounded-md border border-[#d4d4d8] bg-[#fafafa] p-4 text-sm text-[#52525b]">
                  <p className="font-semibold text-[#09090b]">After saving</p>
                  <p>Use Bakery Orders to take deposit, assign production, or update status.</p>
                </div>
              </section>
              <OrderPackagingSection
                canManage={canCreate}
                draftPackaging={state.draftPackaging}
                onDraftPackagingChange={(draftPackaging) =>
                  setState((current) => ({ ...current, draftPackaging }))
                }
                order={null}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 border-t border-[#d4d4d8] bg-white px-5 py-4 sm:px-6">
          <Button
            className="rounded-md border-[#d4d4d8] bg-white text-[#09090b] hover:bg-[#f4f4f5]"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="rounded-md bg-black text-white hover:bg-[#18181b]"
            disabled={!canCreate || isSaving}
            onClick={() => void submitOrder()}
            type="button"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="h-4 w-4" />
            )}
            Create order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
