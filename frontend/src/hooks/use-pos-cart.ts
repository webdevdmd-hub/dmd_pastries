"use client";

import { useMemo, useState } from "react";

import { calculateDocumentChargeTotals, type DocumentTaxMode } from "@/lib/document-charges";
import type { DocumentChargeDraft } from "@/types/document-charges";
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
  if (!type || value === null || !Number.isFinite(value)) {
    return 0;
  }

  if (type === "percentage") {
    return roundMoney(subtotal * Math.min(Math.max(value, 0), 100) * 0.01);
  }

  return roundMoney(Math.min(Math.max(value, 0), subtotal));
}

// Mirror the backend's calculateTax: inclusive rates back the tax out of the
// price instead of adding it on top.
function calculateTax(amount: number, rate: number, inclusive: boolean): number {
  if (amount <= 0 || rate <= 0) {
    return 0;
  }

  if (inclusive) {
    return roundMoney(amount - amount / (1 + rate / 100));
  }

  return roundMoney((amount * rate) / 100);
}

// W3: an explicit document tax mode overrides each rate's own inclusive
// flag; null keeps the legacy per-rate behavior (matches the server's
// business-default fallback for single-rate setups).
function effectiveInclusive(rateInclusive: boolean, taxMode: DocumentTaxMode | null): boolean {
  if (taxMode === "inclusive") {
    return true;
  }
  if (taxMode === "exclusive") {
    return false;
  }
  return rateInclusive;
}

function calculateLine(item: CartItem, taxMode: DocumentTaxMode | null = null): CartItem {
  const lineSubtotal = roundMoney(item.quantity * item.unitPrice);
  const discountAmount = calculateDiscount(lineSubtotal, item.discountType, item.discountValue);
  const taxableAmount = Math.max(lineSubtotal - discountAmount, 0);
  if (taxMode === "no_tax") {
    return {
      ...item,
      lineSubtotal,
      discountAmount,
      taxAmount: 0,
      lineTotal: roundMoney(taxableAmount),
    };
  }
  const inclusive = effectiveInclusive(item.taxRateIsInclusive, taxMode);
  const taxAmount = calculateTax(taxableAmount, item.taxRatePercentage, inclusive);

  return {
    ...item,
    lineSubtotal,
    discountAmount,
    taxAmount,
    lineTotal: inclusive ? roundMoney(taxableAmount) : roundMoney(taxableAmount + taxAmount),
  };
}

function createCartId(productId: string, variantId: string | null): string {
  return `${productId}:${variantId ?? "base"}`;
}

export function usePOSCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [saleDiscountType, setSaleDiscountType] = useState<CartDiscountType | null>(null);
  const [saleDiscountValue, setSaleDiscountValue] = useState<number | null>(null);
  const [charges, setCharges] = useState<DocumentChargeDraft[]>([]);
  const [payments, setPayments] = useState<PaymentInput[]>([]);
  // W3: null = business default (server decides; preview uses per-rate math).
  const [taxMode, setTaxMode] = useState<DocumentTaxMode | null>(null);

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
          imageUrl: variant?.imageUrl ?? product.imageUrl,
          imageFileId: variant?.imageFileId ?? product.imageFileId,
          quantity: 1,
          unitPrice,
          discountType: null,
          discountValue: null,
          taxRatePercentage: product.taxRatePercentage,
          taxRateName: product.taxRateName,
          taxRateIsInclusive: product.taxRateIsInclusive,
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
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.cartItemId === cartItemId ? calculateLine({ ...item, quantity }) : item,
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
    setCharges([]);
    setPayments([]);
    setTaxMode(null);
  };

  const restoreHeldSaleCart = (
    nextItems: CartItem[],
    nextSaleDiscountType: CartDiscountType | null,
    nextSaleDiscountValue: number | null,
    nextCharges: DocumentChargeDraft[] = [],
  ): void => {
    setItems(nextItems.map((item) => calculateLine(item)));
    setSaleDiscountType(nextSaleDiscountType);
    setSaleDiscountValue(nextSaleDiscountValue);
    setCharges(nextCharges);
    setPayments([]);
  };

  const totals = useMemo<CartTotals>(() => {
    const itemSubtotal = roundMoney(items.reduce((sum, item) => sum + item.lineSubtotal, 0));
    const lineDiscounts = roundMoney(items.reduce((sum, item) => sum + item.discountAmount, 0));
    // Mirror the backend checkout math: the sale discount is allocated proportionally
    // onto each line and tax is computed on the discounted line amount.
    const lineNets = items.map((item) =>
      roundMoney(Math.max(item.lineSubtotal - item.discountAmount, 0)),
    );
    const lineNetTotal = roundMoney(lineNets.reduce((sum, net) => sum + net, 0));
    const saleDiscount = calculateDiscount(lineNetTotal, saleDiscountType, saleDiscountValue);

    let taxAmount = 0;
    let itemsTotal = 0;
    items.forEach((item, index) => {
      const lineNet = lineNets[index] ?? 0;
      const allocatedSaleDiscount =
        saleDiscount > 0 && lineNetTotal > 0 && lineNet > 0
          ? roundMoney((saleDiscount * lineNet) / lineNetTotal)
          : 0;
      const discountedLine = roundMoney(
        Math.max(item.lineSubtotal - item.discountAmount - allocatedSaleDiscount, 0),
      );
      const inclusive = effectiveInclusive(item.taxRateIsInclusive, taxMode);
      const lineTax =
        taxMode === "no_tax"
          ? 0
          : calculateTax(discountedLine, item.taxRatePercentage, inclusive);
      taxAmount += lineTax;
      itemsTotal += inclusive || taxMode === "no_tax" ? discountedLine : discountedLine + lineTax;
    });
    taxAmount = roundMoney(taxAmount);

    const { chargeAmount, chargeTaxAmount, chargeTotal } = calculateDocumentChargeTotals(
      charges,
      taxMode,
    );
    const total = roundMoney(itemsTotal + chargeTotal);
    const paidAmount = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));

    return {
      subtotal: itemSubtotal,
      discountAmount: roundMoney(lineDiscounts + saleDiscount),
      taxAmount,
      chargeAmount,
      chargeTaxAmount,
      total,
      paidAmount,
      changeAmount: roundMoney(Math.max(paidAmount - total, 0)),
      balanceDue: roundMoney(Math.max(total - paidAmount, 0)),
    };
  }, [charges, items, payments, saleDiscountType, saleDiscountValue, taxMode]);

  return {
    items,
    charges,
    payments,
    saleDiscountType,
    saleDiscountValue,
    taxMode,
    setTaxMode,
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
    setCharges,
    clearCart,
    restoreHeldSaleCart,
  };
}
