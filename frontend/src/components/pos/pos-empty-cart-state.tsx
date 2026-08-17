import { ShoppingBasket } from "lucide-react";
import type { JSX } from "react";

/**
 * Empty cart, Counter register.
 *
 * `min-h-64` was forcing 256px inside a flex column that shrinks as the totals
 * block grows, so the copy clipped behind the VAT divider. `h-full` lets it
 * centre in whatever space is left instead of demanding a fixed slab.
 *
 * The old copy was `text-foreground-muted` — about 2.8:1, under the AA floor. It read as
 * "disabled" when nothing is disabled: an empty cart is the normal state at the
 * start of every sale, not an error or an inactive control.
 */
export function POSEmptyCartState(): JSX.Element {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center px-5 py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground-muted">
        <ShoppingBasket aria-hidden="true" className="h-5 w-5" />
      </div>
      <h3 className="text-title mt-4 text-foreground">Cart is empty</h3>
      <p className="text-body mt-1 max-w-52 text-foreground-muted">
        Scan a barcode or tap a product to start the sale.
      </p>
    </div>
  );
}
