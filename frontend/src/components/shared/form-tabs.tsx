"use client";

import type { JSX, KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  SEGMENT_BADGE_CLASS,
  SEGMENT_TRACK_CLASS,
  segmentItemClass,
} from "@/components/ui/segment-styles";

export type FormTab<TKey extends string> = {
  key: TKey;
  label: string;
  /** A count after the label, such as fields with errors. Zero renders nothing. */
  badge?: number | undefined;
};

type FormTabsProps<TKey extends string> = {
  active: TKey;
  /** Accessible name for the strip, e.g. "Customer form sections". */
  "aria-label": string;
  onTabChange: (tab: TKey) => void;
  /** The id of the panel element the strip swaps. */
  panelId: string;
  tabs: readonly FormTab<TKey>[];
};

/**
 * A tab strip for the sections of a form that lives in a modal.
 *
 * Buttons rather than links: the form's state is in memory, so there is no
 * URL to hand out. Manual activation, like every other strip: arrow keys
 * move focus, Enter or Space activates, so a section that fires its own
 * queries does not mount just because focus passed over it.
 */
export function FormTabs<TKey extends string>({
  active,
  "aria-label": ariaLabel,
  onTabChange,
  panelId,
  tabs,
}: FormTabsProps<TKey>): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
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
      aria-label={ariaLabel}
      className={`${SEGMENT_TRACK_CLASS} w-fit max-w-full overflow-x-auto`}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="tablist"
    >
      {tabs.map((tab, index) => {
        const selected = index === activeIndex;

        return (
          <button
            aria-controls={panelId}
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
