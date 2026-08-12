# Pastries POS — Accounting Architecture Audit

**Date:** 2026-08-12
**Scope:** Full read-only audit of the accounting system: chart of accounts, journal core, POS sales, purchasing/AP, inventory & manufacturing, bakery orders, payments & expenses, financial statements, dashboards, and branch isolation.
**Method:** 8 parallel code investigations over `backend/internal/modules/*` + 94 SQL migrations, cross-checked with read-only queries against the local dev database (6 businesses, 96 journals, 28 sales). **No data or code was modified.**

---

## Executive summary

The core double-entry engine is **sound where it runs**: every posted journal in the database balances (0 unbalanced), global debits = credits (1,052,929.37 both sides), and there are 0 cross-branch journal lines. Posting happens inside the same DB transaction as the business document, so a sale cannot commit without its journal.

The system is unreliable for three architectural reasons, not dozens of random bugs:

1. **Two sources of financial truth.** Financial statements read the ledger; the dashboard, sales reports, supplier balances, and customer balances compute their own numbers from operational tables with different status filters, date fields, and VAT treatment. They will *never* agree.
2. **The forward paths post; the backward paths don't.** Creation flows (sale, bill, payment) post correct journals. Reversal flows are broken in different ways per module: POS refunds don't reverse VAT/COGS/inventory, bakery cancellations post nothing, expense/supplier-payment deletion **hard-deletes posted journals**, and journal reversals drop `branch_id`.
3. **Bakery orders — the core of this business — never touch inventory or COGS.** Every custom order books 100% gross margin and finished goods pile up in the inventory asset forever.

Plus one **live breaking bug** (verified against the running DB): voiding a sale or posting a sales return for stock-tracked items throws a SQL error, because two queries filter `stock_movements.deleted_at` — a column that does not exist.

---

## A. Current accounting architecture (as it actually is)

### The intended spine exists and mostly holds for "create" events

```
Business document (sale / bill / payment / batch / expense)
        │  same DB transaction
        ▼
accounting.createPostedSystemJournal()          ← posted immediately, no draft stage
        │  status='posted', Go-side balance check (±0.005 absorbed into largest line)
        ▼
journal_entries + journal_entry_lines           ← the ledger. No separate GL table.
        │  live SUM() queries, status IN ('posted','reversed')
        ▼
Trial Balance / P&L / Balance Sheet / GL        ← ledger-derived, branch-required
```

- **Journal lifecycle:** manual journals have draft → posted → reversed (`accounting/service.go:3531,3623,3683`). System journals are born `posted` (`service.go:4781,4816`). There is no "validated" stage.
- **Idempotency** is Go-only: `FindPostedJournalBySource` check-then-insert (`repository.go:675`). The DB unique index on `(business_id, source_type, source_id)` was deliberately deferred until duplicate cleanup (see `backend/docs/accounting-branch-backfill.md`).
- **Account resolution:** `requiredMappedAccount(business, branch, mapping_key, fallback_code)` — a branch-scoped `accounting_account_mappings` table (24 seeded keys) with self-healing fallback to `chart_of_accounts` by code. 46 call sites, all branch-threaded (the 2026-08-10 branch fix).
- **Money is `float64`** end to end against NUMERIC(14,2) columns, with `math.Round(x*100)/100` scattered across ~12 modules.

### But there are two parallel sources of truth

| Question | Ledger answers it | Operational tables answer it |
|---|---|---|
| Trial Balance, P&L, Balance Sheet, GL | ✅ | |
| Dashboard AR / AP widgets | ✅ (accounts 1100/2000) | |
| Dashboard revenue, sales count, collected, refunds | | ✅ `sales`, `sale_payments`, `payment_refunds` |
| Sales / financial / purchase reports | | ✅ operational sums |
| Supplier outstanding balance (UI) | | ✅ `suppliers/repository.go:215-311` — never consults AP 2000 |
| Customer outstanding balance (UI) | | ✅ order rows; disagrees with the AR reconciliation's own definition |
| Inventory value | | ✅ `inventory_items.inventory_value` (running balance) |

A ledger-based revenue path was started and abandoned: `reports/shared/metrics.go:64` (`LedgerFinancialTotals`) has **no callers**.

### What is genuinely good (keep it)

