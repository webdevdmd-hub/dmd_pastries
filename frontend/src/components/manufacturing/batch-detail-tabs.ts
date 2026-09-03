import { ROUTES } from "@/constants/routes";

/**
 * The five sections of a production batch.
 *
 * Overview is the progress and the timeline -- how far this batch has got,
 * which is why anyone opens it. The other four are the batch's four ledgers:
 * what went in, what it was packed in, what came out, and what was lost. They
 * used to be five cards spread across a two-column grid, with wastage and the
 * timeline in a narrow right rail where a long wastage list had nowhere to go.
 */
export type BatchDetailTabKey = "overview" | "ingredients" | "packaging" | "output" | "wastage";

export const BATCH_DETAIL_TAB_KEYS: readonly BatchDetailTabKey[] = [
  "overview",
  "ingredients",
  "packaging",
  "output",
  "wastage",
] as const;

/** Overview is the default, so it is spelled as the bare route. */
export const DEFAULT_BATCH_DETAIL_TAB: BatchDetailTabKey = "overview";

export const BATCH_DETAIL_TAB_QUERY_KEY = "tab";

export function isBatchDetailTabKey(value: string | null | undefined): value is BatchDetailTabKey {
  return BATCH_DETAIL_TAB_KEYS.some((key) => key === value);
}

/** Unknown or absent `?tab=` falls back to Overview rather than throwing. */
export function parseBatchDetailTab(value: string | null | undefined): BatchDetailTabKey {
  return isBatchDetailTabKey(value) ? value : DEFAULT_BATCH_DETAIL_TAB;
}

/** The canonical URL for one tab of one batch, preserving any other params. */
export function batchDetailTabHref(
  batchId: string,
  tab: BatchDetailTabKey,
  params?: URLSearchParams,
): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_BATCH_DETAIL_TAB) {
    next.delete(BATCH_DETAIL_TAB_QUERY_KEY);
  } else {
    next.set(BATCH_DETAIL_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  const base = `${ROUTES.manufacturingBatches}/${batchId}`;
  return query ? `${base}?${query}` : base;
}
