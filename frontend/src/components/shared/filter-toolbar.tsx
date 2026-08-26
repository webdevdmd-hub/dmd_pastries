"use client";

import { SlidersHorizontal } from "lucide-react";
import type { JSX, ReactNode } from "react";

import { TableDensityToggle } from "@/components/density/table-density";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type FilterToolbarProps = {
  /** Omit both search props on a panel whose data source cannot search. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  /**
   * Count only what is hidden *inside* the popover. Anything visible in the
   * toolbar or in the tab strip already shows its own state, and badging it
   * here sends the user into the popover hunting for a control that is not in
   * it. Scope-like fields that always carry a value (branch) must be excluded
   * too, or the badge sits permanently at 1 and stops meaning anything.
   */
  hiddenFilterCount: number;
  /**
   * Whether Reset appears. Deliberately separate from `hiddenFilterCount`: a
   * Reset that clears something it refuses to appear for is a button whose
   * visibility disagrees with its effect.
   */
  hasAnyFilter: boolean;
  onReset: () => void;
  /** Heading inside the popover, e.g. "Filter movements". */
  popoverTitle: string;
  /** The panel's own filter fields. */
  children: ReactNode;
};

/**
 * The one toolbar idiom for the Inventory module: search on the left, a
 * Filters popover carrying everything else, Reset when there is something to
 * reset, density on the right.
 *
 * It exists because the module's panels each grew their own filter treatment --
 * a popover on the item list, a bare row of six selects on Expiring, labelled
 * four-column cards on Transfers and By location, a nine-control row on
 * Movements. Switching tabs changed the filter language every time, which is
 * half of why the tabs read as separate pages even after they stopped being
 * separate routes.
 *
 * The shell owns layout, the badge rule and Reset placement; each panel passes
 * only its own fields as children, so no panel loses a filter it had.
 */
export function FilterToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchAriaLabel = "Search",
  hiddenFilterCount,
  hasAnyFilter,
  onReset,
  popoverTitle,
  children,
}: FilterToolbarProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSearchChange ? (
        <Input
          aria-label={searchAriaLabel}
          className="w-full min-w-[200px] max-w-sm flex-1"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          value={searchValue ?? ""}
        />
      ) : null}

      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hiddenFilterCount > 0 ? (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-medium tabular-nums text-muted">
                {hiddenFilterCount}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-4">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-brand-espresso">{popoverTitle}</p>
            {children}
          </div>
        </PopoverContent>
      </Popover>

      {hasAnyFilter ? (
        <Button onClick={onReset} type="button" variant="ghost">
          Reset
        </Button>
      ) : null}

      <TableDensityToggle className="ml-auto" />
    </div>
  );
}

type FilterFieldProps = {
  htmlFor: string;
  label: string;
  children: ReactNode;
};

/** One labelled control inside the popover. */
export function FilterField({ htmlFor, label, children }: FilterFieldProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-foreground-muted" htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
    </div>
  );
}
