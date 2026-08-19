import { cn } from "@/lib/utils/cn";

/**
 * The visual vocabulary of a segmented track, shared by every control that
 * renders as one.
 *
 * These strings live here rather than inline because two components must render
 * pixel-identically while behaving differently: `SegmentedControl` is a
 * radiogroup of buttons, and the Inventory view strip is a tablist mixing
 * buttons with real anchors. Copying the classes into both would work today and
 * drift the first time either is touched, and the whole point of the strip is
 * that its six items are indistinguishable.
 *
 * Styles only. No roles, no keyboard behaviour, no state -- those differ
 * between the two and deliberately are not shared.
 */

/** The muted track that holds the segments. */
export const SEGMENT_TRACK_CLASS = "inline-flex gap-0.5 rounded bg-muted p-0.5";

/** One segment. `selected` gets the raised card treatment. */
export function segmentItemClass(selected: boolean): string {
  return cn(
    "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 text-meta font-medium transition-colors duration-fast ease-out",
    // Ring offset is `muted`, not `canvas`: a segment sits on the track, so a
    // canvas-coloured offset would draw a pale halo against the wrong ground.
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-muted",
    "disabled:pointer-events-none disabled:opacity-50",
    selected ? "bg-card text-foreground shadow-xs" : "text-foreground-muted hover:text-foreground",
  );
}

/**
 * The count pill that can sit after a segment's label.
 *
 * Warning-toned rather than danger: DESIGN.md section 3.3 maps both low stock
 * and expiring to the warning role, and these counts are exactly those two.
 */
export const SEGMENT_BADGE_CLASS =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning-tint px-1.5 text-xs font-medium tabular-nums text-warning-text";
