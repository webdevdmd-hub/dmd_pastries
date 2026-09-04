# Pastries POS — Design System

Status: **v3, proposed. Not yet applied to app code.**
Owner: webdevdmd
Last updated: 2026-08-17 (v3)

Companion files:

- [docs/design/preview-v3.html](docs/design/preview-v3.html) — open in a browser, includes a dark mode toggle. **This is the current preview.** `docs/design/preview.html` is the superseded v2 preview.
- [docs/design/tokens.css](docs/design/tokens.css) — the token layer (needs the v3 values below applied)
- [docs/design/tailwind.config.proposed.ts](docs/design/tailwind.config.proposed.ts) — Tailwind wiring
- [docs/design/MIGRATION.md](docs/design/MIGRATION.md) — how to adopt it

---

## 0. Where this actually stands

v2 of this document was written on 2026-08-14 and shipped in commit `ce01f74`. It landed the spec, the token file, the proposed Tailwind config, the ESLint guardrails, and a visual-regression harness. **It changed almost no component styling.** Measured on `frontend/src` on 2026-08-17:

| Metric | v2 measured (2026-08-14) | Now (2026-08-17) |
| --- | --- | --- |
| Hardcoded hex in `.tsx` | 298 / 32 files | 291 / 33 files |
| Raw Tailwind palette utilities | 1,911 | **1,949** |
| `font-black` | 78 | 78 |
| Files using `font-mono`, no mono font loaded | 31 | 31 |
| Files using `tabular-nums` | 9 | 9 |
| `text-red-700` | 172 | 172 |

Nothing moved, and drift grew by 38 palette utilities in three days. The cause is not discipline: **every ESLint design rule ships at `"warn"` and `pnpm lint` has no `--max-warnings 0`,** so the guardrails catch nothing. Fixing that is Phase 0 of the migration, not an afterthought.

### What changed from v2 to v3

v2's thesis, discipline, and structure are kept. Four things are new, and two v2 values were wrong.

**New:**

1. **Dark mode is a real deliverable** with its own measured token set (§3.5), not a footnote.
2. **Threshold surfaces get actual art direction** (§7) instead of three lines.
3. **Empty and first-run states are a designed system** (§8). 147 routes, and a trial tenant sees almost all of them empty.
4. **The guardrails get a sequencing plan** that flips each rule `warn` → `error` as its phase lands.

**Corrected:**

5. **v2's `--foreground-muted` fails AA on v2's own muted fills.** v2 quotes `#737373` at 4.62:1, which is measured against white. v2 also prescribes `--muted` fills for KPI cards and wells, where `#737373` on `#F5F5F5` is **4.35:1** — below the 4.5 floor v2 sets for itself. v3's `#6E6A64` on `#F2F0EC` is 4.72:1.
6. **v2's uppercase ban is too broad.** Scoped in §2.

**Decided in consultation (2026-08-17):**

7. **No third brand colour.** Primary stays near-black; green stays money-only. Identity comes from the Fraunces wordmark, not a hue. This is what Midday and Square both do, and it is the most minimal answer.
8. **Neutrals are barely warm,** not zero-chroma. Costs 0.48 of a contrast point and nothing else.
9. **Fraunces replaces Instrument Serif.** Geist and Geist Mono are kept.
10. **The 3D bakery-door scene and the login orbs are deleted.** Landing gets a photograph; login gets the ledger motif.

---

## 1. The thesis

**Colour carries the data. Saturation still carries the commitment.**

> Changed 2026-09-04 by the product owner, replacing "Monochrome by default. Color means money." The reference is the shadcnstore dashboard template. The rule below is what actually governs; v3's monochrome thesis is kept underneath for the reasoning, because the parts of it that were about *contrast* rather than *taste* still hold.

Analytical surfaces — dashboards, charts, KPI cards, trend deltas — use a full categorical palette. A revenue series is green, an orders series is blue, a cost series is amber, and a KPI that moved up says so in green. Colour is now a **default** on those surfaces, not an exception earned by meaning.

What did **not** change:

