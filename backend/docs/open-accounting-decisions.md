# Open accounting decisions

Gaps found during the stabilization work that were **deliberately not
implemented**, because each needs a business decision rather than a technical
one. Guessing at any of them would write wrong figures into the ledger.

Each entry states what happens today, what is missing, and the specific question
that has to be answered before it can be built.

---

## 1. Bakery orders never decrement stock, and post no COGS

**Highest-value remaining gap.**

### What happens today

- A bakery order can be assigned to production. Manufacturing then consumes
  ingredients (`production_out`) and adds the finished item to inventory
  (`production_in`), and posts a balanced journal for the batch.
- Completing the bakery order posts revenue, VAT and charges
  (`PostBakeryOrderRevenueJournal`), and each payment posts against customer
  advance or receivable.
- **Nothing ever removes the delivered goods from inventory.** There is no
  `ApplyMovement` call anywhere in the bakery orders module.

### Consequences

- Stock of made-to-order products grows permanently: production adds, delivery
  never subtracts.
- Every bakery order books 100% gross margin, because revenue is recognised with
  no matching cost. The more the bakery channel grows, the more reported profit
  overstates reality.
- Inventory reconciliation shows a widening operational-versus-ledger gap that
  no backfill can close, because the movements were never recorded.

### Questions to answer

1. **When does stock leave?** On order completion, on delivery/pickup, or on
   production hand-off? This determines the movement date and therefore which
   period carries the cost.
2. **What about orders never routed through production?** If the item is taken
   from existing stock, the decrement is a plain issue. If it is made outside
   the system, there may be no stock to take.
3. **Non-stock-tracked products** — bakery items are often bespoke. Should a
   product with `is_stock_tracked = false` be skipped, or costed some other way?
4. **What cost?** COGS mirrors `PostPOSSaleCOGSJournal`, which prices the
   movement from `stock_movements.total_cost`. That works only if the decrement
   happens and is costed.

Once (1)–(4) are settled the implementation is well understood: emit the stock
movements the way POS does, then add `PostBakeryOrderCOGSJournal` as a mirror of
`PostPOSSaleCOGSJournal` (Dr 5070 / Cr 1200). **Do the inventory side first** —
COGS computed over movements that do not exist would simply post zero.

---

## 2. What does a `refund_mode = 'none'` sales return mean?

### What happens today

`sales_returns.refund_mode` permits exactly two values, `'none'` and `'refund'`
(migration 000051). For a `'none'` return:

- the goods are restocked and the inventory journal posts (Dr 1200 / Cr 5070),
- **no revenue reversal is posted**, so the sale stands as earned.

That is coherent if `'none'` means "goods came back and the customer was not paid
anything": the business keeps the cash and regains the stock, so margin
genuinely improves.

### The risk

If `'none'` is instead being used for returns settled outside the system — cash
from the till, a manual credit note, a replacement — then revenue is overstated
and gross margin is inflated by every such return.

### Question to answer

**Which is it?** If `'none'` covers settled-elsewhere returns, the revenue side
needs a counterparty account (customer advance for store credit, an expense or
contra-revenue account for a write-off) and a third refund mode, which means a
schema change to the `chk_sales_returns_refund_mode` constraint.

The gate is marked in `salesreturns/service.go` where the revenue journal is
posted.

---

## 3. Goods received but not invoiced (GRNI)

### What happens today

Receiving goods records stock but posts no journal — supplier liability and
inventory value are both recognised when the bill is posted. This is a
deliberate bill-only accrual policy, asserted by
`purchasing_posting_policy_test.go`, and migration 000077 reversed the legacy
GRNI journals that predated it.

Account **2050 Goods Received Not Invoiced** is still seeded, but no posting path
reads it. It has been removed from the *required* readiness checks so branches
are not blocked on configuration nothing consumes.

### Consequence

Stock received but not yet billed appears in operational inventory with no ledger
counterpart. The inventory reconciliation reports this as
`pending_bill_posting`, which is accurate rather than an error — but between
receipt and billing, the balance sheet understates both inventory and payables.

### Question to answer

Is the reporting lag acceptable? If month-end regularly closes with unbilled
receipts, GRNI should be posted at receipt (Dr Inventory / Cr 2050) and cleared
when the bill arrives (Dr 2050 / Cr AP). That is a policy change, not a bug fix,
and would require reversing the current no-op and updating its test.

---

## 4. Chart of accounts hierarchy

`chart_of_accounts.parent_account_id` exists and the API already resolves parent
names, but the 74 seeded accounts are all flat — no seed sets a parent.

Building a hierarchy means introducing header accounts ("Current Assets",
"Operating Expenses") that are not postable. That changes the shape of the chart
of accounts and how statements group, which is an accounting design decision for
whoever owns the chart — not something to infer from the code.

**Question:** is a grouped chart of accounts wanted, and if so what is the
intended grouping? Statement grouping works today via `account_group`, so this
is presentation, not correctness.

---

## 5. Per-supplier and per-customer sub-ledgers

There is one Accounts Receivable account (1100) and one Accounts Payable account
(2000). Balances per customer and per supplier are derived from operational
tables, not from the ledger.

This is the conventional design and is not a defect. If a true sub-ledger is
required for audit, the correct model is a sub-ledger table keyed to the control
account — **not** one chart-of-accounts row per counterparty, which would make
the chart unusable at scale.

**Question:** is control-account reconciliation per counterparty an actual
requirement? If not, no work is needed.

---

## 6. Money is float64

Amounts are `float64` in Go against `NUMERIC(14,4)` operational and
`NUMERIC(14,2)` ledger columns.

The immediate harm has been addressed: a sub-cent rounding residue is now
absorbed into the largest line rather than rejecting the posting, which used to
roll back the entire sale rather than just the journal.

The underlying representation is unchanged. Migrating to a decimal type is a
large, mechanical, whole-codebase change and should be planned on its own rather
than folded into stabilization work.

---

## 7. Report caching is unwired

`reports/cache` and `dashboard/cache` are stubs; `Get` and `Set` are never
called, so every report is computed live. The audit metadata used to claim
`cache_enabled: true` whenever the stub was injected; it now reports `false`.

**Before wiring a real cache**, every key must include `business_id` and
`branch_id`. Callers pass an opaque key and there is no key builder, so a key
missing either would serve one tenant's or one branch's figures to another.
Write paths also need invalidation, which does not exist. This is noted in both
cache packages.
