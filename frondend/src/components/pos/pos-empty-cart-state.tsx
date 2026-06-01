import { ShoppingBasket } from "lucide-react";
import type { JSX } from "react";

export function POSEmptyCartState(): JSX.Element {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-brand-cappuccino/80 bg-white/70 px-5 py-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-latte text-brand-mocha">
        <ShoppingBasket aria-hidden="true" className="h-6 w-6" />
      </div>
      <h3 className="mt-3 font-black text-brand-espresso">Cart is empty</h3>
      <p className="mx-auto mt-1 max-w-48 text-sm leading-6 text-brand-mocha">
        Start adding items to begin billing.
      </p>
    </div>
  );
}
