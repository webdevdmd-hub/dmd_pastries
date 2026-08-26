/**
 * Guard against explicit `any` in src/.
 *
 * NOTE ON REDUNDANCY (2026-08-17): `eslint.config.mjs` enables
 * `tseslint.configs.strictTypeChecked`, which already includes
 * `@typescript-eslint/no-explicit-any` at `error` severity — AST-aware, and
 * therefore strictly better than anything this file can do with regex. This
 * script is belt-and-braces only. See TODOS.md T-E: the honest options are to
 * delete it, or fold it into one shared debt-counting chassis with the other
 * bespoke checks.
 *
 * WHY IT WAS REWRITTEN: the previous version tested `/\bany\b/` against every
 * raw line, so it matched the English word "any" in comments and strings. It
 * had been failing on this comment in chart-account-form-dialog.tsx:
 *
 *     // refused on any account that has postings.
 *
 * That single false positive made `pnpm verify` red on both `main` and
 * `design-system-v3`. Because `.githooks/pre-push` runs `pnpm verify`, every
 * frontend push was blocked by a code comment — and the hook's own header warns
 * that a gate which fires spuriously gets bypassed with `--no-verify`, which
 * also disables the Git LFS chaining the hook exists to preserve. A false
 * positive here does not merely annoy; it steers people into the exact failure
 * the hook was written to prevent.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("src");
const filePattern = /\.(ts|tsx)$/;
const tokenPattern = /\bany\b/;

const violations = [];

/**
 * Blank out comments and string/template literals, preserving newlines so
 * reported line numbers still point at the right line.
 *
 * Only `any` in actual code is a violation. `any` in prose is English.
 */
function stripCommentsAndLiterals(source) {
  const blank = (match) => match.replace(/[^\n]/g, " ");

  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank) // block comments
    .replace(/\/\/[^\n]*/g, blank) // line comments
    .replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, blank) // string + template literals
    .replace(/>[^<>{}]*</g, blank); // JSX text nodes: prose between a tag and the next
  // The JSX pattern excludes {} so an expression child (`>{value}<`) survives,
  // and a generic like `Array<any>` keeps its `any` between `<` and `>`, not
  // `>` and `<`. The `>` of `=>` can start a match, but that only ever blanks
  // comparison operands (`x => x.count < limit`), where a bare `any` cannot
  // legally occur.
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const resolvedPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await walk(resolvedPath);
      continue;
    }

    if (!filePattern.test(entry.name)) {
      continue;
    }

    const content = await readFile(resolvedPath, "utf8");
    const lines = stripCommentsAndLiterals(content).split("\n");

    lines.forEach((line, index) => {
      if (tokenPattern.test(line)) {
        violations.push(`${resolvedPath}:${index + 1}: found disallowed 'any' token`);
      }
    });
  }
}

await walk(root);

if (violations.length > 0) {
  console.error(violations.join("\n"));
  console.error(
    `\n${violations.length} violation(s). If one of these is the word "any" in prose rather than\n` +
      `a type annotation, this script has regressed again — fix the stripper, do not add an\n` +
      `inline exception.`,
  );
  process.exit(1);
}

console.log("No disallowed 'any' token found in src.");
