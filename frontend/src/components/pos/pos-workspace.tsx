"use client";

import { CalendarPlus, PackagePlus, ShoppingCart } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useConfirm } from "@/components/app/confirm-provider";
import { POSCartPanel } from "@/components/pos/pos-cart-panel";
import { POSCategoryTiles } from "@/components/pos/pos-category-tiles";
import { POSCheckoutDialog } from "@/components/pos/pos-checkout-dialog";
import { POSCreateOrderDialog } from "@/components/pos/pos-create-order-dialog";
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
import { useCustomerCredits } from "@/hooks/use-customer-credits";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePermission } from "@/hooks/use-permission";
import { usePOSCart } from "@/hooks/use-pos-cart";
import { usePOSCheckout, useVerifyPOSCheckout } from "@/hooks/use-pos-checkout";
import {
  usePOSPaymentMethods,
  usePOSProducts,
  usePOSReferenceData,
} from "@/hooks/use-pos-products";
import { getErrorMessage } from "@/lib/api/client";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import { type CheckoutFeedback, resolveCheckoutBlocker } from "@/lib/pos/checkout-feedback";
import { createUuid } from "@/lib/uuid";
import { checkoutSchema } from "@/lib/validators/pos.schema";
import type { ProductCategory } from "@/types/master-data";
import type {
  CartItem,
  CheckoutResponse,
  PaymentInput,
  POSProduct,
  POSProductVariant,
  SaleReceipt,
} from "@/types/pos";
import type { PaymentMethod, ReceiptLayout, SalesChannel } from "@/types/settings";

const POS_SHOW_PRICES_STORAGE_KEY = "pos.showPrices";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

/**
 * Consequence copy for discarding the current cart.
 *
 * The old `window.confirm("Clear current POS cart?")` could not say how much was
 * being thrown away, so a cashier answered it identically for a 1-item cart and a
 * 20-item one. The count and the total are the whole point of asking.
 */
function describeCartDiscard(itemCount: number, total: number): string {
  const items = itemCount === 1 ? "1 item" : `${String(itemCount)} items`;
  return `This removes ${items} totalling ${formatMoney(total)} from the current sale. It cannot be undone.`;
}

function getCartReceiptItemName(item: CartItem): string {
  return item.variantName ? `${item.productName} - ${item.variantName}` : item.productName;
}

