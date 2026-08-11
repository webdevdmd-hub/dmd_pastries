# Accounting branch backfill

Remediation for accounting data written while account lookups ignored the branch.

**Nothing in this document runs automatically.** Each step is executed by an
operator, in order, after a backup. Every step has a `SELECT` that shows the
blast radius before anything is written.

---

## Background

Migration `000092` made the chart of accounts, account mappings and payment
accounts branch-scoped, cloning them per branch. The Go code kept resolving
accounts by `(business_id, account_code)` and taking the first match, which now
returns an arbitrary branch's copy. Two kinds of damage follow:

1. **Journal lines that reference another branch's accounts.** The entry header
   carries the correct branch; its lines do not. A per-branch trial balance and
   the branch's chart of accounts disagree with the ledger.
2. **Payment accounts linked to another branch's ledger account.** Every branch
   created after the first had its cash/bank/card payment accounts pointed at
   branch #1's `1000` / `1010` / `1030`.

Application code no longer produces either (migration `000095` enforces the
first with `NOT VALID` foreign keys, so all *new* writes are checked). Existing
rows are unaffected by the code change and are what this document addresses.

## Before you start

Run the readiness report and record the result. It is both the starting
inventory and the acceptance criteria:

```
GET /api/v1/accounting/setup-readiness/branches
```

Every branch reports `ready`, `incomplete`, or `corrupt`:

- `incomplete` — missing chart accounts, mappings, or payment accounts. Fixed by
  **step 1**.
- `corrupt` — configuration or ledger rows point at another branch. Fixed by
  **steps 2 and 3**.

The equivalent read-only SQL is in [audit-detection-queries.md](audit-detection-queries.md)
sections 1–4.

---

## Step 1 — Seed missing branch configuration

**Additive and idempotent. Safe to re-run.**

Prefer the API over SQL: it is permissioned, writes an audit record, and reuses
the same seeder that branch creation now uses.

For each branch reported `incomplete`, switch into that branch and call:

```
POST /api/v1/accounting/chart-of-accounts/seed-defaults
POST /api/v1/accounting/account-mappings/seed-defaults
POST /api/v1/accounting/payment-accounts/seed-defaults
```

Each is scoped to the caller's currently selected branch, so switch branch
between runs. Re-run the readiness report; those branches should move off
`incomplete`.

> Branches created from now on are seeded automatically as part of branch
> creation, so this step is only for branches that already exist.

---

## Step 2 — Repoint payment accounts at their own branch's ledger account

Review first:

```sql
SELECT pa.id, pa.branch_id, pa.account_name, pa.account_type,
       coa.account_code,
       coa.branch_id AS current_chart_branch_id,
       target.id     AS corrected_chart_account_id
FROM payment_accounts pa
JOIN chart_of_accounts coa ON coa.id = pa.chart_account_id
LEFT JOIN chart_of_accounts target
       ON target.business_id = pa.business_id
      AND target.branch_id   = pa.branch_id
      AND target.account_code = coa.account_code
      AND target.status = 'active'
      AND target.deleted_at IS NULL
WHERE pa.business_id = :business_id
  AND pa.deleted_at IS NULL
  AND coa.branch_id IS DISTINCT FROM pa.branch_id;
```

Any row with a NULL `corrected_chart_account_id` means step 1 has not been
completed for that branch. Go back and finish it — do not proceed.

Then, when every row has a target:

```sql
BEGIN;

UPDATE payment_accounts pa
SET chart_account_id = target.id,
    updated_at = now()
FROM chart_of_accounts coa, chart_of_accounts target
WHERE coa.id = pa.chart_account_id
  AND target.business_id  = pa.business_id
  AND target.branch_id    = pa.branch_id
  AND target.account_code = coa.account_code
  AND target.status = 'active'
  AND target.deleted_at IS NULL
  AND pa.business_id = :business_id
  AND pa.deleted_at IS NULL
  AND coa.branch_id IS DISTINCT FROM pa.branch_id;

-- Expect 0.
SELECT COUNT(*) AS remaining
FROM payment_accounts pa
JOIN chart_of_accounts coa ON coa.id = pa.chart_account_id
WHERE pa.business_id = :business_id
  AND pa.deleted_at IS NULL
  AND coa.branch_id IS DISTINCT FROM pa.branch_id;

COMMIT;
```

