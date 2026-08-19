"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { InventoryTableSkeleton } from "@/components/inventory/inventory-table-skeleton";
import {
  INVENTORY_TAB_QUERY_KEY,
  inventoryTabHref,
  type InventoryTabKey,
  parseInventoryTab,
} from "@/components/inventory/inventory-tabs";
import {
  INVENTORY_TABPANEL_ID,
  InventoryViewTabs,
} from "@/components/inventory/inventory-view-tabs";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useExpiryAlerts, useInventory } from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import { resolveDashboardTimezone } from "@/lib/reports/dashboard-filters";

import { AccessDeniedCard } from "./access-denied-card";

// Each panel is its own bundle: /inventory should not ship the transfers
// dialogs and the movements ledger to someone who only opens the item list.
const PANEL_FALLBACK = <InventoryTableSkeleton />;

const InventoryListPanel = dynamic(
  () => import("./inventory-list-panel").then((m) => m.InventoryListPanel),
  { loading: () => PANEL_FALLBACK },
);
const ExpiryAlertsPanel = dynamic(
  () => import("./expiry-alerts-panel").then((m) => m.ExpiryAlertsPanel),
  { loading: () => PANEL_FALLBACK },
);
const LocationBalancesPanel = dynamic(
  () => import("./location-balances-panel").then((m) => m.LocationBalancesPanel),
  { loading: () => PANEL_FALLBACK },
);
const StockTransfersPanel = dynamic(
  () => import("./stock-transfers-panel").then((m) => m.StockTransfersPanel),
  { loading: () => PANEL_FALLBACK },
);
const MovementsPanel = dynamic(
  () => import("@/components/stock-movements/movements-panel").then((m) => m.MovementsPanel),
  { loading: () => PANEL_FALLBACK },
);

/**
 * Each tab keeps the sentence its old page header carried, so the information
 * the five separate H1s used to convey survives without five separate pages.
 */
const TAB_DESCRIPTIONS: Record<InventoryTabKey, string> = {
  all: "Track product stock, branch quantities, movements, low stock, and expiry-sensitive items.",
  low_stock: "Items where available quantity is at or below reorder level.",
  expiring: "Track stock batches that are expiring soon or already expired.",
  locations:
    "View the physical breakdown of branch inventory by stock location. Branch total stock remains the sum of all location balances.",
  movements:
    "Track every stock change including purchases, sales, adjustments, wastage, and transfers.",
  transfers:
    "Move stock between physical locations inside the active branch. Completing a transfer changes location balances while keeping branch total stock unchanged.",
};

/**
 * The Inventory module: one page, six tabs, one panel that swaps.
 *
 * ## Why the URL is driven by `history.pushState` and not `router.push`
 *
 * A tab has to feel instant. `router.push` to the same route with a different
 * `?view=` is a soft navigation, but it still re-runs the route on the server
 * before the panel changes, which is a visible pause on every click -- the
 * exact "this is really a page load" feeling this rework exists to remove.
 * `pushState` updates the address bar and the history stack with no round trip,
 * and `popstate` puts back/forward back in charge. Next 16 keeps
 * `useSearchParams` in sync with History API calls, but this component does not
 * rely on that: it holds the parsed view itself and hands panels what they need.
 */
export function InventoryModuleClient(): JSX.Element {
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([
    PERMISSIONS.inventoryView,
    PERMISSIONS.inventoryMovementsView,
    PERMISSIONS.inventoryLowStockView,
    PERMISSIONS.inventoryExpiryView,
  ]);

  // Seeded from the URL the page was opened with, then owned here.
  const [view, setView] = useState<InventoryTabKey>(() =>
    parseInventoryTab(searchParams.get(INVENTORY_TAB_QUERY_KEY)),
  );
  // Everything except `view` -- carried into each tab's href so a scoped
  // Movements deep link survives a trip through the other tabs.
  const [carriedParams, setCarriedParams] = useState<URLSearchParams>(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(INVENTORY_TAB_QUERY_KEY);
    return next;
  });

  useEffect(() => {
    const syncFromLocation = (): void => {
      const params = new URLSearchParams(window.location.search);
      setView(parseInventoryTab(params.get(INVENTORY_TAB_QUERY_KEY)));
      params.delete(INVENTORY_TAB_QUERY_KEY);
      setCarriedParams(params);
    };
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  const handleViewChange = useCallback(
    (next: InventoryTabKey): void => {
      setView(next);
      window.history.pushState({}, "", inventoryTabHref(next, carriedParams));
    },
    [carriedParams],
  );

  // Dropping the item scope is a URL change, so it belongs to whoever owns the
  // URL. The Movements panel asks; the container edits and pushes.
  const handleClearItemScope = useCallback((): void => {
    setCarriedParams((current) => {
      const next = new URLSearchParams(current.toString());
      next.delete("item");
      window.history.pushState({}, "", inventoryTabHref("movements", next));
      return next;
    });
  }, []);

  const timezone = useMemo(resolveDashboardTimezone, []);
  const badgesEnabled = canView && branchScope.hasBranchScope;
  // Badge counts are deliberately branch-scoped but filter-independent: a
  // count on a nav control answers "how much is waiting for me here", which
  // must not change because someone typed in the search box of another tab.
  const badgeInventoryQuery = useInventory(
    {
      search: "",
      branchId: branchScope.defaultBranchId,
      itemType: "all",
      productType: "all",
      status: "all",
      lowStockOnly: false,
      expiryTrackedOnly: false,
      includeUninitialized: false,
    },
    badgesEnabled,
  );
  const badgeExpiryQuery = useExpiryAlerts(
    {
      branchId: branchScope.defaultBranchId,
      itemType: "all",
      productType: "all",
      expiryState: "all",
      timezone,
      days: 30,
    },
    badgesEnabled,
  );

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const lowStockCount = (badgeInventoryQuery.data ?? []).filter((item) => item.lowStock).length;
  const expiringCount = (badgeExpiryQuery.data ?? []).length;
  const itemParam = carriedParams.get("item");

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader title="Inventory" description={TAB_DESCRIPTIONS[view]} />

      <InventoryViewTabs
        active={view}
        expiringCount={expiringCount}
        lowStockCount={lowStockCount}
        onViewChange={handleViewChange}
        params={carriedParams}
      />

      <div className="flex flex-col gap-6" id={INVENTORY_TABPANEL_ID} role="tabpanel">
        {view === "all" || view === "low_stock" ? (
          <InventoryListPanel lowStockOnly={view === "low_stock"} />
        ) : null}
        {view === "expiring" ? <ExpiryAlertsPanel /> : null}
        {view === "locations" ? <LocationBalancesPanel /> : null}
        {view === "movements" ? (
          <MovementsPanel itemId={itemParam} onClearItemScope={handleClearItemScope} />
        ) : null}
        {view === "transfers" ? <StockTransfersPanel /> : null}
      </div>
    </div>
  );
}
