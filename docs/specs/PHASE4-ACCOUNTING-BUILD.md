# EPIC: Phase 4 — Accounting Behaviors Build

**Source:** Accounting audit 2026-08-12 (`docs/accounting-audit/ACCOUNTING-AUDIT-2026-08-12.md`) + Phase 2 decisions (`backend/docs/open-accounting-decisions.md` §DECISIONS).
**Preconditions (done):** Phase 1 critical fixes (`9962a12`…`2fc1aba`), Phase 3 data repair + migration 000096.

## Context

The Phase 2 workshop locked five accounting behaviors that don't exist yet. Until they're built: every bakery order books 100% margin, VAT understates on any filing period containing unrecognized deposits, returns without refunds distort the P&L, card money never reaches the book bank account, and refunds behave differently depending on which screen recorded them. This epic builds all five plus the refund unification the audit classed HIGH.

## Child issues & dependency graph

```
W1 Bakery COGS ──────────────────────────┐
W5 Card settlement (independent) ────────┤
W6 Refund unification ──> W4 Store credit┼──> Epic done
W3 VAT modes ──> W2 VAT per payment ─────┘
```

| # | Title | Depends on | Effort | Order |
|---|---|---|---|---|
| W1 | Bakery order COGS & inventory relief at completion | — | ~2d | 1st |
| W5 | Card settlement screen | — | ~1d | 2nd |
| W6 | Unified refund/reversal contract | — | ~3d | 3rd |
| W4 | Store credit (create + redeem) | W6 | ~2d | 4th |
| W3 | Per-document VAT modes + no-tax RBAC | — | ~2.5d | 5th |
| W2 | VAT recognition on each payment | W3 | ~1.5d | 6th |

**Sequencing rationale:** W1 kills the biggest P&L lie and touches nothing else. W5 is a small independent win. W6 must precede W4 (store credit is a refund outcome). W3 must precede W2 (a payment's VAT slice depends on the document's tax mode). Building W2 before W3 would mean re-doing the payment math two weeks later.

## Decided defaults (raise objections at review, silence = agreed)

1. Card processing fees post to a **new seeded expense account 6260 "Card Processing Fees"** (mapping key `card_fees_expense`); 6240 stays reserved for delivery-platform commissions.
2. **Store credits do not expire** (Zoho default). Expiry is future scope.
3. No-tax permission key: **`sales.no_tax.apply`**, grantable per-role in the existing Roles/RBAC UI; every no-tax document writes an audit event and appears in a "No-tax documents" report filter.
4. Multi-deposit VAT rounding: each payment recognizes proportional VAT (`payment × order_tax / order_total`), and the **final settlement takes the remainder** so cumulative rounding drift is impossible.
5. Bakery packaging components are **consumed at completion** together with the items.
6. Bakery consumption movements use `reference_type='bakery_order'`, direction `out`, priced by the existing outbound cost basis (item average cost → product `cost_price` fallback).
7. Epic ships behind no feature flags — each child merges only when its QA passes, so main stays releasable.

## Out of scope (epic-wide)

- Period locking & year-end close (Phase 5), reports-read-ledger (Phase 5), CoA hierarchy grouping (Phase 6), general AR/AP per-counterparty sub-ledgers (only the customer-credit subledger in W4 is built), float64→decimal migration, credit expiry, gift cards.

---

# W1 — Bakery order COGS & inventory relief at completion

## Context
Decision §1: stock leaves and COGS posts when the order is marked **completed** — the same event that posts revenue (`bakeryorders/service.go:250-254`). Today nothing ever consumes inventory for a bakery order (audit CRITICAL).

