"use client";

import Link from "next/link";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";

/**
 * Opens the journal entry a document posted. Journal entries need
 * accounting.view; a till, orders, inventory or production role without it was
 * sent to "Access denied" (ISSUE-069), so the link is not offered to them.
 */
export function AccountingJournalLink({
  className,
  id,
}: {
  className?: string;
  id: string | null;
}): JSX.Element | null {
  const { hasPermission } = usePermission();
  if (!id || !hasPermission(PERMISSIONS.accountingView)) return null;

  return (
    <Button asChild className={className} size="sm" type="button" variant="outline">
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
