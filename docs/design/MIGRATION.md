# Design system migration

How to adopt [DESIGN.md](../../DESIGN.md) without a big-bang rewrite of 80+ routes.

**Nothing here is applied yet.** Each phase is independently shippable and revertible.

---

## The actual scope

Measured on `frontend/src`:

| What | Count | Notes |
| --- | --- | --- |
| Hardcoded hex values | 298 across 32 files | |
| &nbsp;&nbsp;— in chart components | 116 | Recharts needs literal colors. Legitimate need, wrong source. |
| &nbsp;&nbsp;— in 3D scenes (`components/home/`, `app/page.tsx`) | 87 | react-three-fiber materials. Same. |
| &nbsp;&nbsp;— in auth screens | 54 | The orb/scanline decoration. Deleted, not migrated. |
| &nbsp;&nbsp;— everywhere else | ~41 | Straight token replacements. |
| **Raw Tailwind palette utilities** | **1,911** | The real drift. |
| `font-black` (weight 900) | 78 across 34 files | Not in the system. |
| `font-mono` with no mono font loaded | 31 files | Live bug. |
| `tabular-nums` | 9 files | Should be everywhere money appears. |

The largest single cluster is an ad-hoc error treatment: `text-red-700` (172), `bg-red-50` (127), `border-red-200` (117), `text-red-800` (98). **514 occurrences of one pattern with no token behind it.** One codemod, and it moves more than all 298 hexes combined.

### Why it happened

`--brand-caramel` and `--brand-espresso` both resolve to `9 9 11`, pure black. The token layer has no brown. But `#7A553A` appears 38 times and `#B08968` 25 times in components. Developers reached for a color the tokens did not have, so they typed the hex.

**The fix is not discipline. It is a token layer that covers what people actually reach for, plus lint that makes the wrong thing fail.** Phase 1 and the guardrails do that together.

---

## Phase 1 — Land the token layer

Nothing user-visible changes. Every existing class keeps working.

1. Copy [tokens.css](tokens.css) over the `:root` and `:root[data-theme="pistachio"]` blocks in `frontend/src/app/globals.css`.

   **In the same commit, delete `globals.css` lines 242-346.** Those ~120 hand-written utilities read `background-color: rgb(var(--brand-latte))`. The new tokens are bare **oklch** triplets, so `rgb(0.97 0 0)` is invalid CSS and every one of those utilities silently stops painting. There is no build error and no lint error — just missing backgrounds across the app. The Tailwind alias layer regenerates all of them correctly, so deleting is the fix, but it cannot be deferred to a later phase. Delete `.font-display` and `.font-sans` (lines 410-416) in the same commit for the same reason.
2. Copy [tailwind.config.proposed.ts](tailwind.config.proposed.ts) to `frontend/tailwind.config.ts`. It keeps `brand-*`, `workspace-*`, and the shadcn names as aliases pointing at new tokens, so `components/ui/*` renders unchanged.
3. Swap the fonts in `frontend/src/app/layout.tsx`:

```ts
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

const fontSans = Geist({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const fontMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });
const fontSerif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: ["400"] });
// <html className={`${fontSans.variable} ${fontMono.variable} ${fontSerif.variable}`}>
```

   This alone fixes the 31 files where `font-mono` resolved to nothing. Remove the `Manrope` and `Cormorant_Garamond` imports; `--font-display` is replaced by `--font-serif`, so grep for `font-display` before deleting.
4. Remove `html { scroll-behavior: smooth }` from `globals.css`, scope it to marketing routes.

**Verify:** `pnpm build`, then walk `/pos`, `/accounting/reports/trial-balance`, `/inventory`, `/login`. Expect identical layout, a visible type change (Geist is tighter than Manrope), consistent mono on prices, snappier POS grid scrolling.

**Note on the type change:** this is the one non-breaking phase that is still visually obvious. If you would rather land tokens and fonts separately, do steps 1, 2, 4 first and step 3 on its own.

---

## Phase 2 — Semantic codemod (biggest single win)

