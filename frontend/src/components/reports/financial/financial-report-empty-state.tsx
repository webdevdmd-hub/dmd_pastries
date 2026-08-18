import { WalletCards } from "lucide-react";
import type { JSX } from "react";

import { EmptyState } from "@/components/shared/collection-state";

/**
 * Module adapter for the canonical empty state (DESIGN.md §8, plan item E2).
 *
 * This one was missed by the E2 sweep and kept its own markup — a `rounded-2xl`
 * dashed card on `brand-cappuccino` / `brand-latte` / `brand-espresso`, none of
 * which are in the v3 token set. Signature unchanged so call sites do not move.
 */
export function FinancialReportEmptyState({ message }: { message: string }): JSX.Element {
  return <EmptyState icon={WalletCards} title={message} />;
}
