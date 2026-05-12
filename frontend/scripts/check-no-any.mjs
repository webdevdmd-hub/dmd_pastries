import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("src");
const filePattern = /\.(ts|tsx)$/;
const tokenPattern = /\bany\b/;

const violations = [];

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
    const lines = content.split("\n");

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
  process.exit(1);
}

console.log("No disallowed 'any' token found in src.");
