"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  copyCategories,
  createOrderStatus,
  createPaymentStatus,
  createProductCategory,
  createSimpleCategory,
  createUnit,
  deleteProductCategory,
  deleteSimpleCategory,
  deleteUnit,
  getMasterDataOverview,
  getOrderStatuses,
  getPaymentStatuses,
  getProductCategories,
  getProductCategoryById,
  getSimpleCategories,
  getSimpleCategoryById,
  getUnitById,
  getUnitCategories,
  getUnits,
  updateOrderStatus,
  updateOrderStatusStatus,
  updatePaymentStatus,
  updatePaymentStatusStatus,
  updateProductCategory,
  updateProductCategoryStatus,
  updateSimpleCategory,
  updateSimpleCategoryStatus,
  updateUnit,
  updateUnitStatus,
} from "@/lib/api/master-data";
import { invalidateMasterDataMutation } from "@/lib/query-invalidation";
import type {
  CopyCategoriesPayload,
  CopyCategoriesResult,
  CreateOrderStatusPayload,
  CreatePaymentStatusPayload,
  CreateProductCategoryPayload,
  CreateSimpleCategoryPayload,
  CreateUnitPayload,
  ManageableSimpleCategoryCollection,
  MasterDataCollection,
  OrderStatus,
  PaymentStatus,
  ProductCategory,
  SimpleCategory,
  Unit,
  UpdateMasterDataStatusPayload,
  UpdateOrderStatusPayload,
  UpdatePaymentStatusPayload,
  UpdateProductCategoryPayload,
  UpdateSimpleCategoryPayload,
  UpdateUnitPayload,
} from "@/types/master-data";
import type { ProductType } from "@/types/product";

const masterDataQueryKey = "master-data";

export function useMasterDataOverview(enabled = true) {
  return useQuery({
    queryKey: [masterDataQueryKey, "overview"],
    queryFn: async () => getMasterDataOverview(),
    enabled,
  });
}

export function useUnitCategories(enabled = true) {
  return useQuery({
    queryKey: [masterDataQueryKey, "unit-categories"],
    queryFn: async () => getUnitCategories(),
    enabled,
  });
}

export function useUnits(enabled = true) {
  return useQuery({
    queryKey: [masterDataQueryKey, "units"],
    queryFn: async () => getUnits(),
    enabled,
  });
}

export function useUnit(id: string | null, enabled = true) {
  return useQuery({
    queryKey: [masterDataQueryKey, "units", "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Unit ID is required.");
      }

      return getUnitById(id);
    },
    enabled: enabled && id !== null,
  });
}

function invalidateUnits(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return invalidateMasterDataMutation(queryClient);
}

export function useCreateUnit() {
  const queryClient = useQueryClient();

  return useMutation<Unit, Error, CreateUnitPayload>({
    mutationFn: async (payload) => createUnit(payload),
    onSuccess: async () => {
      await invalidateUnits(queryClient);
    },
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();

  return useMutation<
    Unit,
    Error,
    {
      id: string;
      payload: UpdateUnitPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateUnit(id, payload),
    onSuccess: async (unit) => {
      queryClient.setQueryData([masterDataQueryKey, "units", "detail", unit.id], unit);
      await invalidateUnits(queryClient);
    },
  });
}

export function useUpdateUnitStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    Unit,
    Error,
    {
      id: string;
      payload: UpdateMasterDataStatusPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateUnitStatus(id, payload),
    onSuccess: async (unit) => {
      queryClient.setQueryData([masterDataQueryKey, "units", "detail", unit.id], unit);
      await invalidateUnits(queryClient);
    },
  });
}

export function useDeleteUnit() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteUnit(id),
    onSuccess: async () => {
      await invalidateUnits(queryClient);
    },
  });
}

type ProductCategoryFilters = {
  productType?: ProductType | "all";
};

export function useProductCategories(enabled = true, filters: ProductCategoryFilters = {}) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery({
    queryKey: [
      masterDataQueryKey,
      branchQueryKey,
      "product-categories",
      filters.productType ?? "all",
    ],
    queryFn: async () => getProductCategories(filters),
    enabled,
  });
}

export function useProductCategory(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery({
    queryKey: [masterDataQueryKey, branchQueryKey, "product-categories", "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Product category ID is required.");
      }

      return getProductCategoryById(id);
    },
    enabled: enabled && id !== null,
  });
}

function invalidateProductCategories(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<unknown[]> {
  return invalidateMasterDataMutation(queryClient);
}

export function useCreateProductCategory() {
  const queryClient = useQueryClient();

  return useMutation<ProductCategory, Error, CreateProductCategoryPayload>({
    mutationFn: async (payload) => createProductCategory(payload),
    onSuccess: async () => {
      await invalidateProductCategories(queryClient);
    },
  });
}

export function useUpdateProductCategory() {
  const queryClient = useQueryClient();

  return useMutation<
    ProductCategory,
    Error,
    {
      id: string;
      payload: UpdateProductCategoryPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateProductCategory(id, payload),
    onSuccess: async () => {
      await invalidateProductCategories(queryClient);
    },
  });
}

