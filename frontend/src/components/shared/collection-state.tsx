"use client";

import type { LucideIcon } from "lucide-react";
import type { JSX, ReactNode } from "react";

import { useDensity } from "@/components/density/density-provider";
import { Button } from "@/components/ui/button";

/**
 * The three states a collection can be in when it shows nothing (DESIGN.md §8,
 * plan item E1).
 *
 * Kept in one file on purpose. The failure this addresses is that they rendered
 * identically, and three components in three files drift apart again the moment
 * someone edits one. Side by side, "these must look different" is enforced by
 * reading.
 *
 * WHAT WAS ACTUALLY THERE
 *
 * Not nothing — 26 empty-state components and 24 error-state components, one per
 * module, all near-copies of Card > CardContent > tinted icon > h2 > p > Button,
 * differing only in icon, copy and handler. What genuinely did not exist was the
 * FILTERED state (0 files), which is the one most often confused with empty.
 *
 * The copy gave it away: every one of those said "No customers found." / "No
 * products found." — `found` is search language. It reads as "your filter matched
 * nothing" on a screen that means "you have not created any yet". Two different
 * situations, two different next actions, one shared sentence.
 *
 * REGISTER
 *
 * Ledger is instructive: the owner is reading, is new, and needs to know what fills
 * the screen. Counter is terse: the cashier is not reading and already knows. The
 * register is read from context rather than passed, so a component cannot be
 * mounted into the wrong one by accident.
 *
 * NO ILLUSTRATIONS, in any of the three. 147 routes would mean 147 assets to draw,
 * maintain and theme, and it makes a financial product read as a toy.
 */

type Action = {
  label: string;
  onClick: () => void;
};

/* ------------------------------------------------------------------ empty --- */

type EmptyStateProps = {
  /** Names what is missing. Not "No data" — say the noun. */
  title: string;
  /** Ledger only: what will fill this, and why it is empty. Ignored at the counter. */
  description?: string | undefined;
  icon?: LucideIcon | undefined;
  /** The one action that changes the situation. */
  action?: Action | undefined;
  /** At most one alternate. More than two actions is a menu, not an empty state. */
  alternate?: Action | undefined;
};

/**
 * Nothing exists yet. Neutral and instructive — this is not an error, and for a new
 * tenant it is the first impression of the module.
 *
 * `--card` with a DASHED border, which is what separates it at a glance from the
 * filtered row (solid `--muted`) and the failed panel (`--danger-tint`).
 */
export function EmptyState({
  action,
  alternate,
  description,
  icon: Icon,
  title,
}: EmptyStateProps): JSX.Element {
  const density = useDensity();
  const isCounter = density === "counter";

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center">
      {Icon ? <Icon aria-hidden className="h-5 w-5 shrink-0 text-foreground-muted" /> : null}

      <h2 className="text-title text-foreground">{title}</h2>

      {/* Counter gets no body copy: a cashier mid-shift is not reading a paragraph,
          and the title already names what is missing. */}
      {!isCounter && description ? (
        <p className="text-body max-w-[54ch] text-foreground-muted">{description}</p>
      ) : null}

      {/* ...and no actions either. At the counter the way out of an empty screen is
          the surrounding UI, not a button inside the hole. */}
      {!isCounter && (action ?? alternate) ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action ? (
            <Button className="min-h-tap" onClick={action.onClick} type="button">
              {action.label}
            </Button>
          ) : null}
          {alternate ? (
            <Button
              className="min-h-tap"
              onClick={alternate.onClick}
              type="button"
              variant="outline"
            >
              {alternate.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- filtered --- */

type FilteredStateProps = {
  /** What the user searched for, echoed back so they can see the typo. */
  query?: string | undefined;
  /** How many exist in total. This is the whole point: things DO exist. */
  totalCount?: number | undefined;
  /** Plural noun for the collection, e.g. "products". */
  noun: string;
  onClearFilters: () => void;
};

/**
 * Things exist; the filter excludes them.
 *
 * A `--muted` INLINE ROW, deliberately not the dashed card. The shape itself
 * carries the difference: a card says "this screen is empty", a row inside the list
 * says "your filter is narrow". Same reason it never offers the create action —
 * offering "Add product" here implies the catalogue is empty when 214 products
 * exist, which sends the user off to do the wrong thing.
 *
 * `role="status"` with `aria-live="polite"`: this appears and disappears as someone
 * types, so it has to be announced, and politely. That plus the distinct wording is
 * what closes TODOS T-H — three states that announce differently, rather than three
 * that all say "No items found".
 */
export function FilteredState({
  noun,
  onClearFilters,
  query,
  totalCount,
}: FilteredStateProps): JSX.Element {
  return (
    <div
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-muted px-4 py-3"
      role="status"
    >
      <p className="text-body min-w-0 text-foreground">
        No {noun} match
        {query ? (
          <span className="font-mono text-foreground"> &ldquo;{query}&rdquo;</span>
        ) : (
          " the current filters"
        )}
        .
      </p>

      {/* "1 products exist" is what noun agreement gets you here, and naive
          pluralisation breaks on the words this app actually uses (categories,
          batches). A labelled figure sidesteps agreement entirely, is grammatical
          at any count, and reads as ledger vocabulary rather than prose. */}
      {typeof totalCount === "number" ? (
        <p className="text-body text-foreground-muted">
          Total: <span className="font-mono tabular-nums text-foreground">{totalCount}</span>
        </p>
      ) : null}

      <span className="flex-1" />

      <Button
        className="min-h-tap shrink-0"
        onClick={onClearFilters}
        type="button"
        variant="outline"
      >
        Clear filters
      </Button>
    </div>
  );
}

/* ----------------------------------------------------------------- failed --- */

type FailedStateProps = {
  /** What failed to load, e.g. "products". */
  noun: string;
  /** Optional detail from the API. Never the raw stack. */
  detail?: ReactNode | undefined;
  onRetry?: (() => void) | undefined;
};

/**
 * The request errored.
 *
 * `--danger-tint` with `--danger-text`, and it always says nothing was lost. An
 * error where a list should be reads as "my data is gone"; that one sentence is the
 * most commonly missing part of a failed state and the cheapest to add.
 *
 * The reassurance deliberately avoids the noun. "your {noun} are still there" reads
 * well for "products" and breaks for the nouns modules actually pass — "the
 * dashboard", "purchasing data", "the report". A sentence that is grammatical for
 * every caller beats one that is warmer for some and broken for others.
 *
 * `role="alert"`, because unlike the filtered row this is not a refinement of what
 * the user just did — it is something that went wrong and warrants interrupting.
 */
export function FailedState({ detail, noun, onRetry }: FailedStateProps): JSX.Element {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-lg border border-danger/30 bg-danger-tint px-6 py-10 text-center"
      role="alert"
    >
      <h2 className="text-title text-danger-text">Couldn&rsquo;t load {noun}</h2>

      <p className="text-body max-w-[54ch] text-danger-text">
        {detail ?? "The request failed."} Nothing has changed and no data was lost.
      </p>

      {onRetry ? (
        <Button
          className="min-h-tap mt-2 border-border bg-card text-foreground hover:bg-muted"
          onClick={onRetry}
          type="button"
          variant="outline"
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}
