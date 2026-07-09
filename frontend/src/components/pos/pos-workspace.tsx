"use client";

import { CalendarPlus, PackagePlus, ShoppingCart } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { POSBarcodeInput } from "@/components/pos/pos-barcode-input";
import { POSCartPanel } from "@/components/pos/pos-cart-panel";
import { POSCategorySidebar } from "@/components/pos/pos-category-sidebar";
import { POSCheckoutDialog } from "@/components/pos/pos-checkout-dialog";
import { POSCreateOrderDialog } from "@/components/pos/pos-create-order-dialog";
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
import { usePermission } from "@/hooks/use-permission";
import { usePOSCart } from "@/hooks/use-pos-cart";
import {
  useCancelHeldSale,
  useHeldSales,
  useHoldSale,
  usePOSCheckout,
  useResumeHeldSale,
  useVerifyPOSCheckout,
} from "@/hooks/use-pos-checkout";
import {
  usePOSPaymentMethods,
  usePOSProducts,
  usePOSReferenceData,
} from "@/hooks/use-pos-products";
import { getErrorMessage } from "@/lib/api/client";
import { lookupPOSProduct } from "@/lib/api/pos";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import {
  type CheckoutFeedback,
  resolveCheckoutBlocker,
} from "@/lib/pos/checkout-feedback";
import { getProductCategoryIconForMetadata } from "@/lib/product-category-icons";
import { checkoutSchema } from "@/lib/validators/pos.schema";
import type { ProductCategory } from "@/types/master-data";
import type {
  CartItem,
  CheckoutResponse,
  POSProduct,
  POSProductVariant,
  SaleReceipt,
} from "@/types/pos";
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
  const canCreateBakeryOrder = hasAnyPermission([PERMISSIONS.ordersCreate, PERMISSIONS.posSell]);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [search, setSearch] = useState("");
  const [pricePreferenceLoaded, setPricePreferenceLoaded] = useState(false);
  const [showPrices, setShowPrices] = useState(false);
  const [categoryId, setCategoryId] = useState("all");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [salesChannelId, setSalesChannelId] = useState("");
  const [externalOrderNumber, setExternalOrderNumber] = useState("");
  const [checkoutFeedback, setCheckoutFeedback] = useState<CheckoutFeedback | null>(null);
  const [checkoutReference, setCheckoutReference] = useState<string | null>(null);
  const [variantProduct, setVariantProduct] = useState<POSProduct | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);
  const branchId = branchScope.effectiveBranchId ?? "";
  const referenceDataQuery = usePOSReferenceData(branchId || null, branchScope.hasBranchScope);
  const paymentMethodsQuery = usePOSPaymentMethods(branchId || null, branchScope.hasBranchScope);
  const { refetch: refetchReferenceData } = referenceDataQuery;
  const { refetch: refetchPaymentMethods } = paymentMethodsQuery;
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
  const verifyCheckoutMutation = useVerifyPOSCheckout();
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
    void refetchPaymentMethods();
  }, [
    branchId,
    branchScope.hasBranchScope,
    permissionSignature,
    refetchReferenceData,
    refetchPaymentMethods,
  ]);

  const branchName =
    branchScope.effectiveBranchName ??
    (branchScope.effectiveBranchId ? "Active branch" : "No branch assigned");

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
          setCheckoutReference(null);
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

  const showCheckoutFeedback = (feedback: CheckoutFeedback): void => {
    setCheckoutFeedback(feedback);
    if (feedback.tone === "success") {
      toast.success(feedback.message);
      return;
    }
    if (feedback.tone === "warning") {
      toast.warning(feedback.message);
      return;
    }
    toast.error(feedback.message);
  };

  const getOrCreateCheckoutReference = (): string => {
    if (checkoutReference) {
      return checkoutReference;
    }

    const reference = crypto.randomUUID();
    setCheckoutReference(reference);
    return reference;
  };

  const completeCheckout = (
    checkedOut: CheckoutResponse,
    receiptItemSnapshot: CartItem[],
  ): void => {
    setReceipt(
      withCartItemNames(
        {
          ...checkedOut.receipt,
          accountingJournalEntryId: checkedOut.sale.accountingJournalEntryId,
        },
        receiptItemSnapshot,
      ),
    );
    setCheckoutFeedback(null);
    setCheckoutOpen(false);
    setReceiptOpen(true);
    setExternalOrderNumber("");
    setCheckoutReference(null);
    cart.clearCart();
    if (checkedOut.receiptWarning) {
      toast.warning(checkedOut.receiptWarning);
    } else {
      toast.success("Sale completed");
    }
    barcodeInputRef.current?.focus();
  };

  const submitCheckout = async (): Promise<void> => {
    if (checkoutMutation.isPending || verifyCheckoutMutation.isPending) {
      return;
    }

    if (checkoutBlocker) {
      showCheckoutFeedback(checkoutBlocker.feedback);
      setCheckoutOpen(true);
      return;
    }

    const activeCheckoutReference = getOrCreateCheckoutReference();
    const payload = {
      branchId,
      checkoutReference: activeCheckoutReference,
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
      charges: cart.charges,
      payments: cart.payments,
      salesChannelId: salesChannelId || null,
      externalOrderNumber:
        externalOrderNumber.trim().length > 0 ? externalOrderNumber.trim() : null,
      notes: null,
    };
    const parsed = checkoutSchema.safeParse(payload);

    if (!parsed.success) {
      showCheckoutFeedback({
        message: parsed.error.issues[0]?.message ?? "Checkout validation failed.",
        title: "Checkout needs attention",
        tone: "error",
      });
      return;
    }

    const receiptItemSnapshot = cart.items.map((item) => ({ ...item }));

    try {
      const checkedOut = await checkoutMutation.mutateAsync(payload);
      completeCheckout(checkedOut, receiptItemSnapshot);
    } catch (error) {
      try {
        const verifiedCheckout = await verifyCheckoutMutation.mutateAsync(activeCheckoutReference);

        if (verifiedCheckout) {
          completeCheckout(verifiedCheckout, receiptItemSnapshot);
          return;
        }

        showCheckoutFeedback({
          message: getErrorMessage(error),
          title: "Checkout failed",
          tone: "error",
        });
      } catch (verificationError) {
        showCheckoutFeedback({
          message: `The checkout result could not be verified. Retry will use the same checkout reference to prevent a duplicate sale. ${getErrorMessage(
            verificationError,
          )}`,
          title: "Checkout status unknown",
          tone: "warning",
        });
      }
    }
  };

  const isCheckoutProcessing = checkoutMutation.isPending || verifyCheckoutMutation.isPending;

  const resetCheckoutReference = (): void => {
    if (!isCheckoutProcessing) {
      setCheckoutReference(null);
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
        charges: cart.charges,
        totals: cart.totals,
        notes,
      });
      resetCheckoutReference();
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
      cart.restoreHeldSaleCart(
        resumed.items,
        resumed.saleDiscountType,
        resumed.saleDiscountValue,
        resumed.charges,
      );
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

  const referenceCategories = useMemo(
    () => referenceDataQuery.data?.productCategories ?? [],
    [referenceDataQuery.data?.productCategories],
  );
  const paymentMethods = paymentMethodsQuery.data ?? [];
  const chargeTaxRates = referenceDataQuery.data?.taxRates ?? [];
  const salesChannels = useMemo(
    () =>
      (referenceDataQuery.data?.salesChannels ?? []).filter(
        (channel) => channel.status === "active",
      ),
    [referenceDataQuery.data?.salesChannels],
  );
  const checkoutBlocker = resolveCheckoutBlocker({
    branchId,
    externalOrderNumber,
    itemCount: cart.items.length,
    paymentMethods,
    paymentMethodsError: paymentMethodsQuery.error,
    payments: cart.payments,
    salesChannelId,
    salesChannels,
    totals: cart.totals,
  });
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const receiptLayout = useMemo(
    () => selectReceiptLayout(referenceDataQuery.data?.receiptLayouts ?? [], branchId),
    [branchId, referenceDataQuery.data?.receiptLayouts],
  );
  const categorySourceProducts = useMemo(
    () => categorySourceProductsQuery.data ?? [],
    [categorySourceProductsQuery.data],
  );
  const referenceCategoryById = useMemo(() => {
    const categoryMap = new Map<string, ProductCategory>();

    referenceCategories.forEach((category) => {
      categoryMap.set(category.id, category);
    });

    return categoryMap;
  }, [referenceCategories]);
  const derivedCategories = useMemo<ProductCategory[]>(() => {
    const categoriesById = new Map<string, ProductCategory>();

    categorySourceProducts.forEach((product) => {
      if (!product.categoryId || categoriesById.has(product.categoryId)) {
        return;
      }

      const referenceCategory = referenceCategoryById.get(product.categoryId);

      categoriesById.set(product.categoryId, {
        businessId: referenceCategory?.businessId ?? user?.businessId ?? "",
        categoryCode: referenceCategory?.categoryCode ?? product.categoryId,
        categoryName: referenceCategory?.categoryName ?? product.categoryName,
        allowedProductTypes: referenceCategory?.allowedProductTypes ?? [],
        createdAt: referenceCategory?.createdAt ?? "",
        description: referenceCategory?.description ?? "",
        id: product.categoryId,
        imageUrl: referenceCategory?.imageUrl ?? "",
        parentCategoryId: referenceCategory?.parentCategoryId ?? null,
        sortOrder: referenceCategory?.sortOrder ?? categoriesById.size + 1,
        status: referenceCategory?.status ?? "active",
        updatedAt: referenceCategory?.updatedAt ?? "",
      });
    });

    return Array.from(categoriesById.values());
  }, [categorySourceProducts, referenceCategoryById, user?.businessId]);
  const categories = derivedCategories.length > 0 ? derivedCategories : referenceCategories;
  const categoryIds = useMemo(
    () => new Set(categories.map((category) => category.id)),
    [categories],
  );
  useEffect(() => {
    if (categoryId !== "all" && !categoryIds.has(categoryId)) {
      setCategoryId("all");
    }
  }, [categoryId, categoryIds]);

  useEffect(() => {
    if (checkoutOpen) {
      setCheckoutFeedback(null);
    }
  }, [checkoutOpen]);

  const clearCheckoutFeedback = (): void => {
    setCheckoutFeedback(null);
  };

  const handleCheckoutOpenChange = (open: boolean): void => {
    if (open) {
      clearCheckoutFeedback();
    }
    setCheckoutOpen(open);
  };

  const cartPanel = (
    <POSCartPanel
      canSell={canSell}
      charges={cart.charges}
      customerId={customerId}
      externalOrderNumber={externalOrderNumber}
      isCheckingOut={isCheckoutProcessing}
      items={cart.items}
      onCheckout={() => handleCheckoutOpenChange(true)}
      onChargesChange={(charges) => {
        clearCheckoutFeedback();
        cart.setCharges(charges);
      }}
      onClear={() => {
        if (window.confirm("Clear current POS cart?")) {
          clearCheckoutFeedback();
          resetCheckoutReference();
          cart.clearCart();
        }
      }}
      onCustomerChange={(value) => {
        clearCheckoutFeedback();
        setCustomerId(value);
      }}
      onExternalOrderNumberChange={(value) => {
        clearCheckoutFeedback();
        setExternalOrderNumber(value);
      }}
      onHoldSale={() => setHoldOpen(true)}
      onLineDiscountChange={(cartItemId, discountType, discountValue) => {
        clearCheckoutFeedback();
        cart.applyLineDiscount(cartItemId, discountType, discountValue);
      }}
      onQuantityChange={(cartItemId, quantity) => {
        clearCheckoutFeedback();
        cart.updateQuantity(cartItemId, quantity);
      }}
      onRemoveItem={(cartItemId) => {
        clearCheckoutFeedback();
        cart.removeItem(cartItemId);
      }}
      onSalesChannelChange={(value) => {
        clearCheckoutFeedback();
        setSalesChannelId(value);
      }}
      salesChannelId={salesChannelId}
      salesChannels={salesChannels}
      taxRates={chargeTaxRates}
      totals={cart.totals}
    />
  );

  return (
    <div className="flex h-screen min-h-[42rem] w-full flex-col overflow-hidden bg-[#f9f9fa] font-sans text-[#09090b]">
      <POSTopBar branchName={branchName} cashierName={user?.fullName ?? "Cashier"} />
      <main className="grid min-h-0 flex-1 border-y border-[#d4d4d8] lg:grid-cols-[88px_minmax(0,1fr)_420px] xl:grid-cols-[96px_minmax(0,1fr)_440px]">
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

            <section className="scrollbar-hidden min-h-0 overflow-y-auto border-r border-[#d4d4d8] bg-[#f9f9fa]">
              <div className="sticky top-0 z-10 grid gap-2 border-b border-[#d4d4d8] bg-white px-4 py-3 md:grid-cols-[minmax(0,1fr)_170px_auto_auto]">
                <POSProductSearch onChange={setSearch} value={search} />
                <POSBarcodeInput
                  inputRef={barcodeInputRef}
                  onLookup={(query) => {
                    void handleLookup(query);
                  }}
                />
                <Button
                  className="h-10 rounded-md border-[#d4d4d8] bg-white px-3 text-xs font-black text-[#09090b] shadow-none hover:bg-[#f4f4f5]"
                  disabled={!canCreateBakeryOrder}
                  onClick={() => setCreateOrderOpen(true)}
                  type="button"
                  variant="outline"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Create Order
                </Button>
                <label className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#d4d4d8] bg-white px-3 text-xs font-black text-[#3f3f46] md:justify-start">
                  <Checkbox
                    checked={showPrices}
                    onCheckedChange={(checked) => setShowPrices(checked === true)}
                  />
                  Show prices
                </label>
              </div>
              <div className="flex gap-2 overflow-x-auto border-b border-[#d4d4d8] bg-white px-3 py-2 lg:hidden">
                <Button
                  className="rounded-md border-[#d4d4d8]"
                  onClick={() => setCategoryId("all")}
                  type="button"
                  variant={categoryId === "all" ? "default" : "outline"}
                >
                  All
                </Button>
                {categories.map((category) => {
                  const Icon = getProductCategoryIconForMetadata(category);

                  return (
                    <Button
                      className="rounded-md border-[#d4d4d8]"
                      key={category.id}
                      onClick={() => setCategoryId(category.id)}
                      type="button"
                      variant={categoryId === category.id ? "default" : "outline"}
                    >
                      <Icon className="h-4 w-4" />
                      {category.categoryName}
                    </Button>
                  );
                })}
              </div>
              <div className="px-4 py-4">
                <POSProductGrid
                  canCreateOrder={canCreateBakeryOrder}
                  error={productsQuery.error}
                  isLoading={
                    productsQuery.isLoading ||
                    (referenceDataQuery.isLoading && categories.length === 0)
                  }
                  onCreateOrder={() => setCreateOrderOpen(true)}
                  onProductClick={addProduct}
                  onProductVariantsClick={openVariantChooser}
                  onRetry={() => {
                    void productsQuery.refetch();
                  }}
                  products={products}
                  showPrices={showPrices}
                />
              </div>
            </section>

            <div className="hidden min-h-0 lg:block">{cartPanel}</div>
          </>
        )}
      </main>

      <Button
        className="fixed bottom-4 right-4 z-20 h-14 rounded-md bg-black px-5 font-black text-white shadow-lg hover:bg-[#18181b] lg:hidden"
        onClick={() => setMobileCartOpen(true)}
        type="button"
      >
        <ShoppingCart className="mr-2 h-5 w-5" />
        Cart ({cart.items.length})
      </Button>

      <Sheet onOpenChange={setMobileCartOpen} open={mobileCartOpen}>
        <SheetContent className="w-full border-[#d4d4d8] bg-white p-0 sm:max-w-md" side="right">
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
        <DialogContent className="max-w-[34rem] rounded-lg border-[#d4d4d8] bg-white p-0 text-[#09090b] shadow-lg">
          <div className="border-b border-[#d4d4d8] bg-[#fafafa] px-5 py-4">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">
                Choose a variant
              </DialogTitle>
              <DialogDescription className="text-[#52525b]">
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
                    className="h-auto items-center justify-between gap-4 rounded-lg border-[#d4d4d8] bg-white p-3 text-left shadow-none transition hover:border-[#71717a] hover:bg-[#fafafa] disabled:border-red-200 disabled:bg-red-50 disabled:text-red-800"
                    disabled={isOutOfStock}
                    key={variant.id}
                    onClick={() => {
                      addProduct(variantProduct, variant);
                      setVariantProduct(null);
                    }}
                    type="button"
                    variant="outline"
                  >
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#d4d4d8] bg-[#f4f4f5] text-[#71717a]">
                      {variantImageUrl ? (
                        <img alt="" className="h-full w-full object-cover" src={variantImageUrl} />
                      ) : (
                        <PackagePlus className="h-5 w-5" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                      <span className="line-clamp-1 text-base font-black text-[#09090b]">
                        {variant.variantName}
                      </span>
                      {metadata ? (
                        <span className="line-clamp-1 text-xs font-medium text-[#71717a]">
                          {metadata}
                        </span>
                      ) : null}
                      <span
                        className={
                          isOutOfStock
                            ? "rounded-full bg-red-100 px-2 py-0.5 text-[0.68rem] font-black text-red-700"
                            : "rounded-md bg-[#f4f4f5] px-2 py-0.5 text-[0.68rem] font-black text-[#52525b]"
                        }
                      >
                        {stockLabel}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {showPrices ? (
                        <span className="font-mono text-base font-black text-[#09090b]">
                          AED {variant.salePrice.toFixed(2)}
                        </span>
                      ) : null}
                      <span className="rounded-md bg-black px-3 py-1 text-[0.68rem] font-black text-white">
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
        charges={cart.charges}
        confirmButtonLabel={checkoutBlocker?.buttonLabel ?? "Confirm sale"}
        feedback={checkoutFeedback}
        isSubmitting={isCheckoutProcessing}
        onConfirm={() => {
          void submitCheckout();
        }}
        onOpenChange={handleCheckoutOpenChange}
        onChargesChange={(charges) => {
          clearCheckoutFeedback();
          cart.setCharges(charges);
        }}
        onPaymentsChange={(payments) => {
          clearCheckoutFeedback();
          cart.setPayments(payments);
        }}
        onSaleDiscountChange={(discountType, discountValue) => {
          clearCheckoutFeedback();
          cart.setSaleDiscount(discountType, discountValue);
        }}
        open={checkoutOpen}
        paymentMethodsError={paymentMethodsQuery.error}
        paymentMethodsLoading={paymentMethodsQuery.isLoading}
        paymentMethods={paymentMethods}
        payments={cart.payments}
        saleDiscountType={cart.saleDiscountType}
        saleDiscountValue={cart.saleDiscountValue}
        taxRates={chargeTaxRates}
        totals={cart.totals}
      />
      <POSCreateOrderDialog
        branchId={branchId}
        branchName={branchName}
        canCreate={canCreateBakeryOrder}
        onOpenChange={setCreateOrderOpen}
        open={createOrderOpen}
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
