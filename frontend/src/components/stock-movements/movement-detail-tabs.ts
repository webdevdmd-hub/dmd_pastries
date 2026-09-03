/**
 * The three sections of a stock movement.
 *
 * Movement is what happened to the stock, which is why anyone opens a ledger
 * row. Costing is what it was worth and where it landed in accounting. Trace is
 * the provenance: which module wrote the row, who, when, and what reversed it.
 * All three used to be one scroll of sixteen boxed fields in which the reason
 * for the movement sat below the valuation method.
 */
export type MovementDetailTabKey = "movement" | "costing" | "trace";

export const MOVEMENT_DETAIL_TAB_KEYS: readonly MovementDetailTabKey[] = [
  "movement",
  "costing",
  "trace",
] as const;

/** Movement is the default, so it is spelled as the bare route. */
export const DEFAULT_MOVEMENT_DETAIL_TAB: MovementDetailTabKey = "movement";

export const MOVEMENT_DETAIL_TAB_QUERY_KEY = "tab";

/** The full page for one ledger row. Not a ROUTES entry: `inventoryMovements`
 *  is the module tab URL (`/inventory?view=movements`), not a path base. */
export const MOVEMENT_DETAIL_BASE_PATH = "/inventory/movements";

export function isMovementDetailTabKey(
  value: string | null | undefined,
): value is MovementDetailTabKey {
  return MOVEMENT_DETAIL_TAB_KEYS.some((key) => key === value);
}

/** Unknown or absent `?tab=` falls back to Movement rather than throwing. */
export function parseMovementDetailTab(value: string | null | undefined): MovementDetailTabKey {
  return isMovementDetailTabKey(value) ? value : DEFAULT_MOVEMENT_DETAIL_TAB;
}

/** The canonical URL for one tab of one movement, preserving any other params. */
export function movementDetailTabHref(
  movementId: string,
  tab: MovementDetailTabKey,
  params?: URLSearchParams,
): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_MOVEMENT_DETAIL_TAB) {
    next.delete(MOVEMENT_DETAIL_TAB_QUERY_KEY);
  } else {
    next.set(MOVEMENT_DETAIL_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  const base = `${MOVEMENT_DETAIL_BASE_PATH}/${movementId}`;
  return query ? `${base}?${query}` : base;
}
