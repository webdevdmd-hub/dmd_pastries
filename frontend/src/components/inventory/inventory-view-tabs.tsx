"use client";

import Link from "next/link";
import type { JSX, KeyboardEvent } from "react";
import { useCallback, useRef, useState } from "react";

import {
  SEGMENT_BADGE_CLASS,
  SEGMENT_TRACK_CLASS,
  segmentItemClass,
} from "@/components/ui/segment-styles";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";

/** The views that filter the table in place, without leaving the page. */
export type InventoryView = "all" | "low_stock";

/** Which of the six is currently the user's location. */
export type InventoryTabKey = InventoryView | "expiring" | "locations" | "movements" | "transfers";

type InventoryViewTabsProps = {
  /**
   * Which tab is current. On /inventory this tracks the in-page filter; on the
   * four destination pages it is the fixed key for that page, so the strip
   * shows you where you are instead of resetting to "All items".
   */
  active: InventoryTabKey;
  /** Only /inventory has these loaded; elsewhere the badges are simply absent. */
  expiringCount?: number;
  lowStockCount?: number;
  /** Only supplied on /inventory, where the first two tabs do something. */
  onViewChange?: (view: InventoryView) => void;
};

type Tab =
  | { kind: "view"; key: InventoryView; label: string; badge?: number; visible: boolean }
  | {
      kind: "route";
      key: InventoryTabKey;
      label: string;
      href: string;
      badge?: number;
      visible: boolean;
    };

/**
 * One strip, six destinations.
 *
 * Replaces the six full-size navigation cards that used to sit above the table
 * -- roughly 370px of chrome for what is really a row of destinations.
 *
 * ## The ARIA tradeoff, stated plainly
 *
 * Four of these six are real route navigations, and they are marked
 * `role="tab"` anyway. That is a deliberate, user-accepted decision, and it is
 * a lie of a specific size: a screen reader announces "tab", which implies the
 * content below is about to swap in place, when the page is actually about to
 * change. It was chosen because the prototype's single unbroken track is the
 * design that was approved, and splitting the six into a radiogroup plus a
 * `<nav>` -- the previous implementation -- made two of them look like controls
 * and four like links, which is the thing the redesign was trying to stop.
 *
 * Two things keep the cost bounded:
 *
 * 1. The route tabs stay real `<Link>` anchors, so cmd/ctrl-click, middle-click
 *    and "open in new tab" all still work. Roving tabindex collapses the six to
 *    one tab stop without touching any of that -- but only because the cursor
 *    below tracks focus; pinning `tabIndex` to the *selected* tab instead makes
 *    the unfocusable four unreachable rather than merely un-tabbed.
 * 2. The strip renders on all five pages with the current one marked selected,
 *    so `aria-selected` is truthful wherever you are. An earlier cut rendered it
 *    only on /inventory, which meant activating a "tab" made the whole tablist
 *    vanish -- the tabs metaphor broken in the most visible way possible.
 *
 * `aria-controls` is deliberately absent: there is no tabpanel. The region below
 * is five mutually-exclusive branches with the toolbar between it and this
 * control, and it is filtered by search and the popover too, so it is not a
 * panel this strip owns.
 *
 * Also gone with the old structure: the `<nav aria-label="Other inventory
 * views">` landmark, which cost a screen-reader user one entry in the landmark
 * list.
 */
