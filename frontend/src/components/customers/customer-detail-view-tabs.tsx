"use client";

import Link from "next/link";
import type { JSX, KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  customerDetailTabHref,
  type CustomerDetailTabKey,
} from "@/components/customers/customer-detail-tabs";
import {
  SEGMENT_BADGE_CLASS,
  SEGMENT_TRACK_CLASS,
  segmentItemClass,
} from "@/components/ui/segment-styles";

/** The id of the single panel region the strip swaps. See `aria-controls`. */
export const CUSTOMER_DETAIL_TABPANEL_ID = "customer-detail-tabpanel";

type CustomerDetailViewTabsProps = {
  active: CustomerDetailTabKey;
  customerId: string;
  /** Badge counts, when the lists that produce them are loaded. */
  notesCount?: number | undefined;
  onTabChange: (tab: CustomerDetailTabKey) => void;
  tagsCount?: number | undefined;
};

type Tab = {
  key: CustomerDetailTabKey;
  label: string;
  badge?: number;
};

/**
 * One strip, five tabs, one customer. Same contract as the order and supplier
 * strips: each tab is a real `<Link>` to this route with a different `?tab=`,
 * so cmd/ctrl-click and "open in new tab" work, while a plain left click swaps
 * the panel in place. Arrow keys move focus; Enter or Space activates, since
 * Notes and Transactions each fire their own queries.
 */
export function CustomerDetailViewTabs({
  active,
  customerId,
  notesCount,
  onTabChange,
  tagsCount,
}: CustomerDetailViewTabsProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  const tabs: Tab[] = useMemo(
    () => [
      { key: "profile", label: "Profile" },
      { key: "tags", label: "Tags", ...(tagsCount ? { badge: tagsCount } : {}) },
      { key: "notes", label: "Notes", ...(notesCount ? { badge: notesCount } : {}) },
      { key: "transactions", label: "Transactions" },
      { key: "credit", label: "Store credit" },
    ],
    [notesCount, tagsCount],
  );

  const activeIndex = Math.max(
    tabs.findIndex((tab) => tab.key === active),
    0,
  );

  // The roving cursor tracks FOCUS, not selection.
  const [cursor, setCursor] = useState(activeIndex);
  const cursorIndex = cursor < tabs.length ? cursor : activeIndex;

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
      aria-label="Customer sections"
      className={`${SEGMENT_TRACK_CLASS} w-fit max-w-full overflow-x-auto`}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="tablist"
    >
      {tabs.map((tab, index) => {
        const selected = index === activeIndex;

        return (
          <Link
            aria-controls={CUSTOMER_DETAIL_TABPANEL_ID}
            aria-selected={selected}
            className={segmentItemClass(selected)}
            data-tab=""
            href={customerDetailTabHref(customerId, tab.key)}
            key={tab.key}
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
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
