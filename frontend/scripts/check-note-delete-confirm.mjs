/**
 * Deleting a customer or supplier note is confirmed, reported, and a failure
 * is shown.
 *
 * The trash button on a note called the delete mutation straight from the
 * click: no confirmation, no success toast, and `void mutateAsync(...)`
 * dropped any error, so a failed delete looked like nothing happened.
 *
 * Regression: ISSUE-093 — customer and supplier notes deleted in one click with errors swallowed
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * Usage: node scripts/check-note-delete-confirm.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");
const load = (path) => {
  const out = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const state = { exports: {} };
  new Function("exports", "module", out.outputText)(state.exports, state);
  return state.exports;
};

// 1. The confirmation names the note: its start, on one line.
const { notePreview } = load("src/lib/notes/note-preview.ts");
assert.equal(notePreview("Call before delivery"), "Call before delivery");
assert.equal(notePreview("  Prefers\n\nmorning   drop-offs "), "Prefers morning drop-offs");
const long = notePreview("x".repeat(80));
assert.equal(long, `${"x".repeat(60)}…`, "a long note is cut to 60 characters and marked");

// 2. Both sections confirm, report success, and show a failure.
for (const [file, owner] of [
  ["src/components/customers/customer-notes-section.tsx", "customer"],
  ["src/components/suppliers/supplier-notes-section.tsx", "supplier"],
]) {
  const source = read(file);
  const start = source.indexOf("const deleteNote = async (noteId: string, text: string)");
  assert.ok(start >= 0, `${file}: no confirmed deleteNote handler`);
  const handler = source.slice(start, source.indexOf("\n  };\n", start));

  assert.match(
    handler,
    /await confirm\(\{[\s\S]*?confirmLabel: "Delete note"[\s\S]*?\}\);\s*if \(!confirmed\) \{\s*return;/,
    `${file}: the delete must be confirmed with a button that names it`,
  );
  assert.match(
    handler,
    new RegExp(`notePreview\\(text\\)[^\`]*from this ${owner}`),
    `${file}: the confirmation names the note and its ${owner}`,
  );
  assert.match(
    handler,
    /try \{\s*await deleteMutation\.mutateAsync\([^)]*\);\s*toast\.success\("[^"]+"\);\s*\} catch \(error\) \{\s*toast\.error\(getErrorMessage\(error\)\);/,
    `${file}: success is toasted and a failure is shown`,
  );
  assert.match(
    source,
    /onClick=\{\(\) => \{\s*void deleteNote\([^)]*\.id, [^)]*\.note\);/,
    `${file}: the trash button runs the confirmed handler`,
  );
  assert.doesNotMatch(
    source,
    /void deleteMutation\.mutateAsync\(/,
    `${file}: a fire-and-forget delete swallows its error`,
  );
}

console.log("check-note-delete-confirm: note deletes are confirmed, toasted and report failures.");
