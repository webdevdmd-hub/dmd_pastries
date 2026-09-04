import { ArrowRight, RotateCcw } from "lucide-react";
import type { JSX } from "react";

import { useConnectivity } from "@/components/connectivity/connectivity-provider";
import { POSCartItem } from "@/components/pos/pos-cart-item";
import { POSChargesControl } from "@/components/pos/pos-charges-control";
import { POSEmptyCartState } from "@/components/pos/pos-empty-cart-state";
import { Button } from "@/components/ui/button";
import type { DocumentChargeDraft } from "@/types/document-charges";
import type { CartItem, CartTotals } from "@/types/pos";

type POSCartPanelProps = {
  canSell: boolean;
  charges: DocumentChargeDraft[];
  isCheckingOut: boolean;
  items: CartItem[];
  onChargesChange: (charges: DocumentChargeDraft[]) => void;
  onCheckout: () => void;
  onClear: () => void;
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

/**
 * The cart: what is being bought, what it comes to, and the control that takes
 * the money.
 *
 * Customer, sales channel, VAT mode and discounts were removed from this panel
 * on request. The checkout payload still carries those fields and now sends
 * null for each, which is what it already meant by "use the business default" --
 * so a sale still posts with the branch's configured tax treatment.
 */
export function POSCartPanel({
  canSell,
  charges,
  isCheckingOut,
  items,
  onChargesChange,
  onCheckout,
  onClear,
  onQuantityChange,
  onRemoveItem,
  totals,
}: POSCartPanelProps): JSX.Element {
  const { isOffline } = useConnectivity();
  const itemCountLabel = items.length === 1 ? "1 item" : `${String(items.length)} items`;

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-card text-foreground">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3.5">
        <p className="text-section font-medium text-foreground">Your cart</p>
        <p className="text-meta font-mono tabular-nums text-foreground-muted">{itemCountLabel}</p>
      </div>

      <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
        {items.length === 0 ? (
          <POSEmptyCartState />
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <POSCartItem
                item={item}
                key={item.cartItemId}
                onQuantityChange={onQuantityChange}
                onRemove={onRemoveItem}
              />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t border-border bg-card p-4">
        {items.length > 0 ? (
          <POSChargesControl
            charges={charges}
            className="border-b border-border pb-3"
            onChange={onChargesChange}
          />
        ) : null}

        <div className="space-y-2">
          <div className="text-body flex justify-between">
            <span className="text-foreground-muted">Subtotal</span>
            <span className="font-mono font-medium tabular-nums text-foreground">
              {formatMoney(totals.subtotal)}
            </span>
          </div>
          <div className="text-body flex justify-between">
            <span className="text-foreground-muted">Tax</span>
            <span className="font-mono font-medium tabular-nums text-foreground">
              {formatMoney(totals.taxAmount + totals.chargeTaxAmount)}
            </span>
          </div>
          {totals.chargeAmount > 0 ? (
            <div className="text-body flex justify-between">
              <span className="text-foreground-muted">Charges</span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatMoney(totals.chargeAmount)}
              </span>
            </div>
          ) : null}

          {/* The total is the one thing on this screen a cashier reads from a
              metre away, so it gets the size rather than the weight: 32px mono
              at -0.045em tracking, weight 500 (DESIGN.md section 2). */}
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
            <span className="text-body font-medium text-foreground">Total</span>
            <span className="text-total font-mono tabular-nums text-foreground">
              {formatMoney(totals.total)}
            </span>
          </div>
        </div>

        {/* The commit action: the one saturated thing on the screen, because it
            is the one control that moves money (DESIGN.md sections 3.2 and 6).
            The label carries the amount so a cashier confirms the figure on the
            button, not just the word. */}
        <Button
          className="text-body h-14 w-full rounded bg-money font-medium text-primary-foreground shadow-none hover:bg-money-hover disabled:bg-muted disabled:text-foreground-disabled"
          disabled={!canSell || items.length === 0 || isCheckingOut || isOffline}
          onClick={onCheckout}
          type="button"
        >
          {isCheckingOut ? (
            "Processing..."
          ) : !canSell ? (
            "Sell permission required"
          ) : isOffline ? (
            "Charging unavailable while offline"
          ) : items.length === 0 ? (
            "Create order"
          ) : (
            <>
              Create order{" "}
              <span className="font-mono tabular-nums">{formatMoney(totals.total)}</span>
            </>
          )}
          <ArrowRight className="ml-3 h-5 w-5" />
        </Button>

        <Button
          className="text-body min-h-tap w-full rounded border-border bg-card font-medium text-danger-text shadow-none hover:border-danger hover:bg-danger-tint"
          disabled={items.length === 0}
          onClick={onClear}
          type="button"
          variant="outline"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Clear cart
        </Button>
      </div>
    </aside>
  );
}
