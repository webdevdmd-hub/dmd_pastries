"use client";

import { CircleDollarSign, Loader2, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/orders/access-denied-card";
import { OrderCustomerSelector } from "@/components/orders/order-customer-selector";
import {
  DEFAULT_ORDER_FORM_TAB,
  ORDER_FORM_TABPANEL_ID,
  type OrderFormTabKey,
  OrderFormTabs,
} from "@/components/orders/order-form-tabs";
import { OrderItemsSection } from "@/components/orders/order-items-section";
import { OrderPackagingSection } from "@/components/orders/order-packaging-section";
import { OrderPaymentSection } from "@/components/orders/order-payment-section";
import { OrderProductionSection } from "@/components/orders/order-production-section";
import { OrderScheduleCard } from "@/components/orders/order-schedule-card";
import { OrdersErrorState } from "@/components/orders/orders-error-state";
import { DocumentChargesEditor } from "@/components/shared/document-charges-editor";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useBranches } from "@/hooks/use-branches";
import {
  useAddOrderPackaging,
  useCreateOrder,
  useOrder,
  useOrderPreview,
  useUpdateOrder,
} from "@/hooks/use-orders";
import { usePermission } from "@/hooks/use-permission";
import { useProductReferenceData, useProducts } from "@/hooks/use-products";
import { useSalesChannels } from "@/hooks/use-settings-data";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { toDateOnlyInputValue, todayDateOnly } from "@/lib/utils/date-only";
import { createOrderSchema } from "@/lib/validators/orders.schema";
import type { Branch } from "@/types/branch";
import type { DocumentChargeDraft } from "@/types/document-charges";
import type {
  AddOrderPackagingPayload,
  BakeryOrderItem,
  CreateOrderItemPayload,
  CreateOrderPayload,
  OrderType,
} from "@/types/orders";

