"use client";

import Link from "next/link";
import type { JSX } from "react";

import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
import { ROUTES } from "@/constants/routes";

/** The two views that filter the table in place, without leaving the page. */
export type InventoryView = "all" | "low_stock";

type InventoryViewTabsProps = {
  canViewExpiryAlerts: boolean;
  canViewLocationBalances: boolean;
  canViewLowStock: boolean;
  canViewStockMovements: boolean;
  canViewStockTransfers: boolean;
  expiringCount: number;
  lowStockCount: number;
  onViewChange: (view: InventoryView) => void;
  view: InventoryView;
};

/**
 * Replaces the six full-size navigation cards that used to sit above the
 * table -- roughly 370px of chrome for what is really a row of destinations.
 *
 * Two groups, and the divider between them is the honest part. The first is a
 * SegmentedControl: it filters the table underneath and you stay where you
 * are. The second are links to routes with genuinely different table shapes
 * (movements is one row per transaction, location balances is item x
 * location), which is why the plan keeps them as separate pages rather than
 * flattening them into this one.
 *
 * The first group is a radiogroup, not a tablist. An earlier cut of this file
 * hand-rolled role="tablist"/role="tab", which announces the WAI-ARIA tabs
 * contract -- arrow keys move between tabs, a roving tabindex makes the group
 * one tab stop, and each tab controls a tabpanel. None of that was
 * implemented, and there is no tabpanel to point at: the table region below is
 * five mutually-exclusive branches with the toolbar sitting between it and
 * this control, and it is filtered by search and the popover too, so it is not
 * a panel this control owns. SegmentedControl already implements the
 * radiogroup contract properly, so this defers to it rather than reimplementing
 * a weaker copy.
 *
 * "Expiring soon" sits in the link group rather than becoming a view, despite
 * having a count. The only in-page filter available is `expiryTrackedOnly`,
 * which selects items with expiry tracking switched on -- not items that are
 * expiring. Wiring the label "Expiring soon" to that filter would show a
 * manager every tracked item and call them all expiring. The expiry-alerts
 * route already answers the real question, so the link points there.
 */
export function InventoryViewTabs({
  canViewExpiryAlerts,
  canViewLocationBalances,
  canViewLowStock,
  canViewStockMovements,
  canViewStockTransfers,
  expiringCount,
  lowStockCount,
  onViewChange,
  view,
}: InventoryViewTabsProps): JSX.Element {
  const options: SegmentedControlOption<InventoryView>[] = [
    { label: "All items", value: "all" },
    ...(canViewLowStock
      ? [{ badge: lowStockCount, label: "Low stock", value: "low_stock" as const }]
      : []),
  ];

  const links: { count?: number; href: string; label: string; visible: boolean }[] = [
    {
      count: expiringCount,
      href: ROUTES.inventoryExpiryAlerts,
      label: "Expiring soon",
      visible: canViewExpiryAlerts,
    },
    {
      href: ROUTES.inventoryLocationBalances,
      label: "By location",
      visible: canViewLocationBalances,
    },
    { href: ROUTES.inventoryMovements, label: "Movements", visible: canViewStockMovements },
    { href: ROUTES.inventoryStockTransfers, label: "Transfers", visible: canViewStockTransfers },
  ];

  const visibleLinks = links.filter((link) => link.visible);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        aria-label="Inventory view"
        onValueChange={onViewChange}
        options={options}
        value={view}
      />

      {visibleLinks.length > 0 ? (
        <nav aria-label="Other inventory views" className="flex flex-wrap items-center gap-0.5">
          {visibleLinks.map((link) => (
            <Link
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-sm px-3 text-meta font-medium text-foreground-muted transition-colors duration-fast ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-canvas"
              href={link.href}
              key={link.href}
            >
              {link.label}
              {link.count ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning-tint px-1.5 text-xs font-medium tabular-nums text-warning-text">
                  {link.count}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
