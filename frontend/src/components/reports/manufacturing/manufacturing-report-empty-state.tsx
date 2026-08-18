import { Soup } from "lucide-react";
import type { JSX } from "react";

import { EmptyState } from "@/components/shared/collection-state";

/**
 * Module adapter for the canonical empty state (DESIGN.md §8, plan item E2).
 * Missed by the E2 sweep; kept its own dashed card on legacy brand-* tokens.
 * Signature unchanged so call sites do not move.
 */
export function ManufacturingReportEmptyState({ message }: { message: string }): JSX.Element {
  return <EmptyState icon={Soup} title={message} />;
}