export function useUpdateProductCategoryStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    ProductCategory,
    Error,
    {
      id: string;
      payload: UpdateMasterDataStatusPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateProductCategoryStatus(id, payload),
    onSuccess: async () => {
      await invalidateProductCategories(queryClient);
    },
  });
}

export function useDeleteProductCategory() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteProductCategory(id),
    onSuccess: async () => {
      await invalidateProductCategories(queryClient);
    },
  });
}

export function useCopyCategories() {
  const queryClient = useQueryClient();

  return useMutation<CopyCategoriesResult, Error, CopyCategoriesPayload>({
    mutationFn: async (payload) => copyCategories(payload),
    onSuccess: async () => {
      await invalidateMasterDataMutation(queryClient);
    },
  });
}

export function useSimpleCategories(
  collection: Extract<MasterDataCollection, "ingredient-categories" | "packaging-categories">,
  enabled = true,
) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery({
    queryKey: [masterDataQueryKey, branchQueryKey, collection],
    queryFn: async () => getSimpleCategories(collection),
    enabled,
  });
}

export function useSimpleCategory(
  collection: ManageableSimpleCategoryCollection,
  id: string | null,
  enabled = true,
) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery({
    queryKey: [masterDataQueryKey, branchQueryKey, collection, "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Category ID is required.");
      }

      return getSimpleCategoryById(collection, id);
    },
    enabled: enabled && id !== null,
  });
}

function invalidateSimpleCategories(
  queryClient: ReturnType<typeof useQueryClient>,
  collection: ManageableSimpleCategoryCollection,
): Promise<unknown[]> {
  void collection;
  return invalidateMasterDataMutation(queryClient);
}

export function useCreateSimpleCategory(collection: ManageableSimpleCategoryCollection) {
  const queryClient = useQueryClient();

  return useMutation<SimpleCategory, Error, CreateSimpleCategoryPayload>({
    mutationFn: async (payload) => createSimpleCategory(collection, payload),
    onSuccess: async () => {
      await invalidateSimpleCategories(queryClient, collection);
    },
  });
}

export function useUpdateSimpleCategory(collection: ManageableSimpleCategoryCollection) {
  const queryClient = useQueryClient();

  return useMutation<
    SimpleCategory,
    Error,
    {
      id: string;
      payload: UpdateSimpleCategoryPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateSimpleCategory(collection, id, payload),
    onSuccess: async () => {
      await invalidateSimpleCategories(queryClient, collection);
    },
  });
}

export function useUpdateSimpleCategoryStatus(collection: ManageableSimpleCategoryCollection) {
  const queryClient = useQueryClient();

  return useMutation<
    SimpleCategory,
    Error,
    {
      id: string;
      payload: UpdateMasterDataStatusPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateSimpleCategoryStatus(collection, id, payload),
    onSuccess: async () => {
      await invalidateSimpleCategories(queryClient, collection);
    },
  });
}

export function useDeleteSimpleCategory(collection: ManageableSimpleCategoryCollection) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteSimpleCategory(collection, id),
    onSuccess: async () => {
      await invalidateSimpleCategories(queryClient, collection);
    },
  });
}

export function useOrderStatuses(enabled = true) {
  return useQuery({
    queryKey: [masterDataQueryKey, "order-statuses"],
    queryFn: async () => getOrderStatuses(),
    enabled,
  });
}

function invalidateOrderStatuses(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<unknown[]> {
  return invalidateMasterDataMutation(queryClient);
}

export function useCreateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation<OrderStatus, Error, CreateOrderStatusPayload>({
    mutationFn: async (payload) => createOrderStatus(payload),
    onSuccess: async () => {
      await invalidateOrderStatuses(queryClient);
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    OrderStatus,
    Error,
    {
      id: string;
      payload: UpdateOrderStatusPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateOrderStatus(id, payload),
    onSuccess: async () => {
      await invalidateOrderStatuses(queryClient);
    },
  });
}

export function useUpdateOrderStatusStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    OrderStatus,
    Error,
    {
      id: string;
      payload: UpdateMasterDataStatusPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateOrderStatusStatus(id, payload),
    onSuccess: async () => {
      await invalidateOrderStatuses(queryClient);
    },
  });
}

export function usePaymentStatuses(enabled = true) {
  return useQuery({
    queryKey: [masterDataQueryKey, "payment-statuses"],
    queryFn: async () => getPaymentStatuses(),
    enabled,
  });
}

function invalidatePaymentStatuses(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<unknown[]> {
  return invalidateMasterDataMutation(queryClient);
}

export function useCreatePaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation<PaymentStatus, Error, CreatePaymentStatusPayload>({
    mutationFn: async (payload) => createPaymentStatus(payload),
    onSuccess: async () => {
      await invalidatePaymentStatuses(queryClient);
    },
  });
}

export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    PaymentStatus,
    Error,
    {
      id: string;
      payload: UpdatePaymentStatusPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updatePaymentStatus(id, payload),
    onSuccess: async () => {
      await invalidatePaymentStatuses(queryClient);
    },
  });
}

export function useUpdatePaymentStatusStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    PaymentStatus,
    Error,
    {
      id: string;
      payload: UpdateMasterDataStatusPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updatePaymentStatusStatus(id, payload),
    onSuccess: async () => {
      await invalidatePaymentStatuses(queryClient);
    },
  });
}
