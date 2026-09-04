/**
 * Literal colour values for contexts that cannot read CSS custom properties.
 *
 * Recharts renders to SVG but takes colours as prop strings, and react-three-fiber
 * materials run on WebGL. Neither can resolve `var(--money-solid)`, so they need
 * real values — which is the legitimate reason chart code reached for hex in the
 * first place. The mistake was typing them per component: before this file, charts
 * carried 124 literals in the v1 coffee palette (#7A553A Mocha Bean 38 times,
 * #B08968 Caramel Roast 16, #D6BFA6 Warm Cappuccino 14, #F3E9D7 Creamy Latte),
 * i.e. every chart in the app was still brown after the rest of it went monochrome.
 *
 * KEEP IN SYNC WITH docs/design/tokens.css. There is no way to derive one from the
 * other at build time; `pnpm check:chart-palette` at least asserts the series stay
 * distinguishable, and `pnpm check:tokens` covers the CSS side.
 *
 * TAKES A MODE, DELIBERATELY (plan risk R9)
 *
 * Dark mode is cut from the current plan, so it would be easy to export a single
 * light object here. R9 flags that as the trap: the day dark mode lands, a flat
 * object is wrong at every call site, and there will be 124 of them. A function
 * that ignores its argument today costs nothing and is a one-line change later.
 */
export type PaletteMode = "light" | "dark";

type Palette = {
  canvas: string;
  card: string;
  muted: string;
  border: string;
  foreground: string;
  foregroundMuted: string;
  primary: string;
  money: string;
  moneyText: string;
  moneyTint: string;
  warning: string;
  warningText: string;
  warningTint: string;
  danger: string;
  dangerText: string;
  dangerTint: string;
  info: string;
  infoText: string;
  infoTint: string;
};

const light: Palette = {
  canvas: "#FAF9F7",
  card: "#FFFFFF",
  muted: "#F2F0EC",
  border: "#E5E2DC",
  foreground: "#0A0A0A",
  foregroundMuted: "#6E6A64",
  primary: "#171717",
  money: "#00723B",
  moneyText: "#005E31",
  moneyTint: "#EAF7EE",
  warning: "#A66D00",
  warningText: "#7B4800",
  warningTint: "#FCF3E1",
  danger: "#CC2827",
  dangerText: "#9E1618",
  dangerTint: "#FDEEEC",
  info: "#3072C1",
  infoText: "#17559B",
  infoTint: "#EBF3FD",
};

/** Not shipped (TODOS T-A), but measured, so the bridge is dark-ready. */
const dark: Palette = {
  canvas: "#0B0B0B",
  card: "#141414",
  muted: "#1C1C1C",
  border: "#2A2A2A",
  foreground: "#F4F1EC",
  foregroundMuted: "#A39E96",
  primary: "#F4F1EC",
  money: "#00723B",
  moneyText: "#2FAE71",
  moneyTint: "#0E2A1B",
  warning: "#A66D00",
  warningText: "#E0A030",
  warningTint: "#2A1F0B",
  danger: "#CC2827",
  dangerText: "#F87171",
  dangerTint: "#2E1414",
  info: "#3072C1",
  infoText: "#7DB3F7",
  infoTint: "#0F1E30",
};

export function palette(mode: PaletteMode = "light"): Palette {
  return mode === "dark" ? dark : light;
}

/**
 * Categorical series for Recharts.
 *
 * Leads with near-black rather than a colour: in a monochrome system the first
 * Colour now LEADS on analytical surfaces (DESIGN.md §1, changed 2026-09-04).
 * A single-series revenue chart renders green, because on a dashboard green is
 * the revenue series as well as the money accent. The neutrals moved to the back
 * of the list rather than out of it — a six-series chart still needs them.
 *
 * Ordered for maximum adjacent separation, and that ordering is ASSERTED, not
 * asserted-in-a-comment: `scripts/check-chart-palette.mjs` simulates protanopia and
 * deuteranopia and fails if any adjacent pair collapses. The previous version of
 * this list carried the claim "distinguishable under deuteranopia and protanopia"
 * with nothing checking it.
 */
export const chartSeries = [
  "#00723B", // money — colour leads now, see the note above
  "#3072C1", // info
  "#A66D00", // warning
  "#9E1618", // danger-TEXT, not danger-solid — see below
  "#171717", // primary
  "#6E6A64", // foreground-muted
] as const;

/**
 * On the danger entry: this is `--danger-text` (#9E1618), not `--danger-solid`
 * (#CC2827), and the check is what forced it.
 *
 * With danger-solid, warning and danger collapsed to dE 7.7 under deuteranopia —
 * indistinguishable, and adjacent in the series. Both hues project to a similar
 * yellow-brown for a deuteranope, so no reordering fixes it; only separating them
 * in lightness does. The darker danger-text lifts the worst adjacent pair to 20.5
 * and the worst pair anywhere to 17.4.
 *
 * It is also the better token on its own merits: a chart stroke is a thin 2px mark,
 * which needs text-grade contrast rather than fill-grade, and DESIGN.md §3.3 puts
 * the `-text` values at 6.5:1+ while `-solid` is specified for fills.
 */

/**
 * Dash patterns paired to `chartSeries` by index.
 *
 * A line chart is the one place in this system where colour genuinely is the only
 * carrier of meaning — there is no dot or label to fall back on, so a viewer who
 * cannot separate two hues cannot read the chart at all. Applying these as
 * `strokeDasharray` gives every series a second, non-colour channel.
 *
 * Not optional for multi-series line charts. DESIGN.md §9 requires that colour is
 * never the only carrier of state, and a legend swatch does not satisfy it.
 */
export const chartSeriesDash = [
  undefined, // solid — the primary series stays clean
  "6 3",
  "2 3",
  "8 3 2 3",
  "4 2 4 6",
  "1 3",
] as const;