- **The commit action is still the most saturated thing in its own view.** Charge, Post, Confirm payment, Close period. A dashboard full of coloured chart series does not get a green button competing with them.
- **Every pair is still measured.** A palette is not a licence to ship 3:1 text. The contrast floors in §3.3 and §3.5 are engineering requirements and they are unchanged.
- **Colour is still never the only carrier of state.** §9 still holds: a series needs a dash pattern or a label as well as a hue, and `scripts/check-chart-palette.mjs` still has to pass.

The superseded rule, for the record: *neutrals carry almost no chroma; the only saturated thing on any screen is the thing that takes payment, the thing that warns you, or the thing that broke.* That is still the right rule for **transactional** screens — the register, forms, tables, the ledger. It is no longer the rule for **analytical** ones.

Two people use this product and they want opposite things. The **cashier** stands at a counter with someone waiting: they tap without looking, and they confirm a total from a meter away. The **owner or accountant** sits down with a trial balance across 20+ report screens: they read, they do not tap.

So: **two densities over one token set.**

| Register | Where | What changes |
| --- | --- | --- |
| **Counter** | `/pos`, cashier dashboard, checkout | 48px targets, mono readout, larger type |
| **Ledger** | Accounting, inventory, manufacturing, products, reports, settings | 36px controls, 44px rows, tabular figures |
| **Threshold** | Login, landing, receipt header | Serif wordmark, generous space, photograph |

Same tokens, same fonts. Only density, type size, and accent budget move.

**The memorable thing:** the total. Readable across a counter, and it ties to the ledger.

### What this replaces in the current build

- Token names are a bakery brand (`latte`, `cappuccino`, `caramel`, `mocha`, `espresso`) but `--brand-caramel` and `--brand-espresso` are both `9 9 11`, pure black. **There is no caramel and no espresso.** Developers reached for a brown the token layer never had, so `#7A553A` (38×) and `#B08968` (25×) got typed as raw hex. That is the mechanical cause of the 291 hardcoded hexes.
- A `pistachio` theme is bolted on with ~50 lines of `:root[data-theme="pistachio"] aside.bg-brand-espresso button:not(...)` override selectors. It is a patch over a theme that does not exist.
- `font-mono` is used in **31 files** for money and **no mono font is loaded anywhere.** Prices render in the OS default monospace, so a Windows counter terminal and a Mac show different digits. This is a live bug, not a style preference.
- `tabular-nums` appears in only **9 files.** Decimal points do not line up in any report.
- `font-black` (900) appears **78 times** across 34 files.
- There is **no dark mode.** `tailwind.config.ts:5` declares `darkMode: ["class"]`; `globals.css` has no `.dark` block. Both shipped themes are light.

---

## 2. Typography

### Families

| Role | Family | Weights | Where |
| --- | --- | --- | --- |
| UI | **Geist** | 400, 500, 600 | Everything |
| Numeric | **Geist Mono** | 400, 500 | Money at the counter, all identifiers |
| Display | **Fraunces** | 400, 500 | Threshold register only |

All three load through `next/font/google`.

```ts
// frontend/src/app/layout.tsx
import { Geist, Geist_Mono, Fraunces } from "next/font/google";

const fontSans = Geist({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const fontMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });
const fontSerif = Fraunces({ variable: "--font-serif", subsets: ["latin"], weight: ["400", "500"], axes: ["SOFT"] });
// <html className={`${fontSans.variable} ${fontMono.variable} ${fontSerif.variable}`}>
```

Remove the `Manrope` and `Cormorant_Garamond` imports. `--font-display` is replaced by `--font-serif`; grep for `font-display` before deleting.

**Geist replaces Manrope.** Manrope's roundness and lack of a matched mono are what date it. Geist is a modern grotesk with **Geist Mono as a width-matched companion**, which solves the money problem inside one family.

**Geist Mono fixes a live bug.** The 31 files calling `font-mono` finally resolve to something deterministic, with a slashed zero and unambiguous `1`/`l`/`I`.

**Fraunces replaces Instrument Serif.** Same job, more control. Instrument Serif has become the default editorial serif on template sites, which is the same staleness problem one swap later. Fraunces is variable with a genuine `SOFT` axis, so the wordmark's personality is a dial you own rather than a decision the type designer made for you. Set `SOFT` low (~30) and `opsz` high for a crisp, high-contrast display cut.

