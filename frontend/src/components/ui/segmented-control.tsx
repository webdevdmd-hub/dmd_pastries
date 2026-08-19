"use client";

import type { JSX } from "react";
import { useCallback, useId, useRef } from "react";

import {
  SEGMENT_BADGE_CLASS,
  SEGMENT_TRACK_CLASS,
  segmentItemClass,
} from "@/components/ui/segment-styles";
import { cn } from "@/lib/utils/cn";

export type SegmentedControlOption<TValue extends string> = {
  /**
   * Optional count rendered after the label, for options that carry a live
   * figure worth seeing before you select them (how many items are low on
   * stock, how many payments are unreconciled). Zero and undefined both render
   * nothing: a badged "0" reads as a thing to attend to when it is the
   * opposite.
   */
  badge?: number;
  disabled?: boolean;
  label: string;
  value: TValue;
};

type SegmentedControlProps<TValue extends string> = {
  /** Accessible name. Required — this renders as a radio group. */
  "aria-label": string;
  // Explicitly admits undefined: the project runs exactOptionalPropertyTypes,
  // so `className?: string` would reject a forwarded `string | undefined`.
  className?: string | undefined;
  onValueChange: (value: TValue) => void;
  options: SegmentedControlOption<TValue>[];
  value: TValue;
};

/**
 * Single-select control for a small, fixed set of options.
 *
 * DESIGN.md §6 names this for payment method, table density and date range, and
 * it explicitly replaces "two adjacent buttons where the selected one is fully
 * black" — a pattern that reads as two competing primary actions rather than
 * one choice.
 *
 * Built as a radio group rather than a row of buttons: a screen reader then
 * announces "2 of 4" and the arrow keys move the selection, which is what a
 * segmented control means. Roving tabindex keeps the whole group one tab stop.
 */
export function SegmentedControl<TValue extends string>({
  "aria-label": ariaLabel,
  className,
  onValueChange,
  options,
  value,
}: SegmentedControlProps<TValue>): JSX.Element {
  const groupId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const focusAt = useCallback((index: number): void => {
    const items = containerRef.current?.querySelectorAll<HTMLButtonElement>("[data-segment]");
    items?.[index]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const selectable = options.filter((option) => !option.disabled);
      if (selectable.length === 0) {
        return;
      }

      const currentIndex = selectable.findIndex((option) => option.value === value);
      let nextIndex: number | null = null;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = (currentIndex + 1) % selectable.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex = (currentIndex - 1 + selectable.length) % selectable.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = selectable.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const next = selectable[nextIndex];
      if (!next) {
        return;
      }

      onValueChange(next.value);
      focusAt(options.findIndex((option) => option.value === next.value));
    },
    [focusAt, onValueChange, options, value],
  );

  return (
    <div
      aria-label={ariaLabel}
      className={cn(SEGMENT_TRACK_CLASS, className)}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      role="radiogroup"
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            aria-checked={selected}
            className={segmentItemClass(selected)}
            data-segment=""
            disabled={option.disabled}
            id={`${groupId}-${option.value}`}
            key={option.value}
            onClick={() => onValueChange(option.value)}
            role="radio"
            // Roving tabindex: the group is a single tab stop, and arrow keys
            // move within it.
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {option.label}
            {option.badge ? <span className={SEGMENT_BADGE_CLASS}>{option.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
