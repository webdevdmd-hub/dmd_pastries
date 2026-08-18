import { ShoppingBasket } from "lucide-react";
import type { JSX } from "react";

import { EmptyState } from "@/components/shared/collection-state";

/**
 * Empty cart, Counter register (plan item E2).
 *
 * Uses the same primitive as every Ledger empty state and comes out terse without
 * being told to: EmptyState reads the register from context, and inside the (pos)
 * tree that is "counter", which drops the body copy and the action. A cashier
 * mid-shift is not reading a paragraph, and the way out of an empty cart is the
 * product grid, not a button inside the cart.
 *
 * The description below is therefore only rendered in Ledger — it is kept so the
 * component still reads correctly if the cart panel is ever shown outside the
 * counter, and costs nothing when it is not.
 */
export function POSEmptyCartState(): JSX.Element {
  return (
    <EmptyState
      description="Scan a barcode or tap a product to start the sale."
      icon={ShoppingBasket}
      title="Cart is empty"
    />
  );
}
