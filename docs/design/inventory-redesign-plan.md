# Inventory module — UI/UX redesign plan

Status: **draft, ready for review**
Scope: the Inventory module only — `/inventory` and its 6 sub-pages
Branch this was drafted on: `claude/inventory-ui-ux-audit-b2e8a4`
Relationship to the wider effort: this **is** Track C5 from [UI-REBUILD-PLAN.md](UI-REBUILD-PLAN.md) (currently scheduled after C1–C4), pulled forward and scoped in detail because it was asked for directly. It still depends on Track A (token layer) and Track C0 (component prerequisites) landing first — see §6.

---

## 0. The complaint, made specific

"It feels overwhelming" is a real, diagnosable IA problem, not a vibe. Here is everything a user sees on `/inventory` **before any row of data**, counted from the current source:

| Zone | Count | Source |
| --- | --- | --- |
| KPI cards | 4 | `inventory-summary-cards.tsx` |
| Full-size navigation cards ("Inventory sections") | 6 | `inventory-page-client.tsx:353-386` |
| Toolbar controls (search + 4 selects + reset + 3 checkboxes) | 8 | `inventory-toolbar.tsx` |
| **Total controls/decisions before the table** | **18** | |
| Table columns | 14 | `inventory-table.tsx:67-82` |
| Row action buttons | up to 4 (View, Movements, Adjust, Add batch) | `inventory-table.tsx:158-205` |

18 things to look at or decide, then a 14-column table with up to 4 icon buttons per row. That is the overwhelm, and it is fixable without touching a single API call.

**Two structural causes, not eighteen small ones:**

1. **The 6 "sections" are views of the same data, styled as if they were 6 separate destinations.** Location balances, stock transfers, stock locations, movements, low stock, and expiry alerts are all just the inventory ledger filtered or sliced differently. Presenting them as six full-width cards with icon, title, and description each (72px+ tall, ~370px total) trains the eye to treat them as six modules to evaluate, when they're six filters on one dataset.
2. **The table shows everything a detail view already shows.** `inventory-details-drawer.tsx` already renders a full breakdown per item (branch stock, recent movements, expiry batches, cost, identity). The list table duplicates most of that inline — 14 columns — instead of showing what you scan a list *for* (name, quantity, status) and letting the drawer carry the rest.

Fix both and the "overwhelming" feeling goes away without deleting a single feature.

---

## 1. Non-negotiables

- **Zero API, hook, or data-shape changes.** Every one of the 26 exported hooks in `use-inventory.ts`, every `useQuery`/`useMutation`, every field on `InventoryItem`/`InventoryFilters`/`ExpiryBatch` stays exactly as-is. This plan only moves where and how existing data renders.
- **Zero route removal.** All 7 URLs stay live and independently linkable (deep links from POS low-stock warnings, from Purchasing "receive goods," from Reports, etc. depend on them existing): `/inventory`, `/inventory/location-balances`, `/inventory/movements`, `/inventory/low-stock`, `/inventory/expiry-alerts`, `/inventory/stock-locations`, `/inventory/stock-transfers`.
- **Built on the existing v3 token layer**, not a new one. Ledger register per DESIGN.md §1: 36px controls, 44px rows, tabular figures, monochrome + money-green-only accent. No new colors, no new type scale.
- **Permission gating stays exactly where it is.** Every `visible: hasAnyPermission([...])` / `canView*` / `canManage` check in the current code maps 1:1 to the redesigned components. This is a presentation pass, not a permissions rewrite.

---

## 2. Information architecture — the actual redesign

### 2.1 Collapse "6 destinations" into "1 page, filtered 6 ways"

Replace the 6 full-size navigation cards with a **tab strip** directly under the page header, in front of the table — the same pattern already used for density/segmented controls elsewhere in v3 (DESIGN.md §6, Segmented control). Tabs, not cards:

```
[ All items ]  [ Low stock 3 ]  [ Expiring soon 1 ]  [ By location ]  [ Movements ]  [ Transfers ]
```

