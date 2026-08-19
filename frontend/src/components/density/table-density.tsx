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

export const TABLE_DENSITY_STORAGE_KEY = "pastries-pos-table-density";
export const TABLE_DENSITY_ATTRIBUTE = "data-table-density";

const STORAGE_KEY = TABLE_DENSITY_STORAGE_KEY;
const DENSITIES: TableDensity[] = ["compact", "default", "comfortable"];

function isTableDensity(value: unknown): value is TableDensity {
  return DENSITIES.some((density) => density === value);
}

/**
 * The same read, as a string to inline in the document before first paint.
 *
 * The hook below can only stamp the attribute in an effect, which is after the
 * first paint — so on a hard load the tables render at `default` and then jump
 * to the stored height. That is fine on a page that mounts the toggle and was
 * invisible while only a few screens did, but the attribute is global and the
 * preference is meant to be too: every table on every route reads it.
 *
 * Running this before paint is the standard fix (it is what theme scripts do)
 * and it is why <html> already carries suppressHydrationWarning. Built from the
 * constants above rather than hand-written so the key and the valid values
 * cannot drift away from the hook that writes them.
 */
export const TABLE_DENSITY_BOOT_SCRIPT = `try{var d=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(${JSON.stringify(DENSITIES)}.indexOf(d)>-1){document.documentElement.setAttribute(${JSON.stringify(
  TABLE_DENSITY_ATTRIBUTE,
)},d)}}catch(e){}`;

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
    document.documentElement.setAttribute(TABLE_DENSITY_ATTRIBUTE, stored);
  }, []);

  const setDensity = useCallback((next: TableDensity): void => {
    setDensityState(next);
    document.documentElement.setAttribute(TABLE_DENSITY_ATTRIBUTE, next);
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
