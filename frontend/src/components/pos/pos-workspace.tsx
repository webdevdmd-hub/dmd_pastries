"use client";

import { PackagePlus, ShoppingCart } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { POSBarcodeInput } from "@/components/pos/pos-barcode-input";
import { POSCartPanel } from "@/components/pos/pos-cart-panel";
import { POSCategorySidebar } from "@/components/pos/pos-category-sidebar";
import { POSCheckoutDialog } from "@/components/pos/pos-checkout-dialog";
import { POSHoldSaleDialog } from "@/components/pos/pos-hold-sale-dialog";
import { POSProductGrid } from "@/components/pos/pos-product-grid";
import { POSProductSearch } from "@/components/pos/pos-product-search";
import { POSReceiptDialog } from "@/components/pos/pos-receipt-dialog";
import { POSTopBar } from "@/components/pos/pos-top-bar";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PERMISSIONS } from "@/constants/permissions";
import { useAuth } from "@/hooks/use-auth";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useBranch } from "@/hooks/use-branches";
import { useInventory } from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import { usePOSCart } from "@/hooks/use-pos-cart";
import {
  useCancelHeldSale,
  useHeldSales,
  useHoldSale,
  usePOSCheckout,
  useResumeHeldSale,
} from "@/hooks/use-pos-checkout";
import { usePOSProducts, usePOSReferenceData } from "@/hooks/use-pos-products";
import { useReceiptLayouts } from "@/hooks/use-settings-data";
import { getErrorMessage } from "@/lib/api/client";
import { lookupPOSProduct } from "@/lib/api/pos";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import { checkoutSchema } from "@/lib/validators/pos.schema";
import type { ProductCategory } from "@/types/master-data";
import type { CartItem, POSProduct, POSProductVariant, SaleReceipt } from "@/types/pos";
import type { ReceiptLayout } from "@/types/settings";

const POS_SHOW_PRICES_STORAGE_KEY = "pos.showPrices";

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debounced;
}

function getCartReceiptItemName(item: CartItem): string {
  return item.variantName ? `${item.productName} - ${item.variantName}` : item.productName;
}

function withCartItemNames(receipt: SaleReceipt, cartItems: CartItem[]): SaleReceipt {
  return {
    ...receipt,
    items: receipt.items.map((receiptItem, index) => {
      const cartItem = cartItems[index];

      if (!cartItem) {
        return receiptItem;
      }

      return {
        ...receiptItem,
        name: getCartReceiptItemName(cartItem),
      };
    }),
  };
}

function selectReceiptLayout(layouts: ReceiptLayout[], branchId: string): ReceiptLayout | null {
  const activeLayouts = layouts.filter((layout) => layout.status === "active");
  const branchLayouts = activeLayouts.filter((layout) => layout.branchId === branchId);
  const businessWideLayouts = activeLayouts.filter((layout) => layout.branchId === null);

  return (
    branchLayouts.find((layout) => layout.isDefault) ??
    branchLayouts.find((layout) => Boolean(layout.counterId ?? layout.printerType)) ??
    branchLayouts[0] ??
    businessWideLayouts.find((layout) => layout.isDefault) ??
    activeLayouts.find((layout) => layout.isDefault) ??
    activeLayouts[0] ??
    null
  );
}

