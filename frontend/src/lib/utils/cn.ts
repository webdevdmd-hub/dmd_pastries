import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The v3 type scale is ADDITIVE and semantic (DESIGN.md §2): `text-meta`,
 * `text-cell`, `text-body`, `text-title`, `text-page`, `text-kpi`, `text-total`,
 * `text-display`. tailwind-merge does not know them, and its fallback for an
 * unrecognised `text-*` utility is to treat it as a TEXT COLOUR. So it decided
 * these collided with the semantic colour tokens and dropped the earlier one:
 *
 *   twMerge("text-danger-text text-body")   -> "text-body"        colour gone
 *   twMerge("text-foreground-muted text-meta") -> "text-meta"     colour gone
 *   twMerge("text-money-text text-title")   -> "text-title"       colour gone
 *
 * Caught on the POS discard-sale confirm dialog, whose destructive button
 * rendered in --foreground black instead of --danger-text red: AppButton put
 * `text-danger-text` in the tone classes and the caller passed `text-body`.
 *
 * This is the plan's R2 failure signature exactly — invalid or missing styling
 * with no build error and no lint error — and it fires wherever a v3 type token
 * and a v3 colour token meet in the same `cn()` call. Note `text-sm` was never
 * affected, because tailwind-merge ships with the stock scale, which is why the
 * bug only appeared once components started adopting the semantic scale.
 *
 * Registering the scale as font-size restores the intended behaviour: a size and
 * a colour are different groups and both survive.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["meta", "cell", "body", "title", "page", "kpi", "total", "display"] }],
    },
  },
});

export function cn(...inputs: Parameters<typeof clsx>): string {
  return twMerge(clsx(inputs));
}