## Current state (verified 2026-08-12)
- `UpdateStatus` (`bakeryorders/service.go:231`) posts only `PostBakeryOrderRevenueJournal` (`accounting/service.go:1506-1598`) at `completed`.
- No `ApplyMovement` call exists anywhere in `internal/modules/bakeryorders/`.
- Revenue journal `EntryDate` uses `time.Now()` (`accounting/service.go:1590`) — wrong period for backdated completions (audit HIGH #5).
- Production batches already capitalize raw materials → finished goods correctly (`manufacturing/service.go:590-737`).
- `bakery_order_packaging` rows record required packaging but nothing consumes it (migration 000063).

## Proposed change
In the same transaction as the completion status write:
1. For each order item resolving to a stock-tracked product/variant on the order's branch: `inventory.ApplyMovement` type `sale_out`-class movement, `reference_type='bakery_order'`, `reference_id=order.ID`, direction `out`, quantity from the item, cost via existing outbound basis (`inventory/service.go:1675-1686`).
2. Same for `bakery_order_packaging` components (packaging item type).
3. Post journal `source_type='bakery_order_cogs'`: Dr COGS 5070 / Cr Inventory 1200 = SUM(movement costs). Idempotent via source lookup + stored `cogs_journal_entry_id` (new column on `bakery_orders`).
4. Fix `EntryDate` on BOTH bakery journals to the completion timestamp (order event date semantics), not `time.Now()`.
5. Custom/non-stock items: no movement, and (matching POS behavior) log a warning when an item has no cost basis instead of silently booking zero.
6. Reversal: `completed → cancelled` transition must reverse the COGS journal and restock (mirror movements), same pattern as POS void (`pos/service.go:866+`). Revenue reversal on cancellation belongs to W6 but the COGS reversal ships here so W1 is never asymmetric.
7. New backfill target `bakery_order_cogs` in `accounting/repository.go` `backfillTargetQuery` for historical completed orders (zero-cost items skip, consistent with existing policy).

## Files reference
| File | Change |
|---|---|
| `backend/internal/modules/bakeryorders/service.go:231-260` | consumption + COGS call in completion tx; cancellation reversal |
| `backend/internal/modules/accounting/service.go` | `PostBakeryOrderCOGSJournal` + reversal; EntryDate fix at :1590 |
| `backend/internal/modules/accounting/repository.go` | movement sum by reference; backfill target; journal-id column update |
| `backend/migrations/000097_bakery_order_cogs.sql` | `bakery_orders.cogs_journal_entry_id uuid`, `cogs_reversal_journal_entry_id uuid` |
| `backend/internal/modules/reports/shared/metrics.go` | consistency check #11: completed bakery orders missing COGS journal |
| frontend order details | show COGS/margin line for completed orders |

## Acceptance criteria
1. Completing an order with 2 stock-tracked items creates `out` movements for both + packaging, and one balanced `bakery_order_cogs` journal (Dr 5070 / Cr 1200 = movement cost sum), linked on the order row.
2. Completing the same order twice (idempotency retry) creates exactly one COGS journal.
3. `completed → cancelled` restores stock at original cost and posts a mirror reversal journal; ledger Dr=Cr holds.
4. Both bakery journals carry the completion date as `entry_date`, verified by a backdated completion test.
5. An order with only custom (non-stock) items completes with revenue journal only and a logged warning, no crash.
6. Backfill dry-run/live posts COGS for historical completed orders with priced movements; zero-cost skip counted.
7. New consistency warning fires for any completed order without a COGS journal.
8. Full backend suite green; new unit tests for the journal builder and reversal.

## Testing plan
| Layer | What | Count |
|---|---|---|
| Unit | COGS journal builder (mixed stock/custom/packaging), reversal mirror, entry-date | +4 |
| Integration (API) | complete → verify movements+journal; cancel → verify reversal; idempotent re-complete | +3 |
| E2E (QA) | UI: complete a real order, check margin + trial balance | 1 flow |

## Rollback
Revert the commit; migration 000097 columns are additive/nullable — safe to leave.

---

# W5 — Card settlement screen

> **Implementation note (2026-08-12):** built by REUSING the existing platform-settlement flow instead of a new `card_settlements` entity — `CreatePlatformSettlement` already posts Dr deposit (net) + Dr fee deductions / Cr clearing (gross) with numbering, idempotency, and audit. The only gate was the `platform_clearing`-only validation, now widened to accept `card_clearing` (`isSettleableClearingType`). 6260 seeded via seeder + migration 000098. Settlement reversal moves to W6's reversal-contract registry. The dedicated-entity design below is retained for reference only.

## Context
Decision §5. Card sales debit Card Clearing 1030; nothing can credit it (`allow_manual_posting=false`, no flow). Book bank balance never shows card income; fees invisible.

## Proposed change
1. New entity `card_settlements` (migration 000098): id, business_id, branch_id, settlement_date, card_payment_account_id (must be `card_clearing` type), bank_payment_account_id (must be `bank` type), gross_amount, fee_amount, net_amount (= gross − fee, enforced), reference_number, notes, journal_entry_id, created_by, timestamps, soft delete.
2. Posting (same tx): Dr Bank chart account (net) + Dr 6260 Card Processing Fees (fee) / Cr Card Clearing chart account (gross). Source `card_settlement`. Reversal endpoint posts the mirror (safe-delete rules: no hard delete).
3. Seed 6260 + mapping key `card_fees_expense` (seeder + repair for existing tenants in the migration).
4. Validation: gross ≤ current 1030 balance → warning (not block — processor timing); gross > 0; fee ≥ 0; accounts on the operating branch.
5. UI: Finance → "Card Settlements": list + create dialog showing current Card Clearing balance per branch; permission `accounting.settlements.manage`.

## Acceptance criteria
1. Recording a settlement (gross 1000, fee 25) posts Dr 1010 975 + Dr 6260 25 / Cr 1030 1000, balanced, branch-stamped.
2. Card Clearing balance visibly decreases on the payment-accounts screen.
3. Reversal restores balances and marks the settlement reversed; no hard deletes (guard test stays green).
4. 6260 + mapping exist for new AND pre-existing businesses/branches after migration.
5. Permission enforced server-side; audit event written.

## Testing plan
Unit +3 (journal shape, validation, reversal) · Integration +2 (create/reverse via API) · E2E 1 flow.

## Rollback: revert; additive migration safe.

---

# W6 — Unified refund/reversal contract

> **Implementation note (2026-08-13):** shipped with these deltas from the design below.
> - The unified builder is `buildRefundJournalLines` + `prorateRefundSlices` (`accounting/refund_contract.go`), pure and unit-tested; POS quick refunds, sales returns, and bakery post-completion refunds all assemble through it. Partial refunds slice VAT/charges with a **cumulative rounding rule** (slice = rounded cumulative share after − before), so refund series that reach the document total reverse tax exactly.
> - POS refunds now post **one journal per refund event** (`sale_refunds` header; `payment_refunds.sale_refund_id` links allocation rows — migration 000099). The legacy per-row `PostPOSPaymentRefundJournal` remains only for pre-W6 backfill; the backfill missing-condition also accepts event-journal linkage.
> - AR-first: a POS refund's unallocatable slice (beyond collected cash) credits AR up to the sale's outstanding receivable.
> - **Vendor-credit VAT:** receipts carry no tax snapshot (spec assumption was wrong), so a bill-less return derives each line's rate from the matching purchase-order line, then the product master's default rate (`returnItemTaxWithoutInvoice`); genuinely unbilled+unordered receipt lines still reverse zero VAT, which is correct under the bill-only policy.
> - **Bakery refunds** (`POST /bakery-orders/:id/refunds`): on a NOT-completed (or cancelled) order this is an advance refund `Dr 2200 / Cr cash` decrementing `paid_amount`; on a completed order it routes through the builder (cap = collected − refunded, tracked in `bakery_orders.refunded_amount`; no AR slice, preserving `balance = total − paid`).
> - **Bakery cancellation:** completed→cancelled now also reverses the revenue journal — the income side mirrors, but the counterparty side is rebuilt as `Cr 2200 = current paid / Cr 1100 = current outstanding` (post-completion settlements make a blind mirror wrong). Paid money lands back in 2200 and is refunded AFTER cancellation via the advance path, avoiding the double-reversal the refund-before-cancel ordering would cause. Guards: non-completed orders must have `paid_amount ≈ 0` to cancel; completed orders with post-completion refunds cannot cancel at all.
> - **Registry:** `reversalContracts` in `refund_contract.go` maps every posting source_type to its reversal source_type or an explicit rationale; `refund_contract_test.go` AST-scans `service.go` so no posting literal can ship unregistered.

## Context
Audit RC3/K7/K9: POS refunds skip VAT/charge reversal and never restore AR; sales-return refunds do it right; invoice-less vendor credits never reverse VAT; bakery has no refund path at all; bakery cancellation posts nothing.

## Proposed change
1. **One refund posting builder** in accounting: given (document kind, money refunded, goods returned?, charges refunded?, customer?), emit the complete entry: Dr Sales Returns 4040 (net) + Dr charge-refund accounts + Dr VAT Payable 2100 (tax slice) / Cr payment account (branch-mapped); when goods return: Dr Inventory / Cr COGS at movement cost; when the sale had unpaid AR: restore AR before crediting cash (Cr AR first, cash only for the collected part).
2. `pos.RefundSale` (money-only quick refund) routes through the builder: VAT + charges now reverse; AR restored on credit sales; still no restock (goods didn't return — that's the sales-returns module's job). The two paths now differ only by the goods flag, not by accounting shape.
3. **Vendor-credit VAT fix:** `buildPurchaseReturnItems` (`purchasing/service.go:3182-3197`) computes tax from the receipt's tax-rate snapshot when `invoice == nil`, instead of 0; `PostPurchaseReturnJournal` then reverses VAT Receivable correctly.
4. **Bakery refunds:** migration extends `payment_refunds.refund_source` CHECK with `'bakery_order'`; endpoint `POST /bakery-orders/:id/refunds` (advance refunds: Dr Customer Advance 2200 / Cr payment account; post-completion refunds route through the unified builder).
5. **Bakery cancellation posting:** cancel of a completed order reverses the revenue journal (mirror); cancel of any order with unrefunded advances requires refund or store-credit conversion first (dependency guard, extends K3c).
6. Every new reversal declares itself in a table-driven registry (source_type → reversal builder) so future flows can't ship without one.

## Acceptance criteria
1. POS quick refund of an inclusive-VAT sale reverses net revenue, VAT, and charges; VAT Payable decreases by the refund's tax slice (previously unchanged).
2. Refunding a partially-paid credit sale restores AR: Cr AR up to outstanding, Cr cash only for collected.
3. Invoice-less vendor credit on a VAT bill line reverses VAT Receivable proportionally; AP debit equals gross.
4. Bakery advance refund posts Dr 2200 / Cr cash and updates order paid totals; cancelling an order with unrefunded advances is blocked with a clear message offering refund or store credit.
5. Cancelling a completed bakery order reverses revenue + COGS (W1) symmetrically.
6. Registry test: every posting source_type with financial effect has a registered reversal.
7. Full suite green; ledger balanced in every new test.

## Testing plan
Unit +6 (builder matrix: money-only, goods, credit-sale, charges, VAT modes) · Integration +5 · E2E 2 flows.

## Rollback: revert commits; CHECK-constraint migration has a down path (restore old constraint).

---

# W4 — Store credit (create + redeem) — depends on W6

> **Implementation note (2026-08-13):** shipped with these deltas from the design below.
> - `refund_mode` becomes **three-way** (`none | refund | store_credit`, migration 000100): historical `'none'` keeps its meaning (goods back, no compensation) instead of being reinterpreted; `store_credit` is the new outcome that posts Dr 4040 (+charges/VAT) / Cr 2200 through the W6 builder and writes the `customer_credits` row.
> - Subledger: `customer_credits` + `customer_credit_redemptions` (redemption audit trail, migration 000100). Redemption locks rows `FOR UPDATE` oldest-first (`RedeemCustomerCredit`), so racing terminals serialize and over-redemption 400s.
> - Redemption tender: seeded 4th default payment method **"Store Credit"** (`method_type='store_credit'`) with a per-branch `payment_accounts.account_type='store_credit'` backed by chart 2200 (liability-backed payment accounts are allowed only for this type). POS checkout validates customer + balance server-side and decrements in the sale tx; the tender is hidden client-side without a customer with balance. **Bakery `AddPayment` rejects the tender** (no decrement pipeline there yet).
> - Bakery advance→credit conversion: `convert_to_store_credit` flag on `POST /bakery-orders/:id/refunds` — subledger row only, no journal (2200 already holds the money), paid_amount decrements.
> - Endpoints: `GET /accounting/customer-credits?customer_id=` (rows + balance) and `GET /accounting/reconciliation/customer-credits` (subledger vs credit-sourced 2200 activity; bakery conversions are ledger-neutral and added back for comparability).
> - **Operator action:** existing businesses must re-run `POST /accounting/payment-accounts/seed-defaults` per branch to get the Store Credit tender.

## Context
Decision §4: `refund_mode='none'` becomes store credit. 2200 is a control account with no per-customer detail, so a subledger table is required (audit open-decision §5, scoped here to customer credits only).

## Proposed change
1. Migration 000099: `customer_credits` (id, business_id, branch_id, customer_id, source_type `sales_return|bakery_order|manual`, source_id, journal_entry_id, amount, balance, notes, timestamps, soft delete) + index on (business, customer). Reconciliation invariant: SUM(balance) per business = ledger 2200 credit balance from credit-sourced entries.
2. `refund_mode='none'` on a sales return: requires `sale.customer_id` (walk-in → 400 "select a customer or choose refund"); posts via W6 builder with outcome = Cr Customer Advance 2200 instead of Cr cash; writes a `customer_credits` row.
3. Redemption: seeded system payment method **"Store Credit"** (`method_type='store_credit'`, per-branch payment account with new `payment_accounts.account_type='store_credit'` backed by chart 2200). POS checkout: tender visible only when a customer with balance > 0 is selected; server validates balance; posting Dr 2200 (via the mapped account, same branch-mapped resolution as all tenders) inside the normal sale journal; `customer_credits.balance` decremented in the same tx (oldest-first).
4. Bakery cancellation "convert advance to store credit" (W6 #5 option): moves 2200 advance into a credit row (no journal needed — same account — but subledger row + audit event).
5. UI: POS customer chip shows credit balance; Customers page shows credit history; sales-return form gains the three-way outcome (Refund / Store credit / —).

## Acceptance criteria
1. Return with store-credit outcome: Dr 4040 / Cr 2200, credit row created, customer balance visible at POS.
2. Redeeming: sale journal's tender line debits 2200; credit balance decreases; over-redemption blocked server-side (400) even if two terminals race (row lock).
3. Walk-in sale cannot select the Store Credit tender (UI hides; API 400).
4. Reconciliation endpoint: per-customer subledger sum equals 2200 credit-sourced balance; drift reported.
5. Redemption respects branch mapping (works at Second Branch).
6. Full suite green.

## Testing plan
Unit +4 (create, redeem, race/lock, reconciliation) · Integration +4 · E2E 2 flows (return→credit→redeem; branch 2).

## Rollback: revert; additive migration.

---

# W3 — Per-document VAT modes + no-tax RBAC

> **Implementation note (2026-08-14):** shipped with these deltas from the design below.
> - Migration is **000101** (000100 was taken by W4). It also adds `tax_mode` to `held_sales` so held/resumed carts keep their mode.
> - **Backfill guard:** inclusiveness was historically a property of the tax RATE (`tax_rates.is_inclusive`), not the document — and the seeded UAE VAT rate is exclusive-flagged. A blanket `'inclusive'` default would have repriced those businesses, so the migration derives each business's `default_tax_mode` (and stamps historical documents) from its governing rate's flag. Historical documents are never recalculated.
> - Mode semantics live once in `charges.ResolveLineTax` + `BuildChargesWithMode` (the charges package is imported by all three selling/buying modules). The empty mode (`TaxModePerRate`) preserves legacy per-rate behavior for document types without a mode (POs, receipts, returns) — including the purchase-line total quirk, kept bug-for-bug.
> - Requests carry `tax_mode` optionally; empty falls back to `business_settings.default_tax_mode`. The mode is fixed for a document's life (bakery/bill edits recalc under the stored mode; `UpdateInvoice` threads it through its create-request reconstruction).
> - Permission `sales.no_tax.apply` (module `pos`) is seeded to Admin+Manager (migration grants existing system roles); enforcement is service-side in POS checkout, bakery `buildOrder`, and `buildInvoice`; `*.no_tax_applied` audit events fire on create; report at `GET /reports/financial/no-tax-documents` unions the three sources.
> - UI: POS cart VAT segmented control, bakery order form selector (badge when editing), bill dialog selector — the No-tax option renders only with the permission. Client cart math mirrors the explicit modes; the "Default" option defers to the server.

## Context
Decision §2b/2c: Inclusive / Exclusive / No-tax selectable per document on POS sales, bakery orders, purchase bills; staff pick per order; No-tax permission-gated + audit-flagged.

## Proposed change
1. Migration 000100: `tax_mode varchar CHECK ('inclusive','exclusive','no_tax') NOT NULL DEFAULT 'inclusive'` on `sales`, `bakery_orders`, `purchase_invoices`; `business_settings.default_tax_mode` (default `'inclusive'`).
2. Calculation: `pos.calculateSale` (`pos/service.go:1101-1129`), bakery totals, purchasing bill calc branch on mode: inclusive = extract tax from price (current); exclusive = add tax on top; no_tax = zero tax lines, gross=net. Product `TaxRateID` still supplies the rate; the mode decides how it's applied. Charges follow the document mode.
3. Permission `sales.no_tax.apply` (new key in the auth permission catalog, both role seeds); server-side enforcement in checkout/order/bill create+edit; UI hides the No-tax option without it.
4. Audit + report: every no_tax document writes an audit event; reports gain a "No-tax documents" list (period, branch, document, amount, who) for VAT-filing review.
5. Journals need no structural change — TaxAmount already flows; exclusive/no_tax just change its computation. Acceptance verifies each mode's journal shape.
6. UI: 3-way selector (default from settings) on POS cart panel, bakery order form, bill form; badge on documents that used non-default mode.

## Acceptance criteria
1. Same AED 100 cart in the three modes produces: inclusive → pay 100, revenue 95.24/VAT 4.76; exclusive → pay 105, revenue 100/VAT 5; no_tax → pay 100, revenue 100/VAT 0. Journal lines match exactly.
2. Purchase bill in exclusive mode: Dr Inventory net + Dr VAT Receivable / Cr AP gross; no_tax bill posts no 1300 line.
3. Staff without `sales.no_tax.apply` neither sees the option nor can force it via API (403).
4. Every no_tax document appears in the audit log and the new report with actor + amount.
5. Existing documents (pre-migration) read as inclusive; recalculation of old documents does not occur.
6. Full suite green.

## Testing plan
Unit +6 (calc × 3 modes × sale/bill) · Integration +4 (API enforcement, report) · E2E 2 flows.

## Rollback: revert code; columns additive with safe default.

---

# W2 — VAT recognition on each payment — depends on W3

## Context
Decision §2a: a deposit carries its proportional VAT slice immediately; completion recognizes only the remainder. Today all VAT waits for completion (`accounting/service.go:1587-1589`), and payment journals post no tax line (`:1396-1399`).

## Proposed change
1. `PostBakeryOrderPaymentJournal`: for orders with tax (per W3 mode), the payment journal becomes Dr payment account (gross) / Cr Customer Advance (net slice) + Cr VAT Payable 2100 (tax slice), where tax slice = `round(payment × order.TaxAmount / order.TotalAmount)`; the **final** payment (order fully paid) takes `order.TaxAmount − already-recognized` instead (remainder rule, default #4).
2. Track recognized VAT per order (`bakery_orders.vat_recognized_amount` column, updated in payment tx) so completion posts `Cr 2100 = TaxAmount − vat_recognized_amount` and `Dr 2200 = PaidAmount − their tax slices` — completion journal stays balanced under partial recognition.
3. Refunding a deposit (W6 path) reverses both slices (Dr 2200 net + Dr 2100 tax / Cr cash).
4. Post-completion payments (AR settlements) recognize no VAT (already recognized at completion) — unchanged.
5. Backfill: none (historical payments keep completion-time VAT; only new payments use the rule). Documented in the migration comment.

## Acceptance criteria
1. Inclusive AED 105 order (tax 5): 50% deposit posts Cr 2200 47.62 / Cr 2100 2.38; completing after full payment posts total remaining VAT so that lifetime Cr 2100 = 5.00 exactly (rounding test with 3 uneven payments).
2. VAT report as-of a date between deposit and completion shows the deposit's VAT slice.
3. Deposit refund before completion reverses its exact slices; 2100 and 2200 return to pre-deposit balances.
4. no_tax orders (W3) post no VAT slice on any payment.
5. Ledger balanced in every scenario; full suite green.

## Testing plan
Unit +5 (proportional math, remainder, refund reversal, no_tax, exclusive) · Integration +3 · E2E 1 flow.

## Rollback: revert; column additive.