function isPermissionDenied(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

function mapOrderToItems(items: CreateOrderItemPayload[]): CreateOrderItemPayload[] {
  return items.map((item) => ({ ...item }));
}

function mapSavedItemsToPayload(items: BakeryOrderItem[]): CreateOrderItemPayload[] {
  return items.map((item) => ({
    customizationsJson: item.customizationsJson,
    designNotes: item.designNotes,
    discountAmount: item.discountAmount,
    flavor: item.flavor,
    itemName: item.itemSource === "custom" ? item.itemNameSnapshot : null,
    messageText: item.messageText,
    productId: item.productId,
    productVariantId: item.productVariantId,
    quantity: item.quantity,
    taxRateId: item.taxRateId,
    unitId: item.unitId,
    unitPrice: item.unitPrice,
    weight: item.weight,
  }));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function toMoney(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

/**
 * One tab's panel. The strip owns the section name, so the heading here is the
 * panel's own title line plus any action that belongs beside it.
 */
function OrderFormSection({
  action,
  children,
  description,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
}): JSX.Element {
  return (
    <section>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-body font-medium text-foreground">{title}</h2>
          <p className="mt-0.5 text-cell text-foreground-muted">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function OrderFormPage({
  onClose,
  orderId,
  presentation = "page",
}: {
  onClose?: () => void;
  orderId: string | null;
  presentation?: "modal" | "page";
}): JSX.Element {
  const router = useRouter();
  const branchScope = useBranchScope();
  const { hasAnyPermission } = usePermission();
  // TODO: Remove POS fallback after orders.* permissions are seeded for every tenant.
  const canView = hasAnyPermission([PERMISSIONS.ordersView, PERMISSIONS.posView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.ordersCreate,
    PERMISSIONS.ordersEdit,
    PERMISSIONS.ordersStatusUpdate,
    PERMISSIONS.ordersPaymentsManage,
    PERMISSIONS.ordersProductionAssign,
    PERMISSIONS.ordersPackagingManage,
    PERMISSIONS.posSell,
  ]);
  const isEdit = orderId !== null;

  const orderQuery = useOrder(orderId, canView && isEdit);
  const branchesQuery = useBranches(canView);
  const salesChannelsQuery = useSalesChannels(canView);
  const productsQuery = useProducts(
    {
      categoryId: "",
      isPosVisible: "all",
      isSellable: "true",
      isPurchasable: "all",
      limit: 100,
      page: 1,
      productType: "all",
      itemStructure: "all",
      search: "",
      sortBy: "product_name",
      sortOrder: "asc",
      status: "active",
    },
    canView,
  );
  const referenceQuery = useProductReferenceData(canView);
  const createMutation = useCreateOrder();
  const updateMutation = useUpdateOrder();
  const addPackagingMutation = useAddOrderPackaging();

  const selectableBranches = useMemo(() => {
    const branches = branchesQuery.data ?? [];
    const currentOrderBranchId = orderQuery.data?.branchId;

    return branches.filter(
      (branch: Branch) =>
        branch.id === currentOrderBranchId ||
        (branchScope.canAccessAllBranches
          ? branch.status === "active"
          : branch.id === branchScope.effectiveBranchId),
    );
  }, [
    branchScope.canAccessAllBranches,
    branchScope.effectiveBranchId,
    branchesQuery.data,
    orderQuery.data?.branchId,
  ]);

  const defaultBranchId = useMemo(() => {
    return (
      (branchScope.canAccessAllBranches
        ? selectableBranches.find(
            (branch: Branch) => branch.status === "active" && branch.isDefault,
          )?.id
        : branchScope.effectiveBranchId) ??
      selectableBranches.find((branch: Branch) => branch.status === "active")?.id ??
      ""
    );
  }, [branchScope.canAccessAllBranches, branchScope.effectiveBranchId, selectableBranches]);
  const branchOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      selectableBranches.map((branch) => ({
        value: branch.id,
        label: branch.name,
        description: [branch.code, branch.status === "active" ? "Active" : "Inactive"]
          .filter((part) => part.length > 0)
          .join(" - "),
        keywords: [branch.name, branch.code],
        disabled: branch.status !== "active",
      })),
    [selectableBranches],
  );
  const salesChannels = useMemo(
    () => (salesChannelsQuery.data ?? []).filter((channel) => channel.status === "active"),
    [salesChannelsQuery.data],
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
        ]
          .filter((part) => part.length > 0)
          .join(" - "),
        keywords: [channel.channelName, channel.channelType],
      })),
    [salesChannels],
  );

  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [salesChannelId, setSalesChannelId] = useState("");
  const [externalOrderNumber, setExternalOrderNumber] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  // W3: "" = business default; the mode is fixed once the order is created.
  const [taxMode, setTaxMode] = useState<"" | "inclusive" | "exclusive" | "no_tax">("");
  const [eventDate, setEventDate] = useState(todayDateOnly());
  const [pickupTime, setPickupTime] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<CreateOrderItemPayload[]>([]);
  const [charges, setCharges] = useState<DocumentChargeDraft[]>([]);
  const [draftPackaging, setDraftPackaging] = useState<AddOrderPackagingPayload[]>([]);
  // Which section is showing. Every field above is state on this component, so
  // switching tabs never loses what was typed on another one.
  const [activeTab, setActiveTab] = useState<OrderFormTabKey>(DEFAULT_ORDER_FORM_TAB);

  useEffect(() => {
    if (!branchId && defaultBranchId) {
      setBranchId(defaultBranchId);
    }
  }, [branchId, defaultBranchId]);

  useEffect(() => {
    const order = orderQuery.data;
    if (!order) {
      return;
    }
    setBranchId(order.branchId);
    setCustomerId(order.customerId);
    setCustomerName(order.customerNameSnapshot);
    setCustomerPhone(order.customerPhoneSnapshot);
    setSalesChannelId(order.salesChannelId ?? "");
    setExternalOrderNumber(order.externalOrderNumber ?? "");
    setOrderType(order.orderType);
    setEventDate(toDateOnlyInputValue(order.eventDate));
    setPickupTime(order.pickupTime ?? "");
    setDeliveryTime(order.deliveryTime ?? "");
    setDeliveryAddress(order.deliveryAddress ?? "");
    setNotes(order.notes ?? "");
    setCharges(order.charges);
    setDraftPackaging([]);
    setItems(mapOrderToItems(mapSavedItemsToPayload(order.items)));
  }, [orderQuery.data]);

  const currentOrder = orderQuery.data ?? null;
  const selectedSalesChannel =
    salesChannels.find((channel) => channel.id === salesChannelId) ?? null;

  useEffect(() => {
    if (selectedSalesChannel?.requiresExternalOrderNumber !== true && externalOrderNumber) {
      setExternalOrderNumber("");
    }
  }, [externalOrderNumber, selectedSalesChannel?.requiresExternalOrderNumber]);

  const draftPayload = useMemo<CreateOrderPayload>(
    () => ({
      branchId,
      customerId,
      customerName,
      customerPhone,
      salesChannelId: salesChannelId || null,
      externalOrderNumber:
        externalOrderNumber.trim().length > 0 ? externalOrderNumber.trim() : null,
      deliveryAddress: orderType === "delivery" ? deliveryAddress || null : null,
      deliveryTime: orderType === "delivery" ? deliveryTime || null : null,
      eventDate,
      items,
      charges,
      notes: notes || null,
      orderType,
      pickupTime: orderType === "pickup" ? pickupTime || null : null,
      taxMode: taxMode === "" ? null : taxMode,
    }),
    [
      branchId,
      charges,
      customerId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryTime,
      eventDate,
      externalOrderNumber,
      items,
      notes,
      orderType,
      pickupTime,
      salesChannelId,
      taxMode,
    ],
  );

  const validPreviewPayload = useMemo(() => {
    if (
      selectedSalesChannel?.requiresExternalOrderNumber === true &&
      !draftPayload.externalOrderNumber
    ) {
      return null;
    }

    const result = createOrderSchema.safeParse(draftPayload);
    return result.success ? result.data : null;
  }, [draftPayload, selectedSalesChannel?.requiresExternalOrderNumber]);

  // Debounce the preview payload so typing doesn't fire a preview request per keystroke.
  const [debouncedPreviewPayload, setDebouncedPreviewPayload] = useState<CreateOrderPayload | null>(
    null,
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedPreviewPayload(validPreviewPayload), 300);
    return () => window.clearTimeout(timeout);
  }, [validPreviewPayload]);

  const previewQuery = useOrderPreview(debouncedPreviewPayload, canManage);

  const buildPayload = (): CreateOrderPayload => draftPayload;

  const save = async (): Promise<void> => {
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
      if (orderId) {
        await updateMutation.mutateAsync({ id: orderId, payload: result.data });
        toast.success("Order updated.");
        if (onClose) {
          onClose();
        } else {
          router.replace(`/orders/${orderId}`);
        }
      } else {
        const created = await createMutation.mutateAsync(result.data);
        await Promise.all(
          draftPackaging.map((payload) =>
            addPackagingMutation.mutateAsync({ orderId: created.id, payload }),
          ),
        );
        toast.success("Order created.");
        if (onClose) {
          onClose();
        } else {
          router.replace(`/orders/${created.id}`);
        }
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  if (isEdit && orderQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-brand-mocha">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading order...
      </div>
    );
  }

  if (isPermissionDenied(orderQuery.error)) {
    return <AccessDeniedCard />;
  }

  if (isEdit && (orderQuery.isError || !orderQuery.data)) {
    return (
      <OrdersErrorState
        description={getErrorMessage(orderQuery.error)}
        onRetry={() => void orderQuery.refetch()}
      />
    );
  }

  const order = currentOrder;
  const saving =
    createMutation.isPending || updateMutation.isPending || addPackagingMutation.isPending;
  const itemQuantity = items.reduce((sum, item) => sum + toMoney(item.quantity), 0);
  const draftSubtotal = items.reduce(
    (sum, item) => sum + toMoney(item.quantity) * toMoney(item.unitPrice),
    0,
  );
  const draftDiscount = items.reduce(
    (sum, item) => sum + Math.max(0, toMoney(item.discountAmount)),
    0,
  );
  const draftChargeAmount = charges.reduce((sum, charge) => sum + toMoney(charge.amount), 0);
  const preview = previewQuery.data ?? null;
  const summarySubtotal =
    preview?.subtotalAmount ?? order?.subtotalAmount ?? Math.max(0, draftSubtotal);
  const summaryDiscount = preview?.discountAmount ?? order?.discountAmount ?? draftDiscount;
  const summaryTax = preview?.taxAmount ?? order?.taxAmount ?? 0;
  const summaryChargeAmount = preview?.chargeAmount ?? order?.chargeAmount ?? draftChargeAmount;
  const summaryChargeTax = preview?.chargeTaxAmount ?? order?.chargeTaxAmount ?? 0;
  const summaryTotal =
    preview?.totalAmount ??
    order?.totalAmount ??
    Math.max(
      0,
      summarySubtotal - summaryDiscount + summaryTax + summaryChargeAmount + summaryChargeTax,
    );
  const showPreviewLoading = validPreviewPayload !== null && previewQuery.isFetching;
  const showPreviewError = validPreviewPayload !== null && previewQuery.isError;
  // Closing an edit used to land on that order's details page, which read as
  // the form "going back" to a screen the user had not come from. Both modes
  // now return to the orders list.
  const closeForm = (): void => {
    if (onClose) {
      onClose();
      return;
    }

    router.push("/orders");
  };

  return (
    <main
      className={
        presentation === "modal"
          ? "h-full min-h-0 bg-transparent"
          : "min-h-dvh bg-primary/35 px-3 py-4 backdrop-blur-sm sm:px-6 lg:py-8"
      }
    >
      <div
        className={
          presentation === "modal"
            ? "mx-auto flex h-full min-h-0 max-h-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            : "mx-auto flex max-h-[calc(100dvh-2rem)] max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl lg:max-h-[calc(100dvh-4rem)]"
        }
      >
        <header className="flex items-start justify-between gap-6 border-b border-border px-6 py-5 sm:px-8">
          <div>
            <h1 className="text-title text-foreground sm:text-3xl">
              {isEdit ? "Edit Bakery Order" : "Create Bakery Order"}
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              Design a custom cake or managed artisan order flow.
            </p>
          </div>
          <button
            aria-label="Close bakery order form"
            className="rounded-full p-2 text-foreground-muted transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            onClick={closeForm}
            type="button"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        {/* Below lg the whole body is one scroll: form, then summary, then
            Save. Splitting the height into two scroll windows left the form
            a third of the screen on a phone. From lg up the two columns
            scroll independently so the summary stays in view. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
          <section className="flex flex-col lg:min-h-0 lg:overflow-hidden">
            <div className="sticky top-0 z-10 border-b border-border bg-card px-5 py-3 sm:px-8 lg:static">
              <OrderFormTabs
                active={activeTab}
                itemsCount={items.length}
                onTabChange={setActiveTab}
                showProduction={isEdit}
              />
            </div>
            {/* One panel element that swaps, which is what `aria-controls` on
                every tab points at. Only the selected section renders; the
                field state lives above, so nothing typed is lost. */}
            <div
              className="px-5 py-6 sm:px-8 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain"
              id={ORDER_FORM_TABPANEL_ID}
              role="tabpanel"
              tabIndex={-1}
            >
              {activeTab === "customer" ? (
                <OrderFormSection
                  action={
                    <span className="rounded-full border border-border px-3 py-1 text-meta font-medium text-foreground-muted">
                      {customerName ?? "Walk-in customer"}
                    </span>
                  }
                  description="Who the order is for and how to reach them."
                  title="Customer details"
                >
                  <OrderCustomerSelector
                    customerId={customerId}
                    customerName={customerName}
                    customerPhone={customerPhone}
                    onCustomerChange={(customer) => {
                      setCustomerId(customer.id);
                      setCustomerName(customer.name);
                      setCustomerPhone(customer.phone);
                    }}
                  />
                </OrderFormSection>
              ) : null}

              {activeTab === "schedule" ? (
                <OrderFormSection
                  description="Branch, sales channel, event date, and pickup or delivery."
                  title="Logistics and scheduling"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <label
                        className="text-sm font-semibold text-foreground"
                        htmlFor="bakeryOrderBranch"
                      >
                        Branch
                      </label>
                      <SearchableCombobox
                        emptyMessage="No matching branches found."
                        id="bakeryOrderBranch"
                        onValueChange={setBranchId}
                        options={branchOptions}
                        placeholder="Select branch"
                        searchPlaceholder="Search branch, code..."
                        value={branchId}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label
                        className="text-sm font-semibold text-foreground"
                        htmlFor="bakeryOrderChannel"
                      >
                        Sales Channel
                      </label>
                      <SearchableCombobox
                        emptyMessage="No active sales channels found."
                        id="bakeryOrderChannel"
                        onValueChange={setSalesChannelId}
                        options={salesChannelOptions}
                        placeholder="Default sales channel"
                        searchPlaceholder="Search channel..."
                        value={salesChannelId}
                      />
                      <button
                        className="w-fit text-xs font-bold text-foreground-muted underline-offset-4 hover:text-foreground hover:underline"
                        onClick={() => {
                          setSalesChannelId("");
                          setExternalOrderNumber("");
                        }}
                        type="button"
                      >
                        Use default channel
                      </button>
                    </div>
                    {selectedSalesChannel?.requiresExternalOrderNumber ? (
                      <div className="grid gap-2 md:col-span-2">
                        <label
                          className="text-sm font-semibold text-foreground"
                          htmlFor="bakeryOrderExternalNumber"
                        >
                          External order number
                        </label>
                        <Input
                          aria-label="External order number"
                          id="bakeryOrderExternalNumber"
                          onChange={(event) => setExternalOrderNumber(event.target.value)}
                          placeholder="Platform / partner order number"
                          value={externalOrderNumber}
                        />
                        <p className="text-xs text-foreground-muted">
                          Required for {selectedSalesChannel.channelName}.
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-5">
                    <OrderScheduleCard
                      deliveryAddress={deliveryAddress}
                      deliveryTime={deliveryTime}
                      eventDate={eventDate}
                      notes={notes}
                      onChange={(patch) => {
                        setOrderType(patch.orderType ?? orderType);
                        setEventDate(patch.eventDate ?? eventDate);
                        setPickupTime(patch.pickupTime ?? pickupTime);
                        setDeliveryTime(patch.deliveryTime ?? deliveryTime);
                        setDeliveryAddress(patch.deliveryAddress ?? deliveryAddress);
                        setNotes(patch.notes ?? notes);
                      }}
                      orderType={orderType}
                      pickupTime={pickupTime}
                    />
                  </div>
                </OrderFormSection>
              ) : null}

              {activeTab === "items" ? (
                <OrderFormSection
                  description="Cakes, made-to-order items, and custom notes."
                  title="Order items"
                >
                  <OrderItemsSection
                    items={items}
                    onChange={setItems}
                    products={productsQuery.data?.items ?? []}
                    units={referenceQuery.data?.units ?? []}
                  />
                </OrderFormSection>
              ) : null}

              {activeTab === "charges" ? (
                <OrderFormSection
                  description="Delivery, service, and other charges on top of the items."
                  title="Charges"
                >
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <DocumentChargesEditor
                      charges={charges}
                      onChange={setCharges}
                      taxRates={referenceQuery.data?.taxRates ?? []}
                    />
                  </div>
                </OrderFormSection>
              ) : null}

              {activeTab === "packaging" ? (
                <OrderFormSection
                  description="Boxes, boards, and other packaging this order needs."
                  title="Packaging"
                >
                  <OrderPackagingSection
                    canManage={canManage}
                    draftPackaging={draftPackaging}
                    onDraftPackagingChange={setDraftPackaging}
                    order={order}
                  />
                </OrderFormSection>
              ) : null}

              {activeTab === "production" && isEdit ? (
                <OrderFormSection
                  description="Link this order to a batch or create production from an item."
                  title="Production control"
                >
                  <OrderProductionSection canManage={canManage} order={order} />
                </OrderFormSection>
              ) : null}
            </div>
          </section>

          <aside className="border-t border-border bg-muted px-5 py-5 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-t-0">
            <div className="space-y-5 lg:sticky lg:top-0">
              <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border bg-muted px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-body font-medium text-foreground">Order Summary</h2>
                    {showPreviewLoading ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground-muted">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Previewing
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-3 px-5 py-5 text-sm text-foreground-muted">
                  {showPreviewError ? (
                    <div className="rounded-xl border border-danger/30 bg-danger-tint px-3 py-2 text-xs font-medium text-danger-text">
                      Draft preview failed: {getErrorMessage(previewQuery.error)}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-4">
                    <span>VAT mode</span>
                    {order ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground-muted">
                        {order.taxMode === "no_tax"
                          ? "No tax"
                          : order.taxMode === "exclusive"
                            ? "Exclusive"
                            : "Inclusive"}
                      </span>
                    ) : (
                      <select
                        className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                        onChange={(event) => setTaxMode(event.target.value as typeof taxMode)}
                        value={taxMode}
                      >
                        <option value="">Business default</option>
                        <option value="inclusive">Inclusive</option>
                        <option value="exclusive">Exclusive</option>
                        {hasAnyPermission([PERMISSIONS.salesNoTaxApply]) ? (
                          <option value="no_tax">No tax</option>
                        ) : null}
                      </select>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Subtotal ({formatCurrency(itemQuantity)} items)</span>
                    <span className="font-mono text-foreground">
                      {formatCurrency(summarySubtotal)} AED
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Discount</span>
                    <span className="font-mono text-foreground">
                      {formatCurrency(summaryDiscount)} AED
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Item tax</span>
                    <span className="font-mono text-foreground">
                      {formatCurrency(summaryTax)} AED
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Charges</span>
                    <span className="font-mono text-foreground">
                      {formatCurrency(summaryChargeAmount)} AED
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Charge tax</span>
                    <span className="font-mono text-foreground">
                      {formatCurrency(summaryChargeTax)} AED
                    </span>
                  </div>
                  <div className="border-t border-border pt-4">
                    <p className="text-meta font-medium text-foreground-muted">Total Amount</p>
                    <div className="mt-2 flex items-end justify-between gap-4">
                      <span className="font-mono text-title text-foreground">
                        {formatCurrency(summaryTotal)} AED
                      </span>
                      <span className="rounded-full border border-border px-2 py-1 text-xs font-bold uppercase text-foreground-muted">
                        {order?.paymentStatus ?? "Draft"}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {isEdit ? (
                <OrderPaymentSection canManage={canManage} order={order} />
              ) : (
                <section className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-body font-medium text-foreground">
                      <CircleDollarSign className="h-4 w-4" />
                      Payment Status
                    </h2>
                    <span className="rounded-full bg-muted px-3 py-1 text-meta font-medium uppercase text-foreground-muted">
                      Draft
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-foreground-muted">
                    Payments can be recorded once the order draft is saved. Use partial deposits for
                    custom cake bookings.
                  </p>
                </section>
              )}

              <div className="space-y-3">
                <Button
                  className="h-14 w-full rounded-lg bg-primary text-body font-medium text-primary-foreground shadow-lg shadow-black/15 hover:bg-primary"
                  disabled={!canManage || saving}
                  onClick={() => void save()}
                  type="button"
                >
                  {saving ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  {isEdit ? "Save Changes" : "Save Bakery Order"}
                </Button>
                <Button
                  className="h-12 w-full rounded-lg border-border bg-card text-base font-bold text-foreground hover:bg-muted"
                  onClick={closeForm}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>

              <div className="flex flex-wrap gap-3 text-meta font-medium uppercase text-foreground-muted">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-money" />
                  Inventory: Valid
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-info" />
                  Branch:{" "}
                  {branchOptions.find((branch) => branch.value === branchId)?.label ?? "Main"}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