- Each tab is a `--muted` track / `--card` thumb segmented control, not 6 separate full-page navigations dressed as cards.
- Tabs that have a live count (Low stock, Expiring soon) show it as a small numeral, sourced from **the same KPI data already being fetched** (`inventoryQuery`, `expiryAlertsQuery`) — no new request.
- "All items", "Low stock", "Expiring soon" render **in place**, on the same `/inventory` page, by pre-setting the existing `lowStockOnly` / `expiryTrackedOnly` filter state — this is a filter tab, not a navigation. This is a real functional upgrade over today: right now the KPI card for "Low Stock Items" is purely decorative and the actual filter toggle is a separate, easy-to-miss checkbox at the bottom of an 8-control toolbar. Unifying them means one fewer thing to find.
- "By location," "Movements," and "Transfers" keep navigating to their existing dedicated routes (`/inventory/location-balances`, `/inventory/movements`, `/inventory/stock-transfers`) — those views have different table shapes (location × item, not item-only) and stay separate pages. `/inventory/stock-locations` (managing physical locations, an admin task, not a stock view) moves out of the tab strip entirely into a small "Manage locations" link inside the page's overflow menu — it is configuration, not a daily-use view, and does not deserve equal visual weight with "Low stock."

Net effect: 6 large cards (~370px of vertical space, 6 separate mental "is this relevant to me" evaluations) become one 44px tab row. Every destination still exists and is one click away; nothing is deleted.

### 2.2 Slim the KPI row

Four large cards (icon + label + big number, ~140px tall each) become one compact stat strip — a single `--muted` row of 4 label/value pairs at ~64px, matching the Ledger register's KPI treatment used elsewhere post-migration. Same 4 numbers (`Total Inventory Items`, `Low Stock Items`, `Expiring Soon`, `Total Stock Value` — now a real computed value per the ISSUE-001 fix already shipped), same `items.length` / `lowStockCount` / `expiryAlerts.length` / `inventoryValue` sum, same data. Only the container shrinks.

### 2.3 Toolbar: progressive disclosure, not 8 controls at once

- **Always visible:** search box, and the "Low stock" / "Expiring soon" state now lives in the tab strip (§2.1), so those two checkboxes disappear from the toolbar entirely — they're not removed, they're relocated somewhere more useful.
- **Collapsed into a single "Filters" button** (opens a popover): Branch, Item type, Product type, Status, "Include catalog items without stock." A filled dot on the button indicates any non-default filter is active — the same disclosure pattern already used for report filters elsewhere in the app.
- **Reset** stays, but only shows once a filter is actually active (no permanently-visible button for a no-op state).

This takes the toolbar from "8 controls visible at all times" to "1 search box + 1 filters button, expanding on demand." All 8 underlying `InventoryFilters` fields keep their exact names, types, and `updateFilters` merge behavior — this is a `<Popover>` wrapping the same `<Select>`/`<Checkbox>` components, not new filter logic.

### 2.4 Table: scan-friendly columns, detail in the drawer

Current 14 columns: Item, Type, Branch, Current Qty, Reserved, Available, Avg Cost, Value, Reorder, Unit, Stock Level, Expiry, Status, Actions.

**Default visible columns (8):** Item (name + code), Branch, Available (bold, the number that actually matters for "can I sell this"), Unit, Value, Stock Level, Status, Actions.

**Moved into the existing "View" detail drawer** (`inventory-details-drawer.tsx`, already built, already shows branch stock breakdown, movements, and batches): Type, Current Qty vs. Reserved breakdown, Avg Cost, Reorder level, Expiry tracking detail. The drawer already renders all of this — the table was duplicating it inline for no reason. Add the two fields the drawer doesn't yet carry (Reorder level, Unit) as it's the natural home for "why is this row flagged" detail, not a new endpoint.

**Table density mode** (C0.3 from UI-REBUILD-PLAN, `localStorage`-persisted `pastries-pos-table-density`): default 44px rows; "Compact" (36px) available for anyone scanning the full catalog at once. No new backend contract — this is the same primitive already scoped for the wider migration, just adopted here first since Inventory is the page complained about.

