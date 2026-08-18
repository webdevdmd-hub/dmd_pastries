import { Receipt } from "lucide-react";
import type { JSX } from "react";

import { EmptyState } from "@/components/shared/collection-state";

/**
 * Module adapter for the canonical empty state (DESIGN.md 8, plan item E2).
 * Signature unchanged so call sites do not move.
 */

export function PaymentsEmptyState({
  description,
  title,
}: {
  title?: string | undefined;
  description?: string | undefined;
}): JSX.Element {
  return <EmptyState description={description} icon={Receipt} title={title ?? "No payments yet"} />;
}