function withCartItemNames(receipt: SaleReceipt, cartItems: CartItem[]): SaleReceipt {
  const cartItemsById = new Map(cartItems.map((item) => [item.cartItemId, item]));

  return {
    ...receipt,
    items: receipt.items.map((receiptItem) => {
      if (!receiptItem.productId) {
        return receiptItem;
      }

      const cartItem = cartItemsById.get(
        `${receiptItem.productId}:${receiptItem.productVariantId ?? "base"}`,
      );

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

function getUsableDefaultPaymentMethod(
  salesChannel: SalesChannel | null,
  paymentMethods: PaymentMethod[],
): PaymentMethod | null {
  if (!salesChannel?.defaultPaymentMethodId) {
    return null;
  }

  const paymentMethod =
    paymentMethods.find((method) => method.id === salesChannel.defaultPaymentMethodId) ?? null;

  if (
    paymentMethod?.status !== "active" ||
    !paymentMethod.showInPos ||
    !paymentMethod.defaultPaymentAccountId
  ) {
    return null;
  }

  return paymentMethod;
}

function createAutoSelectedPayment(method: PaymentMethod, amount: number): PaymentInput {
  return {
    paymentMethodId: method.id,
    paymentMethodName: method.methodName,
    amount,
    referenceNumber: null,
  };
}

export function POSWorkspace(): JSX.Element {
  const { user } = useAuth();
  const branchScope = useBranchScope();
  const { hasAnyPermission, hasPermission } = usePermission();
  const confirm = useConfirm();
  const canSell = hasPermission(PERMISSIONS.posSell);
  const canCreateBakeryOrder = hasAnyPermission([PERMISSIONS.ordersCreate, PERMISSIONS.posSell]);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [search, setSearch] = useState("");
  const [pricePreferenceLoaded, setPricePreferenceLoaded] = useState(false);
  const [showPrices, setShowPrices] = useState(false);
  const [categoryId, setCategoryId] = useState("all");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [salesChannelId, setSalesChannelId] = useState("");
  const [autoSelectedPaymentMethodId, setAutoSelectedPaymentMethodId] = useState<string | null>(
    null,
  );
  const [paymentAutoSelectionSuppressedChannelId, setPaymentAutoSelectionSuppressedChannelId] =
    useState<string | null>(null);
  const [externalOrderNumber, setExternalOrderNumber] = useState("");
  const [checkoutFeedback, setCheckoutFeedback] = useState<CheckoutFeedback | null>(null);
  // useRef, not useState: `getOrCreateCheckoutReference` both reads and writes
  // this in the same call. Two `submitCheckout` invocations landing in the same
  // tick (a stuck touchscreen firing twice in one frame) would otherwise both
  // read the pre-update state value, see null, and each mint a fresh UUID --
  // silently defeating the idempotency key the backend relies on to collapse
  // a duplicate submission into one sale. A ref is updated synchronously, so
  // the second call always sees what the first one just wrote.
  const checkoutReferenceRef = useRef<string | null>(null);
  const [variantProduct, setVariantProduct] = useState<POSProduct | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);
  const branchId = branchScope.effectiveBranchId ?? "";
  const referenceDataQuery = usePOSReferenceData(branchId || null, branchScope.hasBranchScope);
  const paymentMethodsQuery = usePOSPaymentMethods(branchId || null, branchScope.hasBranchScope);
  // W4: the selected customer's open store-credit balance gates and caps the
  // Store Credit tender in the checkout dialog.
  const customerCreditsQuery = useCustomerCredits(customerId);
  const customerCreditBalance = customerCreditsQuery.data?.balance ?? 0;
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
  const cart = usePOSCart();
  const cartPayments = cart.payments;
  const cartTotal = cart.totals.total;
  const setCartPayments = cart.setPayments;

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

        if (cart.items.length === 0) {
          return;
        }

        // A keyboard shortcut is the easiest way to discard a cart by accident,
        // so this is the one path that most needs the amount stated.
        void (async () => {
          const confirmed = await confirm({
            cancelLabel: "Keep sale",
            confirmLabel: "Discard sale",
            consequence: describeCartDiscard(cart.items.length, cart.totals.total),
            detail: "Nothing is posted to the ledger — the sale was never completed.",
            title: "Discard this sale?",
          });

          if (!confirmed) {
            return;
          }

          checkoutReferenceRef.current = null;
          setAutoSelectedPaymentMethodId(null);
          setPaymentAutoSelectionSuppressedChannelId(null);
          cart.clearCart();
        })();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // `confirm` is stable (useCallback with no deps in ConfirmProvider), so this
    // does not re-bind the listener on every render.
  }, [cart, confirm]);

  const addProduct = (product: POSProduct, variant?: POSProductVariant): void => {
    const displayName = variant
      ? `${product.productName} - ${variant.variantName}`
      : product.productName;
    const availableQuantity = variant
      ? variant.availableStockQuantity
      : product.availableStockQuantity;

    if (availableQuantity !== null && availableQuantity <= 0) {
      toast.error(`${displayName} is out of stock.`);
      return;
    }

    const cartItemId = `${product.id}:${variant?.id ?? "base"}`;
    const existingItem = cart.items.find((item) => item.cartItemId === cartItemId);

    if (
      availableQuantity !== null &&
      existingItem &&
      existingItem.quantity + 1 > availableQuantity
    ) {
      toast.error(
        `Only ${availableQuantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} of ${displayName} in stock.`,
      );
      return;
    }

    cart.addProduct(variant ? { product, variant } : { product });
    toast.success(`${displayName} added to cart`);
  };

  const openVariantChooser = (product: POSProduct): void => {
    if (product.variants.length === 0) {
      return;
    }
    setVariantProduct(product);
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
    if (checkoutReferenceRef.current) {
      return checkoutReferenceRef.current;
    }

    const reference = createUuid();
    checkoutReferenceRef.current = reference;
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
    checkoutReferenceRef.current = null;
    setAutoSelectedPaymentMethodId(null);
    setPaymentAutoSelectionSuppressedChannelId(null);
    cart.clearCart();
    setCustomerId(null);
    setSalesChannelId("");
    if (checkedOut.receiptWarning) {
      toast.warning(checkedOut.receiptWarning);
    } else {
      toast.success("Sale completed");
    }
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
      taxMode: cart.taxMode,
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
          message: `We can't confirm whether this sale went through. Do not re-run the customer's card. Tap "Retry checkout" below — it's safe, and will not create a duplicate sale even if the first attempt actually succeeded. (${getErrorMessage(
            verificationError,
          )})`,
          showRetry: true,
          title: "Checkout status unknown — do not re-charge the customer",
          tone: "warning",
        });
      }
    }
  };

  const isCheckoutProcessing = checkoutMutation.isPending || verifyCheckoutMutation.isPending;

  const resetCheckoutReference = (): void => {
    if (!isCheckoutProcessing) {
      checkoutReferenceRef.current = null;
    }
  };

  const referenceCategories = useMemo(
    () => referenceDataQuery.data?.productCategories ?? [],
    [referenceDataQuery.data?.productCategories],
  );
  const paymentMethods = useMemo(() => paymentMethodsQuery.data ?? [], [paymentMethodsQuery.data]);
  const salesChannels = useMemo(
    () =>
      (referenceDataQuery.data?.salesChannels ?? []).filter(
        (channel) => channel.status === "active",
      ),
    [referenceDataQuery.data?.salesChannels],
  );
  const selectedSalesChannel = useMemo(
    () => salesChannels.find((channel) => channel.id === salesChannelId) ?? null,
    [salesChannelId, salesChannels],
  );
  const salesChannelDefaultPaymentMethod = useMemo(
    () => getUsableDefaultPaymentMethod(selectedSalesChannel, paymentMethods),
    [paymentMethods, selectedSalesChannel],
  );

  useEffect(() => {
    if (paymentAutoSelectionSuppressedChannelId === salesChannelId) {
      return;
    }

    const currentPayment = cartPayments[0] ?? null;
    const currentPaymentWasAutoSelected =
      autoSelectedPaymentMethodId !== null &&
      cartPayments.length === 1 &&
      currentPayment?.paymentMethodId === autoSelectedPaymentMethodId;
    const canApplyChannelDefault = cartPayments.length === 0 || currentPaymentWasAutoSelected;

    if (!canApplyChannelDefault) {
      return;
    }

    if (!salesChannelDefaultPaymentMethod || cartTotal <= 0) {
      if (currentPaymentWasAutoSelected) {
        setCartPayments([]);
      }
      if (autoSelectedPaymentMethodId !== null) {
        setAutoSelectedPaymentMethodId(null);
      }
      return;
    }

    const nextPayment = createAutoSelectedPayment(salesChannelDefaultPaymentMethod, cartTotal);
    const currentPaymentAlreadyMatches =
      currentPayment?.paymentMethodId === nextPayment.paymentMethodId &&
      currentPayment.paymentMethodName === nextPayment.paymentMethodName &&
      currentPayment.amount === nextPayment.amount &&
      currentPayment.referenceNumber === nextPayment.referenceNumber;

    if (!currentPaymentAlreadyMatches) {
      setCartPayments([nextPayment]);
    }
    if (autoSelectedPaymentMethodId !== nextPayment.paymentMethodId) {
      setAutoSelectedPaymentMethodId(nextPayment.paymentMethodId);
    }
  }, [
    autoSelectedPaymentMethodId,
    cartPayments,
    cartTotal,
    paymentAutoSelectionSuppressedChannelId,
    salesChannelDefaultPaymentMethod,
    salesChannelId,
    setCartPayments,
  ]);

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
  const stockByCartItemId = useMemo(() => {
    const stockMap = new Map<string, number>();

    categorySourceProducts.forEach((product) => {
      if (product.availableStockQuantity !== null) {
        stockMap.set(`${product.id}:base`, product.availableStockQuantity);
      }
      product.variants.forEach((variant) => {
        if (variant.availableStockQuantity !== null) {
          stockMap.set(`${product.id}:${variant.id}`, variant.availableStockQuantity);
        }
      });
    });

    return stockMap;
  }, [categorySourceProducts]);
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
      isCheckingOut={isCheckoutProcessing}
      items={cart.items}
      onCheckout={() => handleCheckoutOpenChange(true)}
      onChargesChange={(charges) => {
        clearCheckoutFeedback();
        cart.setCharges(charges);
      }}
      onClear={() => {
        void (async () => {
          const confirmed = await confirm({
            cancelLabel: "Keep sale",
            confirmLabel: "Discard sale",
            consequence: describeCartDiscard(cart.items.length, cart.totals.total),
            detail: "Nothing is posted to the ledger — the sale was never completed.",
            title: "Discard this sale?",
          });

          if (!confirmed) {
            return;
          }

          clearCheckoutFeedback();
          resetCheckoutReference();
          setAutoSelectedPaymentMethodId(null);
          setPaymentAutoSelectionSuppressedChannelId(null);
          cart.clearCart();
        })();
      }}
      onQuantityChange={(cartItemId, quantity) => {
        clearCheckoutFeedback();
        const maxQuantity = stockByCartItemId.get(cartItemId);
        if (maxQuantity !== undefined && quantity > maxQuantity) {
          toast.warning(
            `Only ${maxQuantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} in stock.`,
          );
          cart.updateQuantity(cartItemId, maxQuantity);
          return;
        }
        cart.updateQuantity(cartItemId, quantity);
      }}
      onRemoveItem={(cartItemId) => {
        clearCheckoutFeedback();
        cart.removeItem(cartItemId);
      }}
      totals={cart.totals}
    />
  );

  return (
    // h-full, not h-screen. The (pos) layout owns the viewport and may put a
    // persistent bar above this (E5's offline notice), so claiming 100vh here
    // made the workspace overflow by exactly the bar's height and pushed the
    // Charge button off the bottom of the screen — on the one surface where the
    // money control must always be reachable.
    <div className="flex h-full min-h-[42rem] w-full flex-col overflow-hidden bg-canvas font-sans text-foreground">
      <POSTopBar branchName={branchName} cashierName={user?.fullName ?? "Cashier"} />
      <main className="grid min-h-0 flex-1 border-y border-border lg:grid-cols-[144px_minmax(0,1fr)_480px] xl:grid-cols-[152px_minmax(0,1fr)_520px]">
        {!branchScope.hasBranchScope ? (
          <section className="col-span-full flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <NoBranchScopeCard />
            </div>
          </section>
        ) : (
          <>
            <div className="hidden min-h-0 lg:block">
              <POSCategoryTiles
                categories={categories}
                layout="column"
                onSelect={setCategoryId}
                selectedCategoryId={categoryId}
              />
            </div>

            <section className="scrollbar-hidden min-h-0 overflow-y-auto border-r border-border bg-canvas">
              {/* `md:grid-cols-4` gave the two text inputs the same width as a
                  button. At counter width the product column is only ~400px, so
                  each cell was ~95px and both fields clipped their own
                  placeholders mid-word ("Searc", "Barco").
                  Four controls do not fit on one row at that width, so they wrap
                  to two: the fields share row 1, the two toggles share row 2.
                  Only at 2xl, where the column is genuinely wide, do all four sit
                  inline with the fields taking the slack. */}
              <div className="sticky top-0 z-10 grid gap-2 border-b border-border bg-card px-3 py-2.5 md:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                <POSProductSearch onChange={setSearch} value={search} />
                <Button
                  className="text-meta min-h-tap w-full justify-center whitespace-nowrap rounded border-border bg-card px-3 font-medium text-foreground shadow-none hover:bg-muted"
                  disabled={!canCreateBakeryOrder}
                  onClick={() => setCreateOrderOpen(true)}
                  type="button"
                  variant="outline"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Create order
                </Button>
                <label className="text-meta min-h-tap flex w-full items-center justify-center gap-2 whitespace-nowrap rounded border border-border bg-card px-3 font-medium text-foreground-muted">
                  <Checkbox
                    checked={showPrices}
                    onCheckedChange={(checked) => setShowPrices(checked === true)}
                  />
                  Show prices
                </label>
              </div>
              <div className="lg:hidden">
                <POSCategoryTiles
                  categories={categories}
                  layout="row"
                  onSelect={setCategoryId}
                  selectedCategoryId={categoryId}
                />
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
        className="fixed bottom-4 right-4 z-20 h-14 rounded-md bg-primary px-5 font-medium text-primary-foreground shadow-lg hover:bg-primary lg:hidden"
        onClick={() => setMobileCartOpen(true)}
        type="button"
      >
        <ShoppingCart className="mr-2 h-5 w-5" />
        Cart ({cart.items.length})
      </Button>

      <Sheet onOpenChange={setMobileCartOpen} open={mobileCartOpen}>
        <SheetContent className="w-full border-border bg-card p-0 sm:max-w-md" side="right">
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
        <DialogContent className="max-w-[34rem] rounded-lg border-border bg-card p-0 text-foreground shadow-lg">
          <div className="border-b border-border bg-muted px-5 py-4">
            <DialogHeader>
              <DialogTitle className="text-title">Choose a variant</DialogTitle>
              <DialogDescription className="text-foreground-muted">
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
                    className="h-auto items-center justify-between gap-4 rounded-lg border-border bg-card p-3 text-left shadow-none transition hover:border-border hover:bg-muted disabled:border-danger/30 disabled:bg-danger-tint disabled:text-danger-text"
                    disabled={isOutOfStock}
                    key={variant.id}
                    onClick={() => {
                      addProduct(variantProduct, variant);
                      setVariantProduct(null);
                    }}
                    type="button"
                    variant="outline"
                  >
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-foreground-muted">
                      {variantImageUrl ? (
                        <img alt="" className="h-full w-full object-cover" src={variantImageUrl} />
                      ) : (
                        <PackagePlus className="h-5 w-5" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                      <span className="line-clamp-1 text-body font-medium text-foreground">
                        {variant.variantName}
                      </span>
                      {metadata ? (
                        <span className="line-clamp-1 text-xs font-medium text-foreground-muted">
                          {metadata}
                        </span>
                      ) : null}
                      <span
                        className={
                          isOutOfStock
                            ? "rounded-full bg-danger-tint px-2 py-0.5 text-meta font-medium text-danger-text"
                            : "rounded-md bg-muted px-2 py-0.5 text-meta font-medium text-foreground-muted"
                        }
                      >
                        {stockLabel}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {showPrices ? (
                        <span className="font-mono text-body font-medium text-foreground">
                          AED {variant.salePrice.toFixed(2)}
                        </span>
                      ) : null}
                      <span className="rounded-md bg-primary px-3 py-1 text-meta font-medium text-primary-foreground">
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
        customerCreditBalance={customerCreditBalance}
        customerId={customerId}
        feedback={checkoutFeedback}
        hasBlocker={checkoutBlocker !== null}
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
          setAutoSelectedPaymentMethodId(null);
          setPaymentAutoSelectionSuppressedChannelId(salesChannelId);
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
        }}
        onOpenChange={setReceiptOpen}
        open={receiptOpen}
        receipt={receipt}
      />
    </div>
  );
}