### 2.5 Row actions: one overflow menu, not up to 4 icon buttons

Current: View (eye icon), Movements (history icon, a `<Link>`), Adjust (button, opens dialog), and conditionally "Add expiry batch" — up to 4 icon-sized targets crammed into one 44px-tall cell, at 32×32px each (below the Ledger register's own 32×32 minimum, and uncomfortably tight).

Redesign: **one `⋯` overflow button per row**, opening a `DropdownMenu` with the same actions as menu items with labels ("View details," "Adjust stock," "Movements," "Add expiry batch" — the last one still conditional on `item.isExpiryTracked`). Same click handlers, same permission gates (`canManage`, `showViewAction`, `showBatchAction`), same routes — this only changes 4 buttons into 1 trigger + labeled menu items. This is the single highest-leverage visual declutter in the table: it removes ~3 icon targets from every one of potentially hundreds of rows.

### 2.6 What does *not* change

- The Opening Stock dialog, Stock Adjustment dialog, Expiry Batch dialog: unchanged internals (already reviewed for ISSUE-003's adjacent work; the Adjust flow already has good validation per the recent QA pass). Restyle to tokens only (Track C0/C5 mechanical pass).
- The 6 sub-pages' own tables (`stock-movements-table.tsx`, location-balances table, etc.): each gets the same Ledger-register token/density pass as the main table, on its own schedule (§5), but keeps its own column set — they show different data shapes (movements are a ledger, location balances are item×location) and should not be forced into the same 8-column template as the main list.
- Every empty/filtered/failed state already fixed in the recent QA pass (`ISSUE-005`, and the earlier `FilteredState`/`InventoryEmptyState` sweep) — those land as-is under the new IA, no rework.

---

## 3. Before / after, in one picture

**Before**, top to bottom on `/inventory`:
```
Page header (title + Opening Stock button)
4 KPI cards                                    ~140px each  = 560px
6 navigation cards                             ~62px each   = 372px
Toolbar: search, 4 selects, reset, 3 checkboxes = 2 rows      ~140px
─────────────────────────────────────────────────────────────────
~1,070px of chrome before the first table row
14-column table, up to 4 icon actions per row
```

**After:**
```
Page header (title + Opening Stock button)
Compact stat strip (4 values, 1 row)                          ~64px
Tab strip (6 destinations, 1 row)                              ~44px
Search + Filters button (1 row, popover for the rest)          ~40px
─────────────────────────────────────────────────────────────────
~148px of chrome before the first table row  (−86%)
8-column table (default), density toggle, 1 overflow menu per row
```

Nothing above requires a new component library, a new page shell, or a new API. It is a redistribution of the exact same controls and the exact same data into fewer, clearer decisions.

---

## 4. Component work

Reuses everything already scoped in UI-REBUILD-PLAN Track C0 — this plan does not invent new primitives, it consumes them:

| # | Component | Already scoped as | Net-new work for Inventory |
| --- | --- | --- | --- |
| 1 | Segmented/tab control for §2.1 | C0.2 (Segmented control primitive) | Wire 6 tabs to existing routes + existing filter state |
| 2 | Filters popover for §2.3 | New — thin wrapper, `<Popover>` + existing `<Select>`/`<Checkbox>` set | ~0.5d |
| 3 | Table density toggle for §2.4 | C0.3 (three-mode `table.tsx`, `localStorage`-backed) | Adopt on `inventory-table.tsx` first |
| 4 | Row overflow menu for §2.5 | shadcn `DropdownMenu` primitive, already in `components/ui/` | Wire 4 existing actions into it |
| 5 | Compact stat strip for §2.2 | New — restyle of `inventory-summary-cards.tsx` | ~0.25d |
| 6 | Drawer field additions for §2.4 | Extend `inventory-details-drawer.tsx` | ~0.25d |

No new dependency, no new backend field, no new route.

---

## 5. Phased rollout

| Phase | Scope | Depends on | Effort (human / CC) |
| --- | --- | --- | --- |
| P0 | Filters popover (§2.3) + row overflow menu (§2.5) — highest decluttering value, zero IA risk, ships independently of the token migration | Nothing — works with current tokens | 1d / 30m |
| P1 | Tab strip replacing the 6 nav cards (§2.1) + KPI stat strip (§2.2) | P0 | 1d / 30m |
| P2 | Table column reduction + drawer field additions (§2.4) | P1 (so "View details" is the natural place to send the removed columns) | 1d / 30m |
| P3 | Table density mode adoption (§2.4), if C0.3 has landed by then; otherwise Inventory becomes the reference implementation and C0.3 is built here first | C0.3 or built here | 1d / 40m |
| P4 | Same Ledger-register token/density restyle on the 6 sub-pages' own tables, matching whatever Track A/B token state exists at the time | Track A (token layer) | 1.5d / 45m |

**P0–P2 do not require the wider Track A token migration to have landed.** They are pure component/IA restructuring using whatever tokens are live today (`brand-*` aliases still work per DESIGN.md's alias-layer safety net). This means the "overwhelming" complaint can be fixed **before** the 11-week token migration reaches Track C5 in sequence — it does not have to wait behind POS, Accounting, and Reports.

**P4 should land whenever Track A actually ships** for this module, so Inventory isn't restyled twice.

Total: **~4.5 days human / ~2.5 hours CC** for P0–P3 (the IA fix), **+1.5 days / 45m** for P4 (token restyle, timed to the wider migration) — separate from and additive to the 3d/1.5h already budgeted for "C5" in UI-REBUILD-PLAN.md, because that budget covers Manufacturing, Recipes, Ingredients, and Packaging too, not just Inventory's IA.

---

## 6. Dependencies and sequencing risk

- **No hard blocker.** P0–P3 need no other track. This is the one piece of good news in a plan that otherwise sits behind an 11-week migration: it can ship this week if prioritized.
- **Soft dependency on C0.2/C0.3** (segmented control, three-mode table) — if those haven't landed yet, P1 and P3 build minimal local versions and UI-REBUILD-PLAN adopts them as the canonical primitive later, same direction C0.5 (loading) already plans for pre-existing ad-hoc implementations.
- **Track A (token layer) is soft, not hard,** for P0–P3: the current `brand-*` alias layer keeps existing classes rendering correctly today, so this can ship on today's tokens and get restyled once, in P4, rather than twice.

---

## 7. Verification

Same discipline as the rest of the migration, scoped down:

1. **No API diff.** `git diff` on this work should touch zero files under `frontend/src/hooks/use-inventory.ts`, `frontend/src/lib/api/inventory.ts`, or `frontend/src/types/inventory.ts`. If it does, something went wrong.
2. **Every current permission gate still gates the same thing** — `canView`, `canManage`, `canViewStockMovements`, `canViewLowStock`, `canViewExpiryAlerts`, `canViewStockTransfers`, `canViewStockLocations`, `showViewAction`, `showBatchAction` all map 1:1 into the new components.
3. **Manual walk:** `/inventory` in each of the 6 tab states, the filters popover open/closed, the row overflow menu on a tracked and a non-tracked item, the density toggle, and each of the 6 sub-page routes still resolving directly (deep links from other modules must keep working).
4. **`/design-review`** once P0–P3 land, same as every other track's gate in UI-REBUILD-PLAN §6.

---

## 8. What this plan deliberately does not do

- Does not merge the 6 sub-pages' data into one giant unified table. Movements is a ledger (different shape: one row per transaction, not per item). Location balances is item×location. Forcing them into the main item table would be a real data-model distortion disguised as simplification. Tabs *navigate* to them; they don't get flattened into one table.
- Does not remove the "Opening Stock" primary action, the Adjust dialog, or the Add Expiry Batch flow — these are the actual work a Manager does on this page, not chrome to be trimmed.
- Does not touch backend routes, database schema, or reporting exports (`/reports/inventory/*` is a separate module entirely, out of scope here).
- Does not add a new "inventory dashboard" concept distinct from `/inventory` — one landing page, filtered six ways, is the whole point of §2.1.
