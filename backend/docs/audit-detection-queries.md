# Audit detection queries

Read-only diagnostics for the stabilization work. **Every query here is a `SELECT`.
Nothing in this file modifies data.** Run them against a read replica (or a
restored snapshot), record the results, and treat that record as the baseline:
each later phase is accepted by comparing against it.

Replace `:business_id` with the business under investigation, or drop the
predicate to sweep every tenant.

---

## 1. Cross-branch journal lines

**The core accounting defect.** Migration `000092` made the Chart of Accounts
branch-scoped, but the posting code still resolves accounts by
`(business_id, account_code)` and takes the first match. The journal *header*
carries the correct branch while its *lines* point at another branch's accounts.

```sql
SELECT je.branch_id,
       COUNT(*)                        AS cross_branch_lines,
       COUNT(DISTINCT je.id)           AS affected_entries,
       MIN(je.entry_date)              AS first_seen,
       MAX(je.entry_date)              AS last_seen
FROM journal_entry_lines jel
JOIN journal_entries   je  ON je.id  = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.id = jel.account_id
WHERE je.business_id = :business_id
  AND jel.deleted_at IS NULL
  AND je.deleted_at IS NULL
  AND coa.branch_id IS DISTINCT FROM je.branch_id
GROUP BY je.branch_id
ORDER BY cross_branch_lines DESC;
```

Breakdown by source, to see which posting paths are producing them:

```sql
SELECT je.source_type, COUNT(*) AS cross_branch_lines
FROM journal_entry_lines jel
JOIN journal_entries   je  ON je.id  = jel.journal_entry_id
JOIN chart_of_accounts coa ON coa.id = jel.account_id
WHERE je.business_id = :business_id
  AND jel.deleted_at IS NULL AND je.deleted_at IS NULL
  AND coa.branch_id IS DISTINCT FROM je.branch_id
GROUP BY je.source_type
ORDER BY cross_branch_lines DESC;
```

**Acceptance (Phase 2):** this count must stop growing. Historical rows stay
until the documented remap runs; zero *new* rows after deploy is the pass
condition.

---

## 2. Branches with missing accounting configuration

`CreateBranch` never seeded a Chart of Accounts, mappings, or payment accounts,
so every branch created after the first is unconfigured.

```sql
SELECT b.id AS branch_id,
       b.branch_name,
       COUNT(DISTINCT coa.id) AS chart_accounts,
       COUNT(DISTINCT aam.id) AS account_mappings,
       COUNT(DISTINCT pa.id)  AS payment_accounts
FROM branches b
LEFT JOIN chart_of_accounts           coa ON coa.branch_id = b.id AND coa.deleted_at IS NULL
LEFT JOIN accounting_account_mappings aam ON aam.branch_id = b.id AND aam.deleted_at IS NULL
LEFT JOIN payment_accounts            pa  ON pa.branch_id  = b.id AND pa.deleted_at  IS NULL
WHERE b.business_id = :business_id
  AND b.deleted_at IS NULL
GROUP BY b.id, b.branch_name
ORDER BY chart_accounts ASC;
```

A healthy branch shows 74 chart accounts, 24 mappings, and 3 payment accounts.

**Acceptance (Phase 3):** every active branch reports the full counts.

---

## 3. Payment accounts linked to another branch's chart account

`SeedDefaultPaymentAccountsForBusiness` loops branches but resolves the chart
account branch-blind, so secondary branches' cash/bank/card accounts point at
the first branch's ledger accounts. This is live data corruption, not just a
read bug.

```sql
SELECT pa.branch_id, pa.account_name, pa.account_type,
       coa.account_code, coa.branch_id AS chart_account_branch_id
FROM payment_accounts pa
JOIN chart_of_accounts coa ON coa.id = pa.chart_account_id
WHERE pa.business_id = :business_id
  AND pa.deleted_at IS NULL
  AND coa.branch_id IS DISTINCT FROM pa.branch_id;
```

---

## 4. Account mappings pointing at another branch's account