- Transactional posting (no sale-without-journal in current code).
- Branch-scoped CoA + mapping table with 46 uniformly branch-threaded resolutions, protected by an AST guard test.
- The 10-check `consistency_warnings` engine (`reports/shared/metrics.go:117-311`) — a real reconciliation asset.
- The inventory reconciliation endpoint comparing operational stock value vs ledger 1200 with per-item reason codes.
- Purchase bill posting: correct Dr Inventory/expense + Dr VAT 1300 / Cr AP 2000, proportional discounts, symmetric cancel, edit = reverse + repost.
- POS checkout journal: correct multi-tender, credit-sale AR line, VAT split, charge income accounts, change netting.

---

## B. Chart of Accounts audit

**Structure:** 82 distinct codes × per-branch copies = 864 rows (dev DB). Types are a CHECK enum `asset|liability|equity|income|cogs|expense`; ~20 account groups exist only as a Go whitelist. Hierarchy columns exist (`parent_account_id` + cycle validation) but **every seeded account is flat** — no parent is ever set. Normal balance is stored per account. Uniqueness: `(business, branch, lower(code))`.

The seeded chart itself is **well-designed for this business** (Cash 1000, Bank 1010, Petty Cash 1020, Card Clearing 1030, AR 1100, Inventory 1200, WIP 1210, VAT Receivable 1300, Supplier Advances 1400, GRNI 2050, AP 2000, VAT Payable 2100, Customer Advance 2200, equity 3000-3400, income 4000-4100, COGS 5000-5090, expenses 6000-6250). The problems are wiring, not naming:

| Account | Problem | Severity |
|---|---|---|
| 1030 Card Clearing | Debited on every card sale but **nothing can ever credit it**: no settlement flow is wired and `allow_manual_posting=false` blocks manual clearing. Balance grows forever; bank never shows the money arriving. | **HIGH** |
| 3100 Retained Earnings | **No year-end close exists anywhere.** Nothing ever posts here. Balance Sheet goes permanently out of balance after the first financial year. | **HIGH** |
| 3200 Current Year P/L | Never posted; a synthetic row is appended to the BS unconditionally (`service.go:3150`), so any real journal against 3200 is double-counted. | MEDIUM |
| 2050 GRNI | Seeded and required by readiness checks, but the live policy is "bill-only" — `PostPurchaseReceiptJournal` is a no-op. Dead account; received-not-billed stock has no ledger counterpart. | MEDIUM (policy decision) |
| 6240 Platform Commission | Required by setup-readiness (`service.go:4575`) but no posting path ever uses it. Dead config. | MEDIUM |
| 4100 / 5090 Inv. Adjustment Gain/Loss | Migration 000056 inserts them with `is_system_account=false` on legacy tenants → user-deletable system accounts. Also: adjustment **gain is typed income** (4100), so counting corrections inflate revenue on the P&L rather than netting against COGS/shrinkage. | MEDIUM |
| 5000/5010/5050/5060, 4030, 4090, 6250 | Seeded, never referenced by any posting path. Clutter (or missing features: 4030 Discount Received is exactly what purchase bill discounts should hit — see H/C). | LOW |
| 1300 VAT Receivable | Only purchasing posts to it. **Expenses have no VAT column at all**, so input VAT on expenses is unrecoverable/lost. | MEDIUM |
| 3400 Opening Balance Equity | Used only by inventory opening stock. No opening-balance mechanism exists for cash/bank/AR/AP — you cannot go live mid-year with correct starting balances. | **HIGH** (go-live blocker) |

---

## C. Transaction → accounting matrix (as implemented)

Status: ✅ correct · ⚠️ partly wrong · ❌ missing/broken. All journals post at document time, same transaction, born-posted.

