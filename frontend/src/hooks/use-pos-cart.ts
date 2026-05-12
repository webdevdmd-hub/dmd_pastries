"use client";

import { useMemo, useState } from "react";

import type {
  CartDiscountType,
  CartItem,
  CartTotals,
  PaymentInput,
  POSProduct,
  POSProductVariant,
} from "@/types/pos";

type AddProductInput = {
  product: POSProduct;
  variant?: POSProductVariant;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateDiscount(subtotal: number, type: CartDiscountType | null, value: number | null) {
  if (!type || value === null) {
    return 0;
  }

  if (type === "percentage") {
    return roundMoney(subtotal * Math.min(value, 100) * 0.01);
  }

  return roundMoney(Math.min(value, subtotal));
}

function calculateLine(item: CartItem): CartItem {
  const lineSubtotal = roundMoney(item.quantity * item.unitPrice);
  const discountAmount = calculateDiscount(lineSubtotal, item.discountType, item.discountValue);
  const taxableAmount = Math.max(lineSubtotal - discountAmount, 0);
  const taxAmount = roundMoney(taxableAmount * (item.taxRatePercentage / 100));

  return {
    ...item,
    lineSubtotal,
    discountAmount,
    taxAmount,
    lineTotal: roundMoney(taxableAmount + taxAmount),
  };
}

function createCartId(productId: string, variantId: string | null): string {
  return `${productId}:${variantId ?? "base"}`;
}

export function usePOSCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [saleDiscountType, setSaleDiscountType] = useState<CartDiscountType | null>(null);
  const [saleDiscountValue, setSaleDiscountValue] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentInput[]>([]);

  const addProduct = ({ product, variant }: AddProductInput): void => {
    const variantId = variant?.id ?? null;
    const cartItemId = createCartId(product.id, variantId);
    const unitPrice = variant?.salePrice ?? product.salePrice;

    setItems((currentItems) => {
      const existing = currentItems.find((item) => item.cartItemId === cartItemId);

      if (existing) {
        return currentItems.map((item) =>
          item.cartItemId === cartItemId
            ? calculateLine({ ...item, quantity: item.quantity + 1 })
            : item,
        );
      }

      return [
        ...currentItems,
        calculateLine({
          cartItemId,
          productId: product.id,
          productVariantId: variantId,
          productName: product.productName,
          variantName: variant?.variantName ?? null,
          sku: variant?.sku ?? product.sku,
          quantity: 1,
          unitPrice,
          discountType: null,
          discountValue: null,
          taxRatePercentage: product.taxRatePercentage,
          taxRateName: product.taxRateName,
          lineSubtotal: unitPrice,
          discountAmount: 0,
          taxAmount: 0,
          lineTotal: unitPrice,
        }),
      ];
    });
  };

  const removeItem = (cartItemId: string): void => {
    setItems((currentItems) => currentItems.filter((item) => item.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number): void => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.cartItemId === cartItemId
          ? calculateLine({ ...item, quantity: Math.max(1, quantity) })
          : item,
      ),
    );
  };

  const applyLineDiscount = (
    cartItemId: string,
    discountType: CartDiscountType | null,
    discountValue: number | null,
  ): void => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.cartItemId === cartItemId
          ? calculateLine({ ...item, discountType, discountValue })
          : item,
      ),
    );
  };

  const clearCart = (): void => {
    setItems([]);
    setSaleDiscountType(null);
    setSaleDiscountValue(null);
    setPayments([]);
  };

  const restoreHeldSaleCart = (
    nextItems: CartItem[],
    nextSaleDiscountType: CartDiscountType | null,
    nextSaleDiscountValue: number | null,
  ): void => {
    setItems(nextItems.map(calculateLine));
    setSaleDiscountType(nextSaleDiscountType);
    setSaleDiscountValue(nextSaleDiscountValue);
    setPayments([]);
  };

  const totals = useMemo<CartTotals>(() => {
    const itemSubtotal = roundMoney(items.reduce((sum, item) => sum + item.lineSubtotal, 0));
    const lineDiscounts = roundMoney(items.reduce((sum, item) => sum + item.discountAmount, 0));
    const saleDiscount = calculateDiscount(
      Math.max(itemSubtotal - lineDiscounts, 0),
      saleDiscountType,
      saleDiscountValue,
    );
    const taxAmount = roundMoney(items.reduce((sum, item) => sum + item.taxAmount, 0));
    const total = roundMoney(Math.max(itemSubtotal - lineDiscounts - saleDiscount, 0) + taxAmount);
    const paidAmount = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));

    return {
      subtotal: itemSubtotal,
      discountAmount: roundMoney(lineDiscounts + saleDiscount),
      taxAmount,
      total,
      paidAmount,
      changeAmount: roundMoney(Math.max(paidAmount - total, 0)),
      balanceDue: roundMoney(Math.max(total - paidAmount, 0)),
    };
  }, [items, payments, saleDiscountType, saleDiscountValue]);

  return {
    items,
    payments,
    saleDiscountType,
    saleDiscountValue,
    totals,
    addProduct,
    removeItem,
    updateQuantity,
    increaseQuantity: (cartItemId: string) => {
      const item = items.find((entry) => entry.cartItemId === cartItemId);
      if (item) {
        updateQuantity(cartItemId, item.quantity + 1);
      }
    },
    decreaseQuantity: (cartItemId: string) => {
      const item = items.find((entry) => entry.cartItemId === cartItemId);
      if (item) {
        updateQuantity(cartItemId, item.quantity - 1);
      }
    },
    applyLineDiscount,
    setSaleDiscount: (type: CartDiscountType | null, value: number | null) => {
      setSaleDiscountType(type);
      setSaleDiscountValue(value);
    },
    setPayments,
    clearCart,
    restoreHeldSaleCart,
  };
}