```sql
SELECT aam.branch_id, aam.mapping_key,
       coa.account_code, coa.branch_id AS chart_account_branch_id
FROM accounting_account_mappings aam
JOIN chart_of_accounts coa ON coa.id = aam.chart_account_id
WHERE aam.business_id = :business_id
  AND aam.deleted_at IS NULL
  AND coa.branch_id IS DISTINCT FROM aam.branch_id;
```

---

## 5. Duplicate journal source keys

**Gate for the Phase 4 unique index.** Migrations apply automatically at boot
inside a transaction, so shipping the index while duplicates exist would fail
the migration and prevent the application from starting.

```sql
SELECT business_id, source_type, source_id, COUNT(*) AS entries
FROM journal_entries
WHERE source_id IS NOT NULL
  AND deleted_at IS NULL
  AND status IN ('posted','reversed')
GROUP BY business_id, source_type, source_id
HAVING COUNT(*) > 1
ORDER BY entries DESC;
```

**Acceptance (Phase 4):** must return zero rows *before* migration `000095`
is shipped.

---

## 6. Unbalanced journal entries

There is no database constraint asserting `SUM(debit) = SUM(credit)` per entry,
and the expenses module bypasses the Go balance validator entirely.

```sql
SELECT je.id, je.entry_number, je.entry_date, je.source_type,
       SUM(jel.debit_amount)  AS total_debit,
       SUM(jel.credit_amount) AS total_credit,
       SUM(jel.debit_amount) - SUM(jel.credit_amount) AS difference
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.deleted_at IS NULL
WHERE je.business_id = :business_id
  AND je.deleted_at IS NULL
  AND je.status IN ('posted','reversed')
GROUP BY je.id, je.entry_number, je.entry_date, je.source_type
HAVING SUM(jel.debit_amount) <> SUM(jel.credit_amount)
ORDER BY ABS(SUM(jel.debit_amount) - SUM(jel.credit_amount)) DESC;
```

Also check the header totals agree with the lines:

```sql
SELECT je.id, je.entry_number, je.total_debit, je.total_credit,
       SUM(jel.debit_amount) AS line_debit, SUM(jel.credit_amount) AS line_credit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.deleted_at IS NULL
WHERE je.business_id = :business_id AND je.deleted_at IS NULL
GROUP BY je.id, je.entry_number, je.total_debit, je.total_credit
HAVING je.total_debit  <> SUM(jel.debit_amount)
    OR je.total_credit <> SUM(jel.credit_amount);
```

---

## 7. Stale branch access

`user_branch_access` rows are inserted and never deleted by tenant code, so a
user transferred from branch A to branch B keeps A in their allowed set forever.

```sql
SELECT u.id AS user_id, u.full_name, u.email,
       u.branch_id            AS assigned_branch_id,
       uba.branch_id          AS stale_branch_id,
       u.can_access_all_branches
FROM user_branch_access uba
JOIN users u ON u.id = uba.user_id
WHERE u.business_id = :business_id
  AND u.deleted_at IS NULL
  AND u.can_access_all_branches = false
  AND u.branch_id IS NOT NULL
  AND uba.branch_id <> u.branch_id
ORDER BY u.full_name;
```

**Acceptance (Phase 1):** no *new* rows appear after deploy. Existing rows are
cleared by the documented backfill, which is run by a human.

---

## 8. Sales with unrelieved accounts receivable

Customer payments against an outstanding POS sale post no journal, so AR is
debited at sale time and never credited back.

```sql
SELECT s.branch_id,
       COUNT(*)                     AS sales_with_unposted_payments,
       SUM(sp.amount)               AS unposted_payment_amount
FROM sale_payments sp
JOIN sales s ON s.id = sp.sale_id
WHERE s.business_id = :business_id
  AND s.deleted_at IS NULL
  AND sp.deleted_at IS NULL
  AND sp.payment_status IN ('completed','partially_refunded','refunded')
  AND sp.journal_entry_id IS NULL
GROUP BY s.branch_id;
```

Compare the operational AR against the ledger AR:

