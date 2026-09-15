/**
 * How a failed response's detail values join its message for display.
 *
 * The backend puts two kinds of value in an error's detail map: prose for a
 * person ("Key: 'amount' Error: must be positive") and metadata for code --
 * reason codes, statuses, record ids. The client used to append every string,
 * so toasts read like:
 *
 *   "...Deactivate it instead.: supplier_has_history"          (PR #19, 2026-09-15)
 *   "this supplier is inactive; reactivate it ...: inactive"   (ISSUE-026, 2026-09-15)
 *
 * and a refusal carrying a journal_entry_id ended in a UUID. The metadata stays
 * available to code on ApiError.errors / errorDetails; only the display drops it.
 */

/** A detail is prose when it contains whitespace. Codes, enum values and ids never do. */
export function isProseDetail(value: string): boolean {
  return /\s/.test(value.trim());
}

export function joinErrorMessage(message: string, details: readonly string[]): string {
  const prose = details.map((detail) => detail.trim()).filter(isProseDetail);
  const suffix = prose.filter((detail) => detail !== message).join(", ");
  if (!suffix) {
    return message;
  }
  // "Refused.: reason" reads as a typo; a finished sentence takes a space.
  return /[.!?]$/.test(message.trim()) ? `${message.trim()} ${suffix}` : `${message}: ${suffix}`;
}
