/**
 * Photos are compressed before upload; receipts are not.
 *
 * uploadFile in lib/storage/files.ts is the one seam every image upload goes
 * through, and compressImage only has an effect if that seam calls it. A
 * refactor that inlines the provider call, or a new upload helper that skips
 * the seam, would quietly put 4 MB phone photos back into the product grid --
 * no error, just a slower shop every morning.
 *
 * The other direction matters as much: the documents bucket holds receipts,
 * and a re-encoded receipt is not the document that was handed in. The seam
 * must pass documents through untouched.
 *
 * Usage: node scripts/check-upload-compression.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, "..", "src", ...parts), "utf8");

const files = read("lib", "storage", "files.ts");
const compressor = read("lib", "storage", "compress-image.ts");

const failures = [];

const uploadStart = files.indexOf("export async function uploadFile(");
const uploadEnd = files.indexOf("\n}", uploadStart);
const uploadBody = uploadStart >= 0 ? files.slice(uploadStart, uploadEnd) : "";

if (!uploadBody) {
  failures.push("uploadFile is missing from lib/storage/files.ts");
}
if (!/await compressImage\(/.test(uploadBody)) {
  failures.push("uploadFile does not call compressImage -- photos go up at full size");
}
if (!/bucket === "documents" \? file/.test(uploadBody)) {
  failures.push("uploadFile does not pass the documents bucket through uncompressed");
}
if (!/^import \{ compressImage \} from "@\/lib\/storage\/compress-image";/m.test(files)) {
  failures.push("lib/storage/files.ts does not import compressImage");
}

// The compressor's contract, so a tweak cannot silently widen or shrink it.
if (!/export const MAX_IMAGE_EDGE = 1280;/.test(compressor)) {
  failures.push("MAX_IMAGE_EDGE is not 1280 -- update this guard if that change is deliberate");
}
if (!/imageOrientation: "from-image"/.test(compressor)) {
  failures.push(
    "compressImage no longer honours EXIF orientation -- portrait photos will upload sideways",
  );
}
if (!/blob\.size >= file\.size/.test(compressor)) {
  failures.push("compressImage no longer keeps the original when re-encoding would grow it");
}

if (failures.length > 0) {
  console.error("Upload compression guard failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("  Upload compression OK: photos are resized before upload, documents pass through.");
