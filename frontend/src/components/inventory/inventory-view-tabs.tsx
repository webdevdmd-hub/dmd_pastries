"use client";

import Link from "next/link";
import type { JSX } from "react";

import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";

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

const tabClassName =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-sm px-3 text-meta font-medium transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-muted";

function Count({ value }: { value: number }): JSX.Element {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning-tint px-1.5 text-xs font-medium tabular-nums text-warning-text">
      {value}
    </span>
  );
}

/**
 * Replaces the six full-size navigation cards that used to sit above the
 * table -- roughly 370px of chrome for what is really a row of destinations.
 *
 * Split into two groups on purpose, and the divider between them is the
 * honest part. The first group are tabs: they filter the table underneath and
 * you stay where you are, so they are a tablist over the table panel. The
 * second group are links: they navigate to routes with genuinely different
 * table shapes (movements is one row per transaction, location balances is
 * item x location), which is why the plan keeps them as separate pages rather
 * than flattening them into this one. Announcing a link as a tab would tell a
 * screen-reader user the content is about to swap in place when in fact the
 * page is about to change.
 *
 * "Expiring soon" sits in the link group rather than the tab group despite
 * having a count. The in-page filter available here is `expiryTrackedOnly`,
 * which selects items with expiry tracking switched on -- not items that are
 * expiring. Wiring the label "Expiring soon" to that filter would show a
 * manager every tracked item and call them all expiring. The expiry-alerts
 * route already answers the real question, so the tab points there.
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
  const tabs: { label: string; value: InventoryView; count?: number; visible: boolean }[] = [
    { label: "All items", value: "all", visible: true },
    ...(canViewLowStock
      ? [
          {
            label: "Low stock",
            value: "low_stock" as const,
            count: lowStockCount,
            visible: true,
          },
        ]
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
    <div className="flex flex-wrap items-center gap-1 rounded bg-muted p-0.5">
      <div aria-label="Inventory views" className="flex items-center gap-0.5" role="tablist">
        {tabs
          .filter((tab) => tab.visible)
          .map((tab) => {
            const selected = tab.value === view;

            return (
              <button
                aria-selected={selected}
                className={cn(
                  tabClassName,
                  selected
                    ? "bg-card text-foreground shadow-xs"
                    : "text-foreground-muted hover:text-foreground",
                )}
                key={tab.value}
                onClick={() => onViewChange(tab.value)}
                role="tab"
                type="button"
              >
                {tab.label}
                {tab.count ? <Count value={tab.count} /> : null}
              </button>
            );
          })}
      </div>

      {visibleLinks.length > 0 ? (
        <>
          <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />
          <nav aria-label="Other inventory views" className="flex flex-wrap items-center gap-0.5">
            {visibleLinks.map((link) => (
              <Link
                className={cn(tabClassName, "text-foreground-muted hover:text-foreground")}
                href={link.href}
                key={link.href}
              >
                {link.label}
                {link.count ? <Count value={link.count} /> : null}
              </Link>
            ))}
          </nav>
        </>
      ) : null}
    </div>
  );
}
