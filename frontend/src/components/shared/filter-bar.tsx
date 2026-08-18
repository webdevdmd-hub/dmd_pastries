import type { JSX, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The filter row above a list.
 *
 * A fill, not a card: DESIGN.md §4 reserves borders for structural boundaries
 * and uses `--muted` fills for toolbars and wells. Every payments surface had
 * its own version of this — `rounded-3xl` with a border and a shadow here, a
 * `<Card>` there, `rounded-2xl` with a seven-column grid somewhere else — so
 * four screens doing one job looked like four products.
 *
 * Note for callers: `Input` and `SelectTrigger` are `w-full` by design, which is
 * right in a stacked form and wrong here — an unsized field claims an entire
 * row. Give fields an explicit width and let the search box take `flex-1`.
 */
export function FilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}): JSX.Element {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2.5 rounded bg-muted px-4 py-3", className)}
    >
      {children}
    </div>
  );
}
