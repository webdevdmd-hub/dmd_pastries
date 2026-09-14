/**
 * The order screens must only offer status changes the server will accept.
 *
 * Two copies of the transition rule had drifted from the server in different
 * directions, and both shipped:
 *
 *   - order-details-panel rendered all six statuses and disabled only the
 *     current one, so every order showed five buttons of which at most two
 *     worked. A cancelled order showed five that all failed.
 *   - order-actions-menu let `ready` jump straight to `completed`, which the
 *     server refuses, and dropped `cancelled` from `completed`, hiding a
 *     transition the server supports and restocks for.
 *
 * Both now read frontend/src/lib/orders/status-rules.ts, and this check pins
 * that module to the server's own rule, transcribed from
 * backend/internal/modules/bakeryorders/service.go:
 *
 *   allowedStatusTransition(from, to):
 *     from == to                      -> allowed
 *     to == "cancelled"               -> allowed (the W6 money guard runs next)
 *     {new: confirmed, confirmed: in_production, in_production: ready,
 *      ready: delivered, delivered: completed}[from] == to -> allowed
 *     otherwise                       -> refused
 *
 * Editing and payments have their own server gates, mirrored here too:
 * orderCanEdit is new|confirmed, and AddPayment refuses a cancelled order.
 *
 * Regression: ISSUE-004 — order status buttons offered transitions the server refuses
 * Regression: ISSUE-005 — Edit and Add payment were offered on orders the server refuses to change
 * Found by /qa on 2026-09-14
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-order-status-rules.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadModule(specifier) {
  const sourcePath = resolve(rootDir, `${specifier.replace("@/", "src/")}.ts`);
  const transpiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const moduleState = { exports: {} };
  new Function("exports", "module", "require", transpiled.outputText)(
    moduleState.exports,
    moduleState,
    (request) => {
      throw new Error(`Unexpected runtime import while loading order status rules: ${request}`);
    },
  );
  return moduleState.exports;
}

const { allowedOrderTransitions, canAddOrderPayment, canEditOrder } = loadModule(
  "@/lib/orders/status-rules",
);

const ALL_STATUSES = [
  "new",
  "confirmed",
  "in_production",
  "ready",
  "delivered",
  "completed",
  "cancelled",
];

// The server's rule, transcribed. If the backend map changes, change this too.
const SERVER_NEXT = {
  confirmed: "in_production",
  delivered: "completed",
  in_production: "ready",
  new: "confirmed",
  ready: "delivered",
};

function serverAllows(from, to) {
  if (from === to) {
    return true;
  }
  if (to === "cancelled") {
    return true;
  }
  return SERVER_NEXT[from] === to;
}

// --- Every offered transition must be one the server accepts ---------------

for (const from of ALL_STATUSES) {
  for (const to of allowedOrderTransitions(from)) {
    assert.ok(
      serverAllows(from, to),
      `the UI offers ${from} -> ${to}, which the server refuses with "invalid order status transition"`,
    );
    assert.notEqual(to, from, `${from} must not offer a button that changes nothing`);
  }
}

// --- and every transition the server accepts must be offered ---------------
//
// Without this, a fix that just deleted buttons would pass. `completed ->
// cancelled` is the case that was actually missing: the server supports it and
// restocks and reverses the journals for it.

for (const from of ALL_STATUSES) {
  const offered = allowedOrderTransitions(from);
  for (const to of ALL_STATUSES) {
    if (to === from || !serverAllows(from, to)) {
      continue;
    }
    assert.ok(
      offered.includes(to),
      `the server accepts ${from} -> ${to} but the UI never offers it`,
    );
  }
}

// --- The specific drifts that shipped --------------------------------------

assert.deepEqual(
  allowedOrderTransitions("cancelled"),
  [],
  "a cancelled order has nowhere to go; it used to offer five buttons that all failed",
);

assert.ok(
  !allowedOrderTransitions("ready").includes("completed"),
  'ready may only become delivered; "Mark Completed" from ready failed on the server',
);

assert.ok(
  allowedOrderTransitions("completed").includes("cancelled"),
  "a completed order can still be cancelled, which restocks and reverses its journals",
);

assert.deepEqual(allowedOrderTransitions("new"), ["confirmed", "cancelled"]);
assert.deepEqual(allowedOrderTransitions("ready"), ["delivered", "cancelled"]);

// --- Editing and payments --------------------------------------------------

assert.ok(canEditOrder("new"));
assert.ok(canEditOrder("confirmed"));
for (const status of ["in_production", "ready", "delivered", "completed", "cancelled"]) {
  assert.equal(
    canEditOrder(status),
    false,
    `the server refuses to edit a ${status} order, so the edit form must not open`,
  );
}

assert.equal(
  canAddOrderPayment("cancelled"),
  false,
  'AddPayment refuses a cancelled order: "cannot add payment to cancelled order"',
);
for (const status of ["new", "confirmed", "in_production", "ready", "delivered", "completed"]) {
  assert.ok(canAddOrderPayment(status), `a ${status} order must still accept a payment`);
}

console.log("check-order-status-rules: the order screens offer exactly what the server accepts.");
