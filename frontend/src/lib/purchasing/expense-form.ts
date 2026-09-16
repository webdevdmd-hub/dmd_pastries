/**
 * Branch rules for the expense form.
 *
 * The page passed the branch SCOPE's default into the form. For an owner who
 * can see every branch that default is the filter value "all" -- not a branch.
 * Measured on production on 2026-09-16, the Record expense form then:
 *
 *   - showed "Select branch", because no option has the id "all";
 *   - found no payment account for branch "all" and warned "Configure an
 *     active payment account for this branch before recording expenses",
 *     although Main Branch had three;
 *   - passed its own "Branch is required" check, because "all" is not empty,
 *     so an empty submit listed three errors instead of four.
 *
 * Regression: ISSUE-036 — the expense form treated "all branches" as a branch
 * Found by /qa on 2026-09-16
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 */

/** The scope value meaning "every branch". A filter, never a branch to record against. */
export const ALL_BRANCHES = "all";

export function isRecordableBranchId(branchId: string): boolean {
  const trimmed = branchId.trim();
  return trimmed !== "" && trimmed !== ALL_BRANCHES;
}

/**
 * The branch a new expense starts on: the user's own branch when they have one,
 * otherwise the first active branch they can record against, otherwise none.
 */
export function initialExpenseBranchId(
  scopeDefault: string,
  branches: readonly { id: string; status?: string }[],
): string {
  if (isRecordableBranchId(scopeDefault) && branches.some((branch) => branch.id === scopeDefault)) {
    return scopeDefault;
  }
  const active = branches.find((branch) => !branch.status || branch.status === "active");
  return active?.id ?? "";
}
