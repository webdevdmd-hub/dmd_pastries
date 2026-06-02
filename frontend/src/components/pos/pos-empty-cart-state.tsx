import { ShoppingBasket } from "lucide-react";
import type { JSX } from "react";

export function POSEmptyCartState(): JSX.Element {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f4f4f5] text-[#71717a]">
        <ShoppingBasket aria-hidden="true" className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-lg font-black text-[#a1a1aa]">Cart is empty</h3>
      <p className="mx-auto mt-1 max-w-52 text-sm leading-6 text-[#a1a1aa]">
        Start adding items to begin billing.
      </p>
    </div>
  );
}