*Considered and rejected: PP Neue Montreal + Commit Mono. Commit Mono's narrower width genuinely costs fewer table columns than Geist Mono, and Neue Montreal is more distinctive than Geist. Both need commercial licensing and self-hosting. Revisit if the Ledger tables prove too wide in practice.*

### Negative tracking is most of the modern feel

Tighten as size grows, and never go positive.

| Size | Tracking |
| --- | --- |
| ≤ 12.5px | 0 |
| 13.5px | −0.008em |
| 14.5px | −0.011em |
| 18px | −0.02em |
| 28px+ | −0.03em to −0.04em |
| Numeric columns and totals | −0.02em to −0.045em |

### The uppercase rule, scoped

**In-app: no uppercase, no positive letterspacing, ever.** The `text-[0.62rem] uppercase tracking-[0.12em]` pattern is the single most dating detail in the build, and at ~10px it is unreadable at counter distance anyway. `desktop-sidebar.tsx:35` is the worst instance: `text-[0.68rem] uppercase tracking-[0.28em]`, top-left of every authenticated screen.

**On threshold surfaces, one exception:** a single eyebrow label above the hero headline, in **Geist Mono, ≥12px, uppercase, `tracking-[0.1em]`, `--foreground-muted`**. Square's POS landing page uses exactly this pattern above its headline, and it works because it is mono, it is big enough to read, and there is exactly one per page. One per threshold screen. Never in the app.

### The mono rule

Mono is wide. A wide font in a dense table costs you columns.

| Content | Font | Alignment |
| --- | --- | --- |
| Money in a **table** | Geist + `tabular-nums` | right |
| Money at the **counter** (cart lines, total) | Geist Mono | right |
| **Identifiers** — SKU, barcode, invoice no, batch no, journal ref, account code | Geist Mono | left |
| Dates, counts, percentages | Geist + `tabular-nums` | right |
| Everything else | Geist | left |

Any number that can change without its row changing **must** carry `tabular-nums`.

### Weight

| Weight | Use |
| --- | --- |
| 400 | Body, table cells |
| 500 | The workhorse. Labels, buttons, product names, KPI values, totals, table headers |
| 600 | Page titles only |
| 700+ | **Not in the system.** |

The current build's 78 uses of `font-black` are why everything shouts and the total does not stand out.

### Scale

80+ routes are built on Tailwind's numeric scale, so redefining `text-sm` would silently shift every screen. The scale is **additive and semantic**.

| Token | Size / line-height | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| `text-meta` | 12.5 / 16 | 400 | 0 | Metadata, captions, badges |
| `text-cell` | 13.5 / 18 | 400 | −0.008em | Table body |
| `text-body` | 14.5 / 22 | 400 | −0.011em | Prose, inputs, labels |
| `text-title` | 18 / 24 | 500 | −0.02em | Card and panel titles |
| `text-page` | 28 / 32 | 600 | −0.03em | Page headings |
| `text-kpi` | 28 / 30 | 500 | −0.04em | Dashboard stat values, tabular |
| `text-total` | 32 / 32 | 500 | −0.045em | POS grand total, mono, tabular |
| `text-display` | 56–72 | 400 | −0.03em | Threshold wordmark and hero, serif |

**12px is the hard floor** for anything a human reads.

---

## 3. Color

Every ratio below was computed against the actual rendered hex, in both modes. Where a value is used on more than one surface, the worst case is quoted.

### 3.1 Neutrals — barely warm

| Token | Hex | Contrast | Use |
| --- | --- | --- | --- |
| `--canvas` | `#FAF9F7` | — | Page |
| `--card` | `#FFFFFF` | — | Cards, panels, table |
| `--muted` | `#F2F0EC` | — | Fills, KPI cards, inputs, zebra, wells |
| `--border` | `#E5E2DC` | — | Hairlines |
| `--foreground` | `#0A0A0A` | **18.82 : 1** on canvas | Primary text |
| `--foreground-muted` | `#6E6A64` | **5.11** canvas / **5.37** card / **4.72** on muted | Secondary text, labels |
| `--foreground-disabled` | `#918D87` | 3.14 canvas / 3.30 card / 2.90 muted | **Disabled and placeholder only, never content** |
| `--primary` | `#171717` | white on it **17.93 : 1** | Primary buttons |

