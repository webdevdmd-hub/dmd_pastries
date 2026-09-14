/**
 * <FormControl> must wrap the control, not a wrapper <div>.
 *
 * FormControl is a Radix Slot: it forwards `id`, `aria-invalid` and
 * `aria-describedby` onto its single child. Written as
 *
 *   <FormControl>
 *     <div className="relative">
 *       <Mail className="absolute ..." />
 *       <Input {...field} />
 *     </div>
 *   </FormControl>
 *
 * every one of those props lands on the <div>. The <FormLabel htmlFor> then
 * points at a div, so the input has no accessible name (screen readers read
 * the placeholder, or nothing), clicking the label focuses nothing, and a
 * validation error never reaches the field as aria-invalid.
 *
 * Found on /login and /signup during the 2026-09-14 production QA run:
 * every input on both forms computed `labelled: false` while the same
 * pattern written correctly on /forgot-password computed `true`.
 *
 * The icon-in-the-corner layout is fine; the div just goes outside:
 *
 *   <div className="relative">
 *     <Mail className="absolute ..." />
 *     <FormControl>
 *       <Input {...field} />
 *     </FormControl>
 *   </div>
 *
 * Regression: ISSUE-001 — FormControl props landed on a wrapper div, inputs unlabelled
 * Found by /qa on 2026-09-14
 * Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-14.md
 *
 * Usage: node scripts/check-form-control-wraps-input.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "..", "src");

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

for (const file of walk(srcDir)) {
  const source = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  if (!source.includes("<FormControl>")) continue;

  const lines = source.split("\n");
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (lines[i].trim() !== "<FormControl>") continue;
    // The first child of FormControl is the element that receives the props.
    const child = lines[i + 1].trim();
    if (/^<(div|span|section|fieldset)\b/.test(child)) {
      offenders.push({ child, file: file.replace(srcDir, "src"), line: i + 2 });
    }
  }
}

if (offenders.length > 0) {
  console.error(
    `check-form-control-wraps-input: ${String(offenders.length)} <FormControl> wrap(s) a layout element instead of the control:`,
  );
  for (const { child, file, line } of offenders) {
    console.error(`  ${file}:${String(line)}  ${child.slice(0, 60)}`);
  }
  console.error(
    "Move the wrapper outside so <FormControl> wraps the <Input> (or other control) directly.",
  );
  process.exit(1);
}

console.log("check-form-control-wraps-input: every <FormControl> wraps its control directly.");
