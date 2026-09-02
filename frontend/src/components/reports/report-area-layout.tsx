"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX, KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  activeReportAreaTab,
  REPORT_AREAS,
  type ReportAreaKey,
} from "@/components/reports/report-area-tabs";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { SEGMENT_TRACK_CLASS, segmentItemClass } from "@/components/ui/segment-styles";

/** The id of the single panel region the strip swaps. See `aria-controls`. */
export const REPORT_AREA_TABPANEL_ID = "report-area-tabpanel";

/**
 * The shell every report area shares: one header, one tab strip, and the
 * selected report below.
 *
 * Rendered from the area's `layout.tsx`, so the header and strip persist while
 * Next swaps only the page segment underneath. Each tab is a real `<Link>` to
 * its report's existing route: deep links, bookmarks and "open in new tab"
 * all keep working, and the browser handles Enter on a focused tab.
 *
 * Arrow keys move focus along the strip without activating, because every
 * report fires its own queries on mount.
 */
export function ReportAreaLayout({
  area: areaKey,
  children,
}: {
  area: ReportAreaKey;
  children: ReactNode;
}): JSX.Element {
  const area = REPORT_AREAS[areaKey];
  const pathname = usePathname();
  const active = activeReportAreaTab(area, pathname);
  const activeIndex = Math.max(
    area.tabs.findIndex((tab) => tab.href === active.href),
    0,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // The roving cursor tracks FOCUS, not selection.
  const [cursor, setCursor] = useState(activeIndex);
  const cursorIndex = cursor < area.tabs.length ? cursor : activeIndex;

  useEffect(() => {
    setCursor(activeIndex);
  }, [activeIndex]);

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
          next = (cursorIndex + 1) % area.tabs.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          next = (cursorIndex - 1 + area.tabs.length) % area.tabs.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = area.tabs.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      setCursor(next);
      focusAt(next);
    },
    [area.tabs.length, cursorIndex, focusAt],
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader description={area.description} title={area.title} />

      <div
        aria-label={`${area.title} sections`}
        className={`${SEGMENT_TRACK_CLASS} w-fit max-w-full overflow-x-auto`}
        onKeyDown={handleKeyDown}
        ref={containerRef}
        role="tablist"
      >
        {area.tabs.map((tab, index) => {
          const selected = index === activeIndex;

          return (
            <Link
              aria-controls={REPORT_AREA_TABPANEL_ID}
              aria-selected={selected}
              className={segmentItemClass(selected)}
              data-tab=""
              href={tab.href}
              key={tab.href}
              onFocus={() => setCursor(index)}
              role="tab"
              tabIndex={index === cursorIndex ? 0 : -1}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* One panel element that swaps, which is what `aria-controls` on every
          tab points at. */}
      <div id={REPORT_AREA_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