The warm cast is deliberate and it is much subtler than v1's `#FBFAF8` cream. v1 read dated because of everything around it — uppercase tracking, a tan accent, Cormorant, a visible border on every card — not because of the warmth. Midday ships a warm off-white canvas and does not look dated. The cost is measurable and negligible: `#0A0A0A` scores 18.82:1 on warm versus 19.30:1 on v2's cold `#FCFCFC`.

**`--foreground-muted` changed from v2's `#737373`.** v2's value fails AA at 4.35:1 on the muted fills v2 itself prescribes for KPI cards. `#6E6A64` clears 4.5 on canvas, card, and muted fill.

### 3.2 The one accent

| Token | Hex | Contrast |
| --- | --- | --- |
| `--money-solid` | `#00723B` | white on it **6.05 : 1** |
| `--money-text` | `#005E31` | **7.94** on card / **7.20** on tint |
| `--money-tint` | `#EAF7EE` | — |

Reserved for money-committing actions — Charge, Post, Confirm payment, Close period — and for reconciled/paid/posted states.

**The "if two things on a screen are green, one of them is wrong" rule is now scoped to transactional screens.** On a dashboard, green is also the revenue series and an upward delta, and that is intended. The rule that survives is narrower and still absolute: *within one view, only one control commits money, and it is the only saturated **button**.* A green chart line does not compete with a Charge button, because one is a reading and the other is a decision.

**There is no separate brand colour.** The primary CTA is near-black, and identity comes from the Fraunces wordmark. This was a deliberate call: giving the product its own hue would make green rarer and more meaningful, but it adds a third colour against a minimalism brief, and both Midday and Square ship a black CTA with no brand hue at all. If the product later needs an ownable colour, `#B4451D` burnt sugar was the candidate — add it as `--brand-*`, never as `--money-*`.

### 3.3 Semantic

Each role has a `-solid` for fills, icons, and borders, and a `-text` that clears 6.5:1 on its own tint. **Never use `-solid` as a text color.**

| Role | Solid | Text | Tint | Pair ratio |
| --- | --- | --- | --- | --- |
| Success / paid / reconciled / posted | `#00723B` | `#005E31` | `#EAF7EE` | 7.20 : 1 |
| Warning / held / low stock / expiring | `#A66D00` | `#7B4800` | `#FCF3E1` | 6.88 : 1 |
| Danger / void / out of stock / unbalanced | `#CC2827` | `#9E1618` | `#FDEEEC` | 7.21 : 1 |
| Info / pending | `#3072C1` | `#17559B` | `#EBF3FD` | 6.68 : 1 |
| Draft | — | `--foreground-muted` | `--muted` | 4.72 : 1 |

Draft is deliberately neutral. It is the absence of a state, not a state.

### 3.4 Focus

`--ring: #3072C1` light, `#7DB3F7` dark (9.06:1 on dark canvas). 2px, 2px offset. Blue and only blue. The current `focus-visible:ring-brand-caramel` on a `bg-brand-caramel` button is invisible.

### 3.5 Dark mode

**Dark mode is not an inversion, and it is not a neutrals-only redefinition.** Measured on a `#141414` card, all four of v2's semantic `-text` values fail the 4.5 floor:

| v2 value | On dark card | Verdict |
| --- | --- | --- |
| `--accent-text` `#005E31` | **2.32 : 1** | fails |
| `--danger-text` `#9E1618` | **2.26 : 1** | fails |
| `--warning-text` `#7B4800` | **2.43 : 1** | fails |
| `--info-text` `#17559B` | **2.46 : 1** | fails |

So every pair gets a dark value, measured against its dark surface.

