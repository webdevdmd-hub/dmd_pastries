"use client";

import Link from "next/link";
import type { JSX, KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { inventoryTabHref, type InventoryTabKey } from "@/components/inventory/inventory-tabs";
import {
  SEGMENT_BADGE_CLASS,
  SEGMENT_TRACK_CLASS,
  segmentItemClass,
} from "@/components/ui/segment-styles";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/hooks/use-permission";

/** The id of the single panel region the strip swaps. See `aria-controls` below. */
export const INVENTORY_TABPANEL_ID = "inventory-tabpanel";

type InventoryViewTabsProps = {
  active: InventoryTabKey;
  /** Badge counts, when the list that produces them is loaded. */
  expiringCount?: number;
  lowStockCount?: number | string;
  onViewChange: (view: InventoryTabKey) => void;
  /** Other query params to carry into each tab's href (e.g. `item`). */
  params?: URLSearchParams;
};

type Tab = {
  key: InventoryTabKey;
  label: string;
  badge?: number | string;
  visible: boolean;
};

/**
 * One strip, six tabs, one page.
 *
 * Each tab is a real `<Link>` whose href is this same route with a different
 * `?view=` -- so cmd/ctrl-click, middle-click and "open in new tab" all still
 * work -- but a plain left click is intercepted and swaps the panel in place
 * without navigating. That is what makes `role="tab"` honest here: activating
 * one really does replace the region below rather than loading a new page.
 *
 * It did not used to be. Four of the six were sibling routes marked `role="tab"`
 * anyway, and each rebuilt its own H1, breadcrumb leaf and filter idiom, so the
 * strip promised tabs and delivered five separate pages.
 *
 * ## Manual activation, deliberately
 *
 * Arrow keys move focus; Enter or Space activates. WAI-ARIA allows focus to
 * activate a tab only when showing the panel is free, and here it is not: the
 * panels are lazily loaded and each fires its own queries, so arrowing across
 * the strip would mount six panels and six sets of requests. An earlier cut
 * activated on focus for the two in-page views and not for the four routes,
 * which meant one strip with two different keyboard contracts in it.
 *
 * `aria-controls` points every tab at the one panel id, because there is one
 * panel element and it swaps. Giving each tab its own id would leave five of
 * six pointing at elements that do not exist.
 */
export function InventoryViewTabs({
  active,
  expiringCount,
  lowStockCount,
  onViewChange,
  params,
}: InventoryViewTabsProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  // Gates resolve here rather than being passed in: the strip is one component
  // with one answer per destination, so a page cannot gate a tab differently
  // from its neighbours.
  const { hasAnyPermission } = usePermission();
  const canViewLowStock = hasAnyPermission([
    PERMISSIONS.inventoryLowStockView,
    PERMISSIONS.inventoryView,
  ]);
  const canViewExpiryAlerts = hasAnyPermission([
    PERMISSIONS.inventoryExpiryView,
    PERMISSIONS.inventoryView,
  ]);
  const canViewLocationBalances = hasAnyPermission([PERMISSIONS.inventoryView]);
  const canViewStockMovements = hasAnyPermission([
    PERMISSIONS.stockMovementsView,
    PERMISSIONS.inventoryMovementsView,
    PERMISSIONS.inventoryView,
  ]);
  const canViewStockTransfers = hasAnyPermission([
    PERMISSIONS.inventoryView,
    PERMISSIONS.inventoryTransferCreate,
    PERMISSIONS.inventoryTransferComplete,
    PERMISSIONS.inventoryTransferCancel,
  ]);

  const tabs: Tab[] = [
    { key: "all", label: "All items", visible: true },
    {
      key: "low_stock",
      label: "Low stock",
      ...(lowStockCount ? { badge: lowStockCount } : {}),
      visible: canViewLowStock,
    },
    {
      key: "expiring",
      label: "Expiring soon",
      ...(expiringCount ? { badge: expiringCount } : {}),
      visible: canViewExpiryAlerts,
    },
    { key: "locations", label: "By location", visible: canViewLocationBalances },
    { key: "movements", label: "Movements", visible: canViewStockMovements },
    { key: "transfers", label: "Transfers", visible: canViewStockTransfers },
  ];

  const visible = tabs.filter((tab) => tab.visible);
  // Fall back to 0 rather than -1: when canViewLowStock is false and the active
  // key is "low_stock", a miss would leave the strip with no tab stop at all.
  const activeIndex = Math.max(
    visible.findIndex((tab) => tab.key === active),
    0,
  );

  // The roving cursor tracks FOCUS, which is not the same as selection: under
  // manual activation focus moves across the strip while `active` stays put.
  // Deriving the next index from `active` -- as an earlier cut did -- meant
  // every press recomputed the same neighbour of the selected tab, so focus
  // never advanced and, because `tabIndex` was pinned there too, up to three
  // tabs had no keyboard path at all (WCAG 2.1.1).
  //
  // The handler sets it directly rather than waiting for the focus event it is
  // about to cause. Leaving `onFocus` as the only writer deadlocks whenever the
  // computed target already holds focus -- no focus event fires, the cursor
  // never advances, and every later press recomputes the same index. `onFocus`
  // stays as the writer for focus this component did not initiate: a real
  // click, or focus restored from outside.
  const [cursor, setCursor] = useState(activeIndex);
  // Permissions can shrink `visible` after the cursor was set; fall back to the
  // selected tab rather than leaving the strip with no tab stop.
  const cursorIndex = cursor < visible.length ? cursor : activeIndex;

  // Selection can move without any focus event -- browser back/forward fires
  // popstate, which swaps the tab while focus is wherever it was. Without this
  // the single tab stop stays stranded on the previously selected tab, so
  // Tabbing into the strip lands somewhere that is neither current nor where
  // the user last was. Arrowing does not activate, so it never triggers this.
  useEffect(() => {
    setCursor(activeIndex);
  }, [activeIndex]);

  const focusAt = useCallback((index: number): void => {
    const items = containerRef.current?.querySelectorAll<HTMLElement>("[data-tab]");
    items?.[index]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.key === "Enter" || event.key === " ") {
        // Both would otherwise follow the anchor's href and load the page.
        event.preventDefault();
        const target = visible[cursorIndex];
        if (target) {
          onViewChange(target.key);
        }
        return;
      }

      let next: number | null = null;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          next = (cursorIndex + 1) % visible.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          next = (cursorIndex - 1 + visible.length) % visible.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = visible.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      setCursor(next);
      focusAt(next);
    },
    [cursorIndex, focusAt, onViewChange, visible],
  );

  return (
    <div
      aria-label="Inventory views"
      // Six segments are 601px wide, so on a phone this strip alone pushed the
      // whole module into a horizontal scroll. It scrolls inside itself now,
      // the way every detail strip already does.
      className={`${SEGMENT_TRACK_CLASS} max-w-full overflow-x-auto`}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="tablist"
    >
      {visible.map((tab, index) => {
        const selected = index === activeIndex;
        return (
          <Link
            aria-controls={INVENTORY_TABPANEL_ID}
            aria-selected={selected}
            className={segmentItemClass(selected)}
            data-tab=""
            href={inventoryTabHref(tab.key, params)}
            key={tab.key}
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              // Leave the modified clicks to the browser: they are how someone
              // opens a tab in a new window, and intercepting them would make
              // these look like links while behaving like buttons.
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              onViewChange(tab.key);
            }}
            onFocus={() => setCursor(index)}
            role="tab"
            tabIndex={index === cursorIndex ? 0 : -1}
          >
            {tab.label}
            {tab.badge ? <span className={SEGMENT_BADGE_CLASS}>{tab.badge}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}
