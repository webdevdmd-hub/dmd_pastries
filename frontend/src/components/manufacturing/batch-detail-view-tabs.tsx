"use client";

import Link from "next/link";
import type { JSX, KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  batchDetailTabHref,
  type BatchDetailTabKey,
} from "@/components/manufacturing/batch-detail-tabs";
import {
  SEGMENT_BADGE_CLASS,
  SEGMENT_TRACK_CLASS,
  segmentItemClass,
} from "@/components/ui/segment-styles";

/** The id of the single panel region the strip swaps. See `aria-controls`. */
export const BATCH_DETAIL_TABPANEL_ID = "batch-detail-tabpanel";

type BatchDetailViewTabsProps = {
  active: BatchDetailTabKey;
  batchId: string;
  ingredientsCount?: number | undefined;
  onTabChange: (tab: BatchDetailTabKey) => void;
  outputCount?: number | undefined;
  packagingCount?: number | undefined;
  wastageCount?: number | undefined;
};

type Tab = {
  key: BatchDetailTabKey;
  label: string;
  badge?: number;
};

/**
 * One strip, five tabs, one production batch. Same contract as the other detail
 * strips: each tab is a real `<Link>` with a different `?tab=`, a plain left
 * click swaps the panel in place, modified clicks are left to the browser,
 * arrow keys move focus and Enter activates.
 */
export function BatchDetailViewTabs({
  active,
  batchId,
  ingredientsCount,
  onTabChange,
  outputCount,
  packagingCount,
  wastageCount,
}: BatchDetailViewTabsProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  const tabs: Tab[] = useMemo(
    () => [
      { key: "overview", label: "Overview" },
      {
        key: "ingredients",
        label: "Ingredients",
        ...(ingredientsCount ? { badge: ingredientsCount } : {}),
      },
      {
        key: "packaging",
        label: "Packaging",
        ...(packagingCount ? { badge: packagingCount } : {}),
      },
      { key: "output", label: "Output", ...(outputCount ? { badge: outputCount } : {}) },
      { key: "wastage", label: "Wastage", ...(wastageCount ? { badge: wastageCount } : {}) },
    ],
    [ingredientsCount, outputCount, packagingCount, wastageCount],
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
      aria-label="Production batch sections"
      className={`${SEGMENT_TRACK_CLASS} w-fit max-w-full overflow-x-auto`}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="tablist"
    >
      {tabs.map((tab, index) => {
        const selected = index === activeIndex;

        return (
          <Link
            aria-controls={BATCH_DETAIL_TABPANEL_ID}
            aria-selected={selected}
            className={segmentItemClass(selected)}
            data-tab=""
            href={batchDetailTabHref(batchId, tab.key)}
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