| Token | Hex | Contrast |
| --- | --- | --- |
| `--canvas` | `#0B0B0B` | — |
| `--card` | `#141414` | — |
| `--muted` | `#1C1C1C` | — |
| `--border` | `#2A2A2A` | — |
| `--foreground` | `#F4F1EC` | **17.47** canvas / **16.35** card |
| `--foreground-muted` | `#A39E96` | **7.39** canvas / **6.92** card |
| `--foreground-disabled` | `#6B665F` | 3.24 on card — below content threshold, by design |
| `--primary` | `#F4F1EC` | `#0B0B0B` on it **17.47 : 1** |
| `--money-solid` | `#00723B` | **unchanged** — white on it is 6.05 on any surface |
| `--money-text` | `#2FAE71` | **6.50** on card / **5.43** on tint |
| `--money-tint` | `#0E2A1B` | — |
| `--danger-text` | `#F87171` | **6.66** on card / **6.19** on tint |
| `--danger-tint` | `#2E1414` | — |
| `--warning-text` | `#E0A030` | **8.11** on card / **7.11** on tint |
| `--warning-tint` | `#2A1F0B` | — |
| `--info-text` | `#7DB3F7` | **8.48** on card / **7.74** on tint |
| `--info-tint` | `#0F1E30` | — |
| `--ring` | `#7DB3F7` | **9.06** on canvas |

Three rules:

1. **The money fill does not change.** White on `#00723B` is 6.05:1 regardless of surface, so the Charge button is identical in both modes. That is a feature: the one thing a cashier must recognise instantly stays constant.
2. **No token may be a lightness-inversion of its light value.** Every accent is re-measured against its actual dark surface.
3. **`--foreground` is a warm off-white, never pure `#FFFFFF`.** Pure white on near-black halates.

Foreground is warm to match the light mode's warmth, so the product has one temperature in both modes rather than two personalities.

**This also kills the pistachio patch.** With themes restricted to redefining tokens, the ~50 lines of `:root[data-theme="pistachio"] aside.bg-brand-espresso a:not(.bg-brand-caramel)` override selectors have nothing left to override. Replace the two-light-theme selector with a standard light / dark / system control.

---

## 4. Spacing, radius, elevation

### Base

4px, Tailwind's default scale, unchanged.

### Density

| | Ledger | Counter |
| --- | --- | --- |
| Page gutter | 24px | 16px |
| Card padding | 18px | 12px |
| Grid gap | 12px | 10px |
| Field height | 36px | 48px |
| Button height | 36px | 48px |
| Minimum tap target | 32 × 32 | **48 × 48** |

The Counter 48px floor comes from Material's 48dp guidance and Hoober's rage-tap research, which finds error rates level off around 40px.

### Table density

| Mode | Row height | Cell padding x | Font |
| --- | --- | --- | --- |
| Compact | 36px | 14px | `text-cell` |
| Default | 44px | 16px | `text-cell` |
| Comfortable | 56px | 16px | `text-body` |

Numeric columns right-aligned with `tabular-nums` and −0.02em tracking. **No vertical rules.** Header is `text-meta` in `--foreground-muted`, sticky on scroll. Row hover fills `--muted`. Totals row fills `--muted` with a top border. Identifiers in Geist Mono.

### Radius

`--radius: 0.625rem` (10px), down from the current `0.875rem`.

| Token | Value | Use |
| --- | --- | --- |
| `--radius-sm` | 6px | Chips, badges, inline controls |
| `--radius` | 10px | Buttons, cards, inputs, tiles |
| `--radius-lg` | 14px | Dialogs, frames, panels |

### Elevation

Modern depth is a 1px hairline plus a whisper. Three levels, and dark mode needs deeper alphas because a shadow on near-black is nearly invisible at light-mode opacity.

| Token | Light | Dark |
| --- | --- | --- |
| `--shadow-xs` | `0 1px 2px oklch(0 0 0 / .05)` | `0 1px 2px oklch(0 0 0 / .4)` |
| `--shadow-sm` | `0 1px 3px / .07`, `0 1px 2px / .04` | `0 1px 3px / .5` |
| `--shadow-md` | `0 8px 24px / .08` | `0 8px 24px / .6` |