Apply the same shape to `accounting_account_mappings` (`aam.branch_id` vs
`coa.branch_id`), which has the identical defect.

---

## Step 3 — Remap historical journal lines

This rewrites posted ledger rows. Take a backup first, and run it in a
maintenance window.

It does **not** change any amount. Each line keeps its debit/credit and moves to
the same account code inside its own entry's branch, so every trial balance
total is preserved while the per-branch split becomes correct.

Review the blast radius, and specifically the residue that cannot be remapped:

```sql
-- Lines whose target account code does not exist in the entry's branch.
-- These need manual triage; step 1 usually eliminates them.
SELECT je.branch_id, coa.account_code, COUNT(*) AS unmappable_lines
FROM journal_entry_lines jel
JOIN journal_entries   je  ON je.id  = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.id = jel.account_id
LEFT JOIN chart_of_accounts target
       ON target.business_id  = je.business_id
      AND target.branch_id    = je.branch_id
      AND target.account_code = coa.account_code
      AND target.deleted_at IS NULL
WHERE je.business_id = :business_id
  AND jel.deleted_at IS NULL AND je.deleted_at IS NULL
  AND coa.branch_id IS DISTINCT FROM je.branch_id
  AND target.id IS NULL
GROUP BY je.branch_id, coa.account_code;
```

Proceed only when that returns no rows.

```sql
BEGIN;

-- Repoint cross-branch lines at the same account code in the entry's branch.
UPDATE journal_entry_lines jel
SET account_id = target.id,
    branch_id  = je.branch_id,
    updated_at = now()
FROM journal_entries je, chart_of_accounts coa, chart_of_accounts target
WHERE je.id  = jel.journal_entry_id
  AND coa.id = jel.account_id
  AND target.business_id  = je.business_id
  AND target.branch_id    = je.branch_id
  AND target.account_code = coa.account_code
  AND target.deleted_at IS NULL
  AND jel.business_id = :business_id
  AND jel.deleted_at IS NULL
  AND je.deleted_at IS NULL
  AND coa.branch_id IS DISTINCT FROM je.branch_id;

-- Stamp the branch on lines that were already pointing at the right account.
UPDATE journal_entry_lines jel
SET branch_id = je.branch_id,
    updated_at = now()
FROM journal_entries je
WHERE je.id = jel.journal_entry_id
  AND jel.business_id = :business_id
  AND jel.branch_id IS NULL
  AND jel.deleted_at IS NULL;

-- Both must return 0 before committing.
SELECT COUNT(*) AS cross_branch_lines
FROM journal_entry_lines jel
JOIN journal_entries   je  ON je.id  = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.id = jel.account_id
WHERE je.business_id = :business_id
  AND jel.deleted_at IS NULL AND je.deleted_at IS NULL
  AND coa.branch_id IS DISTINCT FROM je.branch_id;

SELECT COUNT(*) AS unstamped_lines
FROM journal_entry_lines
WHERE business_id = :business_id AND branch_id IS NULL AND deleted_at IS NULL;

COMMIT;
```

Confirm the ledger is unchanged in aggregate — this should match the figures you
recorded before the run:

```sql
SELECT SUM(debit_amount) AS total_debit, SUM(credit_amount) AS total_credit
FROM journal_entry_lines
WHERE business_id = :business_id AND deleted_at IS NULL;
```

---

## Step 4 — Harden the constraints

Only once the readiness report shows **no branch in `corrupt` state across every
business**, and section 1 of the detection queries returns zero rows.

Migration `000095` added `journal_entry_lines.branch_id` and two composite
foreign keys as `NOT VALID`: they are enforced for new writes but historical
rows were never checked. This step checks them and closes the column.

