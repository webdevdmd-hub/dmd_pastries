# Design system migration

How to adopt [DESIGN.md](../../DESIGN.md) without a big-bang rewrite of 80+ routes.

**Nothing here is applied yet.** Each phase is independently shippable and revertible.

Updated for DESIGN.md **v3** on 2026-08-17: Phase 0 is new and blocking, Phase 1 swaps in Fraunces, and Phases 8-10 cover dark mode, threshold surfaces, and empty states.

---

## The actual scope

Measured on `frontend/src`, 2026-08-17 (v2's 2026-08-14 figures in brackets where they differ):

| What                                                            | Count                            | Notes                                                         |
| --------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------- |
| Hardcoded hex values                                            | 291 across 33 files [was 298/32] |                                                               |
| &nbsp;&nbsp;— in chart components                               | 116                              | Recharts needs literal colors. Legitimate need, wrong source. |
| &nbsp;&nbsp;— in 3D scenes (`components/home/`, `app/page.tsx`) | 87                               | react-three-fiber materials. Same.                            |
| &nbsp;&nbsp;— in auth screens                                   | 54                               | The orb/scanline decoration. Deleted, not migrated.           |
| &nbsp;&nbsp;— everywhere else                                   | ~41                              | Straight token replacements.                                  |
| **Raw Tailwind palette utilities**                              | **1,949** [was 1,911]            | The real drift, and still growing.                            |
| `font-black` (weight 900)                                       | 78 across 34 files               | Not in the system.                                            |
| `font-mono` with no mono font loaded                            | 31 files                         | Live bug.                                                     |
| `tabular-nums`                                                  | 9 files                          | Should be everywhere money appears.                           |
| Dark mode token blocks                                          | **0**                            | `darkMode: ["class"]` is declared and unused.                 |

The largest single cluster is an ad-hoc error treatment: `text-red-700` (172), `bg-red-50` (127), `border-red-200` (117), `text-red-800` (98). **514 occurrences of one pattern with no token behind it.** One codemod, and it moves more than all 298 hexes combined.

### Why it happened

`--brand-caramel` and `--brand-espresso` both resolve to `9 9 11`, pure black. The token layer has no brown. But `#7A553A` appears 38 times and `#B08968` 25 times in components. Developers reached for a color the tokens did not have, so they typed the hex.

**The fix is not discipline. It is a token layer that covers what people actually reach for, plus lint that makes the wrong thing fail.** Phase 1 and the guardrails do that together.

---

## Phase 0 — Make the guardrails bite (blocking)

**Do this first. Nothing else in this document holds without it.**

The guardrails from the Guardrails section below landed in commit `ce01f74`. They caught nothing, because `eslint.config.mjs:85` sets them all to `"warn"` and `pnpm lint` has no `--max-warnings 0`. In the three days after they landed, raw palette utilities grew from 1,911 to 1,949. The lint rules are decoration until a rule can fail a build.

1. Add a ratchet script that records the current violation count per rule to `frontend/.design-debt.json`.
2. Wire it into `pnpm verify` so the count may go **down or stay flat, never up**. A PR that adds a raw palette utility fails.
3. Leave every rule at `"warn"` for now. The ratchet is what stops the bleeding; the `error` flips happen per-phase (see Sequencing).

This is a day of work and it is the difference between a migration and another spec that sits unapplied for three days.

---

## Phase 1 — Land the token layer

Nothing user-visible changes. Every existing class keeps working.

1. Copy [tokens.css](tokens.css) over the `:root` and `:root[data-theme="pistachio"]` blocks in `frontend/src/app/globals.css`.

   **In the same commit, delete `globals.css` lines 242-346.** Those ~120 hand-written utilities read `background-color: rgb(var(--brand-latte))`. The new tokens are bare **oklch** triplets, so `rgb(0.97 0 0)` is invalid CSS and every one of those utilities silently stops painting. There is no build error and no lint error — just missing backgrounds across the app. The Tailwind alias layer regenerates all of them correctly, so deleting is the fix, but it cannot be deferred to a later phase. Delete `.font-display` and `.font-sans` (lines 410-416) in the same commit for the same reason.

2. Copy [tailwind.config.proposed.ts](tailwind.config.proposed.ts) to `frontend/tailwind.config.ts`. It keeps `brand-*`, `workspace-*`, and the shadcn names as aliases pointing at new tokens, so `components/ui/*` renders unchanged.
3. Swap the fonts in `frontend/src/app/layout.tsx`:

```ts
import { Geist, Geist_Mono, Fraunces } from "next/font/google";

const fontSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const fontMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});
const fontSerif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500"],
  axes: ["SOFT"],
});
// <html className={`${fontSans.variable} ${fontMono.variable} ${fontSerif.variable}`}>
```

This alone fixes the 31 files where `font-mono` resolved to nothing. Remove the `Manrope` and `Cormorant_Garamond` imports; `--font-display` is replaced by `--font-serif`, so grep for `font-display` before deleting.

Use the **v3** values from DESIGN.md §3, not v2's: the neutrals are barely warm, and `--foreground-muted` is `#6E6A64` rather than `#737373` (v2's value is 4.35:1 on v2's own muted fills, below its own AA floor).

4. Remove `html { scroll-behavior: smooth }` from `globals.css`, scope it to marketing routes.

**Verify:** `pnpm build`, then walk `/pos`, `/accounting/reports/trial-balance`, `/inventory`, `/login`. Expect identical layout, a visible type change (Geist is tighter than Manrope), consistent mono on prices, snappier POS grid scrolling.

**Note on the type change:** this is the one non-breaking phase that is still visually obvious. If you would rather land tokens and fonts separately, do steps 1, 2, 4 first and step 3 on its own.

---

## Phase 2 — Semantic codemod (biggest single win)

| Find                                 | Replace             |
| ------------------------------------ | ------------------- |
| `bg-red-50`, `bg-red-100`            | `bg-danger-tint`    |
| `border-red-200`                     | `border-danger/30`  |
| `text-red-700`, `text-red-800`       | `text-danger-text`  |
| `text-red-600`                       | `text-danger-text`  |
| `bg-amber-50`, `bg-yellow-50`        | `bg-warning-tint`   |
| `border-amber-200`                   | `border-warning/30` |
| `text-amber-700`, `text-amber-800`   | `text-warning-text` |
| `bg-emerald-50`, `bg-green-50`       | `bg-money-tint`     |
| `text-emerald-700`, `text-green-700` | `text-money-text`   |
| `bg-blue-50`                         | `bg-info-tint`      |
| `text-blue-700`                      | `text-info-text`    |

Contrast improves in every case: `text-red-700` on `bg-red-50` is ~5.9:1; `danger-text` on `danger-tint` is 7.29:1.

**Two mappings in this table were corrected on 2026-08-17, both for the same reason: the codemod
would have emitted violations of the rules that now guard it.**

1. `text-red-600` mapped to `text-danger`, and `design/no-solid-as-text` bans `-solid` values as text
   colors at **`error`** severity. The codemod would have failed the commit it was making. The rule is
   right; the mapping was wrong. Now `text-danger-text`.
2. The green rows mapped to `accent-tint` / `accent-text`. Under v3 those names survive **only as
   deprecated aliases** for `--money-*` (kept because shadcn's `components/ui/*` references
   `accent-foreground`). A codemod is exactly the wrong place to mint 100+ fresh usages of a
   deprecated name, so they now map to `money-tint` / `money-text` — the canonical v3 names per
   DESIGN.md §3.

Before running this codemod, re-check every row against `frontend/eslint.design-plugin.mjs`. A
mapping table and a lint rule that disagree is a silent, high-volume defect: at `warn` severity the
new violations do not even show up.

**Verify:** screenshot-diff error states on `/accounting/journal-entries`, `/inventory/low-stock`, `/payments/refunds`.

---

## Phase 3 — Neutrals codemod

| Find                                                       | Replace                             |
| ---------------------------------------------------------- | ----------------------------------- |
| `text-zinc-950` (59), `text-neutral-950`(54), `text-black` | `text-foreground`                   |
| `text-zinc-600`, `text-zinc-500`, `text-neutral-600`       | `text-foreground-muted`             |
| `text-zinc-400`, `text-neutral-400`                        | `text-foreground-disabled`          |
| `border-zinc-300` (93), `border-neutral-300` (57)          | `border-border`                     |
| `border-zinc-200`, `border-neutral-200`                    | `border-border`                     |
| `bg-zinc-100`, `bg-neutral-100`, `bg-zinc-50`              | `bg-muted`                          |
| `bg-white`                                                 | `bg-card`                           |
| `bg-black`, `hover:bg-zinc-900`                            | `bg-primary`, `hover:bg-primary/90` |

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
  canvas: "#FAF9F7",
  card: "#FFFFFF",
  muted: "#F2F0EC",
  border: "#E5E2DC",
  foreground: "#0A0A0A",
  foregroundMuted: "#6E6A64",
  money: "#00723B",
  warning: "#A66D00",
  danger: "#CC2827",
  info: "#3072C1",
} as const;

