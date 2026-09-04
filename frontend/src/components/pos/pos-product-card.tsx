import { PackagePlus, ShoppingCart } from "lucide-react";
import type { JSX } from "react";

import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import type { POSProduct } from "@/types/pos";

type POSProductCardProps = {
  onAdd: (product: POSProduct) => void;
  onOpenVariants: (product: POSProduct) => void;
  product: POSProduct;
  showPrices: boolean;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

/**
 * A product tile: photograph, name, price, and an add control.
 *
 * The whole tile is still the add target -- at a counter you hit the picture,
 * not a small button -- and the cart glyph in the corner is what tells you so.
 * The long-press-for-variants gesture is gone: a product with variants now says
 * so on a visible button, because a gesture with no affordance is not
 * discoverable and was the documented cause of mis-added items.
 *
 * Hover is a 1px lift plus --shadow-sm, not a border-colour change (DESIGN.md
 * section 5): a darkening border reads as a state change on the object, a lift
 * reads as "this is pressable".
 */
export function POSProductCard({
  onAdd,
  onOpenVariants,
  product,
  showPrices,
}: POSProductCardProps): JSX.Element {
  const imageUrl = getProductImagePreviewUrl(product.imageFileId) ?? product.imageUrl;
  const hasVariants = product.variants.length > 0;
  const isOutOfStock =
    product.availableStockQuantity !== null && product.availableStockQuantity <= 0;
  const isDisabled = isOutOfStock && !hasVariants;

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card text-foreground transition duration-150 hover:-translate-y-px hover:shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
        isOutOfStock ? "opacity-55" : ""
      }`}
    >
      <button
        aria-label={
          hasVariants
            ? `Choose a variant of ${product.productName}`
            : `Add ${product.productName} to cart`
        }
        className="flex flex-1 flex-col text-left disabled:cursor-not-allowed"
        disabled={isDisabled}
        onClick={() => {
          if (hasVariants) {
            onOpenVariants(product);
            return;
          }
          onAdd(product);
        }}
        type="button"
      >
        {imageUrl ? (
          <img alt="" className="aspect-[4/3] w-full bg-muted object-cover" src={imageUrl} />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-foreground-muted">
            <PackagePlus className="h-8 w-8" />
          </div>
        )}

        <div className="flex flex-1 items-end justify-between gap-2 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-body line-clamp-2 whitespace-normal font-medium leading-tight">
              {product.productName}
            </p>
            {/* Out of stock replaces the price line rather than overlaying the
                photograph: when an item cannot be sold, that outranks its
                price. */}
            {isOutOfStock ? (
              <span className="text-meta mt-1 inline-flex min-w-0 items-center gap-1.5 rounded-full bg-danger-tint px-2 py-0.5 font-medium text-danger-text">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                <span className="truncate">Out of stock</span>
              </span>
            ) : showPrices ? (
              <p className="text-body mt-1 font-mono font-medium tabular-nums text-foreground-muted">
                {formatMoney(product.salePrice)}
              </p>
            ) : null}
          </div>

          {/* Decoration, not a second control: the button above already covers
              the whole tile, and two nested buttons would be one tap target
              inside another. */}
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-foreground-muted transition-colors group-hover:bg-muted group-hover:text-foreground"
          >
            <ShoppingCart className="h-5 w-5" />
          </span>
        </div>
      </button>

      {hasVariants ? (
        <span className="text-meta pointer-events-none absolute right-3 top-3 rounded border border-border bg-card/95 px-2 py-1 font-medium text-foreground shadow-sm">
          Variants
        </span>
      ) : null}
    </article>
  );
}
