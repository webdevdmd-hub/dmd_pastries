# EPIC: Phase 5 — Period Model & Ledger-Backed Reports

**Source:** Accounting audit 2026-08-12 (`docs/accounting-audit/ACCOUNTING-AUDIT-2026-08-12.md`) root causes RC1 (dual sources of truth) and RC4 (period model unfinished); Phase 4 out-of-scope list (`docs/specs/PHASE4-ACCOUNTING-BUILD.md`).
**Preconditions (done):** Phases 1–4 complete on main (through `b121464` + 2026-08-14 QA fixes).

## Context

The ledger is now complete and trustworthy at write time, but nothing protects history and nothing reads it back. There is no lock concept: any user with edit rights can mutate a filed VAT quarter. `3100 Retained Earnings` is seeded but never posted to, and the balance sheet's `3200 Current Year P/L` row is synthetic — after year 1 the balance sheet never balances again. Only inventory has opening balances, so every cash/bank ledger balance is wrong for migrated businesses. And dashboards/reports/counterparty balances still compute from operational tables while statements read journals — the audit's RC1 drift, visible today as dashboard AR/AP (ledger) disagreeing with `/reports/financial/summary` AR/AP (operational).

## Child issues & dependency graph

```
W1 Period locking ──┬──> W3 Opening balances ──> W4 Reports-read-ledger
                    └──> W2 Year-end close ────↗
```

| # | Title | Depends on | Effort | Order |
|---|---|---|---|---|
| W1 | Period locking ("close the books" date) | — | ~2.5d | 1st |
| W3 | Payment-account opening balances | W1 | ~1.5d | 2nd |
| W2 | Year-end close + retained earnings | W1, W3 | ~2.5d | 3rd |
| W4 | Reports read the ledger | W1–W3 (soft) | ~2.5d | 4th |

**Sequencing rationale:** W1 creates the guard (`EnsurePeriodOpen`) and the AST guard test every later posting path must be born compliant with. W3 before W2 because opening balances are dated at/before FY start — closing first would lock those dates, and a close over an unopened bank side "balances" against an incomplete asset side. W4 last so dashboards start displaying ledger numbers only once locks protect history and opening balances make cash/bank real.

## Decided defaults (raise objections at review, silence = agreed)