**Fills over borders.** A `--muted` fill with no border is how KPI cards, toolbars, and wells should read. Reserve borders for structural boundaries: frame edges, table rules, input outlines.

Retire `shadow-workspace` (`inset 0 1px 0 rgba(255,255,255,0.64)`). That inner white bevel is skeuomorphic and invisible on any non-white surface.

---

## 5. Motion

| Interaction | Duration | Easing |
| --- | --- | --- |
| Tap feedback | 0ms | — |
| Hover, focus, color | 150ms | `cubic-bezier(0.2, 0, 0, 1)` |
| Panel, dropdown, dialog | 200ms | same |
| Anything blocking a tap | **0ms** | — |

- **Remove the global `html { scroll-behavior: smooth }`** (`globals.css:80`). It applies to the POS product grid; a cashier flicking through 200 items fights an animation on every scroll. Scope it to marketing routes.
- Never animate a number changing. The login motif in §7 is the one exception, and it resolves once rather than looping.
- Card hover is a 1px lift plus `--shadow-sm`, not a border color change.
- Respect `prefers-reduced-motion` everywhere, including the login motif, which renders its final frame directly.

---

## 6. Component rules

### Buttons

| Variant | Fill | Text | Use |
| --- | --- | --- | --- |
| `primary` | `--primary` | `--primary-foreground` | Main action |
| `commit` | `--money-solid` | white | Money-moving actions. One per screen. |
| `outline` | `--card` + `--border` | `--foreground` | Secondary |
| `ghost` | transparent, `--muted` on hover | `--foreground-muted` | Icon buttons, row actions |
| `danger` | `--card` + `--border`, `--danger-tint` on hover | `--danger-text` | Void, delete, refund |

Sizes: `sm` 32px, `default` 36px (Ledger), `lg` 44px, `counter` 48px. Focus ring is `--ring` on every variant.

There is no filled `secondary`. A `--muted` fill and an outline do the same job; two of them competing is the redundancy that makes a system feel bloated.

### Segmented control

Payment method, table density, date range. A `--muted` track with a `--card` thumb carrying `--shadow-xs`. Replaces the current pattern of two adjacent buttons where the selected one is fully black, which reads as two competing primary actions.

### POS product tile

Concrete fixes to [`pos-product-card.tsx`](frontend/src/components/pos/pos-product-card.tsx):

- **The `h-7` (28px) Variants button at line 114 becomes 48px.** It sits in the card corner; a mis-tap adds the wrong item to a paying customer's order. **This is the highest-priority fix in the app.**
- Line 93, category label: `text-[0.65rem] uppercase tracking-[0.12em]` → `text-meta`, sentence case, `--foreground-muted`.
- Lines 89, 96, 108, 114: `font-black` four times in one card → weight 500.
- Line 49: hover is a 1px lift plus `--shadow-sm`, not `hover:border-zinc-500`.
- Line 49: raw `border-zinc-300 bg-white text-zinc-950` → `--border`, `--card`, `--foreground`.
- Line 108: out-of-stock becomes a `--danger-tint` badge with a dot, plus 55% opacity on the tile.

### Status badges

22px tall, `--radius-full`, 12px weight 500, semantic tint with matching `-text`, plus a 5px dot. **The dot is not decoration** — it carries the state for colour-blind users, and it is the reason colour is never the only signal.

---

## 7. Threshold surfaces

The buy-decision screens. v2 gave these three lines; they are the reason a prospect does or does not take the product seriously.

### What is being deleted

- `globals.css:95-160` — `.auth-orb-one` and `.auth-orb-two`, 18rem and 22rem blurred gradient circles drifting on an 11-second loop behind login, plus the `.auth-scanline` sweep. Blurred drifting gradient blobs are the most recognizable "AI generated this page" tell there is, and this is the first screen a prospect sees.
- `frontend/src/components/home/` — 901 lines of react-three-fiber across four scene components. `bakery-door-scene.tsx` alone is 552 lines and 51 hardcoded hexes. This also drops `three`, `@react-three/fiber`, and `@react-three/drei` from the landing bundle.

### Landing

