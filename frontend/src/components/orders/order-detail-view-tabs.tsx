"use client";

import Link from "next/link";
import type { JSX, KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { orderDetailTabHref, type OrderDetailTabKey } from "@/components/orders/order-detail-tabs";
import {
  SEGMENT_BADGE_CLASS,
  SEGMENT_TRACK_CLASS,
  segmentItemClass,
} from "@/components/ui/segment-styles";

/** The id of the single panel region the strip swaps. See `aria-controls`. */
export const ORDER_DETAIL_TABPANEL_ID = "order-detail-tabpanel";

type OrderDetailViewTabsProps = {
  active: OrderDetailTabKey;
  /** Line count on the Items tab. */
  itemsCount?: number | undefined;
  onTabChange: (tab: OrderDetailTabKey) => void;
  orderId: string;
};

type Tab = {
  key: OrderDetailTabKey;
  label: string;
  badge?: number;
};

/**
 * One strip, five tabs, one order.
 *
 * Same contract as the supplier and inventory strips: each tab is a real
 * `<Link>` to this route with a different `?tab=`, so cmd/ctrl-click and "open
 * in new tab" work, while a plain left click swaps the panel in place.
 *
 * Manual activation, deliberately: arrow keys move focus, Enter or Space
 * activates. Payments, Production and Packaging each fire their own queries,
 * so arrowing across the strip would otherwise mount every panel and every
 * request behind it.
 */
export function OrderDetailViewTabs({
  active,
  itemsCount,
  onTabChange,
  orderId,
}: OrderDetailViewTabsProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  const tabs: Tab[] = useMemo(
    () => [
      { key: "items", label: "Items", ...(itemsCount ? { badge: itemsCount } : {}) },
      { key: "payments", label: "Payments" },
      { key: "production", label: "Production" },
      { key: "packaging", label: "Packaging" },
      { key: "timeline", label: "Timeline" },
    ],
    [itemsCount],
  );

  const activeIndex = Math.max(
    tabs.findIndex((tab) => tab.key === active),
    0,
  );

  // The roving cursor tracks FOCUS, not selection: under manual activation
  // focus moves across the strip while `active` stays put.
  const [cursor, setCursor] = useState(activeIndex);
  const cursorIndex = cursor < tabs.length ? cursor : activeIndex;

  // Browser back/forward swaps the tab while focus is elsewhere; keep the
  // single tab stop on the selected tab.
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
        const target = tabs[cursorIndex];
        if (target) {
          onTabChange(target.key);
        }
        return;
      }

      let next: number | null = null;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          next = (cursorIndex + 1) % tabs.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          next = (cursorIndex - 1 + tabs.length) % tabs.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = tabs.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      setCursor(next);
      focusAt(next);
    },
    [cursorIndex, focusAt, onTabChange, tabs],
  );

  return (
    <div
      aria-label="Order sections"
      className={`${SEGMENT_TRACK_CLASS} w-fit max-w-full overflow-x-auto`}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="tablist"
    >
      {tabs.map((tab, index) => {
        const selected = index === activeIndex;

        return (
          <Link
            aria-controls={ORDER_DETAIL_TABPANEL_ID}
            aria-selected={selected}
            className={segmentItemClass(selected)}
            data-tab=""
            href={orderDetailTabHref(orderId, tab.key)}
            key={tab.key}
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              // Leave modified clicks to the browser: that is how someone opens
              // a tab in a new window.
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
              onTabChange(tab.key);
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