| Find | Replace |
| --- | --- |
| `bg-red-50`, `bg-red-100` | `bg-danger-tint` |
| `border-red-200` | `border-danger/30` |
| `text-red-700`, `text-red-800` | `text-danger-text` |
| `text-red-600` | `text-danger` |
| `bg-amber-50`, `bg-yellow-50` | `bg-warning-tint` |
| `border-amber-200` | `border-warning/30` |
| `text-amber-700`, `text-amber-800` | `text-warning-text` |
| `bg-emerald-50`, `bg-green-50` | `bg-accent-tint` |
| `text-emerald-700`, `text-green-700` | `text-accent-text` |
| `bg-blue-50` | `bg-info-tint` |
| `text-blue-700` | `text-info-text` |

Contrast improves in every case: `text-red-700` on `bg-red-50` is ~5.9:1; `danger-text` on `danger-tint` is 7.29:1.

**Verify:** screenshot-diff error states on `/accounting/journal-entries`, `/inventory/low-stock`, `/payments/refunds`.

---

## Phase 3 — Neutrals codemod

| Find | Replace |
| --- | --- |
| `text-zinc-950` (59), `text-neutral-950`(54), `text-black` | `text-foreground` |
| `text-zinc-600`, `text-zinc-500`, `text-neutral-600` | `text-foreground-muted` |
| `text-zinc-400`, `text-neutral-400` | `text-foreground-disabled` |
| `border-zinc-300` (93), `border-neutral-300` (57) | `border-border` |
| `border-zinc-200`, `border-neutral-200` | `border-border` |
| `bg-zinc-100`, `bg-neutral-100`, `bg-zinc-50` | `bg-muted` |
| `bg-white` | `bg-card` |
| `bg-black`, `hover:bg-zinc-900` | `bg-primary`, `hover:bg-primary/90` |

One Tailwind color family per PR (`zinc`, then `neutral`, then `slate`/`gray`). A single 1,900-line diff is unreviewable.

---

## Phase 4 — Retire the old token names

Only after 2 and 3.

1. `brand-caramel` → `primary`, `brand-espresso` → `foreground`, `brand-mocha` → `foreground-muted`, `brand-latte` → `muted`, `brand-cappuccino` → `border`.
2. `workspace-canvas` → `background`, `workspace-panel` → `card`, `workspace-border` → `border`, `workspace-muted` → `foreground-muted`.
3. Delete the `brand` and `workspace` groups from `tailwind.config.ts`.
4. **Delete the ~50 lines of `:root[data-theme="pistachio"] aside.bg-brand-espresso …` overrides from `globals.css`.** With themes restricted to redefining tokens there is nothing left to override. Re-verify pistachio on `/pos` and the sidebar.
5. Delete the ~120 hand-written `.bg-brand-*` / `.text-brand-*` / `.border-brand-*` utilities from `@layer utilities`. Tailwind generates these now.

---

## Phase 5 — Typography discipline

1. `font-black` → `font-medium` (78 occurrences). Review the handful where `font-semibold` is right: page titles only.
2. `font-bold` → `font-medium` except page titles. 500 is the workhorse.
3. **Kill uppercase tracking.** Find `uppercase` combined with `tracking-[0.1em]`+ and replace with sentence case at `text-meta` in `text-foreground-muted`. This is the single most dating pattern in the build.
4. Replace sizes below 12px: `text-[0.6…]` through `text-[0.7…]`, `text-[10px]`, `text-[11px]` → `text-meta`.
5. Add `tabular-nums` to every money, count, date, and percentage cell. Prefer the `data-numeric` attribute from `tokens.css` on table cells, which gives right-alignment, tabular figures, and −0.02em tracking together.
6. Scope `font-serif` to `(auth)` routes, the receipt header, and `app/page.tsx`.

---

## Phase 6 — Charts and 3D

116 chart hexes + 87 3D-material hexes are literal colors by necessity. They should come from one bridge, not be typed by hand.

Create `frontend/src/lib/design/palette.ts`:

```ts
/** Literal values for canvas/WebGL contexts that cannot read CSS vars.
 *  Keep in sync with docs/design/tokens.css. */
export const palette = {
  foreground: "#0A0A0A",
  foregroundMuted: "#737373",
  border: "#E5E5E5",
  muted: "#F5F5F5",
  card: "#FFFFFF",
  accent: "#00723B",
  warning: "#A66D00",
  danger: "#CC2827",
  info: "#3072C1",
} as const;

/** Categorical series for Recharts. Ordered for maximum adjacent contrast
 *  and distinguishable under deuteranopia and protanopia. */
export const chartSeries = [
  "#171717", // primary
  "#00723B", // accent
  "#3072C1", // info
  "#A66D00", // warning
  "#CC2827", // danger
  "#737373", // muted
] as const;
```

