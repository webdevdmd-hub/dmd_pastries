"use client";

import { useEffect, useState } from "react";

import type { usePOSCart } from "@/hooks/use-pos-cart";
import type { DocumentTaxMode } from "@/lib/document-charges";
import type { DocumentChargeDraft } from "@/types/document-charges";
import type { CartDiscountType, CartItem } from "@/types/pos";

// Regression: ISSUE-011 — a full page reload wiped the register cart mid-sale.
// Found by /qa on 2026-09-14.
//
// This lives beside usePOSCart rather than inside it on purpose: the cart's
// totals are checked by scripts/check-pos-cart-totals.mjs under a React stub
// that provides useState and useMemo only, so the cart hook stays effect-free
// and this hook carries the storage side effects.
//
// The draft is kept in sessionStorage: it survives a refresh and the chunk
// reload that app/error.tsx performs after a deploy, but not the tab, so a
// shared counter device never shows the next cashier a previous cart. Payments
// are not restored; they are re-entered at checkout.
const POS_CART_DRAFT_STORAGE_KEY = "pastries-pos-cart-draft";

type CartDraft = {
  charges: DocumentChargeDraft[];
  items: CartItem[];
  saleDiscountType: CartDiscountType | null;
  saleDiscountValue: number | null;
  taxMode: DocumentTaxMode | null;
};

type POSCart = ReturnType<typeof usePOSCart>;

function readDraft(): CartDraft | null {
  try {
    const raw = window.sessionStorage.getItem(POS_CART_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<CartDraft>;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return null;
    }
    return {
      charges: Array.isArray(parsed.charges) ? parsed.charges : [],
      items: parsed.items,
      saleDiscountType: parsed.saleDiscountType ?? null,
      saleDiscountValue: parsed.saleDiscountValue ?? null,
      taxMode: parsed.taxMode ?? null,
    };
  } catch {
    // A malformed or blocked store is an empty cart, nothing more.
    return null;
  }
}

export function usePOSCartDraft(cart: POSCart): void {
  const [hydrated, setHydrated] = useState(false);
  const {
    charges,
    items,
    restoreHeldSaleCart,
    saleDiscountType,
    saleDiscountValue,
    setTaxMode,
    taxMode,
  } = cart;

  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      restoreHeldSaleCart(
        draft.items,
        draft.saleDiscountType,
        draft.saleDiscountValue,
        draft.charges,
      );
      setTaxMode(draft.taxMode);
    }
    setHydrated(true);
    // Mount only: the restore functions are stable in behaviour and re-running
    // this on every render would overwrite live edits with the stored draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    try {
      if (items.length === 0) {
        window.sessionStorage.removeItem(POS_CART_DRAFT_STORAGE_KEY);
        return;
      }
      const draft: CartDraft = { charges, items, saleDiscountType, saleDiscountValue, taxMode };
      window.sessionStorage.setItem(POS_CART_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Storage full or blocked: the cart still works for this page's lifetime.
    }
  }, [charges, hydrated, items, saleDiscountType, saleDiscountValue, taxMode]);
}
