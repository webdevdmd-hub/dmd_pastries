-- Backfill purchasing-ready payment accounts for existing businesses.
-- Supplier payments require active purchasing payment methods that resolve to active payment accounts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO chart_of_accounts (
    id, business_id, account_code, account_name, account_type, account_group,
    normal_balance, is_system_account, is_control_account, allow_manual_posting,
    status, created_at, updated_at
)
SELECT gen_random_uuid(), b.id, seed.account_code, seed.account_name, 'asset', 'current_asset',
       'debit', TRUE, TRUE, seed.allow_manual_posting, 'active', NOW(), NOW()
FROM businesses b
CROSS JOIN (
    VALUES
        ('1000', 'Cash in Hand', TRUE),
        ('1010', 'Bank Account', TRUE),
        ('1030', 'Card Clearing Account', FALSE)
) AS seed(account_code, account_name, allow_manual_posting)
WHERE NOT EXISTS (
    SELECT 1
    FROM chart_of_accounts coa
    WHERE coa.business_id = b.id
      AND LOWER(coa.account_code) = LOWER(seed.account_code)
      AND coa.deleted_at IS NULL
);

INSERT INTO payment_methods (
    id, business_id, method_name, method_type, is_default, allow_split_payment,
    requires_reference, show_in_pos, show_in_bakery_orders, show_in_purchasing,
    show_in_expenses, show_in_dashboard_collection, status, created_at, updated_at
)
SELECT gen_random_uuid(), b.id, seed.method_name, seed.method_type,
       CASE
           WHEN seed.method_name = 'Cash'
                AND NOT EXISTS (
                    SELECT 1
                    FROM payment_methods existing_default
                    WHERE existing_default.business_id = b.id
                      AND existing_default.is_default = TRUE
                      AND existing_default.deleted_at IS NULL
                )
           THEN TRUE
           ELSE FALSE
       END,
       TRUE, seed.requires_reference, TRUE, seed.show_in_bakery_orders, TRUE,
       seed.show_in_expenses, TRUE, 'active', NOW(), NOW()
FROM businesses b
CROSS JOIN (
    VALUES
        ('Cash', 'cash', FALSE, TRUE, TRUE),
        ('Card', 'card', TRUE, TRUE, FALSE),
        ('Bank Transfer', 'bank_transfer', TRUE, FALSE, TRUE)
) AS seed(method_name, method_type, requires_reference, show_in_bakery_orders, show_in_expenses)
WHERE NOT EXISTS (
    SELECT 1
    FROM payment_methods pm
    WHERE pm.business_id = b.id
      AND LOWER(pm.method_name) = LOWER(seed.method_name)
      AND pm.deleted_at IS NULL
);

UPDATE payment_methods pm
SET show_in_purchasing = TRUE,
    status = 'active',
    updated_at = NOW()
WHERE LOWER(pm.method_name) IN ('cash', 'card', 'bank transfer')
  AND pm.deleted_at IS NULL;

INSERT INTO payment_accounts (
    id, business_id, branch_id, account_name, account_type, chart_account_id,
    description, status, created_at, updated_at
)
SELECT gen_random_uuid(), br.business_id, br.id,
       seed.account_name_prefix || ' - ' || br.branch_name,
       seed.account_type,
       coa.id,
       'Default payment account for ' || seed.method_name || ' payments.',
       'active',
       NOW(),
       NOW()
FROM branches br
JOIN businesses b ON b.id = br.business_id
JOIN (
    VALUES
        ('Cash', 'Cash Box', 'cash', '1000'),
        ('Card', 'Card Clearing', 'card_clearing', '1030'),
        ('Bank Transfer', 'Bank Account', 'bank', '1010')
) AS seed(method_name, account_name_prefix, account_type, chart_code) ON TRUE
JOIN chart_of_accounts coa
  ON coa.business_id = br.business_id
 AND coa.account_code = seed.chart_code
 AND coa.status = 'active'
 AND coa.deleted_at IS NULL
WHERE br.status = 'active'
  AND br.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM payment_accounts pa
      WHERE pa.business_id = br.business_id
        AND pa.branch_id = br.id
        AND pa.chart_account_id = coa.id
        AND pa.deleted_at IS NULL
  );

UPDATE payment_method_account_mappings pmam
SET payment_account_id = ready.payment_account_id,
    status = 'active',
    updated_at = NOW()
