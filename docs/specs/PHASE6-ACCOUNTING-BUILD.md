# EPIC: Phase 6 — Opening Balances, Ledger-Backed Trends, Chart Hierarchy, Decimal Money

**Source:** Phase 5 out-of-scope list (`docs/specs/PHASE5-ACCOUNTING-BUILD.md:42`), open accounting decisions §4/§5/§6 (`backend/docs/open-accounting-decisions.md`), accounting audit 2026-08-12 recommendation #4.
**Preconditions (done):** Phases 1–5 complete on main through `dea4ec2`. Migrations applied through `000106`. Phase 6 migrations start at **`000107`**.

## Context

Phase 5 made the ledger authoritative and protected history, but three gaps remain from the audit and one long-deferred piece of technical debt is now the largest single risk to figure accuracy.

Opening balances exist for exactly two things: inventory stock and cash/bank payment accounts. Every other account — prepaid expenses, fixed assets, loans, owner capital — has no way to carry a go-live balance except a manual JV against 3400, and **AR/AP cannot be opened at all**, because 1100/2000 are control accounts with no subledger. A business migrating mid-year cannot state what its customers owed it on day one.

The financial trend chart is the last money report still computed entirely from operational tables, so it can disagree with the summary and dashboard that now read journals. The chart of accounts is 75 flat accounts with an unused `parent_account_id`, so statement grouping is improvised client-side from `account_group`. And money is `float64` end to end, which is why a rounding-residue absorber, a `0.05` drift epsilon, and roughly fifteen inline tolerance literals exist at all.

## Child issues & dependency graph

```
W0 Phase 5 carry-over ──> W1 Opening balances ──┐
                                                 ├──> W4 float64 → decimal
                          W2 Ledger trend ───────┤
                          W3 CoA hierarchy ──────┘
```

| # | Title | Depends on | Effort | Order |
|---|---|---|---|---|
| W0 | Phase 5 W4 carry-over: ledger-backed outstanding/payables headers | — | ~1d | 1st |
| W1 | Generic opening balances + per-counterparty AR/AP subledger | W0 | ~4d | 2nd |
| W2 | Ledger-backed trend report | — (parallel with W1) | ~2.5d | 2nd |
| W3 | Chart of accounts hierarchy | — (**blocked on a business decision**) | ~3d | 3rd |
| W4 | float64 → decimal money | W1–W3 | ~18–24d | last |

**Sequencing rationale.** W0 first because W1 changes what the AR/AP ledger balance *is*, and shipping the ledger-backed headers on top of a moving number makes both changes unreviewable. W1 before W4 so the new subledger is written once. **W4 last, deliberately**: it is mechanical and touches ~934 rounding call sites across 94 files, so it should absorb the Phase 6 feature code rather than force every feature to be written twice. W3 can slip without blocking anything — it is presentation only.

**W4 is larger than W1–W3 combined.** It is specified here for completeness, but the honest recommendation is to run it as its own phase with its own QA window against a production snapshot, not to squeeze it into the tail of this one.

## Decided defaults (raise objections at review, silence = agreed)

1. Opening balances reuse **`accounting.accounts.manage`** — no new permission this phase (carried from Phase 5 decision #4).
2. **One opening mechanism per account.** The generic editor refuses accounts already covered by a dedicated mechanism — payment accounts' chart accounts (W3 of Phase 5), inventory 1200, and AR/AP 1100/2000 (which go through the counterparty editor instead). Otherwise two paths post to 3400 for the same asset and it double-counts.
3. Per-counterparty AR/AP follows the **`customer_credits` precedent**: a subledger table keyed to the control account, carrying `journal_entry_id`, plus a drift-reporting reconciliation. Journal lines do **not** gain `customer_id`/`supplier_id` columns.
4. **One journal per counterparty**, keyed on the counterparty UUID, so editing one customer's opening reposts only that customer (mirrors W3's repost-on-edit).
5. Opening balances are **corrected by editing (repost)**, not by reversal — same contract as `payment_account`, opposite to `inventory_opening_stock`. Registry rationale must say so.
6. The operational AR/AP sums are **taught to include openings** in the same commit that starts posting them. Without this, every reconciliation screen and the dashboard go red on day one.
7. The trend report keeps the **`{labels, datasets}` response shape** and adds `source_of_truth` + `consistency_warnings` as siblings. `parseTrend` ignores unknown keys, so this is additive; a `{buckets:[…]}` reshape would silently render an empty chart.
8. The trend aggregates with **2–3 grouped SQL queries**, never by calling `LedgerFinancialTotals` per bucket (8 queries × N buckets — a 90-day daily trend would be 720 round trips).
9. Trend metrics are **flows only** (revenue, collected, refunded, tax). `OutstandingCustomer`/`SupplierPayable` are cumulative as-of balances and are meaningless as per-bucket trend series.
10. Header accounts get a **new explicit `is_header` column**, not a reuse of `allow_manual_posting` — that flag is already `false` on control accounts the system posts to automatically, so overloading it would either unblock headers or block AR/AP.
11. **W3 does not ship until the grouping scheme is supplied** by the owner/accountant (see the open decision below). No grouping will be inferred from the code.
12. W4 sets **`decimal.MarshalJSONWithoutQuotes = true`** so the JSON wire format stays byte-identical and the frontend needs zero changes. String-serialized decimals are a separate, later decision.
13. No feature flags — each child merges only when its QA passes, so main stays releasable.

