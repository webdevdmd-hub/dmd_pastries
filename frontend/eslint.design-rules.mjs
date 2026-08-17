/**
 * Design system guardrails for ESLint.
 *
 * These are the rules that keep the token layer from drifting back into raw
 * hex and raw Tailwind palette scales. See DESIGN.md and
 * docs/design/MIGRATION.md.
 *
 * ## Why the selectors look like this
 *
 * A naive rule matches only `JSXAttribute[name.name='className'] Literal`.
 * That misses most of where classes actually live in this codebase:
 *
 *   - `cva()` variant maps — src/components/ui/{alert,badge,button,label}.tsx.
 *     Only 4 files, but they are 260 + 104 + 37 import sites downstream, and
 *     they hold the variant colors, which is exactly what these rules police.
 *   - `cn()` / `clsx()` calls made outside a className attribute, e.g. a
 *     helper that returns a class string for a status value.
 *   - Template literals: className={`text-red-700 ${extra}`}
 *   - `.ts` files — a `buttonVariants` extracted out of a `.tsx` escapes a
 *     `*.tsx`-only glob entirely.
 *
 * So every pattern is applied across four node shapes, over both .ts and .tsx.
 *
 * ## Ramp
 *
 * Everything ships at "warn". `pnpm lint` has no `--max-warnings 0`, so
 * warnings cost nothing and act as a live to-do list. Each rule flips to
 * "error" in the migration phase that clears it; `--max-warnings 0` is added
 * last, once all of them are at "error".
 *
 * ## Reading the output
 *
 * no-restricted-syntax reports at the matched node, so a violation inside a
 * `cn()` call is reported at the string, not at the JSX element that uses it.
 */

/** Call expressions whose string arguments are Tailwind classes. */
const CLASS_CALL = "CallExpression[callee.name=/^(cn|clsx|cva|twMerge|tv|classNames)$/]";

/**
 * Apply one regex across every place a class string can hide.
 * `re` is an esquery regex body — backslashes must already be escaped for the
 * surrounding JS string.
 */
function guard(re, message) {
  return [
    `JSXAttribute[name.name='className'] Literal[value=/${re}/]`,
    `JSXAttribute[name.name='className'] TemplateElement[value.raw=/${re}/]`,
    `${CLASS_CALL} Literal[value=/${re}/]`,
    `${CLASS_CALL} TemplateElement[value.raw=/${re}/]`,
  ].map((selector) => ({ selector, message }));
}

const TAILWIND_PREFIX =
  "(text|bg|border|ring|from|to|via|fill|stroke|divide|outline|decoration|shadow|caret|placeholder)";
const TAILWIND_HUES =
  "(zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";

// NOTE on escaping: esquery builds a RegExp from the literal text between the
// slashes, so these strings need ONE level of escaping, not two. `"\\b"` in
// this source produces `\b`, which is what esquery must see.
/**
 * Selectors grouped by rule, so each can carry its OWN severity.
 *
 * This grouping is the whole point. Previously all seven shipped as one
 * `no-restricted-syntax` entry, and ESLint resolves a single severity per
 * rule id — so there was no way to make "raw palette" a warning while making
 * "semantic solid as text" an error. `--max-warnings 0` did not help either:
 * it is one global integer with no rule granularity, and switching it on with
 * all seven live would have blocked commits on 300 of 938 files (32%), and 22
 * of the 25 files in components/pos. The third time that bites during an
 * unrelated fix, someone types `--no-verify` and the guardrail is dead.
 *
 * eslint.design-plugin.mjs turns each group below into a real named rule, so
 * a phase that clears a rule can flip that rule to "error" on its own. An
 * error fails ESLint with exit 1 regardless of --max-warnings, which means
 * lint-staged blocks the commit for free.
 *
 * See docs/design/MIGRATION.md for the flip schedule.
 */
export const designRuleGroups = {
  // Cleared by the semantic + neutral codemods (MIGRATION phases 2-3).
  "no-raw-palette": guard(
    `\\b${TAILWIND_PREFIX}-${TAILWIND_HUES}-\\d{2,3}\\b`,
    "No raw Tailwind palette colors. Use design tokens: foreground, foreground-muted, card, muted, border, money, warning, danger, info. See DESIGN.md section 3.",
  ),

  // Cleared by the chart + 3D palette bridge (MIGRATION phase 6).
  "no-hex-in-class": guard(
    "#[0-9a-fA-F]{3,8}\\b",
    "No hardcoded hex in class strings. Use a design token. Canvas and WebGL colors, which cannot read CSS variables, import from @/lib/design/palette.",
  ),

  // Cleared by typography discipline (MIGRATION phase 5).
  "no-heavy-weight": guard(
    "\\bfont-(black|extrabold)\\b",
    "Weights above 600 are not in the type system; 500 is the workhorse. See DESIGN.md section 2.",
  ),

  // DESIGN.md section 2: no uppercase in-app. The one permitted exception is
  // a single mono eyebrow on a threshold screen, which takes an inline
  // eslint-disable-next-line with a reason.
  //
  // Banned outright rather than paired with a tracking check, because
  // cn("uppercase", cond && "tracking-[0.12em]") splits the two utilities
  // across separate nodes and no single-node lookahead can see both.
  "no-uppercase": guard(
    "\\buppercase\\b",
    "Uppercase is not in the type system. Use sentence case at text-meta in text-foreground-muted. See DESIGN.md section 2.",
  ),

  // Matches only sub-12px: 0.0-0.74rem, 0-9px, 10-11px. text-[14px] is fine.
  "no-sub-12px": guard(
    "text-\\[0\\.[0-6]\\d*rem\\]|text-\\[0\\.7[0-4]\\d*rem\\]|text-\\[[0-9]px\\]|text-\\[1[01]px\\]",
    "12px is the minimum readable size. Use text-meta or larger. See DESIGN.md section 2.",
  ),

  // The -solid values are fills, icons and borders. Each semantic role has a
  // -text pair that clears 6.5:1 on its own tint. Near-clean today, which is
  // why this one ships at "error" immediately.
  "no-solid-as-text": guard(
    "\\btext-(warning|danger|info)\\b(?!-)",
    "Semantic solid values are fills, not text. Use text-danger-text, text-warning-text or text-info-text. See DESIGN.md section 3.",
  ),

  // Also near-clean today, so also ships at "error".
  //
  // The negative lookbehind is load-bearing. This rule permits the token behind a
  // `disabled:` or `placeholder:` variant — that is its one sanctioned use — and
  // bans it only as a bare content colour. Without the lookbehind it fired on
  // `disabled:text-foreground-disabled`, i.e. on exactly the usage its own
  // message calls allowed, which made styling a disabled control impossible at
  // `error` severity. Found while making the POS Charge button's disabled state.
  "no-disabled-as-content": guard(
    "(?<!\\b(?:disabled|placeholder|aria-disabled|group-disabled|peer-disabled):)\\btext-foreground-disabled\\b",
    "foreground-disabled is ~3.1:1 and fails WCAG AA. Allowed only behind a disabled:/placeholder: variant, never as a content colour. Use text-foreground-muted.",
  ),
};

/**
 * Flattened form, kept for anything that still wants a single
 * `no-restricted-syntax` array. The plugin is the supported path.
 */
export const designRules = Object.values(designRuleGroups).flat();
