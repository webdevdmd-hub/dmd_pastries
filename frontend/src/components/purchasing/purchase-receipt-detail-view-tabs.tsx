"use client";

import Link from "next/link";
import type { JSX, KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  purchaseReceiptDetailTabHref,
  type PurchaseReceiptDetailTabKey,
} from "@/components/purchasing/purchase-receipt-detail-tabs";
import {
  SEGMENT_BADGE_CLASS,
  SEGMENT_TRACK_CLASS,
  segmentItemClass,
} from "@/components/ui/segment-styles";

/** The id of the single panel region the strip swaps. See `aria-controls`. */
export const PURCHASE_RECEIPT_DETAIL_TABPANEL_ID = "purchase-receipt-detail-tabpanel";

type PurchaseReceiptDetailViewTabsProps = {
  active: PurchaseReceiptDetailTabKey;
  /** Badge count: the vendor credits raised against this receipt. */
  creditsCount?: number | undefined;
  /** Badge count: the lines received. */
  itemsCount?: number | undefined;
  onTabChange: (tab: PurchaseReceiptDetailTabKey) => void;
  receiptId: string;
};

type Tab = {
  key: PurchaseReceiptDetailTabKey;
  label: string;
  badge?: number;
};

/**
 * One strip, three tabs, one receive-goods record. Same contract as the other
 * detail strips: each tab is a real `<Link>` with a different `?tab=`, a plain
 * left click swaps the panel in place, arrow keys move focus, Enter activates.
 * Documents and Credits each fire their own query, hence manual activation.
 */
export function PurchaseReceiptDetailViewTabs({
  active,
  creditsCount,
  itemsCount,
  onTabChange,
  receiptId,
}: PurchaseReceiptDetailViewTabsProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  const tabs: Tab[] = useMemo(
    () => [
      { key: "items", label: "Items", ...(itemsCount ? { badge: itemsCount } : {}) },
      { key: "documents", label: "Documents" },
      {
        key: "credits",
        label: "Vendor credits",
        ...(creditsCount ? { badge: creditsCount } : {}),
      },
    ],
    [creditsCount, itemsCount],
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
      aria-label="Receive goods sections"
      className={`${SEGMENT_TRACK_CLASS} w-fit max-w-full overflow-x-auto`}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="tablist"
    >
      {tabs.map((tab, index) => {
        const selected = index === activeIndex;

        return (
          <Link
            aria-controls={PURCHASE_RECEIPT_DETAIL_TABPANEL_ID}
            aria-selected={selected}
            className={segmentItemClass(selected)}
            data-tab=""
            href={purchaseReceiptDetailTabHref(receiptId, tab.key)}
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
