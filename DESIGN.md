# Pastries POS — Design System

Status: proposed, not yet applied to app code.
Owner: webdevdmd
Last updated: 2026-08-14 (v2)

Companion files:

- [docs/design/preview.html](docs/design/preview.html) — open in a browser, includes a dark mode toggle
- [docs/design/tokens.css](docs/design/tokens.css) — the token layer
- [docs/design/tailwind.config.proposed.ts](docs/design/tailwind.config.proposed.ts) — Tailwind wiring
- [docs/design/MIGRATION.md](docs/design/MIGRATION.md) — how to adopt it

---

## 1. The thesis

**Monochrome by default. Color means money.**

Neutrals carry zero chroma. The only saturated thing on any screen is the thing that takes payment, the thing that warns you, or the thing that broke. That constraint is what makes shadcn read clean, and it is the reason this system is built on shadcn's actual current foundation rather than next to it.

Two people use this product and they want opposite things. The **cashier** stands at a counter with someone waiting: they tap without looking, and they confirm a total from a meter away. The **owner or accountant** sits down with a trial balance across 20+ report screens: they read, they do not tap.

So: **two densities over one token set.**

| Register | Where | What changes |
| --- | --- | --- |
| **Counter** | `/pos`, cashier dashboard, checkout | 48px targets, mono readout, larger type |
| **Ledger** | Accounting, inventory, manufacturing, products, reports, settings | 36px controls, 44px rows, tabular figures |
| **Threshold** | Login, receipt header, marketing | Serif wordmark, generous space |

Same tokens, same fonts. Only density, type size, and accent budget move.

**The memorable thing:** the total. Readable across a counter, and it ties to the ledger.

### What this replaces

The codebase currently says two things at once:

- Token names are a bakery brand (`latte`, `cappuccino`, `caramel`, `mocha`, `espresso`) but `--brand-caramel` and `--brand-espresso` are both `9 9 11`, pure black. There is no caramel and no espresso.
- The browns are alive but untokenized: `#7A553A` appears 38 times and `#B08968` 25 times as raw hex. **That is the root cause of the 298 hardcoded hexes.** Developers reached for a color the token layer did not have.
- A `pistachio` theme was bolted on with ~50 lines of `:root[data-theme="pistachio"] aside.bg-brand-espresso button:not(...)` override selectors. That is a patch over a theme that does not exist.
- `font-mono` is used in **31 files** for money and **no mono font is loaded anywhere**. Prices render in the OS default monospace, so a Windows counter terminal and a Mac show different digits.
- `tabular-nums` appears in only 9 files. Decimal points do not line up.
- `font-black` (900) appears **78 times** across 34 files.

### A note on v1 of this document

The first version of this system used warm grey neutrals, a `#FBFAF8` cream canvas, a `#B08968` tan accent, uppercase labels at `0.12em` tracking, Cormorant Garamond, and a visible border on every card. That is 2018 SaaS vocabulary. It has been replaced wholesale. The bakery identity now lives in one serif wordmark on threshold surfaces and in nothing else, which is both more modern and more honest: a POS running a trial balance does not need a cream background to remember it belongs to a bakery.

---

## 2. Typography

### Families

| Role | Family | Weights | Where |
| --- | --- | --- | --- |
| UI | **Geist** | 400, 500, 600 | Everything |
| Numeric | **Geist Mono** | 400, 500 | Money at the counter, all identifiers |
| Display | **Instrument Serif** | 400 | Threshold register only |

All three are on Google Fonts and load through `next/font/google` (verified live).

**Geist replaces Manrope.** Manrope is a competent geometric sans, but its roundness and lack of a matched mono are what date it. Geist is a modern grotesk with **Geist Mono as a width-matched companion**, which solves the money problem inside one family instead of pairing two unrelated ones. It also has the tight default spacing that current interfaces rely on.

**Geist Mono fixes a live bug.** The 31 files calling `font-mono` finally resolve to something deterministic, with a slashed zero and unambiguous `1`/`l`/`I`.

**Instrument Serif replaces Cormorant Garamond.** Same job, current execution. Cormorant is a 2016 high-contrast Garamond revival; Instrument Serif is the contemporary equivalent and pairs with a grotesk without looking like a wedding invitation.

```ts
// frontend/src/app/layout.tsx
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

const fontSans = Geist({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const fontMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });
const fontSerif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: ["400"] });
```

### Negative tracking is most of the modern feel

Default letter-spacing on a grotesk reads loose and dated at display sizes. Tighten as size grows, and never go positive.

| Size | Tracking |
| --- | --- |
| ≤ 12.5px | 0 |
| 13.5px | −0.008em |
| 14.5px | −0.011em |
| 18px | −0.02em |
| 28px+ | −0.03em to −0.04em |
| Numeric columns and totals | −0.02em to −0.045em |