## Open decision — blocks W3

**What is the intended chart-of-accounts grouping?** Building a hierarchy means naming the header accounts and assigning all 75 seeded accounts to them (e.g. "Current Assets" → 1000/1010/1020/1030/1100/1200/…, "Operating Expenses" → 6000–6260). That is an accounting presentation decision owned by whoever owns the chart. Two sub-questions come with it:

- Should headers be **seeded per branch** (consistent with the branch-scoped chart) and therefore become part of branch readiness checks?
- Should statement grouping **move server-side** (backend emits group rows) or stay client-side with headers merely re-parenting the existing middle level? The balance sheet and trial balance already render a two-level group structure from `account_group`; P&L has no middle level at all.

Until this is answered, W3 stays specified but unstarted.

---

# W0 — Phase 5 carry-over: ledger-backed outstanding/payables headers

## Context
Phase 5 W4 item 3 (`PHASE5-ACCOUNTING-BUILD.md:177`) specified ledger-backed header totals for `/financial/outstanding-balances` and `/financial/supplier-payables` with row-sum drift warnings. It was not implemented — `ledgerDriftWarnings` has exactly two call sites today (`reports/repository.go:2195` FinancialSummary, `:2560` paymentsSummary). Closing it first keeps W1 reviewable.

## Current state (verified 2026-08-14)
- `FinancialOutstandingBalances` (`reports/repository.go:2292`) and `FinancialSupplierPayables` (`:2307`) are fully operational; per-entity rows come from `financialOutstandingRowsSQL` (`:3027-3072`).
- `shared.LedgerMappedBalance` (`reports/shared/metrics.go:474`) already returns the 1100/2000 control balance and is used by the dashboard (`dashboard/repository.go:66`, `:252`).

## Proposed change
1. Header totals for both endpoints read `LedgerMappedBalance` (`accounts_receivable`/`accounts_payable`); supplier advances (1400) surfaced as a separate figure rather than netted.
2. Per-entity rows stay operational (control accounts have no subledger **until W1**), with a `operational_ledger_drift_<metric>` warning when the row sum diverges from the header beyond `ledgerDriftEpsilon`.
3. `SourceOfTruth` on both responses becomes `journal_entries` for the header, documented in the response as header-only.
4. Extend the guard map in `reports/ledger_drift_test.go:65` to require `LedgerFinancialTotals`/`ledgerDriftWarnings` in both new functions.

## Acceptance criteria
1. Both endpoints return ledger-backed headers matching dashboard AR/AP to the cent on seeded data.
2. Deleting one journal in a fixture produces a row-sum drift warning rather than a silently wrong header.
3. Per-entity rows unchanged byte-for-byte.
4. Guard test fails if either function loses its ledger call. Full suites green.

## Testing plan
| Layer | What | Count |
|---|---|---|
| Unit | header/row-sum drift builder | +2 |
| Integration | both endpoints vs dashboard parity, drift injection | +3 |
| E2E (QA) | outstanding balances screen vs dashboard | 1 flow |

## Rollback
Revert; operational paths retained.

---

# W1 — Generic opening balances + per-counterparty AR/AP

