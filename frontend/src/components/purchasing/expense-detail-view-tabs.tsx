"use client";

import Link from "next/link";
import type { JSX, KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  expenseDetailTabHref,
  type ExpenseDetailTabKey,
} from "@/components/purchasing/expense-detail-tabs";
import { SEGMENT_TRACK_CLASS, segmentItemClass } from "@/components/ui/segment-styles";

/** The id of the single panel region the strip swaps. See `aria-controls`. */
export const EXPENSE_DETAIL_TABPANEL_ID = "expense-detail-tabpanel";

type ExpenseDetailViewTabsProps = {
  active: ExpenseDetailTabKey;
  expenseId: string;
  onTabChange: (tab: ExpenseDetailTabKey) => void;
};

type Tab = {
  key: ExpenseDetailTabKey;
  label: string;
};

/**
 * One strip, three tabs, one expense. Same contract as the other detail strips:
 * each tab is a real `<Link>` with a different `?tab=`, a plain left click
 * swaps the panel in place, modified clicks are left to the browser, arrow keys
 * move focus and Enter activates.
 */
export function ExpenseDetailViewTabs({
  active,
  expenseId,
  onTabChange,
}: ExpenseDetailViewTabsProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  const tabs: Tab[] = useMemo(
    () => [
      { key: "overview", label: "Overview" },
      { key: "accounting", label: "Accounting" },
      { key: "receipt", label: "Receipt" },
    ],
    [],
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
      aria-label="Expense sections"
      className={`${SEGMENT_TRACK_CLASS} w-fit max-w-full overflow-x-auto`}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="tablist"
    >
      {tabs.map((tab, index) => {
        const selected = index === activeIndex;

        return (
          <Link
            aria-controls={EXPENSE_DETAIL_TABPANEL_ID}
            aria-selected={selected}
            className={segmentItemClass(selected)}
            data-tab=""
            href={expenseDetailTabHref(expenseId, tab.key)}
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
          </Link>
        );
      })}
    </div>
  );
}