**No uppercase. No positive letterspacing. Ever.** The `text-[0.62rem] uppercase tracking-[0.12em]` pattern in the current build is the single most dating detail in the app, and at ~10px it is unreadable at counter distance anyway.

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

Modern interfaces carry emphasis at 500, not 700. The current build's 78 uses of `font-black` are why everything shouts and the total does not stand out.

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
| `text-display` | 68 / 68 | 400 | −0.03em | Threshold wordmark, serif |

**12px is the hard floor** for anything a human reads.

---

## 3. Color

### Neutrals — `oklch(L 0 0)`, zero chroma

Exactly shadcn's ramp. Every ratio below was measured in a browser against the rendered oklch value.

| Token | oklch | Hex | Contrast | Use |
| --- | --- | --- | --- | --- |
| `--background` | `0.99 0 0` | `#FCFCFC` | — | Page |
| `--card` | `1 0 0` | `#FFFFFF` | — | Cards, panels, table |
| `--muted` | `0.97 0 0` | `#F5F5F5` | — | Fills, KPI cards, inputs, zebra |
| `--border` | `0.922 0 0` | `#E5E5E5` | — | Hairlines |
| `--foreground` | `0.145 0 0` | `#0A0A0A` | **19.30 : 1** | Primary text |
| `--foreground-muted` | `0.556 0 0` | `#737373` | **4.62 : 1** | Secondary text, labels |
| `--foreground-disabled` | `0.65 0 0` | `#8F8F8F` | 3.15 : 1 | **Disabled and placeholder only, never content** |
| `--primary` | `0.205 0 0` | `#171717` | **17.47 : 1** | Primary buttons |

Zero chroma is the point. A warm cast behind a financial table fights the numbers, and it is the thing that made v1 of this system feel dated.

### The one accent

| Token | oklch | Hex | Contrast |
| --- | --- | --- | --- |
| `--accent-solid` | `0.48 0.13 155` | `#00723B` | white on it **6.05 : 1** |
| `--accent-text` | `0.42 0.11 155` | `#005E31` | **7.94 : 1** on white |
| `--accent-tint` | `0.965 0.02 155` | `#EAF8EE` | pair **7.24 : 1** |

Reserved for money-committing actions (Charge, Post, Confirm payment, Close period) and success states. **If two things on a screen are green, one of them is wrong.**

The green is not arbitrary. The abandoned `pistachio` theme says the owner already reaches for green; `#43B66B` was too bright to carry text, and this is the same instinct at a weight that works.

### Semantic

Each role has a `-solid` for fills, icons, and borders, and a `-text` that clears 6.7:1 on its own tint. **Never use `-solid` as a text color.**

| Role | Solid | Text | Tint | Pair ratio |
| --- | --- | --- | --- | --- |
| Success / paid / reconciled / closed | `#00723B` | `#005E31` | `#EAF8EE` | 7.24 : 1 |
| Warning / held / low stock / expiring | `#A66D00` | `#7B4800` | `#FEF4DF` | 6.94 : 1 |
| Danger / void / out of stock / unbalanced | `#CC2827` | `#9E1618` | `#FFEFEE` | 7.29 : 1 |
| Info / pending | `#3072C1` | `#17559B` | `#EBF4FF` | 6.73 : 1 |
| Draft | — | `--foreground-muted` | `--muted` | 4.62 : 1 |

Draft is deliberately neutral. It is the absence of a state, not a state.

### Focus

`--ring: oklch(0.55 0.14 255)` (`#3072C1`), 2px, 2px offset. Blue and only blue. The current `focus-visible:ring-brand-caramel` on a `bg-brand-caramel` button is invisible.

### Dark mode

First-class, shipped with the token layer, not deferred. Dark redefines the same tokens and nothing else. Open the preview and toggle it.

That contract is also what kills the ~50 lines of `:root[data-theme="pistachio"] aside.bg-brand-espresso a:not(.bg-brand-caramel)` override selectors: with themes restricted to redefining tokens, there is nothing left to override.

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

Rules: numeric columns right-aligned with `tabular-nums` and −0.02em tracking. **No vertical rules.** Header is `text-meta` in `--foreground-muted`, sticky on scroll. Row hover fills `--muted`. Totals row fills `--muted` with a top border. Identifiers in Geist Mono.

### Radius

`--radius: 0.625rem` (10px), shadcn's default, down from the current `0.875rem`.

| Token | Value | Use |
| --- | --- | --- |
| `--radius-sm` | 6px | Chips, badges, inline controls |
| `--radius` | 10px | Buttons, cards, inputs, tiles |
| `--radius-lg` | 14px | Dialogs, frames, panels |

### Elevation

Modern depth is a 1px hairline plus a whisper. Three levels.

| Token | Value | Use |
| --- | --- | --- |
| `--shadow-xs` | `0 1px 2px oklch(0 0 0 / 0.05)` | Segmented control thumb, floating chips |
| `--shadow-sm` | `0 1px 3px / 0 1px 2px` | Card hover lift |
| `--shadow-md` | `0 8px 24px oklch(0 0 0 / 0.08)` | Dialogs, popovers |