Note the series leads with near-black rather than a color. In a monochrome system the first series should be the neutral one; color enters as a distinguisher, not a default.

Replace hexes in `components/reports/*`, `components/dashboard/*-chart.tsx`, `components/home/*` with imports. `components/home/bakery-door-scene.tsx` alone holds 51 hexes; treat its material colors as art direction, not tokens.

---

## Phase 7 — Density registers and components

1. `data-density="counter"` on the `(pos)` layout, `data-density="ledger"` on `(dashboard)`.
2. Rebuild `components/ui/button.tsx` per DESIGN.md §6. Add `commit`, drop the filled `secondary`, change the focus ring from `ring-brand-caramel` to `ring-ring`.
3. Fix `components/pos/pos-product-card.tsx`. **The 28px Variants button is the highest-priority fix in the app.**
4. Add the segmented control primitive; use it for POS payment method and table density.
5. Add three-mode table density to `components/ui/table.tsx`, persisted per user. Remove vertical rules.
6. Replace the auth orbs and scanline with the Threshold treatment.
7. Wire the dark mode toggle. Tokens already support it.

---

## Guardrails (land with Phase 1, before any codemod)

Add to `eslint.config.mjs`:

```js
{
  files: ["src/**/*.tsx"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "JSXAttribute[name.name='className'] Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
        message:
          "No hardcoded hex in className. Use a token. Canvas/WebGL colors import from @/lib/design/palette.",
      },
      {
        selector:
          "JSXAttribute[name.name='className'] Literal[value=/\\b(text|bg|border|ring|from|to|via)-(zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\\b/]",
        message:
          "No raw Tailwind palette colors. Use tokens: foreground, foreground-muted, card, muted, border, accent, warning, danger, info.",
      },
      {
        selector: "JSXAttribute[name.name='className'] Literal[value=/\\bfont-(black|extrabold)\\b/]",
        message: "Weights above 600 are not in the type system. 500 is the workhorse.",
      },
      {
        selector:
          "JSXAttribute[name.name='className'] Literal[value=/\\buppercase\\b(?=[^\"']*\\btracking-\\[0\\.(0[7-9]|[1-9])/]",
        message:
          "Uppercase with wide tracking is banned. Use sentence case at text-meta in text-foreground-muted.",
      },
      {
        selector:
          "JSXAttribute[name.name='className'] Literal[value=/text-\\[0\\.(?:[0-6][0-9]?|7[0-4])[0-9]*rem\\]|text-\\[[0-9]px\\]|text-\\[1[01]px\\]/]",
        message: "12px is the minimum readable size. Use text-meta or larger.",
      },
      {
        selector:
          "JSXAttribute[name.name='className'] Literal[value=/\\btext-(warning|danger|info)\\b(?!-)/]",
        message:
          "Semantic -solid values are fills, not text. Use text-danger-text / text-warning-text / text-info-text.",
      },
      {
        selector: "JSXAttribute[name.name='className'] Literal[value=/\\btext-foreground-disabled\\b/]",
        message: "foreground-disabled is 3.15:1 and fails AA. Placeholders and disabled state only.",
      },
    ],
  },
}
```

Set each rule to `"warn"` during the phase that clears it, then flip to `"error"` when that phase lands. All-errors on day one makes `pnpm lint` unusable.

---

## Sequencing

| Phase | Risk | Reviewable as |
| --- | --- | --- |
| 1 Token layer + fonts | Low, but the font swap is visible | One PR, or split fonts out |
| 2 Semantic codemod | Low | One PR, screenshot-diff error states |
| 3 Neutrals codemod | Low | **One PR per color family** |
| 4 Retire old names | Low | One PR, re-verify pistachio |
| 5 Typography | Low | One PR |
| 6 Charts and 3D | Low | One PR |
| 7 Components and density | **Medium** | One PR per component, visual QA each |

Run `/design-review` after phase 7.
