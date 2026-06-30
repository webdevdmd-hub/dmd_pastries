import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const standaloneRoot = path.join(projectRoot, ".next", "standalone");

async function copyFresh(source, destination) {
  await rm(destination, { force: true, recursive: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

async function main() {
  await copyFresh(
    path.join(projectRoot, ".next", "static"),
    path.join(standaloneRoot, ".next", "static"),
  );
  await copyFresh(path.join(projectRoot, "public"), path.join(standaloneRoot, "public"));

  console.log("Prepared standalone static assets.");
}

main().catch((error) => {
  console.error("Failed to prepare standalone static assets.");
  console.error(error);
  process.exitCode = 1;
});
