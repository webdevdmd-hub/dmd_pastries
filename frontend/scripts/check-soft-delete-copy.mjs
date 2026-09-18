/**
 * Regression: ISSUE-080 — sales channel and receipt layout delete dialogs
 * called a soft delete permanent and irreversible
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * Both deletes keep the row (deleted_at is set), and a sales channel's name
 * lives on in the sales and orders that snapshot it. The dialogs said "This
 * permanently deletes ... It cannot be undone." The copy must describe what
 * really happens, and the default channel, which the server refuses to
 * delete, must stay without a Delete action.
 *
 * Usage: node scripts/check-soft-delete-copy.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

/** The confirm({...}) call inside a page's delete handler. */
function deleteConfirm(path, handlerStart) {
  const source = read(path);
  const start = source.indexOf(handlerStart);
  assert.ok(start >= 0, `${path}: delete handler found`);
  const handler = source.slice(start, source.indexOf("\n  };\n", start));
  const open = handler.indexOf("await confirm({");
  assert.ok(open >= 0, `${path}: the delete asks first`);
  return handler.slice(open, handler.indexOf("\n    });", open));
}

const channel = deleteConfirm(
  "src/components/settings/sales-channels-page-client.tsx",
  "const handleDelete = async (channel: SalesChannel)",
);
assert.doesNotMatch(channel, /permanently|cannot be undone/i, "a channel delete is not permanent");
assert.match(
  channel,
  /consequence: `This removes \$\{channel\.channelName\} from your sales channels\. Past sales and orders keep showing it\.`/,
  "the channel dialog says past sales keep the name",
);
assert.match(
  channel,
  /its name can be used for a new channel/,
  "the channel dialog says the name is free",
);

const layout = deleteConfirm(
  "src/components/settings/receipt-layouts-page-client.tsx",
  "const handleDelete = async (layout: ReceiptLayout)",
);
assert.doesNotMatch(layout, /permanently|cannot be undone/i, "a layout delete is not permanent");
assert.match(
  layout,
  /consequence: `This removes \$\{layout\.layoutName\} from your receipt layouts\.`/,
  "the layout dialog says the layout is removed",
);

// The server refuses to delete the default channel; the menu must not offer it.
const menu = read("src/components/settings/sales-channel-actions-menu.tsx");
assert.match(
  menu,
  /\{channel\.isDefault \? null : \([\s\S]*?Delete channel[\s\S]*?\)\}/,
  "Delete channel is not offered for the default channel",
);

console.log("check-soft-delete-copy: ok");
