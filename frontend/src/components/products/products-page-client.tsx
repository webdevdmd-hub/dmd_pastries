"use client";

import { Box, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ProductsAccessDeniedCard } from "@/components/products/access-denied-card";
import { ProductDetailsDrawer } from "@/components/products/product-details-drawer";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { ProductVariantFormDialog } from "@/components/products/product-variant-form-dialog";
import { ProductsEmptyState } from "@/components/products/products-empty-state";
import { ProductsErrorState } from "@/components/products/products-error-state";
import { ProductsTable } from "@/components/products/products-table";
import { ProductsTableSkeleton } from "@/components/products/products-table-skeleton";
import { ProductsToolbar } from "@/components/products/products-toolbar";
import { PageHeader } from "@/components/shared/page-header";
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
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import {
  useCreateProduct,
  useCreateProductVariant,
  useDeleteProduct,
  useDeleteProductVariant,
  useProductReferenceData,
  useProducts,
  useProductVariants,
  useUpdateProduct,
  useUpdateProductStatus,
  useUpdateProductVariant,
} from "@/hooks/use-products";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type {
  CreateProductPayload,
  CreateProductVariantPayload,
  Product,
  ProductListFilters,
  ProductStatus,
  ProductVariant,
  UpdateProductPayload,
  UpdateProductVariantPayload,
} from "@/types/product";

const initialFilters: ProductListFilters = {
  search: "",
  categoryId: "all",
  productType: "all",
  status: "all",
  isPosVisible: "all",
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "desc",
};