export function InventoryViewTabs({
  active,
  expiringCount,
  lowStockCount,
  onViewChange,
}: InventoryViewTabsProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  // Gates are resolved here rather than passed in. The strip renders on five
  // pages, and threading the same five booleans through five call sites is five
  // chances for one page to gate a destination differently from the others --
  // which is exactly the bug a shared nav must not have.
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
    { kind: "view", key: "all", label: "All items", visible: true },
    {
      kind: "view",
      key: "low_stock",
      label: "Low stock",
      ...(lowStockCount ? { badge: lowStockCount } : {}),
      visible: canViewLowStock,
    },
    {
      kind: "route",
      key: "expiring",
      label: "Expiring soon",
      href: ROUTES.inventoryExpiryAlerts,
      ...(expiringCount ? { badge: expiringCount } : {}),
      visible: canViewExpiryAlerts,
    },
    {
      kind: "route",
      key: "locations",
      label: "By location",
      href: ROUTES.inventoryLocationBalances,
      visible: canViewLocationBalances,
    },
    {
      kind: "route",
      key: "movements",
      label: "Movements",
      href: ROUTES.inventoryMovements,
      visible: canViewStockMovements,
    },
    {
      kind: "route",
      key: "transfers",
      label: "Transfers",
      href: ROUTES.inventoryStockTransfers,
      visible: canViewStockTransfers,
    },
  ];

  const visible = tabs.filter((tab) => tab.visible);
  // Fall back to 0 rather than -1: when canViewLowStock is false and the active
  // key is "low_stock", a miss would leave the strip with no tab stop at all.
  const activeIndex = Math.max(
    visible.findIndex((tab) => tab.key === active),
    0,
  );

  // The roving cursor tracks FOCUS, which on this strip is not the same thing
  // as selection: arrowing onto a route tab deliberately does not navigate, so
  // `active` stays put while focus keeps moving. An earlier cut computed the
  // arrow target from `activeIndex` instead, which meant every press recomputed
  // the same neighbour of the selected tab -- focus never advanced past one
  // step, and because `tabIndex` was also pinned to the selected tab, up to
  // three of the six had no keyboard path at all (WCAG 2.1.1). The cursor is
  // updated from the elements' own `onFocus`, so mouse, arrow keys and
  // focus restoration all feed the same single source of truth.
  const [cursor, setCursor] = useState(activeIndex);
  // Permissions can shrink `visible` after the cursor was set; fall back to the
  // selected tab rather than leaving the strip with no tab stop.
  const cursorIndex = cursor < visible.length ? cursor : activeIndex;

  const focusAt = useCallback((index: number): void => {
    const items = containerRef.current?.querySelectorAll<HTMLElement>("[data-tab]");
    items?.[index]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
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
      const target = visible[next];
      if (!target) {
        return;
      }

      focusAt(next);
      // Focus activates a tab only when activation is free. Arrowing onto an
      // in-page view selects it, because that is instant and reversible;
      // arrowing onto a route only moves focus, because navigation is not
      // something to do to someone who is still deciding.
      if (target.kind === "view") {
        onViewChange?.(target.key);
      }
    },
    [cursorIndex, focusAt, onViewChange, visible],
  );

  return (
    <div
      aria-label="Inventory views"
      className={SEGMENT_TRACK_CLASS}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="tablist"
    >
      {visible.map((tab, index) => {
        const selected = index === activeIndex;
        const body = (
          <>
            {tab.label}
            {tab.badge ? <span className={SEGMENT_BADGE_CLASS}>{tab.badge}</span> : null}
          </>
        );

        if (tab.kind === "view") {
          return (
            <button
              aria-selected={selected}
              className={segmentItemClass(selected)}
              data-tab=""
              key={tab.key}
              onClick={() => onViewChange?.(tab.key)}
              onFocus={() => setCursor(index)}
              role="tab"
              tabIndex={index === cursorIndex ? 0 : -1}
              type="button"
            >
              {body}
            </button>
          );
        }

        return (
          <Link
            aria-selected={selected}
            className={segmentItemClass(selected)}
            data-tab=""
            href={tab.href}
            key={tab.key}
            // An anchor ignores Space and scrolls the page instead. The tabs
            // pattern requires it, so route it through the same click handler
            // Enter already uses -- one navigation path, not two.
            onFocus={() => setCursor(index)}
            onKeyDown={(event) => {
              if (event.key === " ") {
                event.preventDefault();
                event.currentTarget.click();
              }
            }}
            role="tab"
            tabIndex={index === cursorIndex ? 0 : -1}
          >
            {body}
          </Link>
        );
      })}
    </div>
  );
}