One real photograph of a real counter — product, hands, a person — full-bleed below the fold or as a large framed block, over a Fraunces headline on `--canvas`. Structure, top to bottom:

1. Geist Mono eyebrow, ≥12px, uppercase, `tracking-[0.1em]`, `--foreground-muted`. One per page (§2).
2. Fraunces headline, `text-display`, sentence case, max ~16ch.
3. Geist sub-paragraph, `--foreground-muted`, max ~54ch.
4. One `--primary` CTA. Not two competing ones.
5. The photograph.

This is Square's structure and Midday's structure, arrived at independently by the POS category leader and the accounting-SaaS reference. A photograph is also more credible than any abstraction: a bakery owner evaluating a bakery POS wants to see a bakery. It costs one shoot, and it beats 901 lines of WebGL on both bundle size and conviction.

### Login

The form on `--card`, paired with the **ledger motif** on a `--muted` field: a running total that resolves once to a balanced figure and holds. No loop, no blur, no drift, over in about a second. Under `prefers-reduced-motion` it renders the resolved frame directly with no animation.

It is ownable in a way gradient orbs never are, because it is built from the product's own subject matter: the numbers balance. See the Threshold section of [preview-v3.html](docs/design/preview-v3.html) for the working version.

---

## 8. Empty and first-run states

147 routes, and a trial tenant sees almost all of them empty. **An empty screen is the first impression of every module,** which makes it a designed surface, not a fallback. Nothing in v2 covered this.

### The rule

| | Ledger | Counter |
| --- | --- | --- |
| Posture | Instructive | Terse |
| Title | `text-title`, names what is missing | `text-title`, names what is missing |
| Body | One or two lines: what will fill this, and why it is empty | None, or one line |
| Actions | The one action that changes it, plus at most one alternate | None |
| Illustration | **Never** | **Never** |
| Container | `--card` with a dashed `--border` | Same |

A Ledger empty state tells the owner *why* the screen is empty and what fills it, because they are reading and they are new. A Counter empty state is one line, because the cashier is not reading and already knows.

**No illustrations.** A spot illustration in every one of 147 empty states is 147 assets to draw, maintain, and theme for dark mode, and it makes a financial product read as a toy.

Worked example, Ledger:

> **No journal entries yet**
> Entries post here automatically when you record a sale, receive a purchase, or run production. You can also post one by hand.
> `[New journal entry]` `[Import opening balances]`

Worked example, Counter:

> **Cart is empty**
> Tap a product to start an order.

### Distinguish empty from broken from filtered

Three different states that the current build mostly renders identically:

| State | Treatment |
| --- | --- |
| **Empty** — nothing exists yet | The system above. Neutral, instructive. |
| **Filtered** — things exist, the filter excludes them | `--muted` inline row, not the dashed card. Always offers "Clear filters". Never says "No data". |
| **Failed** — the request errored | `--danger-tint` panel, `--danger-text`, states what failed and offers Retry. Never a blank screen. |

### First run

The `getting-started-checklist` component already exists and is mounted. It stays, restyled to the token layer: a `--muted` well, `text-title` heading, checklist rows at 44px, dismissible, one `--primary` action. It is the only place in the app allowed to nudge.

---

## 9. Accessibility floor

Enforced in review and, where possible, in lint:

- Body text ≥ 4.5:1, large text ≥ 3:1, **in both modes**. Every value in §3 is measured.
- No text below 12px, in either register.
- Counter tap targets ≥ 48 × 48, or ≥ 24px clear space.
- Visible `--ring` on every focusable element.
- Color is never the only carrier of state; every badge carries a dot.
- `--foreground-disabled` is forbidden for content. Lint-enforced.
- Semantic `-solid` values are forbidden as text colors; use the `-text` pair.
- Respect `prefers-reduced-motion`.

---

## 10. Out of scope

- **Print stylesheet for receipts.** Thermal output (58/80mm, no color, no grey) has its own constraints.
- **RTL / Arabic.** Currency formats as `en-AE` / AED, which suggests a UAE deployment where this may eventually matter. No RTL support exists today.
- **Iconography.** Lucide is in use and is fine.
- **Command-palette navigation.** Proposed during consultation as a replacement for the 8-group sidebar accordion in the Ledger register, and it is probably right — an owner who knows they want Trial Balance should not click through three accordion levels. It is a navigation-architecture change, not a design-system change, so it belongs in its own spec.
- **Chart palette.** Recharts needs a categorical set derived from these tokens; see MIGRATION.md phase 6.

