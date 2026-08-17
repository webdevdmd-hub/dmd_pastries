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
 * Current counts in src/ at the time of writing:
 *   no-raw-palette          1949 violations, ~300 files  -> after B2
 *   no-hex-in-class          291 violations              -> after B5
 *   no-heavy-weight           78 violations              -> after B4
 *   no-uppercase             232 violations              -> after B4
 *   no-sub-12px               (bundled with the above)   -> after B4
 *   no-solid-as-text        near zero                    -> ERROR NOW
 *   no-disabled-as-content  near zero                    -> ERROR NOW
 */
export const designRuleSeverity = {
  "design/no-raw-palette": "warn",
  "design/no-hex-in-class": "warn",
  "design/no-heavy-weight": "warn",
  "design/no-uppercase": "warn",
  "design/no-sub-12px": "warn",
  "design/no-solid-as-text": "error",
  "design/no-disabled-as-content": "error",
};
