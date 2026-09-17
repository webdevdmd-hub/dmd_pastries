/**
 * Display names for accounting codes. The pages printed stored values as
 * they are -- "Pos Sale Cogs" for a journal source, "asset · current_asset ·
 * debit" under every account in a picker, "accounts_payable" as a mapping
 * title. (ISSUE-053)
 */

const ACRONYMS: Record<string, string> = {
  cogs: "COGS",
  grn: "GRN",
  grni: "GRNI",
  pos: "POS",
  vat: "VAT",
};

/** "current_asset" -> "current asset". */
export function humanizeAccountingValue(value: string | null | undefined): string {
  return (value ?? "")
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => ACRONYMS[part.toLowerCase()] ?? part.toLowerCase())
    .join(" ");
}

/** "pos_sale_cogs" -> "POS Sale COGS". */
export function journalSourceLabel(sourceType: string): string {
  return sourceType
    .split("_")
    .filter((part) => part.length > 0)
    .map(
      (part) =>
        ACRONYMS[part.toLowerCase()] ??
        `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`,
    )
    .join(" ");
}

/** The line under an account in a picker: "asset · current asset · debit". */
export function accountOptionDescription(account: {
  accountGroup?: string | null;
  accountType: string;
  normalBalance?: string | null;
}): string {
  return [account.accountType, account.accountGroup ?? "No group", account.normalBalance]
    .filter((part): part is string => Boolean(part))
    .map((part) => humanizeAccountingValue(part) || part)
    .join(" · ");
}
