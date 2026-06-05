import Link from "next/link";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

export function AccountingJournalLink({ id }: { id: string | null }): JSX.Element | null {
  if (!id) return null;

  return (
    <Button asChild size="sm" type="button" variant="outline">
      <Link href={`${ROUTES.accountingJournalEntries}?search=${encodeURIComponent(id)}`}>
        View Journal
      </Link>
    </Button>
  );
}

export function StockMovementLink({ id }: { id: string | null }): JSX.Element | null {
  if (!id) return null;

  return (
    <Button asChild size="sm" type="button" variant="outline">
      <Link href={`/inventory/movements/${id}`}>Stock Movement</Link>
    </Button>
  );
}