1. The lock is **business-wide** (Zoho-style "close the books" date); close journals are **per-branch** (CoA/journals are branch-scoped since migration 000092 — each branch's balance sheet must balance independently).
2. Lock date is **inclusive** (`entry_date ≤ books_closed_through` is blocked) and must be **strictly before today** (locking the live trading day would brick POS).
3. Locked-period journals are **hard-blocked** from edit/delete/reverse — no override permission. The fix path is unlock (audited) → correct → re-lock. *(User decision 2026-08-14.)*
4. One new permission for the whole phase: **`accounting.period.lock`** (covers lock, unlock, year-end close, reopen). Opening balances reuse `accounting.accounts.manage`.
5. The close journal posts with `entry_date` = FY end, **before** the lock is extended, and is **excluded from P&L queries** so historical P&L statements survive the close (trial balance/GL/BS include it).
6. Reopen **soft-deletes** the close journal, never reverses it — the 000096 idempotency index covers `status IN ('posted','reversed')`, so a reversed close journal would permanently occupy the `(business_id, source_type, source_id)` slot and block re-close.
7. Fiscal years close **oldest-open-first**; re-closing a closed FY is a no-op/409.
8. Opening balances this phase: **payment accounts only** (Dr the account's chart account / Cr 3400 Opening Balance Equity). Generic per-account editor and per-counterparty AR/AP openings defer to Phase 6; the documented workaround is a manual JV against 3400. *(User decision 2026-08-14.)*
9. W4 keeps operational computations alive as **cross-checks feeding `consistencyWarnings`** — drift detection, never a silent switch. Sales analytics (`/reports/sales/*`, `/financial/trend`, per-entity customer/supplier stats) stay operational permanently. *(Superseded for `/financial/trend`, which moved to the ledger in Phase 6 / W2; the sales trends did not.)*
10. First year-end close on existing tenants is a **documented operator action** (accountant-reviewed, per business), never automatic. *(User decision 2026-08-14.)*
11. No feature flags — each child merges only when its QA passes, so main stays releasable.

## Out of scope (epic-wide)

- CoA hierarchy grouping (Phase 6), generic opening-balance editor + per-counterparty AR/AP opening balances (Phase 6), ledger-backed trend report, float64→decimal migration, partial-year (monthly/quarterly hard close beyond the single lock date) period entities.

---

# W1 — Period locking

## Context
Audit RC4 / K3(c): nothing prevents posting, editing, deleting, or reversing journals in a filed period. Zoho's model is a single company-level "books closed through" date.

## Current state (verified 2026-08-14)
- No lock concept anywhere; `company_settings` already carries `financial_year_start_month/day` (migration 000057) read through `EnsureAccountingSettings`/`FindAccountingSettings`/`UpdateAccountingSettings`.
- Journal writes funnel through `createPostedSystemJournal` (`accounting/service.go:5309`, ~25 automated posters) and `createPostedTransferJournal` (`:5262`), plus direct writers: manual `CreateJournalEntry` `:4030`, `PostJournalEntry` `:4163`, `UpdateJournalEntry` `:4104` (can move `entry_date`), `DeleteJournalEntry` `:4194`, `ReverseJournalEntry` `:4223`, `reversePostedJournalInTx` `:2444`, `ReverseBakeryOrderRevenueJournal` `:1867`, backfill `backfillOneJournal` `:3407`.
- Forked writers outside the accounting service: `expenses/service.go` `postExpenseJournal:454` + `postReversalJournal:531` + safe-delete `:264`; `purchasing/service.go:1505` supplier-payment safe-delete.
- `journal_entries.entry_date` is a DATE column. `accounting/routes.go RegisterRoutes(router, handler, authGuard, view, manage)`.

## Proposed change
1. **Migration `000104_period_locking.sql`**: `company_settings` + `books_closed_through date NULL`, `books_lock_updated_by_user_id uuid NULL`, `books_lock_updated_at timestamptz NULL`; insert permission `accounting.period.lock` and grant to existing system Owner/Admin roles (pattern 000101; defensive style 000096).
2. **Guard**: new `accounting/period_lock.go`, package-level `EnsurePeriodOpen(tx, businessID, entryDate) error` → 422 `"accounting period is locked through YYYY-MM-DD"` when `entryDate ≤ books_closed_through`. Package-level so the expenses module calls it without a service dependency.
3. **Enforcement** at every site listed above: choke points check `entryDate`; update checks old AND new date; delete/reverse paths check the target/original entry's date; expenses + purchasing forks check their own dates; backfill **skips** locked-period documents with a counted `skipped_locked` reason instead of failing the run.
4. **API**: `AccountingSettingsResponse` gains the three lock fields; new `PUT /api/v1/accounting/period-lock` `{closed_through: "YYYY-MM-DD"|null, reason?}` (null clears; date must be < today). `RegisterRoutes` gains a `periodLock` guard param; main.go passes `permit("accounting.period.lock")`.
5. **RBAC** (4 touch points, mirroring `sales.no_tax.apply`): permissions catalog, migration grant, default tenant Owner/Admin roles, frontend permission types/constants.
6. **Audit**: `accounting.period_lock_updated` (old date, new date, reason) inside the settings tx; extend `accountingAuditEntityType`.
7. **Guard test**: `accounting/period_lock_guard_test.go`, AST-based (template: `safe_delete_guard_test.go`) — every function calling a journal writer/soft-deleter must call `EnsurePeriodOpen` or appear in an explicit rationale'd allowlist.
8. **Frontend**: "Close the books" card in `AccountingSettingsPageClient` (`accounting-recovery-pages.tsx`); lock badge + disabled edit/delete/post/reverse actions on `journal-entries-page-client.tsx` (server authoritative); standard API plumbing chain. Domain flows (POS/expenses/purchasing) surface the 422 through existing error toasts.

## Acceptance criteria
1. Books closed through 2026-06-30: backdated expense (06-15), manual JV dated 06-30, bill edit whose original journal is 05-01, delete/reverse of a June entry — all 422 with the lock message; a sale today posts normally.
2. A draft cannot move into or out of the locked window via update.
3. Clearing the lock re-enables the same operations; re-locking re-blocks. Lock date today/future → 400.
4. Backfill over a locked window reports `skipped_locked` counts.
5. AST guard test fails the build when any journal-writing function lacks the guard and isn't allowlisted.
6. Permission enforced server-side (403 without it); audit events carry old/new dates; full suites green.

## Testing plan
| Layer | What | Count |
|---|---|---|
| Unit | boundary inclusive/exclusive, nil lock, date truncation, update old+new, backfill skip | +5 |
| Guard | AST completeness test | +1 |
| Integration | lock → blocked-ops matrix, unlock, permission 403, settings roundtrip | +4 |
| E2E (QA) | settings card → lock → blocked ops in UI → unlock | 1 flow |

## Rollback
Revert the commit; columns are additive/nullable, permission rows inert.

---

# W3 — Payment-account opening balances

## Context
Audit RC4: no opening balances except stock. Migrated businesses' cash/bank ledger balances are wrong from day one. `SourcePaymentAccount = "payment_account"` is already declared in `refund_contract.go:59` ("opening-balance entry; corrected by editing the opening balance, which reposts") — the pre-planned hook nothing posts yet.

## Current state (verified 2026-08-14)
- Inventory opening stock is the only opening mechanism (Dr 1200 / Cr 3400, source `inventory_opening_stock`).
- `CreatePaymentAccount` (`accounting/service.go:479`) takes no opening amount; `PaymentAccount` model has no balance fields. `store_credit` accounts (Phase 4 W4) are liability-backed and must be excluded.

## Proposed change
1. **Migration `000105_payment_account_opening_balances.sql`**: `payment_accounts` + `opening_balance numeric(14,2) NOT NULL DEFAULT 0`, `opening_balance_date date NULL`, `opening_journal_entry_id uuid NULL`.
2. **Posting**: `postPaymentAccountOpeningJournal` in `accounting/service.go`, called inside the existing create/update tx. Positive: Dr account's chart account / Cr `opening_balance_equity` (3400); negative mirrored; zero: no journal. `source_type = payment_account`, `source_id = account ID`, `entry_date = opening_balance_date` (required when amount ≠ 0; UI defaults to FY start), via `createPostedSystemJournal` — inherits idempotency, branch stamping, and W1's period guard. `store_credit` type with an opening balance → 400.
3. **Repost-on-edit**: on amount/date change — `EnsurePeriodOpen` for the old journal's date AND the new date, soft-delete the old journal (frees the 000096 idempotency slot), post fresh, update the three columns.
4. **Delete**: `DeletePaymentAccount` soft-deletes the opening journal (guarded by `EnsurePeriodOpen`) so 3400 doesn't strand a balance.
5. **DTOs/Frontend**: create/update requests + response gain the fields; payment-accounts dialog in `accounting-recovery-pages.tsx` gains amount + as-of date (hidden for store-credit); list row shows the opening figure. RBAC unchanged (`accounting.accounts.manage`). Audit: extend existing payment-account event payloads with old/new opening values.

## Acceptance criteria
1. Bank account with opening 5,000 at FY start → Dr bank / Cr 3400, branch-stamped; balance sheet at FY start shows both.
2. Edit to 6,000 leaves exactly one live posted `payment_account` journal (old soft-deleted); ledger shows 6,000.
3. Opening date inside a locked period → 422 on create and on edit (both directions).
4. Negative opening posts the mirror; store-credit account with opening → 400.
5. Deleting the account removes the opening journal; 3400 returns to prior balance; safe-delete guard test green.
6. Full suites green.

## Testing plan
| Layer | What | Count |
|---|---|---|
| Unit | journal shape ±, repost lifecycle, locked-period, store-credit rejection | +4 |
| Integration | create/edit/delete via API with ledger assertions | +3 |
| E2E (QA) | create account with opening → payment-accounts screen + balance sheet | 1 flow |

## Rollback
Revert; columns additive with safe defaults.

---

# W2 — Year-end close + retained earnings

## Context
Audit RC4: no year-end close → balance sheet permanently unbalanced after year 1; `3200 Current Year P/L` is synthetic (`currentYearProfitLossForBalanceSheet`, `accounting/service.go:3977`); `3100 Retained Earnings` never posted to.

## Current state (verified 2026-08-14)
- `financialYearStartFor` (`accounting/service.go:5149`) derives the FY window from `company_settings`. No `retained_earnings` mapping key exists (`seeder.go:147`); 3100 is seeded per branch (control, no manual posting).
- The 000096 idempotency index requires a unique `(business_id, source_type, source_id)` per posted/reversed journal.

## Proposed change
1. **Migration `000106_year_end_close.sql`**: backfill `retained_earnings → 3100` account mapping for every existing (business, branch) with a CoA; add the key to `DefaultAccountMappingSeeds()`. No other schema — close state derives from `year_end_close` journals; the lock column shipped in W1.
2. **Source type**: `SourceYearEndClose = "year_end_close"` in `refund_contract.go` consts + `reversalContracts` (registry test enforces), rationale: reopened by soft-deleting via the reopen endpoint, never reversed.
3. **Close service** (new `accounting/year_end_close.go` + service methods):
   - `POST /api/v1/accounting/year-end-close` `{financial_year_end_date}` — validates: date is the day before an FY boundary per settings, FY complete (`end < today`), oldest-open-first. Per branch with posted activity: `ListProfitLossRows(branch, fyStart, fyEnd)` → Dr each income account by its period amount, Cr each COGS/expense account, net balancing line to 3100 via `requiredMappedAccount("retained_earnings", "3100")`. `source_id = <branchID>-FY<endYear>`, `entry_date = fyEnd`, via `createPostedSystemJournal` **before** setting `books_closed_through = max(current, fyEnd)`. Audit `accounting.year_end_closed` (FY window, per-branch journal IDs + net profit).
   - `GET /api/v1/accounting/year-end-close` — FY list (earliest journal → now) with status closed/open/current + per-branch close journals/net profit. `GET …/preview?financial_year_end_date=` — per-branch net profit for the confirm dialog.
   - `POST …/reopen` `{financial_year_end_date}` — latest closed FY only; inside one tx rolls the lock back to the previous closed FY end (or NULL), then soft-deletes that FY's close journals (guard-test allowlist entry with rationale). Audit `accounting.year_end_reopened`.
   - POSTs behind the `periodLock` guard; GETs behind `view`.
4. **Report math**: `ListProfitLossRows` excludes `source_type='year_end_close'` (trial balance/GL/BS include it). `currentYearProfitLossForBalanceSheet`: synthetic-3200 window becomes `max(financialYearStartFor(asOf), lastClose+1 day) → asOf`; when empty, 3200 is 0 and real 3100 carries the profit.
5. **Frontend**: "Year-End Close" card in `AccountingSettingsPageClient`: FY list with status chips, Close button → preview-confirm dialog (per-branch profit), Reopen with a strong confirm. Balance-sheet page unchanged (already renders `IsCalculated` rows).

## Acceptance criteria
1. Closing FY on a two-branch business posts one balanced close journal per active branch (income Dr'd to period amounts, expense/COGS Cr'd, net to 3100), `entry_date` = FY end.
2. Balance sheet balances at FY end and mid-next-year: 3100 real, 3200 = 0 / next-year stub; reconciliation health-check passes both dates.
3. FY P&L byte-identical before/after the close.
4. Re-close → 409; out-of-order close → 400; current incomplete FY → 400.
5. Close auto-locks through FY end (backdated expense 422s); reopen soft-deletes the close journals, rolls the lock back, allows re-close; both audited.
6. Registry test green with the new source type; full suites green.

## Testing plan
| Layer | What | Count |
|---|---|---|
| Unit | close-line builder (profit/loss/zero-activity branch), FY boundary incl. non-Jan starts, oldest-first validation, synthetic-3200 window incl. boundary date, idempotent source_id | +6 |
| Integration | close → BS balanced two dates, reopen → re-close, lock interaction, P&L invariance | +4 |
| E2E (QA) | settings card: preview → close → balance sheet → reopen | 1 flow |

## Rollback
Revert; the reopen endpoint (or manual soft-delete of `year_end_close` journals + clearing the lock) restores pre-close state; migration is a mapping insert, inert.

---

# W4 — Reports read the ledger

## Context
Audit RC1: `reports/repository.go` (3,755 lines) contains zero ledger queries; every reported figure is operational while statements read journals. `LedgerFinancialTotals` (`reports/shared/metrics.go:64`) was purpose-built for this switch and has zero callers. Dashboard AR/AP already read the ledger (`LedgerMappedBalance`), so the summary and dashboard are guaranteed to disagree today.

## Current state (verified 2026-08-14)
- `/reports/financial/summary` (`FinancialSummary`, `reports/repository.go:2166`) emits `SourceOfTruth: "financial_transactions"` + `ConsistencyWarnings` — the response already has the signalling fields.
- Three divergent operational AR predicates: reports (`payment_status IN ('unpaid','partial')`), customers (`sale_status <> 'voided'`), accounting reconciliation (`sale_status='completed'`).
- AR/AP reconciliation endpoints exist (`accounting/service.go:3888/:3866`). Dead shadow struct `ledgerFinancialTotals` at `reports/repository.go:40`.

## Proposed change (per-endpoint rollout)
1. **Predicate normalization first**: single `OutstandingARPredicate`/`OutstandingAPPredicate` in `reports/shared/predicates.go`; rewire `reports/repository.go`, `customers/repository.go:350-389`, `suppliers/repository.go:~225-295`, and the accounting reconciliation operational sums. Snapshot-tested pure refactor. Delete the dead shadow struct.
2. **`/reports/financial/summary`**: `LedgerFinancialTotals` becomes primary (`SourceOfTruth: "journal_entries"`); operational computation kept as cross-check; per-metric `operational_ledger_drift_<metric>` warnings when |Δ| > 0.05. Response shape otherwise unchanged.
3. **`/financial/outstanding-balances` + `/financial/supplier-payables`**: header totals from ledger (1100 / 2000, supplier advances 1400 surfaced separately); per-entity rows stay operational (control accounts have no subledger — documented limitation) with row-sum-vs-ledger drift warnings.
4. **Dashboard**: revenue/collected/refunded KPIs switch to the same `LedgerFinancialTotals` call; `DashboardLoadWarning` carries drift. Ends the summary-vs-dashboard split.
5. **Stays operational**: `/reports/sales/*`, customer/supplier per-entity stats. *(`/financial/trend` was listed here too; Phase 6 / W2 moved it to the ledger.)*
6. **Parity validation before merge**: AR/AP reconciliation endpoints + a test harness (seed sale/refund/expense/bill/settlement; assert ledger == operational within epsilon). Pre-existing drift on the dev DB is data repair via backfill, not report-code change.

## Acceptance criteria
1. Summary returns `source_of_truth: "journal_entries"`; on clean seeded data every figure matches the previous operational output to the cent.
2. Summary AR/AP == dashboard AR/AP.
3. Deleting one journal in a test fixture produces the matching drift warning instead of a silently wrong number.
4. Outstanding-balances and supplier-payables headers ledger-backed with row-sum drift warnings; sales analytics byte-identical.
5. All AR predicate call sites import the shared predicate; a grep-guard test bans local re-declarations.
6. Full suites green.

## Testing plan
| Layer | What | Count |
|---|---|---|
| Unit | drift-warning builder, predicate equivalence snapshots, LedgerFinancialTotals fixture math | +5 |
| Integration | summary parity, drift injection, outstanding/payables headers | +4 |
| E2E (QA) | dashboard vs reports agreement on dev DB | 1 flow |

## Rollback
Revert the commit — operational paths are retained as cross-checks, nothing deleted.

---

## Operator actions after deploy (documented, never auto-run)

1. Per business, accountant-reviewed: run the first **year-end close** for already-elapsed fiscal years (Settings → Accounting → Year-End Close), oldest first.
2. Per branch: enter **opening balances** for existing cash/bank payment accounts (as of FY start), after verifying against real bank/cash counts.
3. Then set the **period lock** to the last filed period end.
4. Pre-existing pending items unchanged: push commits to origin, Store Credit seed-defaults per branch, Phase 3 backfill checklist, duplicate ORD/MFG renumbering, M Bakes PI-000006 decision, credential rotation.