export function POSWorkspace(): JSX.Element {
  const { user } = useAuth();
  const branchScope = useBranchScope();
  const { hasAnyPermission, hasPermission } = usePermission();
  const canSell = hasPermission(PERMISSIONS.posSell);
  const canLoadBranchNameFallback = hasAnyPermission([
    PERMISSIONS.branchesView,
    PERMISSIONS.branchesAccessManage,
    PERMISSIONS.settingsView,
  ]);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [search, setSearch] = useState("");
  const [pricePreferenceLoaded, setPricePreferenceLoaded] = useState(false);
  const [showPrices, setShowPrices] = useState(false);
  const [categoryId, setCategoryId] = useState("all");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [variantProduct, setVariantProduct] = useState<POSProduct | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);
  const referenceQuery = usePOSReferenceData(branchScope.hasBranchScope);
  const { refetch: refetchReferenceData } = referenceQuery;
  const permissionSignature = user?.permissions.join("|") ?? "";
  const productsQuery = usePOSProducts(
    {
      categoryId,
      search: debouncedSearch,
      limit: 80,
    },
    branchScope.hasBranchScope,
  );
  const categorySourceProductsQuery = usePOSProducts(
    {
      categoryId: "all",
      search: "",
      limit: 1000,
    },
    branchScope.hasBranchScope,
  );
  const checkoutMutation = usePOSCheckout();
  const receiptLayoutsQuery = useReceiptLayouts(branchScope.hasBranchScope);
  const heldSalesQuery = useHeldSales(holdOpen);
  const holdSaleMutation = useHoldSale();
  const resumeHeldSaleMutation = useResumeHeldSale();
  const cancelHeldSaleMutation = useCancelHeldSale();
  const cart = usePOSCart();

  useEffect(() => {
    if (!branchScope.hasBranchScope) {
      return;
    }

    void refetchReferenceData();
  }, [branchScope.hasBranchScope, permissionSignature, refetchReferenceData]);

  const currentBranchQuery = useBranch(
    branchScope.effectiveBranchId,
    Boolean(
      branchScope.hasBranchScope && branchScope.effectiveBranchId && canLoadBranchNameFallback,
    ),
  );
  const branchName =
    branchScope.effectiveBranchName ??
    currentBranchQuery.data?.name ??
    (branchScope.effectiveBranchId ? "Branch name unavailable" : "No branch assigned");
  const branchId = branchScope.effectiveBranchId ?? "";
  const canViewStock = hasAnyPermission([
    PERMISSIONS.inventoryView,
    PERMISSIONS.inventoryMovementsView,
  ]);
  const inventoryQuery = useInventory(
    {
      branchId: branchId || "all",
      expiryTrackedOnly: false,
      includeUninitialized: false,
      itemType: "product",
      lowStockOnly: false,
      search: "",
      status: "active",
    },
    Boolean(branchScope.hasBranchScope && branchId && canViewStock),
  );

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  useEffect(() => {
    setShowPrices(window.localStorage.getItem(POS_SHOW_PRICES_STORAGE_KEY) === "true");
    setPricePreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!pricePreferenceLoaded) {
      return;
    }
    window.localStorage.setItem(POS_SHOW_PRICES_STORAGE_KEY, String(showPrices));
  }, [pricePreferenceLoaded, showPrices]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        setSearch("");
        barcodeInputRef.current?.focus();
      }

      if (event.key === "F2") {
        event.preventDefault();
        setMobileCartOpen(true);
      }

      if (event.key === "F4") {
        event.preventDefault();
        if (cart.items.length > 0 && cart.payments.length > 0) {
          setCheckoutOpen(true);
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Backspace") {
        event.preventDefault();
        if (cart.items.length > 0 && window.confirm("Clear current POS cart?")) {
          cart.clearCart();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cart]);

  const addProduct = (product: POSProduct, variant?: POSProductVariant): void => {
    cart.addProduct(variant ? { product, variant } : { product });
    toast.success(
      variant
        ? `${product.productName} - ${variant.variantName} added to cart`
        : `${product.productName} added to cart`,
    );
    barcodeInputRef.current?.focus();
  };

  const openVariantChooser = (product: POSProduct): void => {
    if (product.variants.length === 0) {
      return;
    }
    setVariantProduct(product);
  };

  const handleLookup = async (query: string): Promise<void> => {
    try {
      const product = await lookupPOSProduct({ query });

      if (!product) {
        toast.error("Product not found");
        return;
      }

      addProduct(product);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const submitCheckout = async (): Promise<void> => {
    if (!branchId) {
      toast.error("No active branch is selected. Switch to an active branch before checkout.");
      return;
    }

    const paymentMissingReference = cart.payments.find((payment) => {
      const method = paymentMethods.find((entry) => entry.id === payment.paymentMethodId);
      return method?.requiresReference === true && !payment.referenceNumber?.trim();
    });

    if (paymentMissingReference) {
      toast.error(`Reference number is required for ${paymentMissingReference.paymentMethodName}.`);
      setCheckoutOpen(true);
      return;
    }

    const payload = {
      branchId,
      customerId,
      items: cart.items.map((item) => ({
        productId: item.productId,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
      })),
      saleDiscountType: cart.saleDiscountType,
      saleDiscountValue: cart.saleDiscountValue,
      payments: cart.payments,
      notes: null,
    };
    const parsed = checkoutSchema.safeParse(payload);

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Checkout validation failed.");
      return;
    }

    const receiptItemSnapshot = cart.items.map((item) => ({ ...item }));

    try {
      const checkedOut = await checkoutMutation.mutateAsync(payload);
      setReceipt(withCartItemNames(checkedOut.receipt, receiptItemSnapshot));
      setCheckoutOpen(false);
      setReceiptOpen(true);
      cart.clearCart();
      toast.success("Sale completed");
      barcodeInputRef.current?.focus();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const holdCurrentSale = async (notes: string | null): Promise<void> => {
    if (!branchId) {
      toast.error(
        "No active branch is selected. Switch to an active branch before holding a sale.",
      );
      return;
    }

    if (cart.items.length === 0) {
      toast.error("Add items before holding a sale.");
      return;
    }

    try {
      await holdSaleMutation.mutateAsync({
        branchId,
        customerId,
        items: cart.items,
        saleDiscountType: cart.saleDiscountType,
        saleDiscountValue: cart.saleDiscountValue,
        totals: cart.totals,
        notes,
      });
      cart.clearCart();
      setCustomerId(null);
      toast.success("Sale held successfully.");
      void heldSalesQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const resumeHeldSale = async (heldSaleId: string): Promise<void> => {
    if (cart.items.length > 0 && !window.confirm("Replace current cart with this held sale?")) {
      return;
    }

    try {
      const resumed = await resumeHeldSaleMutation.mutateAsync(heldSaleId);
      cart.restoreHeldSaleCart(resumed.items, resumed.saleDiscountType, resumed.saleDiscountValue);
      setCustomerId(resumed.customerId);
      setHoldOpen(false);
      toast.success("Held sale resumed.");
      barcodeInputRef.current?.focus();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const cancelHeldSale = async (heldSaleId: string): Promise<void> => {
    if (!window.confirm("Cancel this held sale?")) {
      return;
    }

    try {
      await cancelHeldSaleMutation.mutateAsync(heldSaleId);
      toast.success("Held sale cancelled.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const referenceCategories = referenceQuery.data?.categories ?? [];
  const paymentMethods = referenceQuery.data?.paymentMethods ?? [];
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const receiptLayout = useMemo(
    () => selectReceiptLayout(receiptLayoutsQuery.data ?? [], branchId),
    [branchId, receiptLayoutsQuery.data],
  );
  const categorySourceProducts = useMemo(
    () => categorySourceProductsQuery.data ?? [],
    [categorySourceProductsQuery.data],
  );
  const derivedCategories = useMemo<ProductCategory[]>(() => {
    const categoriesById = new Map<string, ProductCategory>();

    categorySourceProducts.forEach((product) => {
      if (!product.categoryId || categoriesById.has(product.categoryId)) {
        return;
      }

      categoriesById.set(product.categoryId, {
        businessId: user?.businessId ?? "",
        categoryCode: product.categoryId,
        categoryName: product.categoryName,
        createdAt: "",
        description: "",
        id: product.categoryId,
        imageUrl: "",
        parentCategoryId: null,
        sortOrder: categoriesById.size + 1,
        status: "active",
        updatedAt: "",
      });
    });

    return Array.from(categoriesById.values());
  }, [categorySourceProducts, user?.businessId]);
  const categories = referenceCategories.length > 0 ? referenceCategories : derivedCategories;
  const categoryIds = useMemo(
    () => new Set(categories.map((category) => category.id)),
    [categories],
  );
  const stockByProductId = useMemo(() => {
    const stockMap = new Map<string, { quantity: number; unitName: string }>();

    (inventoryQuery.data ?? []).forEach((item) => {
      if (item.productId) {
        stockMap.set(item.productId, {
          quantity: item.availableQuantity,
          unitName: item.unitSymbol || item.unitName,
        });
      }
    });

    return stockMap;
  }, [inventoryQuery.data]);

  useEffect(() => {
    if (categoryId !== "all" && !categoryIds.has(categoryId)) {
      setCategoryId("all");
    }
  }, [categoryId, categoryIds]);

  const cartPanel = (
    <POSCartPanel
      canSell={canSell}
      customerId={customerId}
      isCheckingOut={checkoutMutation.isPending}
      items={cart.items}
      onCheckout={() => setCheckoutOpen(true)}
      onClear={() => {
        if (window.confirm("Clear current POS cart?")) {
          cart.clearCart();
        }
      }}
      onCustomerChange={setCustomerId}
      onHoldSale={() => setHoldOpen(true)}
      onLineDiscountChange={cart.applyLineDiscount}
      onQuantityChange={cart.updateQuantity}
      onRemoveItem={cart.removeItem}
      totals={cart.totals}
    />
  );

  return (
    <div className="flex h-screen min-h-[42rem] w-full flex-col overflow-hidden rounded-[2rem] border border-brand-cappuccino/70 bg-[radial-gradient(circle_at_top_left,_rgba(214,191,166,0.38),_transparent_34%),linear-gradient(135deg,_#F3E9D7_0%,_#fffaf1_48%,_#F3E9D7_100%)] text-brand-espresso shadow-soft">
      <POSTopBar branchName={branchName} cashierName={user?.fullName ?? "Cashier"} />
      <main className="grid min-h-0 flex-1 gap-4 p-5 lg:grid-cols-[170px_minmax(0,1fr)_440px] xl:grid-cols-[180px_minmax(0,1fr)_460px] 2xl:grid-cols-[190px_minmax(0,1fr)_480px]">
        {!branchScope.hasBranchScope ? (
          <section className="col-span-full flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <NoBranchScopeCard />
            </div>
          </section>
        ) : (
          <>
            <div className="hidden min-h-0 lg:block">
              <POSCategorySidebar
                categories={categories}
                onSelect={setCategoryId}
                selectedCategoryId={categoryId}
              />
            </div>

            <section className="scrollbar-hidden min-h-0 overflow-y-auto rounded-[2rem] border border-brand-cappuccino/70 bg-white/45 p-4 shadow-[0_24px_80px_rgba(59,42,34,0.08)] backdrop-blur">
              <div className="sticky top-0 z-10 mb-5 grid gap-3 rounded-[1.7rem] bg-white/90 p-3 shadow-sm backdrop-blur md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <POSProductSearch onChange={setSearch} value={search} />
                <POSBarcodeInput
                  inputRef={barcodeInputRef}
                  onLookup={(query) => {
                    void handleLookup(query);
                  }}
                />
                <label className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-brand-cappuccino bg-brand-latte/70 px-3 text-xs font-black text-brand-mocha md:justify-start">
                  <Checkbox
                    checked={showPrices}
                    onCheckedChange={(checked) => setShowPrices(checked === true)}
                  />
                  Show prices
                </label>
              </div>
              <div className="mb-5 flex gap-2 overflow-x-auto lg:hidden">
                <Button
                  className="rounded-2xl"
                  onClick={() => setCategoryId("all")}
                  type="button"
                  variant={categoryId === "all" ? "default" : "outline"}
                >
                  All
                </Button>
                {categories.map((category) => (
                  <Button
                    className="rounded-2xl"
                    key={category.id}
                    onClick={() => setCategoryId(category.id)}
                    type="button"
                    variant={categoryId === category.id ? "default" : "outline"}
                  >
                    {category.categoryName}
                  </Button>
                ))}
              </div>
              <POSProductGrid
                error={productsQuery.error}
                isLoading={
                  productsQuery.isLoading || (referenceQuery.isLoading && categories.length === 0)
                }
                onProductClick={addProduct}
                onProductVariantsClick={openVariantChooser}
                onRetry={() => {
                  void productsQuery.refetch();
                }}
                products={products}
                showPrices={showPrices}
                stockByProductId={stockByProductId}
              />
            </section>

            <div className="hidden min-h-0 lg:block">{cartPanel}</div>
          </>
        )}
      </main>

      <Button
        className="fixed bottom-4 right-4 z-20 h-14 rounded-full px-5 shadow-2xl lg:hidden"
        onClick={() => setMobileCartOpen(true)}
        type="button"
      >
        <ShoppingCart className="mr-2 h-5 w-5" />
        Cart ({cart.items.length})
      </Button>

      <Sheet onOpenChange={setMobileCartOpen} open={mobileCartOpen}>
        <SheetContent className="w-full bg-brand-latte p-3 sm:max-w-md" side="right">
          <SheetHeader className="sr-only">
            <SheetTitle>POS cart</SheetTitle>
            <SheetDescription>Review active cart items and checkout controls.</SheetDescription>
          </SheetHeader>
          {cartPanel}
        </SheetContent>
      </Sheet>

      <Dialog
        onOpenChange={(open) => !open && setVariantProduct(null)}
        open={variantProduct !== null}
      >
        <DialogContent className="max-w-[34rem] rounded-[2rem] border-brand-cappuccino/80 bg-white/95 p-0 shadow-[0_28px_90px_rgba(59,42,34,0.22)] backdrop-blur">
          <div className="rounded-t-[2rem] border-b border-brand-cappuccino/70 bg-brand-latte/65 px-5 py-4">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl text-brand-espresso">
                Choose a variant
              </DialogTitle>
              <DialogDescription className="text-brand-mocha">
                {variantProduct?.productName}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-3 p-4">
            {variantProduct?.variants
              .filter((variant) => variant.status === "active")
              .map((variant) => {
                const availableQuantity = variant.availableStockQuantity;
                const isOutOfStock = availableQuantity !== null && availableQuantity <= 0;
                const parentImageUrl =
                  getProductImagePreviewUrl(variantProduct.imageFileId) ?? variantProduct.imageUrl;
                const variantImageUrl =
                  getProductImagePreviewUrl(variant.imageFileId) ??
                  variant.imageUrl ??
                  parentImageUrl;
                const stockLabel =
                  availableQuantity !== null
                    ? `${availableQuantity.toLocaleString(undefined, {
                        maximumFractionDigits: 3,
                      })} available`
                    : "Stock not linked";
                const metadata = [variant.sku, variant.barcode]
                  .filter((part): part is string => Boolean(part))
                  .join(" / ");

                return (
                  <Button
                    className="h-auto items-center justify-between gap-4 rounded-[1.35rem] border-brand-cappuccino/75 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-caramel hover:bg-brand-latte/35 hover:shadow-md disabled:translate-y-0 disabled:border-red-200 disabled:bg-red-50 disabled:text-red-800"
                    disabled={isOutOfStock}
                    key={variant.id}
                    onClick={() => {
                      addProduct(variantProduct, variant);
                      setVariantProduct(null);
                    }}
                    type="button"
                    variant="outline"
                  >
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-brand-cappuccino/60 bg-brand-latte text-brand-mocha shadow-sm">
                      {variantImageUrl ? (
                        <img alt="" className="h-full w-full object-cover" src={variantImageUrl} />
                      ) : (
                        <PackagePlus className="h-5 w-5" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                      <span className="line-clamp-1 text-base font-black text-brand-espresso">
                        {variant.variantName}
                      </span>
                      {metadata ? (
                        <span className="line-clamp-1 text-xs font-medium text-brand-mocha">
                          {metadata}
                        </span>
                      ) : null}
                      <span
                        className={
                          isOutOfStock
                            ? "rounded-full bg-red-100 px-2 py-0.5 text-[0.68rem] font-black text-red-700"
                            : "rounded-full bg-brand-latte px-2 py-0.5 text-[0.68rem] font-black text-brand-mocha"
                        }
                      >
                        {stockLabel}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {showPrices ? (
                        <span className="text-base font-black text-brand-espresso">
                          AED {variant.salePrice.toFixed(2)}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-brand-caramel px-3 py-1 text-[0.68rem] font-black text-white">
                        Select
                      </span>
                    </span>
                  </Button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>

      <POSCheckoutDialog
        isSubmitting={checkoutMutation.isPending}
        onConfirm={() => {
          void submitCheckout();
        }}
        onOpenChange={setCheckoutOpen}
        onPaymentsChange={cart.setPayments}
        onSaleDiscountChange={cart.setSaleDiscount}
        open={checkoutOpen}
        paymentMethods={paymentMethods}
        payments={cart.payments}
        saleDiscountType={cart.saleDiscountType}
        saleDiscountValue={cart.saleDiscountValue}
        totals={cart.totals}
      />
      <POSReceiptDialog
        layout={receiptLayout}
        onNewSale={() => {
          setReceiptOpen(false);
          setReceipt(null);
          barcodeInputRef.current?.focus();
        }}
        onOpenChange={setReceiptOpen}
        open={receiptOpen}
        receipt={receipt}
      />
      <POSHoldSaleDialog
        canHoldCurrentSale={cart.items.length > 0}
        heldSales={heldSalesQuery.data ?? []}
        isCancelling={cancelHeldSaleMutation.isPending}
        isHolding={holdSaleMutation.isPending}
        isLoading={heldSalesQuery.isLoading}
        isResuming={resumeHeldSaleMutation.isPending}
        onCancelHeldSale={(heldSaleId) => {
          void cancelHeldSale(heldSaleId);
        }}
        onHoldCurrentSale={(notes) => {
          void holdCurrentSale(notes);
        }}
        onOpenChange={setHoldOpen}
        onResumeHeldSale={(heldSaleId) => {
          void resumeHeldSale(heldSaleId);
        }}
        onRetry={() => {
          void heldSalesQuery.refetch();
        }}
        open={holdOpen}
      />
    </div>
  );
}
