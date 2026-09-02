"use client";

import type { JSX, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  SEGMENT_BADGE_CLASS,
  SEGMENT_TRACK_CLASS,
  segmentItemClass,
} from "@/components/ui/segment-styles";

/**
 * The sections of the bakery order form.
 *
 * They used to be six numbered sections on one scroll, so a cashier fixing a
 * delivery time scrolled past the customer picker to reach it and past the
 * items to get back. Production only exists once the order is saved.
 */
export type OrderFormTabKey =
  | "customer"
  | "schedule"
  | "items"
  | "charges"
  | "packaging"
  | "production";

export const DEFAULT_ORDER_FORM_TAB: OrderFormTabKey = "customer";

/** The id of the single panel region the strip swaps. See `aria-controls`. */
export const ORDER_FORM_TABPANEL_ID = "order-form-tabpanel";

type OrderFormTabsProps = {
  active: OrderFormTabKey;
  /** Line count on the Items tab. */
  itemsCount?: number | undefined;
  onTabChange: (tab: OrderFormTabKey) => void;
  /** Production is only offered for a saved order. */
  showProduction: boolean;
};

type Tab = {
  key: OrderFormTabKey;
  label: string;
  badge?: number;
};

/**
 * The strip above the form body. Buttons rather than links: the form lives in
 * a modal and its state is in memory, so there is no URL to hand out.
 *
 * Manual activation, like the other strips: arrow keys move focus, Enter or
 * Space activates. Packaging and Production fire their own queries, so
 * arrowing across the strip should not mount them all.
 */
export function OrderFormTabs({
  active,
  itemsCount,
  onTabChange,
  showProduction,
}: OrderFormTabsProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  const tabs: Tab[] = useMemo(() => {
    const list: Tab[] = [
      { key: "customer", label: "Customer" },
      { key: "schedule", label: "Schedule" },
      { key: "items", label: "Items", ...(itemsCount ? { badge: itemsCount } : {}) },
      { key: "charges", label: "Charges" },
      { key: "packaging", label: "Packaging" },
    ];
    if (showProduction) {
      list.push({ key: "production", label: "Production" });
    }
    return list;
  }, [itemsCount, showProduction]);

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
      aria-label="Order form sections"
      className={`${SEGMENT_TRACK_CLASS} w-fit max-w-full overflow-x-auto`}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="tablist"
    >
      {tabs.map((tab, index) => {
        const selected = index === activeIndex;

        return (
          <button
            aria-controls={ORDER_FORM_TABPANEL_ID}
            aria-selected={selected}
            className={segmentItemClass(selected)}
            data-tab=""
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            onFocus={() => setCursor(index)}
            role="tab"
            tabIndex={index === cursorIndex ? 0 : -1}
            type="button"
          >
            {tab.label}
            {tab.badge ? <span className={SEGMENT_BADGE_CLASS}>{tab.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
