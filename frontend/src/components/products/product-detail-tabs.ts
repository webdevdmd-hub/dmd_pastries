import { ROUTES } from "@/constants/routes";

/**
 * The three sections of a product's details.
 *
 * They used to be one scroll inside the drawer: image, metrics, flags,
 * description, classification, then the variants table at the bottom.
 * Reaching the variants meant scrolling past everything else.
 */
export type ProductDetailTabKey = "overview" | "details" | "variants";

export const PRODUCT_DETAIL_TAB_KEYS: readonly ProductDetailTabKey[] = [
  "overview",
  "details",
  "variants",
] as const;

/** Overview is the default, so it is spelled as the bare route. */
export const DEFAULT_PRODUCT_DETAIL_TAB: ProductDetailTabKey = "overview";

export const PRODUCT_DETAIL_TAB_QUERY_KEY = "tab";

export function isProductDetailTabKey(
  value: string | null | undefined,
): value is ProductDetailTabKey {
  return PRODUCT_DETAIL_TAB_KEYS.some((key) => key === value);
}

/** Unknown or absent `?tab=` falls back to Overview rather than throwing. */
export function parseProductDetailTab(value: string | null | undefined): ProductDetailTabKey {
  return isProductDetailTabKey(value) ? value : DEFAULT_PRODUCT_DETAIL_TAB;
}

/** The canonical URL for one tab of one product, preserving any other params. */
export function productDetailTabHref(
  productId: string,
  tab: ProductDetailTabKey,
  params?: URLSearchParams,
): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_PRODUCT_DETAIL_TAB) {
    next.delete(PRODUCT_DETAIL_TAB_QUERY_KEY);
  } else {
    next.set(PRODUCT_DETAIL_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  const base = `${ROUTES.products}/${productId}`;
  return query ? `${base}?${query}` : base;
}