```sql
BEGIN;

ALTER TABLE journal_entry_lines ALTER COLUMN branch_id SET NOT NULL;

ALTER TABLE journal_entry_lines VALIDATE CONSTRAINT fk_jel_entry_branch;
ALTER TABLE journal_entry_lines VALIDATE CONSTRAINT fk_jel_account_branch;

COMMIT;
```

If either `VALIDATE` fails, a cross-branch row survives: roll back, re-run the
step 3 review query, and remediate before retrying.

> Do not fold this into an automatic migration. Migrations are applied at
> start-up inside a transaction, so a failure here would prevent the application
> from booting.

---

## Step 5 — Enforce journal idempotency at the database

Posting is guarded in application code: every path checks for an existing entry
with the same `(source_type, source_id)` before creating one. That check and the
insert are not atomic, so a database constraint is the only real guarantee.

This is **not** shipped as an automatic migration on purpose. Creating a unique
index fails if duplicates already exist, and migrations are applied at start-up
inside a transaction — a failure here would prevent the application from
booting.

Find duplicates first (this is section 5 of
[audit-detection-queries.md](audit-detection-queries.md)):

```sql
SELECT business_id, source_type, source_id, COUNT(*) AS entries,
       ARRAY_AGG(id ORDER BY created_at) AS entry_ids
FROM journal_entries
WHERE source_id IS NOT NULL
  AND deleted_at IS NULL
  AND status IN ('posted','reversed')
GROUP BY business_id, source_type, source_id
HAVING COUNT(*) > 1;
```

Each duplicate is a document posted twice, so the ledger is overstated by the
duplicate's value. Resolve them by reversing the surplus entry through the
application (`POST /api/v1/accounting/journal-entries/:id/reverse`) rather than
deleting rows, so the correction stays visible and auditable.

> `purchase_invoice_edit` entries are expected to repeat and are **not**
> duplicates: that path deliberately uses a fresh `source_id` per edit so each
> revision keeps its own audit trail.

Once the query returns nothing:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_source_unique
ON journal_entries (business_id, source_type, source_id)
WHERE source_id IS NOT NULL
  AND deleted_at IS NULL
  AND status IN ('posted','reversed');
```

This takes a write lock on `journal_entries` while it builds. At POS data
volumes that is brief, but run it in a maintenance window.

---

## Step 6 — Relieve historical accounts receivable

Separate from the branch work, and only relevant once the customer-payment
posting is deployed.

Customer payments against an outstanding POS sale previously posted no journal,
so accounts receivable was debited at sale time and never credited back. New
payments now post correctly; historical ones need the backfill endpoint.

Per branch, and preferably a date window at a time:

```
POST /api/v1/accounting/backfill-journals
{
  "branch_id": "<branch>",
  "targets": ["pos_sale_payments"],
  "date_from": "2026-01-01",
  "date_to":   "2026-01-31",
  "dry_run":   true
}
```

Run with `"dry_run": true` first and review the candidate counts. `branch_id` is
mandatory — an unscoped backfill would post across every branch.

Verify with the AR comparison in
[audit-detection-queries.md](audit-detection-queries.md) section 8: the variance
between operational and ledger AR should close rather than continue widening.

## Step 7 — Repair zero-cost sale movements, then post COGS

Sales recorded before a product had any cost history produced `sale_out` stock
movements with `total_cost = 0`, so the COGS journal was skipped and can never
post from those movements as-is. The `sale_movement_costs` backfill target
re-prices such movements from the product/variant `cost_price` (variants fall
back to their parent product), after which the `pos_sales` target posts the
COGS journal from the repaired cost. Run them in that order — it is the default
order when no `targets` are supplied:

```
POST /api/v1/accounting/backfill-journals
{ "branch_id": "<branch>", "targets": ["sale_movement_costs"], "dry_run": true }
```

then the same with `["pos_sales"]`. Movements already linked to a journal are
never touched, and rows whose product has no `cost_price` are reported as
skipped. Before running at scale, create the idempotency index from Step 5 —
it is the database-level guard against duplicate journals on re-runs.
