"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/orders/access-denied-card";
import { OrderCustomerSelector } from "@/components/orders/order-customer-selector";
import { OrderHeader } from "@/components/orders/order-header";
import { OrderItemsSection } from "@/components/orders/order-items-section";
import { OrderPackagingSection } from "@/components/orders/order-packaging-section";
import { OrderPaymentSection } from "@/components/orders/order-payment-section";
import { OrderProductionSection } from "@/components/orders/order-production-section";
import { OrderScheduleCard } from "@/components/orders/order-schedule-card";
import { OrdersErrorState } from "@/components/orders/orders-error-state";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useBranches } from "@/hooks/use-branches";
import { useAddOrderPackaging, useCreateOrder, useOrder, useUpdateOrder } from "@/hooks/use-orders";
import { usePermission } from "@/hooks/use-permission";
import { useProductReferenceData, useProducts } from "@/hooks/use-products";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { createOrderSchema } from "@/lib/validators/orders.schema";
import type { Branch } from "@/types/branch";
import type {
  AddOrderPackagingPayload,
  CreateOrderItemPayload,
  CreateOrderPayload,
  OrderType,
} from "@/types/orders";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function isPermissionDenied(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

function mapOrderToItems(items: CreateOrderItemPayload[]): CreateOrderItemPayload[] {
  return items.map((item) => ({ ...item }));
}

export function OrderFormPage({ orderId }: { orderId: string | null }): JSX.Element {
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
  const productsQuery = useProducts(
    {
      categoryId: "",
      isPosVisible: "all",
      limit: 100,
      page: 1,
      productType: "all",
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

  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [eventDate, setEventDate] = useState(today());
  const [pickupTime, setPickupTime] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<CreateOrderItemPayload[]>([]);
  const [draftPackaging, setDraftPackaging] = useState<AddOrderPackagingPayload[]>([]);

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
    setOrderType(order.orderType);
    setEventDate(order.eventDate.slice(0, 10));
    setPickupTime(order.pickupTime ?? "");
    setDeliveryTime(order.deliveryTime ?? "");
    setDeliveryAddress(order.deliveryAddress ?? "");
    setNotes(order.notes ?? "");
    setDraftPackaging([]);
    setItems(
      mapOrderToItems(
        order.items.map((item) => ({
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
        })),
      ),
    );
  }, [orderQuery.data]);

  const buildPayload = (): CreateOrderPayload => ({
    branchId,
    customerId,
    customerName,
    customerPhone,
    deliveryAddress: orderType === "delivery" ? deliveryAddress || null : null,
    deliveryTime: orderType === "delivery" ? deliveryTime || null : null,
    eventDate,
    items,
    notes: notes || null,
    orderType,
    pickupTime: orderType === "pickup" ? pickupTime || null : null,
  });

  const save = async (): Promise<void> => {
    const payload = buildPayload();
    const result = createOrderSchema.safeParse(payload);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Please check order details.");
      return;
    }

    try {
      if (orderId) {
        await updateMutation.mutateAsync({ id: orderId, payload: result.data });
        toast.success("Order updated.");
      } else {
        const created = await createMutation.mutateAsync(result.data);
        await Promise.all(
          draftPackaging.map((payload) =>
            addPackagingMutation.mutateAsync({ orderId: created.id, payload }),
          ),
        );
        toast.success("Order created.");
        router.replace(`/orders/${created.id}`);
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

  const order = orderQuery.data ?? null;

  return (
    <main className="min-h-screen bg-brand-latte px-6 py-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <OrderHeader
          canManage={canManage}
          isSaving={
            createMutation.isPending || updateMutation.isPending || addPackagingMutation.isPending
          }
          onSave={() => void save()}
          order={order}
        />
        <section className="rounded-3xl border border-brand-cappuccino/60 bg-white/85 p-5">
          <h2 className="text-xl font-semibold text-brand-espresso">Branch</h2>
          <div className="mt-4 max-w-xl">
            <SearchableCombobox
              emptyMessage="No matching branches found."
              onValueChange={setBranchId}
              options={branchOptions}
              placeholder="Select branch"
              searchPlaceholder="Search branch, code..."
              value={branchId}
            />
          </div>
        </section>
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="grid gap-6">
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
            <OrderItemsSection
              items={items}
              onChange={setItems}
              products={productsQuery.data?.items ?? []}
              units={referenceQuery.data?.units ?? []}
            />
          </div>
          <div className="grid content-start gap-6">
            <OrderPaymentSection canManage={canManage} order={order} />
            <OrderProductionSection canManage={canManage} order={order} />
            <OrderPackagingSection
              canManage={canManage}
              draftPackaging={draftPackaging}
              onDraftPackagingChange={setDraftPackaging}
              order={order}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
