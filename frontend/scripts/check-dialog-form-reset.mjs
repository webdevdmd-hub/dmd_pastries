/**
 * A dialog that resets its form must depend on `open`.
 *
 * The reset effect is usually written as
 *
 *   useEffect(() => { form.reset(toDefaults(record)); }, [form, record]);
 *
 * which is correct for editing, where `record` differs per row, and silently
 * wrong for adding, where `record` is null every time: nothing in the deps
 * changes between closing and reopening, the effect never re-runs, and the
 * next form opens holding the last one's values.
 *
 * Found on Add Product during the 2026-09-08 production audit. Creating ten
 * products in a row wrote the previous item's cost price onto three of them
 * and gave a fourth the wrong unit -- and cost price feeds recipe costing,
 * inventory valuation and COGS, so it is not a cosmetic carry-over. Nine other
 * dialogs had the identical shape. Editing hid it in every one of them.
 *
 * Usage: node scripts/check-dialog-form-reset.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = resolve(here, "..", "src/components");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const offenders = [];

for (const file of walk(componentsDir)) {
  const source = readFileSync(file, "utf8");
  if (!source.includes("form.reset(")) continue;
  // Only components that are actually opened and closed can have this bug.
  if (!/^\s*open:\s*boolean/m.test(source)) continue;

  const effects = source.matchAll(
    /( *)useEffect\(\(\)\s*=>\s*\{(.*?)\n\1\}\s*,\s*\[([^\]]*)\]\s*\);/gs,
  );

  for (const [, , body, deps] of effects) {
    if (!body.includes("form.reset(")) continue;
    if (/\bopen\b/.test(deps)) continue;
    offenders.push({
      deps: deps.replace(/\s+/g, " ").trim(),
      file: file.replace(componentsDir, ""),
    });
  }
}

if (offenders.length > 0) {
  console.error("\n  Dialog form reset FAILED.");
  console.error("  These dialogs reset a form in an effect that does not depend on `open`,");
  console.error("  so reopening them for a new record keeps the previous record's values:\n");
  for (const { file, deps } of offenders) {
    console.error(`    ${file}`);
    console.error(`      deps: [${deps}]  -- add \`open\` and return early when it is false\n`);
  }
  console.error(
    "  Editing masks this: the record changes per row, so the effect re-runs.\n" +
      "  Adding does not, because the record is null every time.\n",
  );
  process.exit(1);
}

console.log("  Dialog form reset OK: every form-resetting dialog depends on `open`.");
