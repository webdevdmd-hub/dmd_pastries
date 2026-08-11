"use client";

import { Box, Boxes, CircleDollarSign, Eye, PackageCheck, PlusCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInventory } from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import {
  useApplyProductPriceSuggestion,
  useBulkApplyProductPriceSuggestions,
  useCreateProduct,
  useCreateProductVariant,
  useDeleteProduct,
  useDeleteProductVariant,
  useDismissProductPriceSuggestion,
  useProductPriceSuggestions,
  useProductReferenceData,
  useProducts,
  useProductVariants,
  useUpdateProduct,
  useUpdateProductStatus,
  useUpdateProductVariant,
} from "@/hooks/use-products";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import {
  getHistoryDeleteConflictMessage,
  isHistoryDeleteConflict,
} from "@/lib/api/delete-conflicts";
import type { InventoryFilters } from "@/types/inventory";
import type {
  CreateProductPayload,
  CreateProductVariantPayload,
  Product,
  ProductListFilters,
  ProductPriceSuggestion,
  ProductStatus,
  ProductVariant,
  UpdateProductPayload,
  UpdateProductVariantPayload,
} from "@/types/product";
import { ITEM_STRUCTURES, PRODUCT_TYPES } from "@/types/product";

const initialFilters: ProductListFilters = {
  search: "",
  categoryId: "all",
  productType: "all",
  itemStructure: "all",
  status: "all",
  isPosVisible: "all",
  isSellable: "all",
  isPurchasable: "all",
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "desc",
};

function createProductCountFilters(overrides: Partial<ProductListFilters>): ProductListFilters {
  return {
    ...initialFilters,
    ...overrides,
    page: 1,
    limit: 1,
  };
}

const catalogCountFilters = createProductCountFilters({});
const activeCountFilters = createProductCountFilters({ status: "active" });
const productInventoryFilters: InventoryFilters = {
  branchId: "",
  expiryTrackedOnly: false,
  includeUninitialized: true,
  itemType: "all",
  lowStockOnly: false,
  productType: "all",
  search: "",
  status: "all",
};

