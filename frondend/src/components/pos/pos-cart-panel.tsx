import { CreditCard, PauseCircle, RotateCcw } from "lucide-react";
import type { JSX } from "react";

import { POSCartItem } from "@/components/pos/pos-cart-item";
import { POSCustomerSelector } from "@/components/pos/pos-customer-selector";
import { POSEmptyCartState } from "@/components/pos/pos-empty-cart-state";
import { Button } from "@/components/ui/button";
import type { CartDiscountType, CartItem, CartTotals } from "@/types/pos";

type POSCartPanelProps = {
  canSell: boolean;
  customerId: string | null;
  isCheckingOut: boolean;
  items: CartItem[];
  onCheckout: () => void;
  onClear: () => void;
  onCustomerChange: (customerId: string | null) => void;
  onHoldSale: () => void;
  onLineDiscountChange: (
    cartItemId: string,
    type: CartDiscountType | null,
    value: number | null,
  ) => void;
  onQuantityChange: (cartItemId: string, quantity: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  totals: CartTotals;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

export function POSCartPanel({
  canSell,
  customerId,
  isCheckingOut,
  items,
  onCheckout,
  onClear,
  onCustomerChange,
  onHoldSale,
  onLineDiscountChange,
  onQuantityChange,
  onRemoveItem,
  totals,
}: POSCartPanelProps): JSX.Element {
  const itemCountLabel = items.length === 1 ? "1 item" : `${String(items.length)} items`;
  const customerLabel = customerId ? "Selected customer" : "Walk-in customer";

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-brand-cappuccino/70 bg-white/90 shadow-[0_24px_80px_rgba(59,42,34,0.12)] backdrop-blur">
      <div className="shrink-0 border-b border-brand-cappuccino/55 bg-white/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl leading-none text-brand-espresso">
              Order Details
            </h2>
            <p className="mt-1 text-sm font-medium text-brand-mocha">{customerLabel}</p>
          </div>
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-cappuccino text-sm font-black text-brand-espresso"
          >
            POS
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold text-brand-mocha">
          <div className="rounded-full border border-brand-cappuccino/70 bg-brand-latte/60 px-3 py-1.5">
            Counter
          </div>
          <div className="rounded-full border border-brand-cappuccino/70 bg-brand-latte/60 px-3 py-1.5">
            Draft
          </div>
          <div className="rounded-full border border-brand-cappuccino/70 bg-brand-latte/60 px-3 py-1.5">
            {itemCountLabel}
          </div>
        </div>

        <div className="mt-2">
          <POSCustomerSelector onChange={onCustomerChange} value={customerId} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between bg-brand-latte/45 px-5 py-2.5">
          <div>
            <p className="text-sm font-black text-brand-espresso">Order</p>
            <p className="text-xs text-brand-mocha">Active cart</p>
          </div>
          <p className="text-sm font-black text-brand-espresso">{itemCountLabel}</p>
        </div>

        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
          {items.length === 0 ? (
            <POSEmptyCartState />
          ) : (
            <div className="space-y-2 pb-2">
              {items.map((item) => (
                <POSCartItem
                  item={item}
                  key={item.cartItemId}
                  onDiscountChange={onLineDiscountChange}
                  onQuantityChange={onQuantityChange}
                  onRemove={onRemoveItem}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-brand-cappuccino/70 bg-white/95 p-3.5">
        <div className="rounded-[1.25rem] border border-brand-cappuccino/70 bg-white p-2.5 shadow-sm">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-brand-mocha">Sub Total</span>
              <span className="font-bold text-brand-espresso">{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-mocha">Discount</span>
              <span className="font-bold text-brand-espresso">
                {formatMoney(totals.discountAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-mocha">Tax</span>
              <span className="font-bold text-brand-espresso">{formatMoney(totals.taxAmount)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-brand-cappuccino/60 pt-1.5">
              <span className="text-xs font-bold text-brand-mocha">Total</span>
              <span className="text-xl font-black text-brand-espresso">
                {formatMoney(totals.total)}
              </span>
            </div>
            {totals.paidAmount > 0 ? (
              <div className="grid grid-cols-2 gap-2 border-t border-brand-cappuccino/60 pt-1.5 text-[0.7rem]">
                <div className="flex justify-between text-brand-mocha">
                  <span>Paid</span>
                  <span className="font-semibold text-brand-espresso">
                    {formatMoney(totals.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-green-800">
                  <span>Change</span>
                  <span className="font-semibold">{formatMoney(totals.changeAmount)}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <Button
          className="h-10 w-full rounded-2xl"
          disabled={items.length === 0}
          onClick={onCheckout}
          type="button"
          variant="outline"
        >
          Payment Details
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-10 rounded-2xl" onClick={onHoldSale} type="button" variant="outline">
            <PauseCircle className="mr-2 h-4 w-4" />
            Hold / Resume
          </Button>
          <Button
            className="h-10 rounded-2xl"
            disabled={items.length === 0}
            onClick={onClear}
            type="button"
            variant="outline"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
        <Button
          className="h-12 w-full rounded-2xl text-sm font-black"
          disabled={!canSell || items.length === 0 || isCheckingOut}
          onClick={onCheckout}
          type="button"
        >
          <CreditCard className="mr-2 h-5 w-5" />
          {isCheckingOut
            ? "Processing..."
            : canSell
              ? "Complete checkout"
              : "Sell permission required"}
        </Button>
      </div>
    </aside>
  );
}