/** Dark-mode literals. Charts must swap these at runtime, not invert lightness.
 *  See DESIGN.md section 3.5 — every semantic -text value fails on a dark card. */
export const paletteDark = {
  canvas: "#0B0B0B",
  card: "#141414",
  muted: "#1C1C1C",
  border: "#2A2A2A",
  foreground: "#F4F1EC",
  foregroundMuted: "#A39E96",
  money: "#2FAE71",
  warning: "#E0A030",
  danger: "#F87171",
  info: "#7DB3F7",
} as const;

/** Categorical series for Recharts. Ordered for maximum adjacent contrast
 *  and distinguishable under deuteranopia and protanopia. */
export const chartSeries = [
  "#171717", // primary
  "#00723B", // money
  "#3072C1", // info
  "#A66D00", // warning
  "#CC2827", // danger
  "#6E6A64", // muted
] as const;

export const chartSeriesDark = [
  "#F4F1EC", // primary, inverted
  "#2FAE71", // money
  "#7DB3F7", // info
  "#E0A030", // warning
  "#F87171", // danger
  "#A39E96", // muted
] as const;
```

Note the series leads with near-black rather than a color. In a monochrome system the first series should be the neutral one; color enters as a distinguisher, not a default.

Replace hexes in `components/reports/*` (83 hexes) and `components/dashboard/*-chart.tsx` (41 hexes) with imports. `components/home/*` is not migrated here — Phase 9 deletes it outright.

---

## Phase 7 — Density registers and components

1. `data-density="counter"` on the `(pos)` layout, `data-density="ledger"` on `(dashboard)`.
2. Rebuild `components/ui/button.tsx` per DESIGN.md §6. Add `commit`, drop the filled `secondary`, change the focus ring from `ring-brand-caramel` to `ring-ring`.
3. Fix `components/pos/pos-product-card.tsx`. **The 28px Variants button is the highest-priority fix in the app.**
4. Add the segmented control primitive; use it for POS payment method and table density.
5. Add three-mode table density to `components/ui/table.tsx`, persisted per user. Remove vertical rules.

---

## Phase 8 — Dark mode

Do this after Phase 4, once `brand-*` and `workspace-*` are gone. Redefining tokens is only safe when nothing bypasses them.

1. Add the `.dark` block to `globals.css` with the measured v3 values from DESIGN.md §3.5. **Do not derive them by inverting lightness** — all four of v2's semantic `-text` values score 2.26–2.46:1 on a dark card against a 4.5 floor.
2. Leave `--money-solid` at `#00723B` in both modes. White on it is 6.05:1 on any surface, so the Charge button is identical light and dark. That constancy is deliberate.
3. Deepen the shadow alphas per DESIGN.md §4. Light-mode shadow opacity is invisible on near-black.
4. Replace `src/constants/themes.ts`. Today it offers two _light_ themes (`latte`, `pistachio`); it becomes light / dark / system. Migrate the `pastries-pos-theme` localStorage key, mapping both old values to `light`.
5. Delete the ~50 lines of `:root[data-theme="pistachio"] …` override selectors (also listed in Phase 4 step 4). With themes restricted to redefining tokens there is nothing left to override.
6. Add `suppressHydrationWarning` handling and an inline pre-paint script so a dark-mode user does not get a white flash on load.

**Verify:** walk `/pos`, `/accounting/reports/trial-balance`, `/inventory`, `/login` in both modes. Screenshot-diff both. Check every badge, every empty state, and every focus ring.

---

## Phase 9 — Threshold surfaces

1. Delete `.auth-orb-one`, `.auth-orb-two`, `.auth-scanline` and their keyframes from `globals.css` (lines ~95-160).
2. Build the login ledger motif per DESIGN.md §7. Resolves once, holds, renders its final frame under `prefers-reduced-motion`.
3. Rebuild `app/page.tsx` on the landing structure in DESIGN.md §7: mono eyebrow, Fraunces headline, muted sub-paragraph, one CTA, one photograph.
4. Delete `components/home/bakery-door-scene.tsx`, `bakery-operations-scene.tsx`, `foundation-hero-effects.tsx`, `story-section-reveal.tsx` — 901 lines and 87 of the remaining hexes.
5. Drop `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three` from `package.json`. Confirm nothing else imports them first.

**Verify:** landing bundle size before and after. This should be the single largest bundle win in the migration.

**Blocked on:** one photograph of a real counter. Until it exists, ship the type-only version — it is still better than the door scene.

---

## Phase 10 — Empty and first-run states

147 routes, and a trial tenant sees almost all of them empty.

1. Build `components/ui/empty-state.tsx` with a `register` prop (`ledger` | `counter`) per DESIGN.md §8.
2. Build the sibling `filtered-state` and `failed-state` treatments. The current build mostly renders all three identically, so a filter that excludes everything looks the same as a module with no data and the same as a failed request.
3. Sweep the module list routes and replace ad-hoc empty markup. One PR per module group (Sell, Stock, Produce, Govern).
4. Restyle `getting-started-checklist.tsx` to the token layer. It stays; it is the only place allowed to nudge.

**Verify:** sign up a fresh tenant and walk every module route. That is the actual first-run experience and nobody has designed it yet.

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
        message: "foreground-disabled is ~3.1:1 and fails AA. Placeholders and disabled state only.",
      },
    ],
  },
}
```

All-errors on day one makes `pnpm lint` unusable. Each rule flips `warn` → `error` in the phase that clears it, and `--max-warnings 0` goes on last. **This table is the contract** — without it the rules stay decorative, which is exactly what happened after `ce01f74`.

> **Status, 2026-08-17: `no-raw-palette` and `no-heavy-weight` are now at `error`.**
>
> Raw palette utilities across `frontend/src` went **1949 → 0** and `font-black`
> went **78 → 0**, so both flipped in the commit that finished clearing them —
> which is what this table asks for. Verified in both directions: `pnpm lint` is
> clean on the tree, and a file containing `text-zinc-500` or `font-black` now exits
> ESLint with code 1, fails `lint-staged`, and is reverted before it can be
> committed.
>
> Three rules stay at `warn` because what remains is not drift a codemod can clear:
> `no-hex-in-class` (57 — Recharts and react-three-fiber literals, which cannot read
> CSS custom properties and need the `palette.ts` bridge in Phase 6),
> `no-uppercase` (40 — table headers without the wide tracking, so a copy pass), and
> `no-sub-12px` (39 — each one a layout decision).
>
> Live severities are in `frontend/eslint.design-plugin.mjs`; that file is the
> source of truth, this table is the schedule.

| Rule                                  | Flips to `error` after | Why then                                                                                                              |
| ------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| hex in `className`                    | Phase 6                | Charts and 3D are the last legitimate literal-colour holders; once they import from `palette.ts`, nothing needs a hex |
| raw Tailwind palette colours          | Phase 3                | The neutrals codemod is what clears the 1,949                                                                         |
| `font-black` / `font-extrabold`       | Phase 5                | Typography phase clears all 78                                                                                        |
| uppercase + wide tracking             | Phase 5                | Same phase; add an override comment for the one threshold eyebrow DESIGN.md §2 permits                                |
| sub-12px sizes                        | Phase 5                | Same phase                                                                                                            |
| semantic `-solid` as text             | Phase 2                | The semantic codemod introduces the `-text` pairs                                                                     |
| `text-foreground-disabled` as content | Phase 2                | Cheap, and it never had legitimate uses                                                                               |
| **`--max-warnings 0` on `pnpm lint`** | **Phase 10**           | Only once every rule above is an error and the ratchet reads zero                                                     |

Add one rule per phase to `frontend/.design-debt.json` as it flips, so the ratchet from Phase 0 keeps enforcing the ones still on `warn`.

---

## Sequencing

| Phase                          | Risk                              | Reviewable as                                     |
| ------------------------------ | --------------------------------- | ------------------------------------------------- |
| **0 Guardrail ratchet**        | **None. Blocking.**               | One PR. Do this first or the rest rots.           |
| 1 Token layer + fonts          | Low, but the font swap is visible | One PR, or split fonts out                        |
| 2 Semantic codemod             | Low                               | One PR, screenshot-diff error states              |
| 3 Neutrals codemod             | Low                               | **One PR per color family**                       |
| 4 Retire old names             | Low                               | One PR                                            |
| 5 Typography                   | Low                               | One PR                                            |
| 6 Charts and 3D palette bridge | Low                               | One PR                                            |
| 7 Components and density       | **Medium**                        | One PR per component, visual QA each              |
| 8 Dark mode                    | **Medium**                        | One PR, screenshot-diff every route in both modes |
| 9 Threshold surfaces           | Low                               | One PR. Blocked on one photograph.                |
| 10 Empty and first-run states  | Low                               | One PR per module group                           |

Phases 9 and 10 are independent of 2-8 and can run in parallel with them by a second person. Phase 8 must follow Phase 4.

The single highest-value item in the whole document is not a phase: it is the **28px Variants button** at `pos-product-card.tsx:114`, where a mis-tap charges a paying customer for the wrong item. Fix that on its own, today, ahead of everything else.

Run `/design-review` after phase 7 and again after phase 8.
