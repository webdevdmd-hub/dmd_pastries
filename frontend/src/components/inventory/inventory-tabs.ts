import { ROUTES } from "@/constants/routes";

/**
 * The six tabs of the Inventory module.
 *
 * All six now live on /inventory and swap a panel in place. They used to be
 * one page plus four sibling routes wearing a tab strip, which is why they
 * read as separate pages: each rebuilt its own H1, its own breadcrumb leaf and
 * its own filter idiom on every click.
 */
export type InventoryTabKey =
  | "all"
  | "low_stock"
  | "expiring"
  | "locations"
  | "movements"
  | "transfers";

export const INVENTORY_TAB_KEYS: readonly InventoryTabKey[] = [
  "all",
  "low_stock",
  "expiring",
  "locations",
  "movements",
  "transfers",
] as const;

/** "All items" is the default, so it is spelled as the bare route. */
export const DEFAULT_INVENTORY_TAB: InventoryTabKey = "all";

export const INVENTORY_TAB_QUERY_KEY = "view";

export function isInventoryTabKey(value: string | null | undefined): value is InventoryTabKey {
  return INVENTORY_TAB_KEYS.some((key) => key === value);
}

/**
 * Unknown or absent `?view=` falls back to "All items" rather than throwing.
 * A stale bookmark should land somewhere useful, not on an error.
 */
export function parseInventoryTab(value: string | null | undefined): InventoryTabKey {
  return isInventoryTabKey(value) ? value : DEFAULT_INVENTORY_TAB;
}

/**
 * Builds a tab URL from a Next.js `searchParams` record, for the server
 * components that stand in for the retired routes. Keeping every param means
 * /inventory/movements?item=X redirects to a still-scoped ledger rather than
 * quietly dropping the deep link on the way.
 */
export function inventoryTabRedirect(
  tab: InventoryTabKey,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) {
      params.set(key, first);
    }
  });
  return inventoryTabHref(tab, params);
}

/**
 * The canonical URL for a tab, preserving any other params already present
 * (notably `?item=` on Movements, which scopes the ledger to one item).
 */
export function inventoryTabHref(tab: InventoryTabKey, params?: URLSearchParams): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_INVENTORY_TAB) {
    next.delete(INVENTORY_TAB_QUERY_KEY);
  } else {
    next.set(INVENTORY_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  return query ? `${ROUTES.inventory}?${query}` : ROUTES.inventory;
}
