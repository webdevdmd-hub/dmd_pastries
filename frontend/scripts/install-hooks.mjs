#!/usr/bin/env node
/**
 * Installs the versioned hooks from .githooks/ into .git/hooks/.
 *
 * Why copy instead of `git config core.hooksPath .githooks`:
 * setting core.hooksPath makes git ignore .git/hooks completely, and this
 * repo keeps its Git LFS hooks there (post-checkout, post-commit, post-merge,
 * pre-push). Redirecting hooksPath would disable LFS. Copying leaves them be.
 *
 * Why this replaced husky: husky was invoked from frontend/ while .git lives
 * one directory up, so it never installed. The hook sat in frontend/.husky/
 * and git never ran it, which meant lint, typecheck and check-no-any only ran
 * when someone remembered to type them.
 *
 * Runs on `pnpm install` via the "prepare" script. Safe to re-run.
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const sourceDir = join(repoRoot, ".githooks");
const gitDir = join(repoRoot, ".git");
const targetDir = join(gitDir, "hooks");

if (!existsSync(gitDir) || !statSync(gitDir).isDirectory()) {
  console.log("install-hooks: no .git directory found, skipping");
  process.exit(0);
}

if (!existsSync(sourceDir)) {
  console.log("install-hooks: no .githooks directory found, skipping");
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });

const installed = [];
for (const name of readdirSync(sourceDir)) {
  const source = join(sourceDir, name);
  if (!statSync(source).isFile()) {
    continue;
  }

  const target = join(targetDir, name);
  copyFileSync(source, target);
  try {
    chmodSync(target, 0o755);
  } catch {
    // Windows filesystems without POSIX permissions. Git for Windows runs the
    // hook through its bundled sh regardless, so this is not fatal.
  }
  installed.push(name);
}

console.log(
  installed.length > 0
    ? `install-hooks: installed ${installed.join(", ")} into .git/hooks`
    : "install-hooks: nothing to install",
);
