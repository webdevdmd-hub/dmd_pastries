import { ROUTES } from "@/constants/routes";

/**
 * The three sections of an expense.
 *
 * Overview is what was spent, on what, and out of which account -- the reason
 * anyone opens an expense. Accounting is the journal the backend posted for it.
 * Receipt holds the attachment and the notes. All three used to be three stat
 * cards followed by seven boxed fields on one scroll, with the journal entry id
 * sitting between "Created by" and "Receipt file" as though it were trivia.
 */
export type ExpenseDetailTabKey = "overview" | "accounting" | "receipt";

export const EXPENSE_DETAIL_TAB_KEYS: readonly ExpenseDetailTabKey[] = [
  "overview",
  "accounting",
  "receipt",
] as const;

/** Overview is the default, so it is spelled as the bare route. */
export const DEFAULT_EXPENSE_DETAIL_TAB: ExpenseDetailTabKey = "overview";

export const EXPENSE_DETAIL_TAB_QUERY_KEY = "tab";

export function isExpenseDetailTabKey(
  value: string | null | undefined,
): value is ExpenseDetailTabKey {
  return EXPENSE_DETAIL_TAB_KEYS.some((key) => key === value);
}

/** Unknown or absent `?tab=` falls back to Overview rather than throwing. */
export function parseExpenseDetailTab(value: string | null | undefined): ExpenseDetailTabKey {
  return isExpenseDetailTabKey(value) ? value : DEFAULT_EXPENSE_DETAIL_TAB;
}

/** The canonical URL for one tab of one expense, preserving any other params. */
export function expenseDetailTabHref(
  expenseId: string,
  tab: ExpenseDetailTabKey,
  params?: URLSearchParams,
): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_EXPENSE_DETAIL_TAB) {
    next.delete(EXPENSE_DETAIL_TAB_QUERY_KEY);
  } else {
    next.set(EXPENSE_DETAIL_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  const base = `${ROUTES.expenses}/${expenseId}`;
  return query ? `${base}?${query}` : base;
}
