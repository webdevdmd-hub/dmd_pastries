"use client";

import { type JSX, useEffect, useState } from "react";

/**
 * The ledger motif (DESIGN.md §7, plan item D2).
 *
 * A running total that resolves once to a balanced figure and holds. No loop, no
 * blur, no drift, over in about a second.
 *
 * WHY THIS AND NOT THE ORBS
 *
 * What it replaces was two 18–22rem blurred gradient circles drifting on an
 * 11-second loop plus a scanline sweep — the most recognisable "AI generated this
 * page" tell there is, on the first screen a prospect sees.
 *
 * This is ownable in a way a gradient never is, because it is built from the
 * product's own subject matter: the numbers balance. A bakery owner evaluating a
 * bakery POS sees the thing the product actually does. And it is finite — it
 * arrives at an answer and stops, which is the opposite of decoration that loops
 * forever behind a form.
 *
 * REDUCED MOTION IS THE DEFAULT STATE, NOT A FALLBACK
 *
 * The resolved figure is what renders on first paint. The animation only ever
 * *replaces* it, and only when motion is allowed. So under
 * `prefers-reduced-motion: reduce` there is nothing to suppress — the correct frame
 * is already on screen. That ordering matters: the orbs this replaces were animation
 * with no resolved state to fall back to, which is why the media query could not
 * help them.
 */

/**
 * Ends at a balanced 0.00, which is the point being made.
 *
 * `RESOLVED` is written out rather than read off the end of the array: under
 * `noUncheckedIndexedAccess` an index lookup is `string | undefined`, and the
 * resolved frame is the one value in here that must never be undefined — it is what
 * renders on the server and under reduced motion.
 */
const RESOLVED = "0.00";
const RESOLVE_STEPS: readonly string[] = [
  "184,220.00",
  "92,110.00",
  "41,006.25",
  "8,204.50",
  RESOLVED,
];
const STEP_MS = 170;

export function LedgerMotif(): JSX.Element {
  // Start resolved. See the note above: this is the reduced-motion frame AND the
  // server-rendered frame, so no configuration is needed for either.
  const [value, setValue] = useState(RESOLVED);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let step = 0;
    setValue(RESOLVE_STEPS[0] ?? RESOLVED);

    const interval = window.setInterval(() => {
      step += 1;
      const next = RESOLVE_STEPS[step];

      // Undefined means we ran off the end, so we are already showing the resolved
      // figure and there is nothing left to do but stop.
      if (next === undefined) {
        window.clearInterval(interval);
        return;
      }

      setValue(next);
    }, STEP_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return (
    <aside
      // aria-hidden: this is atmosphere, not information. A screen reader
      // announcing a figure counting down to zero on a login screen would be
      // actively confusing, and nothing here is needed to sign in.
      aria-hidden
      className="hidden flex-col items-center justify-center gap-3 bg-muted p-8 lg:flex"
    >
      <span className="text-meta text-foreground-muted">Trial balance</span>
      <span className="text-total font-mono tabular-nums text-foreground">AED {value}</span>
      <span className="h-px w-32 bg-border" />
      <span className="text-meta text-foreground-muted">Balanced</span>
    </aside>
  );
}
