"use client";

import Link from "next/link";
import type { JSX, KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { PaymentsPageClient } from "@/components/payments/payments-page-client";
import {
  PAYMENTS_TAB_LABELS,
  PAYMENTS_TABS,
  type PaymentsTab,
  paymentsTabHref,
} from "@/components/payments/payments-tabs";
import { ReconciliationPageClient } from "@/components/payments/reconciliation-page-client";
import { RefundsPageClient } from "@/components/payments/refunds-page-client";
import { SalesReturnsPageClient } from "@/components/payments/sales-returns-page-client";
import { SEGMENT_TRACK_CLASS, segmentItemClass } from "@/components/ui/segment-styles";

/** The id of the single panel region the strip swaps. See `aria-controls`. */
const PAYMENTS_TABPANEL_ID = "payments-tabpanel";

/**
 * The four customer-payment surfaces under one route.
 *
 * Rendered as links on the same segmented track the report areas use, so the
 * back button, a bookmark and a pasted link all behave the way a person
 * expects. Arrow keys move focus along the strip without activating, because
 * each panel fires its own queries on mount.
 *
 * Only the active panel mounts: mounting all four would fire every payments,
 * refunds, returns and reconciliation request on each visit.
 */
export function PaymentsTabShell({ activeTab }: { activeTab: PaymentsTab }): JSX.Element {
  const activeIndex = Math.max(
    PAYMENTS_TABS.findIndex((tab) => tab === activeTab),
    0,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // The roving cursor tracks FOCUS, not selection.
  const [cursor, setCursor] = useState(activeIndex);
  const cursorIndex = cursor < PAYMENTS_TABS.length ? cursor : activeIndex;

  useEffect(() => {
    setCursor(activeIndex);
  }, [activeIndex]);

  // A deep link can land on a tab that starts off-screen on a phone.
  useEffect(() => {
    const container = containerRef.current;
    const selected = container?.querySelectorAll<HTMLElement>("[data-tab]")[activeIndex];
    if (!container || !selected) {
      return;
    }
    const target = selected.offsetLeft - (container.clientWidth - selected.offsetWidth) / 2;
    container.scrollTo({ left: Math.max(target, 0) });
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
          next = (cursorIndex + 1) % PAYMENTS_TABS.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          next = (cursorIndex - 1 + PAYMENTS_TABS.length) % PAYMENTS_TABS.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = PAYMENTS_TABS.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      setCursor(next);
      focusAt(next);
    },
    [cursorIndex, focusAt],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div
        aria-label="Payments sections"
        className={`${SEGMENT_TRACK_CLASS} w-fit max-w-full overflow-x-auto`}
        onKeyDown={handleKeyDown}
        ref={containerRef}
        role="tablist"
      >
        {PAYMENTS_TABS.map((tab, index) => {
          const selected = index === activeIndex;

          return (
            <Link
              aria-controls={PAYMENTS_TABPANEL_ID}
              aria-selected={selected}
              className={segmentItemClass(selected)}
              data-tab=""
              href={paymentsTabHref(tab)}
              key={tab}
              onFocus={() => setCursor(index)}
              role="tab"
              tabIndex={index === cursorIndex ? 0 : -1}
            >
              {PAYMENTS_TAB_LABELS[tab]}
            </Link>
          );
        })}
      </div>

      <div id={PAYMENTS_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {activeTab === "activity" ? <PaymentsPageClient /> : null}
        {activeTab === "refunds" ? <RefundsPageClient /> : null}
        {activeTab === "returns" ? <SalesReturnsPageClient /> : null}
        {activeTab === "reconciliation" ? <ReconciliationPageClient /> : null}
      </div>
    </div>
  );
}
