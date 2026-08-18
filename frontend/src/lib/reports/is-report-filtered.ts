/**
 * Has the user narrowed this report beyond its defaults?
 *
 * Compares the APPLIED filters against the same object built from the report's
 * initial draft. Applied, not draft: the draft changes as someone types in the
 * filter bar, but the rows on screen still reflect the last Apply, and the
 * zero-row state has to describe the rows on screen.
 *
 * Pagination is not narrowing. Several report filter objects carry `page` /
 * `limit` alongside the real filters; landing on an empty page 3 is a paging
 * problem, not a "your filters are too narrow" problem, so those keys are
 * ignored.
 *
 * A shallow compare is enough — report filter objects are flat records of
 * strings (branch id, date, status, a lookup id). Values are stringified so a
 * `2` and a `"2"` from different code paths do not read as a change.
 */
/**
 * Absent, null and empty string all mean "not set" to these endpoints, so they
 * compare equal. Numbers and booleans are stringified so a `2` and a `"2"` from
 * two code paths do not read as a change.
 */
function toComparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

const PAGINATION_KEYS = new Set(["page", "limit", "offset", "pageSize"]);

export function isReportFiltered<TFilters extends Record<string, unknown>>(
  applied: TFilters,
  defaults: TFilters,
): boolean {
  const keys = new Set([...Object.keys(applied), ...Object.keys(defaults)]);

  for (const key of keys) {
    if (PAGINATION_KEYS.has(key)) continue;

    if (toComparable(applied[key]) !== toComparable(defaults[key])) {
      return true;
    }
  }

  return false;
}