---

## Research

Captured with a headless browser on 2026-08-17, not from memory.

- **[Square Point of Sale](https://squareup.com/us/en/point-of-sale)** — the POS category leader. Giant editorial serif headline on pure white, a ~12px mono uppercase letterspaced eyebrow, one pill CTA, then a real photograph of a real counter with real people. Source of the scoped-uppercase exception in §2 and the landing structure in §7.
- **[Midday](https://midday.ai)** — accounting SaaS built on shadcn. Same structure: huge editorial serif, **warm** off-white canvas, solid black CTA, sentence-case body, heavy whitespace, no brand hue. Source of the warm-neutrals call in §3.1 and the no-third-colour call in §3.2.
- **[Mercury](https://mercury.com)** — full-bleed photographic hero. Corroborates the photograph over abstraction.
- **[Linear](https://linear.app)** — ships pure dark as its marketing surface, consistent with dark-mode-first being a 2026 baseline rather than a nice-to-have.
- Also swept for v2: shadcn blocks and its published theming defaults, Attio. The achromatic ramp, `--radius: 0.625rem`, fills instead of borders on KPI cards, and negative tracking that scales with size come from there.

An independent design direction ("Ledger & Crust") was commissioned during the v3 consultation. Its brand/money colour split, its warm-neutrals argument, its no-lightness-inversion dark-mode rule, and its command-palette proposal are all reflected above — three adopted, one deferred to §10.

---

## Decisions log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-08-14 | v2: monochrome thesis, two density registers, one green accent | Replaced v1's warm-grey/cream/tan/Cormorant direction wholesale |
| 2026-08-17 | v3: no third brand colour; primary stays near-black | Midday and Square both ship a black CTA and no brand hue; adding one fights the minimalism brief |
| 2026-08-17 | v3: neutrals go barely warm (`#FAF9F7`) | Costs 0.48 of a contrast point; v1 read dated because of its type and borders, not its warmth |
| 2026-08-17 | v3: Fraunces replaces Instrument Serif | Variable `SOFT` axis; Instrument Serif has become the default template serif |
| 2026-08-17 | v3: `--foreground-muted` `#737373` → `#6E6A64` | v2's value is 4.35:1 on v2's own muted fills, below its own AA floor |
| 2026-08-17 | v3: `--foreground-disabled` corrected to `#918D87` (3.14) after review | The first v3 draft used `#A8A29A` at 2.40:1 — a real regression against v2's 3.15:1, introduced by warming the neutrals without re-measuring. Disabled state is WCAG-exempt, but placeholders carry information, so parity with v2 is the floor. |
| 2026-08-17 | v3 token names (`--canvas`, `--money-*`) are canonical; `background` and `accent.*` survive as Tailwind aliases | Renaming in DESIGN.md without updating `tokens.css` (still v2-headed) and `tailwind.config.proposed.ts` would produce `oklch(var(--canvas))` against an undefined variable: invalid CSS, no build error, no lint error. shadcn primitives reference `accent-foreground`, so the alias must stay. Tracked as plan item A2.1. |
| 2026-08-17 | v3: every semantic `-text` gets a measured dark value | All four v2 values score 2.26–2.46 on a dark card |
| 2026-08-17 | v3: money fill unchanged in dark mode | White on `#00723B` is 6.05:1 on any surface; constancy helps the cashier |
| 2026-08-17 | v3: uppercase ban scoped to in-app | Square uses a mono uppercase eyebrow at ≥12px; the pattern fails at 10px in sans, not universally |
| 2026-08-17 | v3: 3D scenes and auth orbs deleted; photograph + ledger motif | Drops three WebGL dependencies from the landing bundle and reads more credible |
| 2026-08-17 | v3: command-palette nav deferred to its own spec | Navigation architecture, not design system |