FROM (
    SELECT br.business_id, br.id AS branch_id, pm.id AS payment_method_id, pa.id AS payment_account_id
    FROM branches br
    JOIN payment_methods pm
      ON pm.business_id = br.business_id
     AND LOWER(pm.method_name) IN ('cash', 'card', 'bank transfer')
     AND pm.deleted_at IS NULL
    JOIN (
        VALUES
            ('cash', '1000'),
            ('card', '1030'),
            ('bank transfer', '1010')
    ) AS seed(method_name, chart_code)
      ON LOWER(pm.method_name) = seed.method_name
    JOIN chart_of_accounts coa
      ON coa.business_id = br.business_id
     AND coa.account_code = seed.chart_code
     AND coa.deleted_at IS NULL
    JOIN payment_accounts pa
      ON pa.business_id = br.business_id
     AND pa.branch_id = br.id
     AND pa.chart_account_id = coa.id
     AND pa.status = 'active'
     AND pa.deleted_at IS NULL
    WHERE br.status = 'active'
      AND br.deleted_at IS NULL
) ready
WHERE pmam.business_id = ready.business_id
  AND pmam.branch_id = ready.branch_id
  AND pmam.payment_method_id = ready.payment_method_id
  AND pmam.deleted_at IS NULL;

INSERT INTO payment_method_account_mappings (
    id, business_id, branch_id, payment_method_id, payment_account_id,
    status, created_at, updated_at
)
SELECT gen_random_uuid(), ready.business_id, ready.branch_id, ready.payment_method_id,
       ready.payment_account_id, 'active', NOW(), NOW()
FROM (
    SELECT br.business_id, br.id AS branch_id, pm.id AS payment_method_id, pa.id AS payment_account_id
    FROM branches br
    JOIN payment_methods pm
      ON pm.business_id = br.business_id
     AND LOWER(pm.method_name) IN ('cash', 'card', 'bank transfer')
     AND pm.status = 'active'
     AND pm.show_in_purchasing = TRUE
     AND pm.deleted_at IS NULL
    JOIN (
        VALUES
            ('cash', '1000'),
            ('card', '1030'),
            ('bank transfer', '1010')
    ) AS seed(method_name, chart_code)
      ON LOWER(pm.method_name) = seed.method_name
    JOIN chart_of_accounts coa
      ON coa.business_id = br.business_id
     AND coa.account_code = seed.chart_code
     AND coa.deleted_at IS NULL
    JOIN payment_accounts pa
      ON pa.business_id = br.business_id
     AND pa.branch_id = br.id
     AND pa.chart_account_id = coa.id
     AND pa.status = 'active'
     AND pa.deleted_at IS NULL
    WHERE br.status = 'active'
      AND br.deleted_at IS NULL
) ready
WHERE NOT EXISTS (
    SELECT 1
    FROM payment_method_account_mappings pmam
    WHERE pmam.business_id = ready.business_id
      AND pmam.branch_id = ready.branch_id
      AND pmam.payment_method_id = ready.payment_method_id
      AND pmam.deleted_at IS NULL
);

WITH first_branch AS (
    SELECT DISTINCT ON (business_id) business_id, id AS branch_id
    FROM branches
    WHERE status = 'active'
      AND deleted_at IS NULL
    ORDER BY business_id, created_at ASC, id ASC
),
method_account AS (
    SELECT pm.id AS payment_method_id, pa.id AS payment_account_id
    FROM first_branch fb
    JOIN payment_methods pm
      ON pm.business_id = fb.business_id
     AND LOWER(pm.method_name) IN ('cash', 'card', 'bank transfer')
     AND pm.deleted_at IS NULL
    JOIN (
        VALUES
            ('cash', '1000'),
            ('card', '1030'),
            ('bank transfer', '1010')
    ) AS seed(method_name, chart_code)
      ON LOWER(pm.method_name) = seed.method_name
    JOIN chart_of_accounts coa
      ON coa.business_id = fb.business_id
     AND coa.account_code = seed.chart_code
     AND coa.deleted_at IS NULL
    JOIN payment_accounts pa
      ON pa.business_id = fb.business_id
     AND pa.branch_id = fb.branch_id
     AND pa.chart_account_id = coa.id
     AND pa.status = 'active'
     AND pa.deleted_at IS NULL
)
UPDATE payment_methods pm
SET default_payment_account_id = method_account.payment_account_id,
    updated_at = NOW()
FROM method_account
WHERE pm.id = method_account.payment_method_id
  AND pm.default_payment_account_id IS NULL;
