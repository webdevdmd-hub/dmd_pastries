"use client";

import Link from "next/link";
import type { JSX, KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  supplierDetailTabHref,
  type SupplierDetailTabKey,
} from "@/components/suppliers/supplier-detail-tabs";
import {
  SEGMENT_BADGE_CLASS,
  SEGMENT_TRACK_CLASS,
  segmentItemClass,
} from "@/components/ui/segment-styles";

/** The id of the single panel region the strip swaps. See `aria-controls`. */
export const SUPPLIER_DETAIL_TABPANEL_ID = "supplier-detail-tabpanel";

type SupplierDetailViewTabsProps = {
  active: SupplierDetailTabKey;
  /** Badge counts, when the list that produces them is loaded. */
  contactsCount?: number | undefined;
  notesCount?: number | undefined;
  onTabChange: (tab: SupplierDetailTabKey) => void;
  supplierId: string;
};

type Tab = {
  key: SupplierDetailTabKey;
  label: string;
  badge?: number;
};

/**
 * One strip, six tabs, one supplier.
 *
 * Built on the same contract as the inventory strip: each tab is a real `<Link>`
 * to this route with a different `?tab=`, so cmd/ctrl-click and "open in new
 * tab" work, while a plain left click swaps the panel in place. That is what
 * makes `role="tab"` honest -- activating one really does replace the region
 * below rather than loading a page.
 *
 * ## Manual activation, deliberately
 *
 * Arrow keys move focus; Enter or Space activates. WAI-ARIA permits activating
 * on focus only when showing a panel is free, and it is not: Documents,
 * History and Statement each fire their own queries, so arrowing across the
 * strip would mount every panel and every request behind it.
 *
 * `aria-controls` points every tab at the one panel id, because there is one
 * panel element and it swaps.
 */
export function SupplierDetailViewTabs({
  active,
  contactsCount,
  notesCount,
  onTabChange,
  supplierId,
}: SupplierDetailViewTabsProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoised because the keyboard handler depends on it: a fresh array each
  // render would rebuild the handler on every keystroke.
  const tabs: Tab[] = useMemo(
    () => [
      { key: "profile", label: "Profile" },
      { key: "contacts", label: "Contacts", ...(contactsCount ? { badge: contactsCount } : {}) },
      { key: "notes", label: "Notes", ...(notesCount ? { badge: notesCount } : {}) },
      { key: "history", label: "Purchase history" },
      { key: "documents", label: "Documents" },
      { key: "statement", label: "Statement" },
    ],
    [contactsCount, notesCount],
  );

  const activeIndex = Math.max(
    tabs.findIndex((tab) => tab.key === active),
    0,
  );

  // The roving cursor tracks FOCUS, not selection: under manual activation
  // focus moves across the strip while `active` stays put. Deriving the next
  // index from `active` would recompute the same neighbour on every press, so
  // focus would never advance.
  const [cursor, setCursor] = useState(activeIndex);
  const cursorIndex = cursor < tabs.length ? cursor : activeIndex;

  // Selection can move without a focus event -- browser back/forward fires
  // popstate and swaps the tab while focus is elsewhere. Without this the
  // single tab stop stays stranded on the previously selected tab.
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
      aria-label="Supplier sections"
      className={`${SEGMENT_TRACK_CLASS} w-fit max-w-full overflow-x-auto`}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="tablist"
    >
      {tabs.map((tab, index) => {
        const selected = index === activeIndex;

        return (
          <Link
            aria-controls={SUPPLIER_DETAIL_TABPANEL_ID}
            aria-selected={selected}
            className={segmentItemClass(selected)}
            data-tab=""
            href={supplierDetailTabHref(supplierId, tab.key)}
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
