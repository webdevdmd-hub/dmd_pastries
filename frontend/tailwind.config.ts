/**
 * Pastries POS — proposed Tailwind config (v3).
 *
 * PROPOSED. Not yet wired into the app.
 * Reasoning in DESIGN.md, variables in docs/design/tokens.css,
 * adoption steps in docs/design/MIGRATION.md.
 *
 * Four deliberate constraints:
 *
 * 1. The numeric font-size scale (text-sm, text-base, ...) is NOT redefined.
 *    80+ routes are built on Tailwind defaults; shifting text-sm from 14px to
 *    13.5px would silently move every screen. The new scale is ADDITIVE and
 *    semantic: text-cell, text-total, etc.
 *
 * 2. The old `brand-*` and `workspace-*` groups stay as deprecated aliases
 *    pointing at the new tokens, so day one breaks nothing. Deleted in
 *    migration phase 4.
 *
 * 3. Colors are oklch. Tailwind v3 passes arbitrary CSS through, and storing
 *    bare triplets keeps `/ <alpha-value>` working.
 *
 * 4. Every `var(--x)` below MUST have a matching declaration in tokens.css.
 *    v3 renamed `--background` to `--canvas` and `--accent-*` to `--money-*`
 *    (DESIGN.md §3). A config asking for a variable the token layer no
 *    longer defines produces `oklch(var(--background))` -> invalid at
 *    computed-value time -> the browser drops the declaration. No build
 *    error, no lint error, no console warning: a blank app. `background`
 *    and `accent.*` survive here as Tailwind-level aliases pointing at the
 *    v3 variables, because shadcn's components/ui/* references
 *    `accent-foreground` and `bg-background`.
 */
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const c = (name: string) => `oklch(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Neutrals (barely warm) ----------------------------------------
        canvas: c("canvas"),
        // Deprecated alias. shadcn's primitives use `bg-background`.
        background: c("canvas"),
        card: { DEFAULT: c("card"), foreground: c("foreground") },
        muted: { DEFAULT: c("muted"), foreground: c("foreground-muted") },
        border: c("border"),
        input: c("border"),
        foreground: {
          DEFAULT: c("foreground"),
          muted: c("foreground-muted"),
          disabled: c("foreground-disabled"),
        },
        primary: { DEFAULT: c("primary"), foreground: c("primary-foreground") },
        ring: c("ring"),

        // --- The one accent -------------------------------------------------
        // Money-committing actions and success. Two greens on a screen means
        // one of them is wrong. Canonical name is `money`; `accent` is kept
        // as a deprecated alias only because shadcn's Button and DropdownMenu
        // reference `accent-foreground`. Do NOT reach for `accent-*` in new
        // code, and never overload it for a brand hue — DESIGN.md §3.2.
        money: {
          DEFAULT: c("money-solid"),
          hover: c("money-hover"),
          text: c("money-text"),
          tint: c("money-tint"),
          foreground: c("primary-foreground"),
        },
        accent: {
          DEFAULT: c("money-solid"),
          hover: c("money-hover"),
          text: c("money-text"),
          tint: c("money-tint"),
          foreground: c("primary-foreground"),
        },

        // --- Semantic: -solid for fills, -text for type ---------------------
        warning: {
          DEFAULT: c("warning-solid"),
          text: c("warning-text"),
          tint: c("warning-tint"),
        },
        danger: {
          DEFAULT: c("danger-solid"),
          text: c("danger-text"),
          tint: c("danger-tint"),
        },
        info: {
          DEFAULT: c("info-solid"),
          text: c("info-text"),
          tint: c("info-tint"),
        },

        // --- shadcn compatibility -------------------------------------------
        // components/ui/* references these. Repointed, no component edits.
        popover: { DEFAULT: c("card"), foreground: c("foreground") },
        secondary: { DEFAULT: c("muted"), foreground: c("foreground") },
        destructive: {
          DEFAULT: c("danger-solid"),
          foreground: c("primary-foreground"),
        },

        // --- DEPRECATED: delete in migration phase 4 -------------------------
        // Kept so existing usages keep rendering during migration. The coffee
        // names were already lying: --brand-caramel and --brand-espresso both
        // resolved to pure black.
        brand: {
          latte: c("muted"),
          cappuccino: c("border"),
          caramel: c("primary"),
          mocha: c("foreground-muted"),
          espresso: c("foreground"),
        },
        workspace: {
          canvas: c("canvas"),
          sidebar: c("muted"),
          "sidebar-panel": c("card"),
          "sidebar-active": c("primary"),
          "sidebar-muted": c("foreground-muted"),
          panel: c("card"),
          border: c("border"),
          // NOTE: `workspace-panel-border` is used 18 times in src/ and has
          // never been defined in any config, so those 18 elements render no
          // border today. Deliberately NOT aliased here: adding it would be a
          // visual change smuggled into a migration-neutral commit. Decide it
          // in A1' with eyes on the screens. See UI-REBUILD-PLAN.md.
          muted: c("foreground-muted"),
        },
      },

      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Previously undefined. 31 files used `font-mono` for money and got
        // whatever monospace the OS handed back.
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        // Threshold register only: login, receipt header, marketing.
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
      },

      // Additive semantic scale. The numeric scale is untouched.
      // Negative tracking scales with size — that is most of what makes type
      // read as current rather than 2018.
      fontSize: {
        meta: ["0.78125rem", { lineHeight: "1rem" }], // 12.5/16
        cell: ["0.84375rem", { lineHeight: "1.125rem", letterSpacing: "-0.008em" }], // 13.5/18
        body: ["0.90625rem", { lineHeight: "1.375rem", letterSpacing: "-0.011em" }], // 14.5/22
        title: ["1.125rem", { lineHeight: "1.5rem", letterSpacing: "-0.02em", fontWeight: "500" }],
        page: ["1.75rem", { lineHeight: "2rem", letterSpacing: "-0.03em", fontWeight: "600" }],
        kpi: [
          "1.75rem",
          {
            lineHeight: "1.875rem",
            letterSpacing: "-0.04em",
            fontWeight: "500",
          },
        ],
        total: ["2rem", { lineHeight: "2rem", letterSpacing: "-0.045em", fontWeight: "500" }],
        display: ["4.25rem", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "400" }],
      },

      // NOTE: no `fontWeight` block here on purpose.
      // Everything under `theme.extend` MERGES with Tailwind's defaults, so
      // listing 400-700 would not remove `font-black` (900) — it would still
      // resolve. Moving the block to `theme.fontWeight` (non-extend) WOULD
      // remove it, but then the 78 existing `font-black` usages across 34
      // files silently become no-class and the whole app de-bolds at once
      // with no build error. The ESLint rule is the enforcement mechanism for
      // the weight ceiling; the config stays out of it.

      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius-lg)",
      },

      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",

        // DEPRECATED carry-forwards: delete in migration phase 8.
        // Tailwind emits NOTHING for an unknown class — no build error, no
        // lint error, just a silently missing shadow in production. These are
        // still in use (`shadow-float` 15 files, `shadow-panel` 3), so they
        // have to survive until the codemod repoints them.
        // `shadow-workspace` (the inset white bevel) and `bg-grain-warm` are
        // used in 0 files and are dropped outright.
        float: "var(--shadow-md)",
        panel: "var(--shadow-xs)",
      },

      height: {
        control: "var(--control-h)",
        field: "var(--field-h)",
        row: "var(--row-h)",
      },
      minHeight: { tap: "var(--tap-min)" },
      minWidth: { tap: "var(--tap-min)" },
      spacing: {
        gutter: "var(--gutter)",
        card: "var(--card-pad)",
        grid: "var(--grid-gap)",
        "cell-x": "var(--cell-pad-x)",
      },

      transitionDuration: {
        fast: "var(--duration-fast)",
        panel: "var(--duration-panel)",
      },
      transitionTimingFunction: { out: "var(--ease)" },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