export function ProductsPageClient(): JSX.Element {
  const router = useRouter();
  const { logout } = useAuth();
  const { hasAnyPermission } = usePermission();
  const [filters, setFilters] = useState<ProductListFilters>(initialFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [confirmState, setConfirmState] = useState<{
    action: "delete" | "status";
    nextStatus?: ProductStatus;
    product: Product;
  } | null>(null);

  const canViewProducts = hasAnyPermission([PERMISSIONS.productsView]);
  const canCreateProducts = hasAnyPermission([PERMISSIONS.productsCreate]);
  const canManageProducts = hasAnyPermission([
    PERMISSIONS.productsCreate,
    PERMISSIONS.productsEdit,
    PERMISSIONS.productsDelete,
    PERMISSIONS.productsStatusUpdate,
    PERMISSIONS.productsVariantsManage,
  ]);
  const productsQuery = useProducts(filters, canViewProducts);
  const referenceDataQuery = useProductReferenceData(canViewProducts);
  const variantsQuery = useProductVariants(selectedProduct?.id ?? null, detailsOpen);
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const updateProductStatusMutation = useUpdateProductStatus();
  const deleteProductMutation = useDeleteProduct();
  const createVariantMutation = useCreateProductVariant();
  const updateVariantMutation = useUpdateProductVariant();
  const deleteVariantMutation = useDeleteProductVariant();
  const list = useMemo(() => productsQuery.data?.items ?? [], [productsQuery.data?.items]);
  const stats = useMemo(() => {
    const active = list.filter((product) => product.status === "active").length;
    const archived = list.filter((product) => product.status === "archived").length;
    const posVisible = list.filter((product) => product.isPosVisible).length;
    return {
      total: productsQuery.data?.total ?? list.length,
      active,
      archived,
      posVisible,
    };
  }, [list, productsQuery.data?.total]);

  if (!canViewProducts) {
    return <ProductsAccessDeniedCard />;
  }

  if (productsQuery.error instanceof ApiError && productsQuery.error.status === 401) {
    void logout().finally(() => router.replace(ROUTES.login));
  }

  const submitProductCreate = async (payload: CreateProductPayload): Promise<void> => {
    try {
      await createProductMutation.mutateAsync(payload);
      toast.success("Product created successfully.");
      setFormOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const submitProductUpdate = async (id: string, payload: UpdateProductPayload): Promise<void> => {
    try {
      await updateProductMutation.mutateAsync({ id, payload });
      toast.success("Product updated successfully.");
      setFormOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const submitVariantCreate = async (payload: CreateProductVariantPayload): Promise<void> => {
    if (!selectedProduct) {
      return;
    }
    try {
      await createVariantMutation.mutateAsync({ productId: selectedProduct.id, payload });
      toast.success("Variant created successfully.");
      setVariantOpen(false);
      setSelectedVariant(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const submitVariantUpdate = async (
    variantId: string,
    payload: UpdateProductVariantPayload,
  ): Promise<void> => {
    if (!selectedProduct) {
      return;
    }
    try {
      await updateVariantMutation.mutateAsync({
        productId: selectedProduct.id,
        variantId,
        payload,
      });
      toast.success("Variant updated successfully.");
      setVariantOpen(false);
      setSelectedVariant(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Products"
        description="Manage sellable items, bakery products, retail items, variants, pricing, tax, and POS visibility."
        actions={
          canCreateProducts ? (
            <Button
              onClick={() => {
                setSelectedProduct(null);
                setFormOpen(true);
              }}
            >
              <PlusCircle className="h-4 w-4" />
              Add Product
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-brand-mocha">Total Products</p>
            <p className="text-3xl font-semibold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-brand-mocha">Active Products</p>
            <p className="text-3xl font-semibold">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-brand-mocha">POS Visible</p>
            <p className="text-3xl font-semibold">{stats.posVisible}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-brand-mocha">Archived Products</p>
            <p className="text-3xl font-semibold">{stats.archived}</p>
          </CardContent>
        </Card>
      </div>

      <ProductsToolbar
        categories={referenceDataQuery.data?.categories ?? []}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {productsQuery.isLoading ? <ProductsTableSkeleton /> : null}
      {!productsQuery.isLoading && productsQuery.error ? (
        <ProductsErrorState
          description={getErrorMessage(productsQuery.error)}
          onRetry={() => {
            void productsQuery.refetch();
          }}
        />
      ) : null}
      {!productsQuery.isLoading && !productsQuery.error && list.length === 0 ? (
        <ProductsEmptyState
          canCreate={canCreateProducts}
          onCreate={() => {
            setSelectedProduct(null);
            setFormOpen(true);
          }}
        />
      ) : null}
      {!productsQuery.isLoading && !productsQuery.error && list.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <ProductsTable
              canManage={canManageProducts}
              onDelete={(product) => setConfirmState({ action: "delete", product })}
              onEdit={(product) => {
                setSelectedProduct(product);
                setFormOpen(true);
              }}
              onManageVariants={(product) => {
                setSelectedProduct(product);
                setDetailsOpen(true);
              }}
              onStatusChange={(product, status) =>
                setConfirmState({ action: "status", nextStatus: status, product })
              }
              onView={(product) => {
                setSelectedProduct(product);
                setDetailsOpen(true);
              }}
              products={list}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <Button
          disabled={filters.page <= 1}
          onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
          variant="outline"
        >
          Previous
        </Button>
        <p className="text-sm text-brand-mocha">
          Page {filters.page} /{" "}
          {Math.max(1, Math.ceil((productsQuery.data?.total ?? 0) / filters.limit))}
        </p>
        <Button
          disabled={(productsQuery.data?.items.length ?? 0) < filters.limit}
          onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
          variant="outline"
        >
          Next
        </Button>
      </div>

      <ProductFormDialog
        onClose={() => {
          setFormOpen(false);
          setSelectedProduct(null);
        }}
        onCreate={submitProductCreate}
        onUpdate={submitProductUpdate}
        open={formOpen}
        product={selectedProduct}
        referenceData={referenceDataQuery.data ?? { categories: [], units: [], taxRates: [] }}
        submitting={createProductMutation.isPending || updateProductMutation.isPending}
      />

      <ProductDetailsDrawer
        canManage={canManageProducts}
        onAddVariant={() => {
          setSelectedVariant(null);
          setVariantOpen(true);
        }}
        onDeleteVariant={(variant) => {
          if (!selectedProduct) {
            return;
          }
          void deleteVariantMutation
            .mutateAsync({ productId: selectedProduct.id, variantId: variant.id })
            .then(() => toast.success("Variant deleted."))
            .catch((error: unknown) => toast.error(getErrorMessage(error)));
        }}
        onEditVariant={(variant) => {
          setSelectedVariant(variant);
          setVariantOpen(true);
        }}
        onOpenChange={setDetailsOpen}
        open={detailsOpen}
        product={selectedProduct}
        variants={variantsQuery.data ?? selectedProduct?.variants ?? []}
      />

      <ProductVariantFormDialog
        onClose={() => {
          setVariantOpen(false);
          setSelectedVariant(null);
        }}
        onCreate={submitVariantCreate}
        onUpdate={submitVariantUpdate}
        open={variantOpen}
        submitting={createVariantMutation.isPending || updateVariantMutation.isPending}
        variant={selectedVariant}
      />

      <Dialog onOpenChange={(open) => !open && setConfirmState(null)} open={confirmState !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm action</DialogTitle>
            <DialogDescription>
              {confirmState?.action === "delete"
                ? `Delete ${confirmState.product.productName}?`
                : confirmState?.nextStatus
                  ? `Change status for ${confirmState.product.productName} to ${confirmState.nextStatus}?`
                  : "Confirm the selected product action."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setConfirmState(null)} variant="outline">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!confirmState) {
                  return;
                }

                if (confirmState.action === "delete") {
                  void deleteProductMutation
                    .mutateAsync(confirmState.product.id)
                    .then(() => {
                      toast.success("Product deleted.");
                      setConfirmState(null);
                    })
                    .catch((error: unknown) => toast.error(getErrorMessage(error)));
                  return;
                }

                if (confirmState.nextStatus) {
                  void updateProductStatusMutation
                    .mutateAsync({
                      id: confirmState.product.id,
                      payload: { status: confirmState.nextStatus },
                    })
                    .then(() => {
                      toast.success("Product status updated.");
                      setConfirmState(null);
                    })
                    .catch((error: unknown) => toast.error(getErrorMessage(error)));
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {referenceDataQuery.error ? (
        <Card className="border-amber-200 bg-amber-50/80">
          <CardContent className="p-4 text-sm text-amber-800">
            <div className="inline-flex items-center gap-2">
              <Box className="h-4 w-4" />
              Unable to load categories/units/tax rates. Product form options may be limited.
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