function formatMoney(value: number): string {
  return `AED ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatQuantity(value: number): string {
  return value.toLocaleString("en-AE", { maximumFractionDigits: 3 });
}

type ProductSearchParams = {
  get: (name: string) => string | null;
};

function getProductTypeFilter(value: string | null): ProductListFilters["productType"] {
  return PRODUCT_TYPES.includes(value as (typeof PRODUCT_TYPES)[number])
    ? (value as ProductListFilters["productType"])
    : "all";
}

function getItemStructureFilter(value: string | null): ProductListFilters["itemStructure"] {
  return ITEM_STRUCTURES.includes(value as (typeof ITEM_STRUCTURES)[number])
    ? (value as ProductListFilters["itemStructure"])
    : "all";
}

function getProductStatusFilter(value: string | null): ProductListFilters["status"] {
  return value === "active" || value === "inactive" || value === "archived" ? value : "all";
}

function getBooleanFilter(value: string | null): "all" | "true" | "false" {
  return value === "true" || value === "false" ? value : "all";
}

function getProductFiltersFromSearchParams(searchParams: ProductSearchParams): ProductListFilters {
  return {
    ...initialFilters,
    itemStructure: getItemStructureFilter(searchParams.get("item_structure")),
    isPurchasable: getBooleanFilter(searchParams.get("is_purchasable")),
    isPosVisible: getBooleanFilter(searchParams.get("is_pos_visible")),
    isSellable: getBooleanFilter(searchParams.get("is_sellable")),
    productType: getProductTypeFilter(searchParams.get("product_type")),
    search: searchParams.get("search") ?? "",
    status: getProductStatusFilter(searchParams.get("status")),
  };
}

export function ProductsPageClient(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout } = useAuth();
  const { hasAnyPermission } = usePermission();
  const searchParamFilters = useMemo(
    () => getProductFiltersFromSearchParams(searchParams),
    [searchParams],
  );
  const [filters, setFilters] = useState<ProductListFilters>(searchParamFilters);
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
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [suggestionPrices, setSuggestionPrices] = useState<Record<string, string>>({});

  const canViewProducts = hasAnyPermission([PERMISSIONS.productsView]);
  const canCreateProducts = hasAnyPermission([PERMISSIONS.productsCreate]);
  const canViewInventory = hasAnyPermission([PERMISSIONS.inventoryView]);
  const canManageProducts = hasAnyPermission([
    PERMISSIONS.productsCreate,
    PERMISSIONS.productsEdit,
    PERMISSIONS.productsDelete,
    PERMISSIONS.productsStatusUpdate,
    PERMISSIONS.productsVariantsManage,
  ]);
  // The search box writes into filters on every keystroke; only the debounced
  // value may reach the query key, or each keystroke becomes a fetch plus a
  // permanently cached query entry.
  const debouncedSearch = useDebouncedValue(filters.search);
  const queryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [debouncedSearch, filters],
  );
  const productsQuery = useProducts(queryFilters, canViewProducts);
  const catalogCountQuery = useProducts(catalogCountFilters, canViewProducts);
  const activeCountQuery = useProducts(activeCountFilters, canViewProducts);
  const inventoryQuery = useInventory(productInventoryFilters, canViewProducts && canViewInventory);
  const priceSuggestionsQuery = useProductPriceSuggestions(
    { status: "pending", limit: 8 },
    canViewProducts,
  );
  const referenceDataQuery = useProductReferenceData(canViewProducts);
  const variantsQuery = useProductVariants(selectedProduct?.id ?? null, detailsOpen);
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const updateProductStatusMutation = useUpdateProductStatus();
  const deleteProductMutation = useDeleteProduct();
  const createVariantMutation = useCreateProductVariant();
  const updateVariantMutation = useUpdateProductVariant();
  const deleteVariantMutation = useDeleteProductVariant();
  const applySuggestionMutation = useApplyProductPriceSuggestion();
  const dismissSuggestionMutation = useDismissProductPriceSuggestion();
  const bulkApplySuggestionMutation = useBulkApplyProductPriceSuggestions();
  const list = useMemo(() => productsQuery.data?.items ?? [], [productsQuery.data?.items]);
  const inventoryByProduct = useMemo(() => {
    const summaries = new Map<
      string,
      { availableQuantity: number; currentQuantity: number; unitSymbol: string }
    >();

    (inventoryQuery.data ?? []).forEach((item) => {
      if (!item.productId) return;
      const current = summaries.get(item.productId) ?? {
        availableQuantity: 0,
        currentQuantity: 0,
        unitSymbol: item.unitSymbol || item.unitName,
      };
      current.currentQuantity += item.currentQuantity;
      current.availableQuantity += item.availableQuantity;
      if (!current.unitSymbol) current.unitSymbol = item.unitSymbol || item.unitName;
      summaries.set(item.productId, current);
    });

    return summaries;
  }, [inventoryQuery.data]);
  const stats = useMemo(() => {
    const active = list.filter((product) => product.status === "active").length;
    const currentQuantity = Array.from(inventoryByProduct.values()).reduce(
      (total, item) => total + item.currentQuantity,
      0,
    );
    return {
      total: catalogCountQuery.data?.total ?? productsQuery.data?.total ?? list.length,
      active: activeCountQuery.data?.total ?? active,
      currentQuantity,
    };
  }, [
    activeCountQuery.data?.total,
    catalogCountQuery.data?.total,
    inventoryByProduct,
    list,
    productsQuery.data?.total,
  ]);
  const totalPages = Math.max(1, Math.ceil((productsQuery.data?.total ?? 0) / filters.limit));
  const priceSuggestions = priceSuggestionsQuery.data?.items ?? [];

  useEffect(() => {
    setFilters((current) => {
      if (
        current.itemStructure === searchParamFilters.itemStructure &&
        current.productType === searchParamFilters.productType &&
        current.search === searchParamFilters.search &&
        current.status === searchParamFilters.status
      ) {
        return current;
      }

      return {
        ...current,
        itemStructure: searchParamFilters.itemStructure,
        page: 1,
        productType: searchParamFilters.productType,
        search: searchParamFilters.search,
        status: searchParamFilters.status,
      };
    });
  }, [
    searchParamFilters.itemStructure,
    searchParamFilters.productType,
    searchParamFilters.search,
    searchParamFilters.status,
  ]);

  useEffect(() => {
    if (productsQuery.error instanceof ApiError && productsQuery.error.status === 401) {
      void logout().finally(() => {
        router.replace(ROUTES.login);
      });
    }
  }, [logout, productsQuery.error, router]);

  if (!canViewProducts) {
    return <ProductsAccessDeniedCard />;
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

  const applyPriceSuggestion = async (suggestion: ProductPriceSuggestion): Promise<void> => {
    const overrideValue = suggestionPrices[suggestion.id]?.trim();
    const salePrice = overrideValue ? Number(overrideValue) : suggestion.suggestedSalePrice;
    try {
      await applySuggestionMutation.mutateAsync({ id: suggestion.id, salePrice });
      toast.success("Price suggestion applied.");
      setSelectedSuggestionIds((current) => current.filter((id) => id !== suggestion.id));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const dismissPriceSuggestion = async (suggestion: ProductPriceSuggestion): Promise<void> => {
    try {
      await dismissSuggestionMutation.mutateAsync(suggestion.id);
      toast.success("Price suggestion dismissed.");
      setSelectedSuggestionIds((current) => current.filter((id) => id !== suggestion.id));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const bulkApplySelectedSuggestions = async (): Promise<void> => {
    try {
      await bulkApplySuggestionMutation.mutateAsync(selectedSuggestionIds);
      toast.success("Selected price suggestions applied.");
      setSelectedSuggestionIds([]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        actions={
          canCreateProducts ? (
            <Button
              onClick={() => {
                setSelectedProduct(null);
                setFormOpen(true);
              }}
              type="button"
            >
              <PlusCircle className="h-4 w-4" />
              Add Product
            </Button>
          ) : undefined
        }
        description="Manage product records, stock quantities, purchase costs, selling prices, and POS availability."
        title="Products"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: PackageCheck, label: "Catalog records", value: stats.total },
          { icon: Eye, label: "Active products", value: stats.active },
          {
            icon: Boxes,
            label: "Current quantity",
            value:
              canViewInventory && inventoryQuery.isSuccess
                ? formatQuantity(stats.currentQuantity)
                : "-",
          },
          {
            icon: CircleDollarSign,
            label: "Price updates",
            value: priceSuggestionsQuery.data?.total ?? 0,
          },
        ].map((item) => (
          <Card className="bg-white/80" key={item.label}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-brand-mocha">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-brand-espresso">{item.value}</p>
              </div>
              <div className="rounded-2xl bg-brand-cappuccino/35 p-3 text-brand-mocha">
                <item.icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {priceSuggestions.length > 0 ? (
        <Card className="overflow-hidden bg-white/80">
          <CardContent className="p-0">
            <div className="flex flex-col gap-2 border-b border-brand-cappuccino/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-espresso">Price suggestions</p>
                <p className="text-xs text-brand-mocha">
                  Review cost changes for active sellable POS products before updating prices.
                </p>
              </div>
              <Button
                disabled={
                  selectedSuggestionIds.length === 0 || bulkApplySuggestionMutation.isPending
                }
                onClick={() => {
                  void bulkApplySelectedSuggestions();
                }}
                size="sm"
                variant="outline"
              >
                Apply selected
              </Button>
            </div>
            <div className="divide-y divide-brand-cappuccino/70">
              {priceSuggestions.map((suggestion) => {
                const checked = selectedSuggestionIds.includes(suggestion.id);
                return (
                  <div
                    className="grid gap-3 px-4 py-3 lg:grid-cols-[auto_1.6fr_1fr_1fr_1fr_auto]"
                    key={suggestion.id}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) => {
                        setSelectedSuggestionIds((current) =>
                          nextChecked === true
                            ? Array.from(new Set([...current, suggestion.id]))
                            : current.filter((id) => id !== suggestion.id),
                        );
                      }}
                    />
                    <div>
                      <p className="font-semibold text-brand-espresso">
                        {suggestion.productName}
                        {suggestion.variantName ? ` / ${suggestion.variantName}` : ""}
                      </p>
                      <p className="text-xs text-brand-mocha">
                        {suggestion.sourceNumber ?? suggestion.sourceType} /{" "}
                        {suggestion.pricingType} {suggestion.pricingPercent}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-mocha">Cost</p>
                      <p className="font-medium text-brand-espresso">
                        {formatMoney(suggestion.currentCost)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-mocha">Current POS price</p>
                      <p className="font-medium text-brand-espresso">
                        {formatMoney(suggestion.currentSalePrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-mocha">Suggested price</p>
                      <Input
                        inputMode="decimal"
                        onChange={(event) =>
                          setSuggestionPrices((current) => ({
                            ...current,
                            [suggestion.id]: event.target.value,
                          }))
                        }
                        value={
                          suggestionPrices[suggestion.id] ??
                          suggestion.suggestedSalePrice.toFixed(2)
                        }
                      />
                    </div>
                    <div className="flex gap-2 lg:justify-end">
                      <Button
                        disabled={applySuggestionMutation.isPending}
                        onClick={() => {
                          void applyPriceSuggestion(suggestion);
                        }}
                        size="sm"
                      >
                        Apply
                      </Button>
                      <Button
                        disabled={dismissSuggestionMutation.isPending}
                        onClick={() => {
                          void dismissPriceSuggestion(suggestion);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

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
        <Card className="overflow-hidden bg-white/80">
          <CardContent className="p-0">
            <div className="flex flex-col gap-2 border-b border-brand-cappuccino/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-espresso">Product catalog</p>
                <p className="text-xs text-brand-mocha">
                  Showing {list.length} of {productsQuery.data?.total ?? list.length} records
                </p>
              </div>
              <p className="text-xs text-brand-mocha">
                Page {filters.page} of {totalPages}
              </p>
            </div>
            <ProductsTable
              canManage={canManageProducts}
              inventoryAvailable={canViewInventory && inventoryQuery.isSuccess}
              inventoryByProduct={inventoryByProduct}
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

      <div className="flex flex-col gap-3 rounded-3xl border border-brand-cappuccino bg-white/75 p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <Button
          disabled={filters.page <= 1}
          onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
          variant="outline"
        >
          Previous
        </Button>
        <p className="text-center text-sm text-brand-mocha">
          Page <span className="font-semibold text-brand-espresso">{filters.page}</span> of{" "}
          <span className="font-semibold text-brand-espresso">{totalPages}</span>
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
                    .catch((error: unknown) => {
                      toast.error(
                        isHistoryDeleteConflict(error)
                          ? getHistoryDeleteConflictMessage("product")
                          : getErrorMessage(error),
                      );
                      setConfirmState(null);
                    });
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
              {confirmState?.action === "delete" ? "Delete" : "Confirm"}
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
