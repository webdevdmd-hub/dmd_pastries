"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";

/**
 * Row height preference for data tables (DESIGN.md §4).
 *
 *   compact      36px rows, 14px cell padding
 *   default      44px rows, 16px cell padding
 *   comfortable  56px rows, 16px cell padding
 *
 * This is a *preference*, not a register. The Counter/Ledger register is a
 * property of a subtree and travels by React context (see density-provider.tsx);
 * table density is one person's choice about how much of a ledger they want on
 * screen, so it is stored once and stamped on the document element. The token
 * layer in globals.css already keys `--row-h` / `--cell-pad-x` off
 * `[data-table-density]`, and treats the missing attribute as `default`.
 */
export type TableDensity = "compact" | "default" | "comfortable";

const STORAGE_KEY = "pastries-pos-table-density";
const DENSITIES: TableDensity[] = ["compact", "default", "comfortable"];

function isTableDensity(value: unknown): value is TableDensity {
  return DENSITIES.some((density) => density === value);
}

/**
 * Forward-compatible read: an unknown or corrupt value resolves to `default`
 * rather than throwing or leaving the table unstyled. Storage access itself can
 * throw (Safari private mode, storage disabled by policy), so it is guarded —
 * a table must never fail to render because a preference could not be read.
 */
function readStoredDensity(): TableDensity {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTableDensity(stored) ? stored : "default";
  } catch {
    return "default";
  }
}

function writeStoredDensity(density: TableDensity): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, density);
  } catch {
    // A preference that cannot be persisted is not worth failing an
    // interaction over; the choice still applies for this session.
  }
}

export function useTableDensity(): [TableDensity, (density: TableDensity) => void] {
  // Starts at the server-rendered value on purpose. Reading localStorage during
  // render would desynchronise the first client paint from the SSR markup.
  const [density, setDensityState] = useState<TableDensity>("default");

  useEffect(() => {
    const stored = readStoredDensity();
    setDensityState(stored);
    document.documentElement.setAttribute("data-table-density", stored);
  }, []);

  const setDensity = useCallback((next: TableDensity): void => {
    setDensityState(next);
    document.documentElement.setAttribute("data-table-density", next);
    writeStoredDensity(next);
  }, []);

  return [density, setDensity];
}

/** Segmented control for the table density preference. */
export function TableDensityToggle({ className }: { className?: string | undefined }): JSX.Element {
  const [density, setDensity] = useTableDensity();

  return (
    <SegmentedControl
      aria-label="Table density"
      className={className}
      onValueChange={setDensity}
      options={[
        { label: "Compact", value: "compact" },
        { label: "Default", value: "default" },
        { label: "Comfortable", value: "comfortable" },
      ]}
      value={density}
    />
  );
}