```sql
WITH operational AS (
    SELECT branch_id, SUM(GREATEST(total_amount - paid_amount, 0)) AS amount
    FROM sales
    WHERE business_id = :business_id
      AND deleted_at IS NULL
      AND sale_status IN ('completed','partially_refunded','refunded')
    GROUP BY branch_id
),
ledger AS (
    SELECT je.branch_id, SUM(jel.debit_amount - jel.credit_amount) AS amount
    FROM journal_entry_lines jel
    JOIN journal_entries   je  ON je.id  = jel.journal_entry_id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.business_id = :business_id
      AND je.deleted_at IS NULL AND jel.deleted_at IS NULL
      AND je.status IN ('posted','reversed')
      AND coa.account_code = '1100'
    GROUP BY je.branch_id
)
SELECT COALESCE(o.branch_id, l.branch_id) AS branch_id,
       COALESCE(o.amount, 0) AS operational_ar,
       COALESCE(l.amount, 0) AS ledger_ar,
       COALESCE(l.amount, 0) - COALESCE(o.amount, 0) AS variance
FROM operational o
FULL OUTER JOIN ledger l ON l.branch_id = o.branch_id;
```

**Acceptance (Phase 6):** `sales_with_unposted_payments` trends to zero for new
activity, and the AR variance stops widening.

---

## 9. Operational records missing journals

```sql
SELECT 'pos_sale' AS record_type, branch_id, COUNT(*) AS missing_journals
FROM sales
WHERE business_id = :business_id AND deleted_at IS NULL
  AND sale_status IN ('completed','partially_refunded','refunded')
  AND accounting_journal_entry_id IS NULL
GROUP BY branch_id
UNION ALL
SELECT 'bakery_order', branch_id, COUNT(*)
FROM bakery_orders
WHERE business_id = :business_id AND deleted_at IS NULL
  AND order_status = 'completed'
  AND accounting_journal_entry_id IS NULL
GROUP BY branch_id
UNION ALL
SELECT 'stock_movement', branch_id, COUNT(*)
FROM stock_movements
WHERE business_id = :business_id AND deleted_at IS NULL
  AND movement_type IN ('opening_stock','adjustment_in','adjustment_out','wastage')
  AND accounting_journal_entry_id IS NULL
GROUP BY branch_id;
```

---

## 10. Accounts payable predicate variance

The reports module counts a bill as payable when `status <> 'cancelled'`; the
reconciliation module requires `status = 'posted'`. Draft bills therefore appear
in one and not the other, which is the usual explanation for a non-zero AP
variance.

```sql
SELECT branch_id,
       SUM(balance_amount) FILTER (WHERE status <> 'cancelled') AS reports_basis,
       SUM(balance_amount) FILTER (WHERE status =  'posted')    AS reconciliation_basis,
       SUM(balance_amount) FILTER (WHERE status <> 'cancelled')
         - SUM(balance_amount) FILTER (WHERE status = 'posted') AS variance
FROM purchase_invoices
WHERE business_id = :business_id
  AND deleted_at IS NULL
  AND payment_status IN ('unpaid','partial','overdue')
GROUP BY branch_id;
```

**Acceptance (Phase 7):** `variance` explained entirely by draft bills, and both
figures sourced from the same shared predicate.

---

## 11. Sales report join inflation

Confirms the reporting defect where header amounts are summed across a join to
`sale_items`, multiplying every total by the basket size.

```sql
SELECT (SELECT SUM(s.total_amount)
        FROM sales s
        WHERE s.business_id = :business_id AND s.deleted_at IS NULL
          AND s.sale_status IN ('completed','partially_refunded','refunded')) AS correct_total,
       (SELECT SUM(s.total_amount)
        FROM sales s
        LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE s.business_id = :business_id AND s.deleted_at IS NULL
          AND s.sale_status IN ('completed','partially_refunded','refunded')) AS inflated_total;
```

**Acceptance (Phase 7):** `/reports/sales/summary` returns `correct_total`
(plus the refund deduction), not `inflated_total`.