## Context
Audit recommendation #4 and the go-live blocker at `ACCOUNTING-AUDIT-2026-08-12.md:86`. Phase 5 shipped payment-account openings only and documented the manual-JV-against-3400 workaround for everything else. AR/AP cannot use even that workaround cleanly, because 1100/2000 have `allow_manual_posting = false`.

## Current state (verified 2026-08-14)
- Template to generalize: `accounting/payment_account_opening.go` (170 lines) — pure line builder at `:67`, post-or-repost at `:86` (clear-first at `:99-101` to free the 000096 idempotency slot), clear at `:142`.
- 3400 resolves via `requiredMappedAccount(tx, businessID, branchID, "opening_balance_equity", "3400", …)` (`accounting/service.go:5706`).
- Subledger precedent: `accounting/customer_credit.go` — table with `customer_id`/`journal_entry_id`/`balance` (`:21-38`) plus `CustomerCreditReconciliation` drift check (`:187-235`).
- Operational AR/AP sums that must learn about openings: `SumAccountsReceivableOperational` (`accounting/repository.go:3271`), `SumAccountsPayableOperational` (`:3259`), `customers/repository.go:390`, `suppliers/repository.go:297`.
- `SupplierStatementResponse.OpeningBalance` (`suppliers/dto.go:155`) already means *statement-period* opening — **do not reuse the name**.
- Chart is branch-scoped (000092); every branch has its own 1100/2000/3400 row.

## Proposed change
1. **Migration `000107_opening_balances.sql`**:
   - `chart_account_opening_balances` — `(id, business_id, branch_id, chart_account_id, amount numeric(14,2), opening_date date, journal_entry_id uuid, created/updated/deleted)`, unique active on `(business_id, branch_id, chart_account_id)`.
   - `counterparty_opening_balances` — `(id, business_id, branch_id, party_type text CHECK IN ('customer','supplier'), party_id uuid, amount numeric(14,2), opening_date date, journal_entry_id uuid, …)`, unique active on `(business_id, branch_id, party_type, party_id)`.
   - No new permission.
2. **Source types** in `refund_contract.go`: `SourceAccountOpeningBalance = "account_opening_balance"`, `SourceCounterpartyOpeningBalance = "counterparty_opening_balance"`; both registered in `reversalContracts` with the repost rationale (registry test at `refund_contract_test.go:58` enforces).
3. **Posting** (new `accounting/opening_balances.go`, mirroring `payment_account_opening.go`):
   - Per chart account: Dr the account / Cr 3400 for a debit-normal balance, mirrored for credit-normal. `source_id` = chart account UUID.
   - Per counterparty: Dr 1100 / Cr 3400 (customer) or Dr 3400 / Cr 2000 (supplier). `source_id` = the customer/supplier UUID, so one journal per counterparty.
   - All via `createPostedSystemJournal` — inherits idempotency, branch stamping, and the W1 period guard. Posts to `allow_manual_posting = false` accounts legitimately, because the system line builder does not check that flag (`service.go:5604`).
   - Repost-on-edit: clear first (frees the idempotency slot), `EnsurePeriodOpenForJournals` on the old journal, `EnsurePeriodOpen` on the new date, then post.
