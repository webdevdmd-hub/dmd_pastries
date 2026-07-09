-- Reclassify historical bakery order payment stages from the actual payment
-- sequence. This is data-only: it does not create payments, journals, or links.

WITH ordered_payments AS (
    SELECT
        bop.id,
        bop.business_id,
        bop.payment_type AS current_payment_type,
        ROUND(bop.amount, 2) AS amount,
        ROUND(bo.total_amount, 2) AS total_amount,
        ROUND(
            COALESCE(
                SUM(bop.amount) OVER (
                    PARTITION BY bop.business_id, bop.bakery_order_id
                    ORDER BY bop.paid_at ASC, bop.created_at ASC, bop.id ASC
                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ),
                0
            ),
            2
        ) AS paid_before
    FROM bakery_order_payments bop
    JOIN bakery_orders bo
        ON bo.id = bop.bakery_order_id
       AND bo.business_id = bop.business_id
       AND bo.deleted_at IS NULL
),
reclassified_payments AS (
    SELECT
        id,
        business_id,
        CASE
            WHEN amount >= GREATEST(ROUND(total_amount - paid_before, 2), 0) THEN 'full'
            WHEN paid_before <= 0 THEN 'deposit'
            ELSE 'balance'
        END AS corrected_payment_type
    FROM ordered_payments
),
updated_payments AS (
    UPDATE bakery_order_payments bop
    SET payment_type = rp.corrected_payment_type
    FROM reclassified_payments rp
    WHERE bop.id = rp.id
      AND bop.business_id = rp.business_id
      AND bop.payment_type IS DISTINCT FROM rp.corrected_payment_type
    RETURNING bop.id, bop.business_id, bop.payment_type
)
UPDATE audit_logs al
SET metadata = jsonb_set(
    COALESCE(al.metadata, '{}'::jsonb),
    '{payment_type}',
    to_jsonb(up.payment_type),
    true
)
FROM updated_payments up
WHERE al.business_id = up.business_id
  AND al.event_type = 'bakery_order.payment_added'
  AND al.entity_id = up.id::text;
