"use client";

import { SlidersHorizontal } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { reportDatePresets } from "@/constants/report-presets";
import type { Branch } from "@/types/branch";
import type { ReportDatePreset } from "@/types/reports";

type ReportFilterPopoverProps = {
  /** How many popover fields differ from their defaults. Drives the badge and Reset. */
  changedCount: number;
  /** The panel's own filter fields, rendered stacked inside the popover. */
  children: ReactNode;
  /**
   * A stable serialisation of the draft. When the popover closes with a
   * different value than it opened with, the draft is applied, so the chips
   * in the toolbar never describe something other than the loaded report.
   */
  draftKey: string;
  /** A control that stays visible in the toolbar, such as a search box. */
  leading?: ReactNode;
  onApply: () => void;
  onReset: () => void;
  popoverTitle: string;
  /** Short labels for what is applied: period, branch, grouping, extras. */
  summary: string[];
};

/**
 * The report toolbar: what is applied, as chips, and a Filters popover that
 * holds the fields.
 *
 * Reports keep their draft-then-Apply semantics because a report query is
 * expensive and a half-typed date should not fire one. The popover keeps
 * Apply and Reset, and also applies on close when the draft changed, since a
 * closed popover with unapplied edits would leave the chips lying.
 *
 * It replaced a card of five to nine labelled fields above every report,
 * which on a phone stacked into two screens before the first number.
 */
export function ReportFilterPopover({
  changedCount,
  children,
  draftKey,
  leading,
  onApply,
  onReset,
  popoverTitle,
  summary,
}: ReportFilterPopoverProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const keyAtOpen = useRef(draftKey);

  const handleOpenChange = (next: boolean): void => {
    if (next) {
      keyAtOpen.current = draftKey;
    } else if (keyAtOpen.current !== draftKey) {
      onApply();
    }
    setOpen(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {leading}

      <Popover onOpenChange={handleOpenChange} open={open}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {changedCount > 0 ? (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-medium tabular-nums text-muted">
                {changedCount}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        {/* Up to nine fields: cap the height so a short phone scrolls the
            popover rather than losing Apply below the fold. */}
        <PopoverContent
          align="start"
          className="max-h-[min(80vh,40rem)] w-[calc(100vw-2rem)] overflow-y-auto p-4 sm:w-96"
        >
          <div className="flex flex-col gap-3">
            <p className="text-body font-medium text-brand-espresso">{popoverTitle}</p>
            {children}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                onClick={() => {
                  onReset();
                  // Reset applies immediately in every bar, so nothing is left
                  // to apply on close.
                  keyAtOpen.current = "";
                  setOpen(false);
                }}
                type="button"
                variant="ghost"
              >
                Reset
              </Button>
              <Button
                onClick={() => {
                  onApply();
                  keyAtOpen.current = draftKey;
                  setOpen(false);
                }}
                type="button"
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {summary.length > 0 ? (
        <ul aria-label="Applied filters" className="flex flex-wrap items-center gap-1.5">
          {summary.map((item) => (
            <li
              className="rounded-full bg-muted px-2.5 py-1 text-meta text-foreground-muted"
              key={item}
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      {changedCount > 0 ? (
        <Button className="ml-auto" onClick={onReset} type="button" variant="ghost">
          Reset
        </Button>
      ) : null}
    </div>
  );
}

const shortDate = new Intl.DateTimeFormat("en-AE", { day: "2-digit", month: "short" });

function formatShortDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : shortDate.format(parsed);
}

/** "This month", or "01 Sep – 02 Sep" for a custom range, or "Any date". */
export function describeReportPeriod(
  datePreset: ReportDatePreset | undefined,
  dateFrom: string,
  dateTo: string,
): string {
  if (datePreset && datePreset !== "custom") {
    return reportDatePresets.find((preset) => preset.value === datePreset)?.label ?? datePreset;
  }
  if (dateFrom && dateTo) {
    return `${formatShortDate(dateFrom)} – ${formatShortDate(dateTo)}`;
  }
  if (dateFrom) {
    return `From ${formatShortDate(dateFrom)}`;
  }
  if (dateTo) {
    return `Until ${formatShortDate(dateTo)}`;
  }
  return "Any date";
}

/** The branch name, "All branches", or null when there is nothing to say. */
export function describeReportBranch(branches: Branch[], branchId: string): string | null {
  if (branchId === "all") {
    return "All branches";
  }
  if (!branchId) {
    return null;
  }
  return branches.find((branch) => branch.id === branchId)?.name ?? null;
}

/** The option's label when the value is not the default, else null. */
export function describeReportChoice(
  value: string,
  defaultValue: string,
  options: readonly { label: string; value: string }[],
): string | null {
  if (value === defaultValue) {
    return null;
  }
  return options.find((option) => option.value === value)?.label ?? value;
}

/** Drops the nulls so a summary can be built with optional entries. */
export function compactSummary(items: (string | null | undefined)[]): string[] {
  return items.filter((item): item is string => Boolean(item && item.length > 0));
}

const PERIOD_KEYS = new Set(["datePreset", "dateFrom", "dateTo"]);

/**
 * How many fields differ from their defaults, counting the period (preset and
 * both dates) as one because a preset change moves all three.
 */
export function countReportFilterChanges(
  filters: Record<string, unknown>,
  defaults: Record<string, unknown>,
): number {
  let count = 0;
  let periodChanged = false;
  for (const key of Object.keys(filters)) {
    if (filters[key] === defaults[key]) {
      continue;
    }
    if (PERIOD_KEYS.has(key)) {
      periodChanged = true;
    } else {
      count += 1;
    }
  }
  return count + (periodChanged ? 1 : 0);
}