4. **Eligibility guard** (decided default #2): reject chart accounts that are a payment account's `chart_account_id`, are 1200 inventory, or are 1100/2000 — each with a message naming the correct editor.
5. **Reconciliation**: extend `GetARReconciliation`/`GetAPReconciliation` (`accounting/service.go:4052`/`:4030`) so the operational side adds `SUM(counterparty_opening_balances.amount)`; same for `customers/repository.go:390` and `suppliers/repository.go:297` per-entity outstanding, and the W0 row sums. Add a `CounterpartyOpeningReconciliation` mirroring `CustomerCreditReconciliation`.
6. **API**: `GET/PUT /api/v1/accounting/opening-balances/accounts`, `GET/PUT /api/v1/accounting/opening-balances/counterparties`, plus `GET …/summary` returning the 3400 balance and a "still unallocated" figure — the number that must reach zero at go-live.
7. **Frontend**: new route `accountingOpeningBalances` → `/accounting/opening-balances`, hub card in `accounting-page-client.tsx:146-178`, page client with two tabs (Accounts / Customers & Suppliers), each an editable grid with amount + as-of date and a running 3400 total. Dialog patterns copied from `settlement-pages.tsx:269`. Field named `openingBalanceAmount`, never `openingBalance`, to avoid the supplier-statement collision.

## Acceptance criteria
1. Opening 5,000 on 1500 Prepaid Expenses at FY start → Dr 1500 / Cr 3400, branch-stamped; balance sheet shows both.
2. Customer opening 1,200 → Dr 1100 / Cr 3400; that customer's outstanding balance and the AR reconciliation both include it, and the reconciliation reports **no** drift.
3. Supplier opening 800 → Dr 3400 / Cr 2000; AP reconciliation clean.
4. Editing an opening leaves exactly one live posted journal for that source; deleting clears it and returns 3400 to its prior balance.
5. Opening dated inside a locked period → 422 on create and on both edit directions.
6. A payment account's chart account, 1200, 1100 and 2000 are all rejected from the generic editor with the message naming the right screen.
7. The summary endpoint's unallocated-3400 figure reaches 0.00 once every opening is entered.
8. Registry, period-lock, safe-delete and branch-scope guard tests green; full suites green.

## Testing plan
| Layer | What | Count |
|---|---|---|
| Unit | line builder per normal balance ±, counterparty Dr/Cr direction, repost lifecycle, locked period, eligibility rejections | +8 |
| Integration | create/edit/delete with ledger assertions, AR/AP reconciliation stays clean, 3400 summary | +6 |
| E2E (QA) | opening-balances screen → balance sheet → AR reconciliation | 1 flow |

## Rollback
Revert; new tables are additive and unread by any other path. Openings already posted must be deleted through the UI first (or their journals soft-deleted) or 3400 strands a balance.

---

# W2 — Ledger-backed trend report

## Context
Audit RC1's last holdout. `/reports/financial/trend` is the only money chart still computed from `sale_payments`/`bakery_order_payments`/`payment_refunds` while the summary and dashboard read journals.

## Current state (verified 2026-08-14)
- Route `reports/routes.go:67` → handler `:314` → service `reports/service.go:563-583` → `financialTrendSQL` (`reports/repository.go:3348-3420`), a 3-arm `UNION ALL` over operational tables.
- Row struct `trendSeriesRow` (`repository.go:25-29`) is mislabelled: `NetSales` carries *collected*, `SalesCount` carries *refunded*.
- **Two pre-existing bugs to fix here:** labels are always `2006-01-02` even at month granularity (`service.go:568`, while `formatBucket` at `repository.go:3759` exists and is unused on this path); and `DATE_TRUNC` runs on `timestamptz` in the Postgres session timezone, not the request timezone, so buckets can straddle midnight Dubai. Ledger `entry_date` is a plain `DATE`, so the conversion fixes the second one for free.
- `shared.ChartResponse` (`shared/chart_helpers.go:8-11`) has no warnings field.
- Frontend consumer chain is single: `financial-reports.ts:396` → `parseTrend:305` (reads only `labels` + `datasets[].{label,data}`, ignores unknown keys) → `financial-trend-chart.tsx`.

## Proposed change
1. New `shared.LedgerFinancialTotalsByPeriod(db, scope, startUTC, endUTC, groupBy)` in `reports/shared/metrics.go` returning `[]{Bucket time.Time; FinancialTotals}` — implemented as 2 grouped queries (income/tax; payment-account debits/credits) with `DATE_TRUNC('<day|week|month>', je.entry_date)`, `status IN ('posted','reversed')`, and an **explicit** `source_type <> 'year_end_close'` guard. Add its placeholder counts to `shared/metrics_args_test.go`.
2. `FinancialTrend` returns ledger buckets; `financialTrendSQL` is retained as the cross-check. Drift is emitted **once per metric over the whole window**, not per bucket, to avoid warning explosion on long ranges.
3. New `FinancialTrendResponse` in `reports/dto.go`: `{labels, datasets, source_of_truth, consistency_warnings}` — a superset of `ChartResponse`, so `parseTrend` keeps working untouched.
4. Fix the month/week label bug by routing through `formatBucket`.
5. Frontend: extend `parseTrend` and the trend card to render warnings, reusing the block at `financial-summary-cards.tsx:37-58`.
6. Extend the guard map in `ledger_drift_test.go:65` with `FinancialTrend`; update the comment at `ledger_drift.go:18-20` and `PHASE5-ACCOUNTING-BUILD.md:36` that currently declare trends permanently operational.
7. Add `CREATE INDEX … ON journal_entries (business_id, branch_id, entry_date) WHERE deleted_at IS NULL` in **`000108_journal_trend_index.sql`** only if `EXPLAIN` on a year of daily buckets shows the existing `(business_id, entry_date)` index is insufficient.

## Acceptance criteria
1. Trend returns `source_of_truth: "journal_entries"`; on clean seeded data every bucket matches the previous operational output to the cent.
2. Trend collected/refunded totals summed over all buckets equal the summary's figures for the same window.
3. Month granularity labels render as `2026-01`, not `2026-01-01`.
4. A deleted fixture journal produces a drift warning rather than a silently wrong series.
5. A 365-day daily trend issues a constant number of queries (verified by query counter), not one set per bucket.
6. Buckets containing a year-end close journal are unaffected by it. Full suites green.

## Testing plan
| Layer | What | Count |
|---|---|---|
| Unit | bucket builder, granularity labels, year-end-close exclusion, drift aggregation | +5 |
| Integration | trend-vs-summary parity, drift injection, query-count assertion | +4 |
| E2E (QA) | reports page trend chart across all three granularities | 1 flow |

## Rollback
Revert; operational path retained as cross-check.

---

# W3 — Chart of accounts hierarchy

**Blocked on the open decision above. Do not start without the grouping scheme.**

## Context
Open decision §4. `parent_account_id` exists (`000041:6`), the API resolves and validates it (`service.go:4574-4599`), the create/edit dialog already offers a parent picker (`chart-account-form-dialog.tsx:307-328`) — but no seed sets a parent, so the chart is flat and grouping is improvised client-side from `account_group`.

## Current state (verified 2026-08-14)
- 75 seeded accounts, `DefaultChartAccountSeeds()` (`seeder.go:22-100`); `defaultAccountSeed` has no `Parent` field; `SeedDefaultChartOfAccounts` never sets `ParentAccountID` (`:118-132`).
- `validateParentAccount` rejects self-parent and walks 50 levels, but has **no full visited-set cycle check**, no type-compatibility check, and no "parent must be a header" concept.
- No `is_header`/`is_postable` column. `allow_manual_posting` is the only postability signal and is already `false` on control accounts the system posts to.
- Balance sheet (`repository.go:2905`) and P&L (`:2749`) build `FROM journal_entry_lines` **INNER JOIN** chart accounts, so a header with no postings physically cannot appear. Trial balance is a **LEFT JOIN** (`:2731`), so headers *will* appear as zero rows when "include zero balances" is on.
- Adding headers to the seed list changes `expectedChartAccountCount` and `missing_account_codes` (`service.go:3373-3402`) and the branch readiness gate.
- The dialog's parent picker only offers accounts on the **current 25-row page** (`chart-of-accounts-page-client.tsx:804`).
- Unused `chart-accounts-table.tsx` (147 lines) is a ready-made flat table shell with a Parent column.

## Proposed change
1. **Migration `000109_chart_account_headers.sql`**: `chart_of_accounts + is_header boolean NOT NULL DEFAULT false`; insert the agreed header accounts per (business, branch); set `parent_account_id` on the 75 existing accounts per the agreed scheme. Register the new column in the schema-drift list at `database/postgres.go:160`.
2. **Seeder**: `defaultAccountSeed` gains `Parent string` (parent account *code*) and `IsHeader bool`; `SeedDefaultChartOfAccounts` resolves parent codes to same-branch IDs in a second pass. Update the readiness expected-count logic.
3. **Postability**: reject `is_header` accounts in `buildJournalLines` (`service.go:4549`, next to the existing `AllowManualPosting` check) **and** in the system line builder (`:5604`) — the system path currently checks neither, so a mis-mapped header would post silently. Also close the weakest gate found: `purchasing/service.go:3415` `purchaseBillAccount` checks no branch, no type, and no postability.
4. **Validation**: `validateParentAccount` gains a proper visited-set cycle check, a "parent must be `is_header`" rule, and a same-`account_type` rule.
5. **Statements**: trial balance excludes `is_header` rows (keeping the positional-arg count in `trial_balance_args_test.go` in sync); balance sheet and P&L gain a second query over `chart_of_accounts` to render header rows, since their INNER JOIN cannot produce them.
6. **Frontend**: parent picker fetches headers rather than the current page; chart list renders indented by hierarchy; statement pages take their middle grouping level from headers instead of `account_group`; reconcile `accountGroupsByType` (`chart-account-form-dialog.tsx:48-88`) with the backend whitelist (`service.go:4817-4845`) — they currently disagree.

## Acceptance criteria
1. Seeded chart shows every postable account under a header; headers are non-postable and undeletable.
2. Posting to a header → 400 from both the manual JV path and any system/mapping path.
3. Trial balance with "include zero balances" on shows no header rows; balance sheet and P&L render header groups with correct subtotals.
4. Statement totals byte-identical to pre-hierarchy output.
5. Cycle creation rejected; cross-type parenting rejected; parent picker offers only compatible headers.
6. Branch readiness passes with the new expected count. Full suites green.

## Testing plan
| Layer | What | Count |
|---|---|---|
| Unit | cycle detection, header postability guards, seed parent resolution, readiness count | +6 |
| Integration | statement grouping + totals invariance, posting rejections | +4 |
| E2E (QA) | chart page tree → balance sheet → P&L → trial balance | 1 flow |

## Rollback
Revert; `is_header` is additive and `parent_account_id` was already nullable and unused.

---

# W4 — float64 → decimal money

**Recommended as its own phase with a dedicated QA window. Specified here so the decision is documented.**

## Context
Open decision §6. Money is `float64` in Go against `NUMERIC(14,4)` operational and `NUMERIC(14,2)` ledger columns. The residue absorber, the `0.05` drift epsilon, and ~15 inline tolerance literals all exist to paper over float error.

## Current state (verified 2026-08-14)
- 279 Go files, 94 contain `float64`; ~784 money-shaped declarations, ~296 quantity-shaped. Heaviest: `reports/dto.go` (137), `accounting/repository.go` (92), `purchasing/dto.go` (86).
- **934 `round*` call sites**; `roundMoney` is copy-pasted into 18 packages, `roundQuantity` into 9, plus 5 bespoke variants. No shared money package.
- **No decimal library in `go.mod`.** GORM v1.31.1 over pgx v5 with `PreferSimpleProtocol: true` (`database/postgres.go:13-20`), so NUMERIC arrives as text — `shopspring/decimal` scans from the same form with **no plumbing change**.
- Frontend risk: `numberValue()` is duplicated in **16 files** with 333 call sites, each falling back to `0` for a non-number. String-serialized money would silently zero every figure with no error anywhere.
- Genuine pre-existing bugs this migration should fix: `inventory/service.go:1703` divides money by quantity and rounds with the **quantity** helper (4dp) before storing it back as the cost basis, compounding error across movements; `accounting/service.go:1144` gates a user-facing 400 on an exact float `!=`.

## Progress

**Step 1 is DONE.** `backend/internal/shared/money` exists and every module routes through it: the 18 `roundMoney` copies, the 9 `roundQuantity` copies, the 5 differently-named variants (`roundCustomerMoney`, `roundDashboardMoney`, `roundExpenseMoney`, `roundMetricMoney`, `roundSupplierMoney`) and the reflection-based rounding in `audit/metadata.go` now delegate to `money.Round2`/`money.Round4`. Each module keeps its local name, so no call site changed and no figure moved — the package reproduces `math.Round` exactly, pinned by test. A guard test (`internal/shared/money/no_local_copies_test.go`) fails the build if a module reimplements the rounding.

This means the type swap in the remaining steps changes **this package and the struct fields**, not ~934 call sites across 94 files.

Also fixed en route: the platform-settlement balance check compared a rounded left side against raw request input with `!=`, which rejected settlements that balance to the cent. It now uses `money.Equal`.

**Corrected finding:** the scoping report called `inventory/service.go` weighted-average costing a precision bug for rounding a money-per-unit value with the 4-decimal helper. On inspection that is correct, not a bug — unit costs are stored in `NUMERIC(12,4)`, and rounding a cost basis to cents would compound error through a movement series rather than contain it. `money.Round4` documents this. **No costing change was made**, and none should be made without a data comparison.

**Step 2 is DONE.** `shopspring/decimal v1.4.0` is a direct dependency and `money.Amount` wraps it: exact arithmetic, `Round2`/`Round4` matching the old `math.Round` behaviour, `sql.Scanner`/`driver.Valuer` so it sits directly in a GORM model against a NUMERIC column, and `json.Marshaler`/`json.Unmarshaler`.

The wire format is pinned by `Amount.MarshalJSON` rather than the library's global `MarshalJSONWithoutQuotes` flag — the type owns the decision, so no other package can change it and no init-order surprise can unset it. Tests assert `Amount` marshals byte-identically to `float64` across the money value range, including dropping trailing zeros (a NUMERIC(14,2) `1234.50` must still send `1234.5`). **The frontend needs no changes.** A guard test bans importing the decimal library outside this package, so a raw `decimal.Decimal` can never reach a DTO — it would serialize as a quoted string, which the frontend reads as `0`.

The one category where a payload byte legitimately changes is values that today carry binary-float artefacts: `0.30000000000000004` becomes `0.3`.

`Amount` deliberately does **not** round on every operation. Callers round where the scale matters; rounding each intermediate is what compounds error today.

## Remaining change
1. ~~**`backend/internal/shared/money`**~~ — done.
2. ~~**Wire format pinned**~~ — done, via `Amount.MarshalJSON`; the `MarshalJSONWithoutQuotes` global is not used.
3. Convert **module by module**: leaf modules (charges, expenses, ingredients, packaging, customers, suppliers, dashboard) → inventory + products/pricing (fixing the `:1703` bug) → transactional bulk (pos, salesreturns, bakeryorders, payments, purchasing, manufacturing, recipes) → accounting → reports/shared + audit.
4. **Quantities convert too**, in the same pass. Keeping them `float64` forces a conversion at ~170 mixed-arithmetic sites and reintroduces float error at exactly the `unit_cost × quantity` multiplication that matters.
5. `audit/metadata.go:112-115` type-switches on `case float64:` — add `case decimal.Decimal:` or audit metadata silently stops normalizing. This is the one reflection-shaped landmine.
6. Cleanup: delete `absorbRoundingResidue` + `systemBalanceEpsilon` (dead once differences are exactly zero — the clearest proof the migration worked), shrink `ledgerDriftEpsilon`, remove the inline `+0.0001`/`0.004`/`0.005` literals and the SQL `ABS(...) > 0.004` filters, migrate the 15 exact-literal test assertions to `.Equal()`.

## Acceptance criteria
1. JSON payloads byte-identical to pre-migration for every module (golden tests).
2. `absorbRoundingResidue` deleted; a balanced journal is exactly balanced with no epsilon.
3. `balance_rounding_test.go` converted into a "residue is now impossible" regression test.
4. Inventory weighted-average cost no longer rounds a money/quantity division at 4dp; recosting a movement series reproduces exact values.
5. Reports reconcile to the ledger with epsilon 0, not 0.05.
6. Full suites green; QA against a production snapshot shows no figure movement beyond corrected rounding.

## Testing plan
| Layer | What | Count |
|---|---|---|
| Unit | money package, per-module arithmetic conversions | +30 |
| Golden | byte-identical JSON per module | +22 |
| Integration | ledger balance exactness, recosting series | +6 |
| E2E (QA) | full app pass against production snapshot | 1 window |

## Rollback
Per-module commits, each revertible independently. Step 2 keeps the API contract stable, so a partial rollback cannot break the frontend.

---

## Operator actions after deploy (documented, never auto-run)

1. **Enter opening balances** (after W1) per branch: every non-cash account with a go-live balance, then every customer and supplier with an outstanding day-one balance. Verify the opening-balance summary's unallocated-3400 figure reaches 0.00.
2. Re-run the **AR/AP reconciliation** after entering counterparty openings and confirm no drift.
3. Pre-existing pending items unchanged: run the first year-end close per business oldest-first (now that `dea4ec2` makes it runnable), enter cash/bank opening balances, set the period lock to the last filed period end, Store Credit seed-defaults per branch, Phase 3 backfill checklist, duplicate ORD/MFG renumbering, M Bakes PI-000006 decision, credential rotation.

## Note on Phase 5 W2

Year-end close **could not run** as shipped — migration `000106` targeted a nonexistent table and the close journal's `source_id` was not a valid UUID. Both were fixed in `dea4ec2`, along with a static guard test over the migration set. Operator action 3 above depends on that fix being deployed.