**Fills over borders.** A `--muted` fill with no border is the shadcn signature and is how KPI cards, toolbars, and wells should read. Reserve borders for structural boundaries: frame edges, table rules, input outlines.

Retire `shadow-workspace` (`inset 0 1px 0 rgba(255,255,255,0.64)`). That inner white bevel is skeuomorphic and invisible on any non-white surface.

---

## 5. Motion

| Interaction | Duration | Easing |
| --- | --- | --- |
| Tap feedback | 0ms | — |
| Hover, focus, color | 150ms | `cubic-bezier(0.2, 0, 0, 1)` |
| Panel, dropdown, dialog | 200ms | same |
| Anything blocking a tap | **0ms** | — |

- **Remove the global `html { scroll-behavior: smooth }`.** It applies to the POS product grid; a cashier flicking through 200 items fights an animation on every scroll.
- Never animate a number changing.
- Card hover is a 1px lift plus `--shadow-sm`, not a border color change.
- Respect `prefers-reduced-motion`.

### The blobs

`globals.css` has `.auth-orb-one` / `.auth-orb-two`: 18rem and 22rem blurred gradient circles drifting on an 11-second loop behind login, plus an `.auth-scanline` sweep. Blurred drifting gradient blobs are the most recognizable "AI generated a landing page" tell there is. Replace with the Threshold treatment: serif wordmark on a `--muted` field, or one real photograph of the product.

---

## 6. Component rules

### Buttons

| Variant | Fill | Text | Use |
| --- | --- | --- | --- |
| `primary` | `--primary` | `--primary-foreground` | Main action |
| `commit` | `--accent-solid` | white | Money-moving actions. One per screen. |
| `outline` | `--card` + `--border` | `--foreground` | Secondary |
| `ghost` | transparent, `--muted` on hover | `--foreground-muted` | Icon buttons, row actions |
| `danger` | `--card` + `--border`, `--danger-tint` on hover | `--danger-text` | Void, delete, refund |

Sizes: `sm` 32px, `default` 36px (Ledger), `lg` 44px, `counter` 48px. Focus ring is `--ring` on every variant.

Note there is no filled `secondary`. A `--muted` fill and an outline do the same job; two of them competing is the kind of redundancy that makes a system feel bloated.

### Segmented control

Payment method, table density, date range. A `--muted` track with a `--card` thumb carrying `--shadow-xs`. Replaces the current pattern of two adjacent buttons where the selected one is fully black, which reads as two competing primary actions.

### POS product tile

Concrete fixes to `pos-product-card.tsx`:

- **The `h-7` (28px) Variants button becomes 48px.** It sits in the card corner; a mis-tap adds the wrong item to a paying customer's order. This is the highest-priority fix in the app.
- Category label: `text-[0.65rem] tracking-[0.12em] uppercase` → `text-meta`, sentence case, `--foreground-muted`.
- `font-black` on the product name → weight 500.
- Hover is a 1px lift plus `--shadow-sm`, not `hover:border-zinc-500`.
- Raw `border-zinc-300 bg-white text-zinc-950` → `--border`, `--card`, `--foreground`.
- Out-of-stock: `--danger-tint` badge with a dot, plus 55% opacity on the tile.

### Status badges

22px tall, `--radius-full`, 12px weight 500, semantic tint with matching `-text`, plus a 5px dot. The dot carries meaning for color-blind users.

---

## 7. Accessibility floor

Enforced in review:

- Body text ≥ 4.5:1, large text ≥ 3:1. Every value above is measured.
- No text below 12px.
- Counter tap targets ≥ 48 × 48, or ≥ 24px clear space.
- Visible `--ring` on every focusable element.
- Color is never the only carrier of state.
- `--foreground-disabled` (3.15:1) is forbidden for content. Lint-enforced.
- Semantic `-solid` values are forbidden as text colors; use the `-text` pair.
- Respect `prefers-reduced-motion`.

---

## 8. Out of scope

- **Print stylesheet for receipts.** Thermal output (58/80mm, no color, no grey) has its own constraints.
- **RTL / Arabic.** Currency formats as `en-AE` / AED, which suggests a UAE deployment where this may eventually matter. No RTL support exists today.
- **Iconography.** Lucide is in use and is fine.
- **Chart palette.** Recharts needs a categorical set derived from these tokens; see MIGRATION.md phase 6.

---

## Research

Reference sweep for the v2 direction: shadcn blocks and its published theming defaults, Midday (accounting SaaS built on shadcn), Linear, Attio. Captured with the headless browser, not from memory. The concrete borrowings are the achromatic oklch ramp, `--radius: 0.625rem`, fills instead of borders on KPI cards, sentence-case muted labels, and negative tracking that scales with size.
