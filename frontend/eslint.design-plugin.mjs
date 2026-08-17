/**
 * Local ESLint plugin exposing each design guardrail as its own named rule.
 *
 * Why this exists: `no-restricted-syntax` holds all seven guardrails under a
 * single rule id, and ESLint resolves one severity per rule id. That made the
 * per-phase ramp in docs/design/MIGRATION.md impossible to express — the flip
 * table said "palette -> error after phase 3, font-black -> error after phase
 * 5", and there was no knob to do it with.
 *
 * With seven named rules, a phase that clears a rule flips that rule alone.
 * An "error" fails ESLint with exit code 1 no matter what --max-warnings says,
 * so the pre-commit lint-staged run blocks the commit with no extra flags.
 *
 * The rules are intentionally thin: ESLint's visitor object accepts esquery
 * selectors as keys, which is the same mechanism no-restricted-syntax uses
 * internally. So each rule is "report on these selectors with this message"
 * and nothing more. All the pattern logic stays in eslint.design-rules.mjs.
 */

import { designRuleGroups } from "./eslint.design-rules.mjs";

/** Build one ESLint rule from a list of { selector, message } entries. */
function ruleFromSelectors(entries) {
  return {
    meta: {
      type: "problem",
      docs: { description: "Pastries POS design system guardrail. See DESIGN.md." },
      schema: [],
    },
    create(context) {
      const visitor = {};
      for (const { selector, message } of entries) {
        // Several groups share a selector shape across four node types, and
        // two groups could in principle produce the same selector string.
        // Chain rather than overwrite so no report is silently dropped.
        const previous = visitor[selector];
        visitor[selector] = (node) => {
          if (previous) previous(node);
          context.report({ node, message });
        };
      }
      return visitor;
    },
  };
}

export const designPlugin = {
  meta: { name: "design", version: "1.0.0" },
  rules: Object.fromEntries(
    Object.entries(designRuleGroups).map(([name, entries]) => [name, ruleFromSelectors(entries)]),
  ),
};

/**
 * Severity per rule, tracking the MIGRATION.md flip table.
 *
 * Move a rule from "warn" to "error" in the same commit that lands the phase
 * clearing it. Do not flip one early: a rule at "error" with live violations
 * blocks every commit touching an affected file, and the escape hatch people
 * reach for is `--no-verify`, which disables all of them at once.
 *
 * Counts in src/, measured 2026-08-17 after B5, D1, D3 and D4:
 *   no-raw-palette               0  (was 1949 across ~300 files)  -> ERROR
 *   no-heavy-weight              0  (was 78)                      -> ERROR
 *   no-hex-in-class              0  (was 291)                     -> ERROR
 *   no-uppercase                35  copy pass on table headers    -> after B4
 *   no-sub-12px                 38  each one a layout decision     -> after B4
 *   no-solid-as-text             0                                 -> ERROR
 *   no-disabled-as-content       0                                 -> ERROR
 *
 * no-raw-palette is the one this whole exercise was about. 1949 -> 0, so it flips
 * here. From now on a raw Tailwind palette utility fails `eslint` with exit 1,
 * which fails `lint-staged` on the pre-commit hook and `pnpm verify` on pre-push.
 * That is the ratchet MIGRATION.md schedules after B2, and it is what stops the
 * count climbing back - which R1 notes has already happened twice, most recently
 * growing by 38 utilities in the three days after the guardrails first landed.
 *
 * no-heavy-weight flips with it: font-black and font-extrabold are gone (78 -> 0),
 * and 500 is the workhorse weight per DESIGN.md 2.
 *
 * no-hex-in-class flips too, 291 -> 0. It got there by three different routes,
 * which is why it took until now: B5 replaced the 124 Recharts literals with the
 * palette.ts bridge, D1 and D4 DELETED the auth orb decoration and the WebGL door
 * scene rather than migrating them (MIGRATION.md always said those were deletions),
 * and D3 rebuilt the landing page on the Threshold register, which took the last 20.
 *
 * The two still at "warn" are the ones a codemod genuinely cannot clear:
 *   - uppercase is mostly table headers without the wide tracking the sweep
 *     targeted. Rewriting them is a copy pass, and DESIGN.md §4 wants them as
 *     text-meta sentence case.
 *   - sub-12px is a layout decision per site: either the text grows or the
 *     container changes to fit it.
 *
 * One legitimate exception is live and is worth knowing about, because it is the
 * model for any future one: the single permitted threshold eyebrow on the landing
 * page (DESIGN.md §7 item 1) carries an `eslint-disable-next-line` with a reason,
 * per the plan's §5 escape hatch. Disable with a stated reason; do not weaken a rule.
 *
 * If you find yourself reaching for `--no-verify` instead of a scoped disable, that
 * is the signal a rule was flipped too early - and note that `--no-verify` also
 * disables the Git LFS chaining in .githooks/pre-push.
 */
export const designRuleSeverity = {
  "design/no-raw-palette": "error",
  "design/no-hex-in-class": "error",
  "design/no-heavy-weight": "error",
  "design/no-uppercase": "warn",
  "design/no-sub-12px": "warn",
  "design/no-solid-as-text": "error",
  "design/no-disabled-as-content": "error",
};
