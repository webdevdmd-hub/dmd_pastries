"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { ProductsAccessDeniedCard } from "@/components/products/access-denied-card";
import {
  parseProductDetailTab,
  type ProductDetailTabKey,
} from "@/components/products/product-detail-tabs";
import { ProductDetailsPanel } from "@/components/products/product-details-panel";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { ProductStatusBadge } from "@/components/products/product-status-badge";
import { ProductVariantFormDialog } from "@/components/products/product-variant-form-dialog";
import { ProductsTableSkeleton } from "@/components/products/products-table-skeleton";
import { FailedState } from "@/components/shared/collection-state";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import {
  useCreateProductVariant,
  useDeleteProductVariant,
  useProduct,
  useProductReferenceData,
  useProductVariants,
  useUpdateProduct,
  useUpdateProductVariant,
} from "@/hooks/use-products";
import { getErrorMessage } from "@/lib/api/client";
import type {
  CreateProductVariantPayload,
  ProductVariant,
  UpdateProductPayload,
  UpdateProductVariantPayload,
} from "@/types/product";

/**
 * The full page for one product, at /products/[id]. It shares the details
 * panel with the drawer over the catalogue; the tab lives in `?tab=` here so
 * a link can land on Variants.
 */
export function ProductDetailsPageClient({ productId }: { productId: string }): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.productsView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.productsCreate,
    PERMISSIONS.productsEdit,
    PERMISSIONS.productsDelete,
    PERMISSIONS.productsStatusUpdate,
    PERMISSIONS.productsVariantsManage,
  ]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const productQuery = useProduct(productId, canView);
  const variantsQuery = useProductVariants(productId, canView);
  const referenceDataQuery = useProductReferenceData(canView && editOpen);
  const updateProductMutation = useUpdateProduct();
  const createVariantMutation = useCreateProductVariant();
  const updateVariantMutation = useUpdateProductVariant();
  const deleteVariantMutation = useDeleteProductVariant();

  const activeTab = parseProductDetailTab(searchParams.get("tab"));

  const changeTab = (tab: ProductDetailTabKey): void => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (!canView) {
    return <ProductsAccessDeniedCard />;
  }

  if (productQuery.isLoading) {
    return <ProductsTableSkeleton />;
  }

  if (productQuery.error || !productQuery.data) {
    return (
      <FailedState
        detail={productQuery.error ? getErrorMessage(productQuery.error) : "Product not found."}
        noun="product"
        onRetry={() => {
          void productQuery.refetch();
        }}
      />
    );
  }

  const product = productQuery.data;

  const submitProductUpdate = async (id: string, payload: UpdateProductPayload): Promise<void> => {
    try {
      await updateProductMutation.mutateAsync({ id, payload });
      toast.success("Product updated successfully.");
      setEditOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const submitVariantCreate = async (payload: CreateProductVariantPayload): Promise<void> => {
    try {
      await createVariantMutation.mutateAsync({ productId: product.id, payload });
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
    try {
      await updateVariantMutation.mutateAsync({ productId: product.id, variantId, payload });
      toast.success("Variant updated successfully.");
      setVariantOpen(false);
      setSelectedVariant(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            className="inline-flex items-center gap-1.5 text-cell text-foreground-muted transition-colors hover:text-foreground"
            href={ROUTES.products}
          >
            Back to products
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-page">{product.productName}</h1>
            <ProductStatusBadge status={product.status} />
          </div>
          <p className="mt-1 text-meta text-foreground-muted">
            <span className="font-mono">{product.productCode}</span> · {product.categoryName} ·{" "}
            {product.unitName}
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setEditOpen(true)} type="button" variant="outline">
            <Pencil className="h-4 w-4" />
            Edit product
          </Button>
        ) : null}
      </div>

      <ProductDetailsPanel
        activeTab={activeTab}
        canManage={canManage}
        onAddVariant={() => {
          setSelectedVariant(null);
          setVariantOpen(true);
        }}
        onDeleteVariant={(variant) => {
          void deleteVariantMutation
            .mutateAsync({ productId: product.id, variantId: variant.id })
            .then(() => toast.success("Variant deleted."))
            .catch((error: unknown) => toast.error(getErrorMessage(error)));
        }}
        onEditVariant={(variant) => {
          setSelectedVariant(variant);
          setVariantOpen(true);
        }}
        onTabChange={changeTab}
        product={product}
        variants={variantsQuery.data ?? product.variants}
      />

      <ProductFormDialog
        onClose={() => setEditOpen(false)}
        onCreate={() => Promise.resolve()}
        onUpdate={submitProductUpdate}
        open={editOpen}
        product={product}
        referenceData={referenceDataQuery.data ?? { categories: [], units: [], taxRates: [] }}
        submitting={updateProductMutation.isPending}
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
    </div>
  );
}