| Event | Current entries | Status |
|---|---|---|
| **POS sale** (`pos_sale`) | Dr payment accounts (per method, change netted vs cash) + Dr AR 1100 (unpaid part) / Cr Sales 4000 (net) + Cr charge income + Cr VAT Payable 2100 | ✅ |
| **POS COGS** (`pos_sale_cogs`) | Dr COGS 5070 / Cr Inventory 1200 at movement cost | ⚠️ silently skipped when cost=0; 7 of 28 dev sales have none |
| **POS AR payment later** | Dr payment acct / Cr AR 1100 (capped) + Cr Customer Advance 2200 (overpay) | ✅ |
| **POS void** | Mirror-reverses both journals, restocks | ⚠️ **crashes at runtime** — cost lookup queries non-existent `stock_movements.deleted_at` (`pos/service.go:964`); restock cost can also diverge from the mirrored journal |
| **POS refund** (`RefundSale`) | Dr Sales Returns 4040 (gross) / Cr payment acct | ❌ **no VAT reversal, no COGS reversal, no restock, no charge reversal, doesn't credit AR on credit sales** |
| **Sales return** (module) | Dr 4040 net + Dr charge refunds 4080 + Dr VAT 2100 / Cr payment acct; separately Dr Inventory / Cr COGS on restock | ⚠️ correct shape, but crashes on the same `deleted_at` bug; `refund_mode='none'` reverses COGS but not revenue (margin distortion); an economically identical event to "POS refund" posts completely different entries |
| **Purchase order / approval** | nothing | ✅ (by design) |
| **GRN posted** | nothing — bill-only policy; stock qty moves with no ledger value | ⚠️ policy decision pending (GRNI §3 of open decisions) |
| **Purchase bill posted** | Dr Inventory 1200 / expense lines (net of discounts) + Dr VAT Receivable 1300 / Cr AP 2000 | ✅ mechanics; ⚠️ bill discount vanishes into cheaper inventory instead of 4030 Discount Received |
| **Bill edit (posted)** | full reverse + new journal | ⚠️ replacement journal gets a **random `source_id`** → invisible to source lookups; editing a bill **to zero returns early and leaves the old journal live** |
| **Bill cancel** | mirror reversal + inventory reversal | ✅ shape; ⚠️ resets `payment_status='unpaid'` while leaving `paid_amount` |
| **Supplier payment** | Dr AP 2000 (allocated) + Dr Supplier Advance 1400 (unapplied) / Cr paid-through acct | ✅ posting; ❌ **edit/delete hard-deletes the posted journal** (`purchasing/repository.go:641-660`) |
| **Purchase return / vendor credit** | Dr AP (return total) / Cr Inventory (movement cost) + Cr VAT 1300 + plug → 5020 | ⚠️ invoice-less credits post **tax=0** (VAT never reversed); valuation variance silently dumped into 5020; open credits are never applicable to later bills |
| **Expense** | Dr expense acct / Cr paid-through | ✅ posting; ❌ **delete hard-deletes the posted journal**; ❌ no VAT |
| **Bakery advance payment** | Dr payment acct / Cr Customer Advance 2200 | ✅ concept; ❌ **fails entirely at non-primary branches** (fallback-only account resolution) |
| **Bakery order completed** | Dr Advance 2200 + Dr AR 1100 / Cr Bakery Income 4010 + Cr charges + Cr VAT 2100 | ⚠️ posts with `EntryDate=time.Now()` (wrong period for backdated completions); recognition at `completed`, not delivery |
| **Bakery COGS / inventory** | **nothing** | ❌ CRITICAL — no ingredient/FG relief ever |
| **Bakery cancellation / refund** | **nothing** — no reversal journal, no refund path (migration 000087 excludes `bakery_order`) | ❌ CRITICAL |
| **Manufacturing batch completed** | Dr WIP 1210 / Cr Inventory (consumption); Dr Inventory / Cr WIP (output); Dr Wastage 5080 / Cr Inventory | ✅ shape; ⚠️ no labor/overhead; WIP rounding residue never clears; completed batches can't be reversed |
| **Stock adjustment in/out, wastage, opening stock** | Dr/Cr Inventory vs 4100/5090/5080/3400 | ✅; ⚠️ cost=0 movements post nothing |
| **Manual `return_in` movement** | **nothing** — poster defers to sales-return path that never matches | ❌ stock value rises with no ledger entry |
| **Stock transfer** | nothing (intra-branch location move, qty unchanged) | ✅ correct |
| **Purchase receipt cancel / return reversal stock legs** | adjustment movements created **without** calling the poster | ⚠️ unlinked movements flagged by reconciliation |
| **POS refund of `sales_return` source** | skipped to avoid double-posting | ✅ |

---

## D. Journal audit

Verified against the dev database:

- **0 unbalanced journals**; global Dr = Cr = 1,052,929.37. ✅
- **0 cross-branch lines** (line's account branch vs journal branch). ✅
- Statuses: 88 posted, 8 reversed, 0 draft. 17 source types in use.
- **Missing journals are all legacy (pre-June-2026) documents** created before posting was wired: 6 posted purchase bills (May 30–Jun 1), 8 completed production batches (May 7–Jun 10), 6 of 8 bakery payments. Current-dated documents all have journals. → this is a **backfill problem, not a current-code problem**.
- 7 of 28 sales have no COGS journal (known zero-cost/no-movement legacy issue; 8 sales in one business have no `sale_out` movements at all).

Structural defects:

| # | Defect | Severity |
|---|---|---|
| D1 | **No DB idempotency index** on `(business, source_type, source_id)`; Go check-then-insert is non-atomic → concurrent double-posting possible. Deferred pending duplicate cleanup — cleanup never ran. | HIGH |
| D2 | **Reversals write `journal_entry_lines.branch_id = NULL`** — both paths (`service.go:3713-3725`, `1913-1924`). Every reversal silently bypasses the 000095 FKs (`MATCH SIMPLE` ignores NULL) and permanently blocks the planned `SET NOT NULL` hardening. | HIGH |
| D3 | **Posted journals are physically deleted** by expense delete and supplier-payment edit/delete (`expenses/repository.go:308-321`, `purchasing/repository.go:641-660`) instead of reversal. Audit trail destroyed; closed periods silently mutate. | CRITICAL |
| D4 | No DB constraint that debits = credits or that header totals match lines; balance enforced Go-side only, with ±0.005 rounding residue absorbed into the largest line. | MEDIUM |
| D5 | Bill-edit replacement journals carry a random `source_id` → orphaned from source-based lookups, drill-through, and backfills. | MEDIUM |
| D6 | Soft-deleting a single line (`jel.deleted_at` honored by every report filter) would silently unbalance the ledger; nothing prevents it. | MEDIUM |
| D7 | Journal `entry_date` is a bare DATE while operational events carry tz-aware timestamps; Asia/Dubai evening sales land on the wrong ledger day. Bakery revenue journals use `time.Now()` instead of the completion/event date. | MEDIUM |
| D8 | `accountingService == nil` guards make posting **optional** for POS sales, bills, supplier payments (silently skipped) but mandatory for returns — a mis-wired deployment produces documents with no journals and no errors. | MEDIUM |

---

## E. Financial statement audit

**Trial Balance** (`accounting/repository.go:2462-2516`): posted+reversed only, opening/period/closing computed correctly, branch-required. Dr=Cr is *reported* (`is_balanced`) but never enforced. One real trap: the account join filters `coa.branch_id = ?`, so any line whose account belongs to another branch or whose branch is NULL **drops off the account side while staying in the totals** — producing an unexplainable imbalance with no diagnostic (this is exactly what D2's NULL-branch reversal lines will eventually do).

**Balance Sheet**: derives from the ledger, but Retained Earnings is **computed, not posted** — current-year P&L is re-run from the financial-year start and appended as a synthetic 3200 row. Consequences: (1) after year one, prior-year profit belongs in 3100 and nothing puts it there → `Assets ≠ L+E` forever; (2) any genuine 3200 journal double-counts; (3) the reconciliation endpoint faithfully reports the imbalance as a failure with no remedy.

**P&L**: classification purely by `account_type` — clean. Refunds deduct only because refund journals debit income; VAT correctly excluded. Distortions come from upstream: missing bakery COGS (overstates gross profit on every custom order), `refund_mode='none'` reversing COGS but not revenue, adjustment gains typed as income.

**General Ledger**: correct per-account running balance (single-account mode); combined mode has no running balance. No consolidated multi-branch statement exists — every statement requires exactly one branch.

**Reports/dashboard divergences** (why "the numbers don't match"):

1. Dashboard revenue/collected/refunds = operational; dashboard AR/AP = ledger. Same screen, two truths.
2. Financial gross sales uses `sale_status <> 'voided'` → **includes draft and held sales** (`reports/repository.go:3079`), and uses `total_amount` (VAT-inclusive) where the P&L is VAT-exclusive.
3. With `all_branches` selected, ledger-backed widgets (AR/AP/tax) resolve ONE branch's account via `LIMIT 1` — business-wide numbers are silently single-branch.
4. Bakery payment widget omits the cancelled-order filter every other query uses → cancelled orders count as collected.
5. Bakery revenue is in the ledger but absent from sales-report queries (they read `sales` only).
6. Timestamp vs DATE mismatch shifts evening transactions across days (Asia/Dubai).

---

## F. Inventory accounting audit

**Valuation method: moving weighted average, perpetual, per branch-scoped inventory item**, with fallback to product/variant `cost_price` for outbound movements when the item has no cost. No FIFO, no cost layers; expiry batches carry quantity only.

**Verified divergence (dev DB): operational stock value 34,377.67 vs ledger Inventory 1200 = 24,244.23 (~30% gap).** The contributing mechanisms, all found in code:

1. Legacy documents with stock but no journals (6 bills, 8 production batches — backfill).
2. Bakery/manufacturing FG accumulating with no delivery relief (CRITICAL, §Bakery).
3. `cost <= 0` movements change quantity with no journal (silent skip).
4. Manual `return_in` posts nothing.
5. Received-not-billed stock (bill-only policy) — quantity exists, no ledger value, by design.
6. Reversal movements re-price at *current* average instead of original cost → residue strands in 1200/4100/5090.
7. `inventory_value` floored at 0 desyncs from `qty × avg_cost` with no compensating entry.
8. The `sale_movement_costs` repair rewrites movement costs but not item `inventory_value`/`average_unit_cost` — the repair itself creates divergence.
9. WIP 1210 rounding residue per batch (currently 0.01 in dev — real but small).

The reconciliation endpoint (operational vs 1200 with per-item reason codes) is the right tool and already names most of these (`missing_cost`, `pending_bill_posting`, `pos_cogs_missing_journal`).

---

## G. Branch accounting audit

Enforcement is **service-layer, not middleware**: branch scope resolved at auth (`auth/service.go:1077-1124`), primitives in `shared/utils/branch_scope.go`. Accounting uses its own *hard* guards (unconditional 404 on branch mismatch) for all list/read/report paths — a branch user cannot read another branch's journals or statements. Statements require an explicit single branch.

Verified: 0 cross-branch journal lines in data; the 2026-08-10 CoA-resolution fix holds.

Remaining gaps:

| # | Issue | Severity |
|---|---|---|
| G1 | Reversal lines NULL `branch_id` (= D2) — keeps 000095 FKs permanently `NOT VALID`; nothing in code or ops has run `VALIDATE CONSTRAINT`/`SET NOT NULL`. | HIGH |
| G2 | Setup-readiness leaks **all branches'** names + payment/chart account names to any branch-scoped `view` user (`accounting/repository.go:1517-1643`). | MEDIUM |
| G3 | GL with an explicit `account_id` returns another branch's account metadata (`repository.go:388`). | LOW-MED |
| G4 | Business-wide expense list for all-branch users without the explicit `all_branches` opt-in other modules require. | LOW-MED |
| G5 | Purchasing-posting-integrity endpoint exposes business-wide counts under mere `view`. | LOW |
| G6 | `BRANCH_GUARD_ENFORCE` staged rollout has **no operator-visible signal** — the violation counter has no production caller, so there's no way to know when it's safe to flip. | MEDIUM |
| G7 | All-branch access still grantable by role *name* "admin"; allowed-branch set includes deleted branches. | LOW |
| G8 | `all_branches` ledger widgets pick one branch via `LIMIT 1` (= E3) — a correctness bug wearing an isolation costume. | HIGH (reporting) |

---

## H. Payment accounting audit

The three-layer design is right: `payment_methods` → `payment_accounts` (branch-scoped, carries `chart_account_id`) → `payment_method_account_mappings` (per business+branch+method).

**The defect is that only some callers use it.** Resolution paths in use today:

| Caller | Resolution | Non-primary branch outcome |
|---|---|---|
| POS checkout / AR payments | mapping + fallback (branch-aware) | ✅ works |
| Supplier payments | resolved at write, stored FK | ✅ works (snapshot never heals) |
| Purchase invoice payments | **fallback only** (`default_payment_account_id`) | ❌ hard-fails |
| POS refunds | **fallback only** | ❌ hard-fails — **refunds impossible at branch 2+** |
| Bakery order payments | **fallback only** | ❌ hard-fails |
| Sales-return refunds | **fallback only** | ❌ hard-fails |
| Expenses | separate raw CoA FK, validated against payment_accounts | ✅ different mechanism entirely |

`default_payment_account_id` is seeded from **branch #1 only** (`accounting/service.go:629-635`, reaffirmed by migrations 000091/000092), so every fallback-only path resolves a branch-1 account, then the branch validator correctly rejects it, and the whole transaction fails. The guard converted silent misposting (pre-Aug-10 corruption) into hard failure — better, but the flows are still dead at non-primary branches.

Other payment findings: refunds never restore AR on partially-paid credit sales (Dr 4040/Cr Cash, AR stays); card capture debits 1030 with no settlement mechanism (see B); supplier-payment and purchase-invoice-payment refunds don't exist; expenses have no VAT.

---

## I. Root cause analysis

Five root causes explain ~90% of the symptoms:

**RC1 — Dual sources of truth, no reconciliation loop closure.**
Statements read the ledger; dashboards, sales reports, supplier/customer balances read operational tables with their own filters. The abandoned ledger-revenue path (`LedgerFinancialTotals`, no callers) shows the migration was started and dropped. → E1-E6, supplier balance ≠ AP, customer balance ≠ AR, "wrong balance report".

**RC2 — Posting is per-module wiring, not a mandatory pipeline.**
Each module hand-wires its own posting calls, optionally (`if accountingService != nil`), with its own account-resolution shortcut and its own reversal (or none). That's why POS refunds ≠ sales returns, why four payment-resolution paths exist, why bakery cancellation posts nothing, and why two modules delete posted journals. → C/D/H defects.

**RC3 — Lifecycle asymmetry: create posts, undo doesn't.**
Reversals were bolted on per flow: missing branch_id, missing VAT legs, re-priced costs, hard deletes, no bakery refund source. The ledger is only append-correct. → D2, D3, refund defects, bakery cancellation.

**RC4 — The period model is unfinished.**
No opening balances (except stock), no year-end close, computed-not-posted retained earnings, DATE-typed entry dates fed from tz-aware timestamps, no period locking (posted journals mutable via hard delete). → BS imbalance, "trial balance looks wrong", period drift.

**RC5 — The bakery/manufacturing cost chain stops half-way.**
Manufacturing correctly capitalizes finished goods; nothing relieves them on delivery, and orders that skip the manufacturing module consume nothing at all. Deliberately parked as open decision §1 — it is the single biggest P&L distortion for a pastry business. → bakery COGS, inventory overstatement.

Cross-cutting hygiene (real, but not root): float64 money, no DB Dr=Cr constraint, no DB idempotency index, legacy backfill gaps (the dev DB's missing journals are all pre-June documents).

---

## J. Recommended target architecture (Zoho-style, adapted to this codebase)

The goal your owner/accountant asked for — "understandable without inspecting the database" — maps to five rules:

1. **One posting pipeline.** A single `accounting.PostingService` with a typed event contract: every business module emits `AccountingEvent{source_type, source_id, branch, event_date(tz-aware), lines-by-mapping-key}`; only the accounting module turns mapping keys into accounts and writes journals. Mandatory (no nil-guards), transactional, idempotent via a DB unique index. Every event type declares its **reversal** up front — a flow that can't reverse doesn't ship. This dissolves RC2/RC3 without a big-bang rewrite: the 46 existing call sites migrate one flow at a time.
2. **The ledger is the only financial truth.** Dashboards and financial reports read ledger balances (revive the dead `LedgerFinancialTotals` path); operational tables keep powering *operational* screens (order lists, stock levels). Supplier/customer balances become AP/AR ledger drill-downs (Zoho's model exactly). The `consistency_warnings` engine stays as the watchdog that the two views agree.
3. **Documents, not journals, in the UI.** Keep born-posted system journals (Zoho does the same — users see invoices and payments; the journal is a detail view). Manual JVs keep the draft flow. Add: no deletion of posted anything — void/reverse only — and period lock after close.
4. **Finish the period model.** Opening-balance entry screen (Cr/Dr per account vs 3400, one-time per go-live); year-end close posting income/COGS/expense into 3100; entry timestamps carried tz-aware and bucketed consistently with reports.
5. **CoA: keep 82 codes, add the 6 headline groups.** The seeded chart is already Zoho-shaped. Set `parent_account_id` to group under Assets/Liabilities/Equity/Income/COGS/Expenses for readable statements; retire or wire the dead accounts (2050 GRNI pending the §3 decision, 5000/5010/5050/5060, 6240, 6250, 4090); route bill discounts to 4030; retype 4100 out of income or net it under COGS.

**Explicit business decisions needed from your accountant** (they gate the design, listed in `backend/docs/open-accounting-decisions.md`):
- When does a bakery order consume stock — at production completion, delivery, or completion? What about non-produced (resale) items on orders?
- Should VAT be due on advances (jurisdiction-dependent — UAE: generally yes on receipt)?
- GRNI accrual at receipt vs bill-only (current)?
- What does `refund_mode='none'` mean commercially?
- Card settlement flow: when/how does 1030 clear to 1010, and who records fees?

---

## K. Fix priority

### CRITICAL — the app is wrong or broken today
| # | Fix | Root cause |
|---|---|---|
| K1 | `stock_movements.deleted_at` phantom filter crashes void-sale & sales-return (`pos/service.go:964`, `salesreturns/service.go:973`) — **verified live SQL error** | hygiene |
| K2 | Bakery COGS/inventory relief (after accountant answers the consumption-timing question) + bakery cancellation reversal + bakery refund source in 000087 | RC5, RC3 |
| K3 | Stop hard-deleting posted journals (expenses delete, supplier-payment edit/delete) → reverse instead | RC3 |
| K4 | Branch-aware account resolution for the four fallback-only paths (POS refunds, bakery payments, sales-return refunds, purchase-invoice payments) — refunds are impossible at non-primary branches today | RC2 |

### HIGH — ledger integrity & correctness
K5 reversal lines must carry `branch_id` (both paths) · K6 DB idempotency index after duplicate cleanup (backfill Step 6) · K7 POS refund parity with sales returns (VAT/COGS/restock/AR) — ideally collapse into ONE refund path · K8 year-end close + opening balances · K9 invoice-less vendor credits VAT reversal · K10 `all_branches` `LIMIT 1` ledger widgets · K11 legacy backfills (6 bills, 8 batches, 6 bakery payments, 7 COGS-less sales) via existing backfill endpoints + operator runbook Steps 2–7 · K12 gross-sales report status/VAT alignment with `reportshared` predicates.

### MEDIUM
Card clearing settlement flow · expense VAT · reversal re-pricing at original cost · manual `return_in` posting · bill-edit phantom `source_id` + edit-to-zero stale journal · Dr=Cr DB constraint · entry-date timezone handling · adjustment-gain account typing · supplier-balance query vs AP ledger alignment · branch-guard rollout signal (wire the violation counter) · setup-readiness cross-branch metadata leak · open vendor credits applicable to later bills.

### LOW
Flat CoA → grouped hierarchy · retire dead accounts · bill discounts → 4030 · float64 → integer minor units (large but mechanical; schedule deliberately) · role-name-based all-branch access · deleted branches in allowed set.

### Suggested sequencing
1. **Stop the bleeding (days):** K1, K3, K4, K5 — small, surgical, no schema changes.
2. **Decisions workshop with accountant (1 session):** the five questions in §J. Everything bakery-related waits on this.
3. **Data repair (operator runbook, existing docs):** K11 backfills + duplicate cleanup → K6 index → validate 000095 constraints.
4. **Unify refunds & reversals (K7, K9, and the reversal contract of §J.1).**
5. **Period model (K8), then reports-read-ledger (RC1)** — this is the point where "wrong balance report" becomes structurally impossible rather than patched.
6. **Zoho-style polish:** CoA grouping, statement presentation, drill-downs.

---

## Appendix: verified data snapshot (dev DB, 2026-08-12)

```
journals: 88 posted, 8 reversed | unbalanced: 0 | global Dr=Cr: 1,052,929.37
cross-branch lines: 0 | CoA: 82 codes / 864 branch rows / 0 dupes
missing journals (all legacy, pre-2026-06-10):
  purchase bills 6/16 · production batches 8/14 completed · bakery payments 6/8
sales without COGS journal: 7/28
inventory: operational 34,377.67 vs ledger(1200) 24,244.23  → gap 10,133.44
```

Pending operator actions from the 2026-08-10 stabilization remain unexecuted (see `backend/docs/accounting-branch-backfill.md`): payment-account repointing, historical line remap, 000095 constraint validation, idempotency index, AR relief backfill.

*Read-only audit: no journals, accounts, mappings, balances, or documents were modified.*
