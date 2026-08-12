"use client";

import type { JSX, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Lets a detail page tell the breadcrumb what to call itself.
 *
 * Detail routes are addressed by record id (`/purchasing/invoices/{uuid}`), so
 * the breadcrumb would otherwise render the raw identifier as if it were a
 * title. A page that knows its business document reference (bill no, order no,
 * customer name) publishes it here and the header shows that instead.
 */
type BreadcrumbLabelContextValue = {
  label: string | null;
  setLabel: (label: string | null) => void;
};

const BreadcrumbLabelContext = createContext<BreadcrumbLabelContextValue | null>(null);

export function BreadcrumbLabelProvider({ children }: { children: ReactNode }): JSX.Element {
  const [label, setLabel] = useState<string | null>(null);
  const value = useMemo<BreadcrumbLabelContextValue>(() => ({ label, setLabel }), [label]);

  return <BreadcrumbLabelContext.Provider value={value}>{children}</BreadcrumbLabelContext.Provider>;
}

/** Read the currently published label (used by the header breadcrumb). */
export function useBreadcrumbLabel(): string | null {
  return useContext(BreadcrumbLabelContext)?.label ?? null;
}

/**
 * Publish a breadcrumb label for the current page. Pass `null` while the record
 * is still loading. The label is cleared on unmount so it never leaks into the
 * next route.
 */
export function usePublishBreadcrumbLabel(label: string | null): void {
  const context = useContext(BreadcrumbLabelContext);
  const setLabel = context?.setLabel;
  const stableSetLabel = useCallback(
    (next: string | null) => {
      if (setLabel) {
        setLabel(next);
      }
    },
    [setLabel],
  );

  useEffect(() => {
    stableSetLabel(label);

    return () => {
      stableSetLabel(null);
    };
  }, [label, stableSetLabel]);
}
