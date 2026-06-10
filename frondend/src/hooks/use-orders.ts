"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  addOrderItem,
  addOrderPackaging,
  addOrderPayment,
  assignOrderProduction,
  convertOrderItemToProduct,
  convertOrderItemToVariant,
  createOrder,
  createOrderItemProduction,
  deleteOrder,
  deleteOrderItem,
  getOrderById,
  getOrderPackaging,
  getOrderPayments,
  getOrders,
  getOrderSummary,
  updateOrder,
  updateOrderItem,
  updateOrderProductionStatus,
  updateOrderStatus,
} from "@/lib/api/orders";
import type {
  AddOrderPackagingPayload,
  AddOrderPaymentPayload,
  AssignOrderProductionPayload,
  BakeryOrder,
  BakeryOrderFilters,
  BakeryOrderItem,
  BakeryOrderPackaging,
  BakeryOrderPayment,
  BakeryOrderSummary,
  ConvertOrderItemToProductPayload,
  ConvertOrderItemToVariantPayload,
  CreateOrderItemPayload,
  CreateOrderItemProductionPayload,
  CreateOrderPayload,
  UpdateOrderItemPayload,
  UpdateOrderPayload,
  UpdateOrderProductionStatusPayload,
  UpdateOrderStatusPayload,
} from "@/types/orders";

const ordersQueryKey = "orders";

export function useOrders(filters: BakeryOrderFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<BakeryOrder[]>({
    queryKey: [ordersQueryKey, branchQueryKey, "list", filters],
    queryFn: async () => getOrders(filters),
    enabled,
  });
}

export function useOrder(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<BakeryOrder>({
    queryKey: [ordersQueryKey, branchQueryKey, "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Order ID is required.");
      }

      return getOrderById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useOrderSummary(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<BakeryOrderSummary>({
    queryKey: [ordersQueryKey, branchQueryKey, "summary"],
    queryFn: async () => getOrderSummary(),
    enabled,
  });
}

export function useOrderPayments(orderId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<BakeryOrderPayment[]>({
    queryKey: [ordersQueryKey, branchQueryKey, "payments", orderId],
    queryFn: async () => {
      if (!orderId) {
        throw new Error("Order ID is required.");
      }

      return getOrderPayments(orderId);
    },
    enabled: enabled && orderId !== null,
  });
}

export function useOrderPackaging(orderId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<BakeryOrderPackaging[]>({
    queryKey: [ordersQueryKey, branchQueryKey, "packaging", orderId],
    queryFn: async () => {
      if (!orderId) {
        throw new Error("Order ID is required.");
      }

      return getOrderPackaging(orderId);
    },
    enabled: enabled && orderId !== null,
  });
}

function invalidateOrders(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [ordersQueryKey] }),
    queryClient.invalidateQueries({ queryKey: ["products"] }),
    queryClient.invalidateQueries({ queryKey: ["pos"] }),
  ]);
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation<BakeryOrder, Error, CreateOrderPayload>({
    mutationFn: async (payload) => createOrder(payload),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation<BakeryOrder, Error, { id: string; payload: UpdateOrderPayload }>({
    mutationFn: async ({ id, payload }) => updateOrder(id, payload),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation<BakeryOrder, Error, { id: string; payload: UpdateOrderStatusPayload }>({
    mutationFn: async ({ id, payload }) => updateOrderStatus(id, payload),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteOrder(id),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}

export function useAddOrderItem() {
  const queryClient = useQueryClient();

  return useMutation<BakeryOrderItem, Error, { orderId: string; payload: CreateOrderItemPayload }>({
    mutationFn: async ({ orderId, payload }) => addOrderItem(orderId, payload),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}

export function useUpdateOrderItem() {
  const queryClient = useQueryClient();

  return useMutation<
    BakeryOrderItem,
    Error,
    { itemId: string; orderId: string; payload: UpdateOrderItemPayload }
  >({
    mutationFn: async ({ itemId, orderId, payload }) => updateOrderItem(orderId, itemId, payload),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}

export function useDeleteOrderItem() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { itemId: string; orderId: string }>({
    mutationFn: async ({ itemId, orderId }) => deleteOrderItem(orderId, itemId),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}

export function useConvertOrderItemToProduct() {
  const queryClient = useQueryClient();

  return useMutation<
    BakeryOrderItem,
    Error,
    { itemId: string; orderId: string; payload: ConvertOrderItemToProductPayload }
  >({
    mutationFn: async ({ itemId, orderId, payload }) =>
      convertOrderItemToProduct(orderId, itemId, payload),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}

export function useConvertOrderItemToVariant() {
  const queryClient = useQueryClient();

  return useMutation<
    BakeryOrderItem,
    Error,
    { itemId: string; orderId: string; payload: ConvertOrderItemToVariantPayload }
  >({
    mutationFn: async ({ itemId, orderId, payload }) =>
      convertOrderItemToVariant(orderId, itemId, payload),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}

export function useAddOrderPayment() {
  const queryClient = useQueryClient();

  return useMutation<
    BakeryOrderPayment,
    Error,
    { orderId: string; payload: AddOrderPaymentPayload }
  >({
    mutationFn: async ({ orderId, payload }) => addOrderPayment(orderId, payload),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}

export function useAssignProduction() {
  const queryClient = useQueryClient();

  return useMutation<
    BakeryOrder,
    Error,
    { orderId: string; payload: AssignOrderProductionPayload }
  >({
    mutationFn: async ({ orderId, payload }) => assignOrderProduction(orderId, payload),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}

export function useCreateOrderItemProduction() {
  const queryClient = useQueryClient();

  return useMutation<
    BakeryOrder,
    Error,
    { itemId: string; orderId: string; payload: CreateOrderItemProductionPayload }
  >({
    mutationFn: async ({ itemId, orderId, payload }) =>
      createOrderItemProduction(orderId, itemId, payload),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}

export function useUpdateOrderProductionStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    BakeryOrder,
    Error,
    { orderId: string; payload: UpdateOrderProductionStatusPayload }
  >({
    mutationFn: async ({ orderId, payload }) => updateOrderProductionStatus(orderId, payload),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}

export function useAddOrderPackaging() {
  const queryClient = useQueryClient();

  return useMutation<
    BakeryOrderPackaging,
    Error,
    { orderId: string; payload: AddOrderPackagingPayload }
  >({
    mutationFn: async ({ orderId, payload }) => addOrderPackaging(orderId, payload),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}
