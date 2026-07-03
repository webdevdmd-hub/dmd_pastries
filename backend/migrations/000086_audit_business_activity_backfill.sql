-- Best-effort audit label repair for rows where the event type already
-- identifies the business entity. Ambiguous generic settings rows are left as-is.

UPDATE audit_logs
SET entity_type = 'journal_entry',
    module_name = 'journal_entry'
WHERE event_type LIKE 'accounting.journal_entry_%'
  AND entity_type <> 'journal_entry';

UPDATE audit_logs
SET entity_type = 'chart_account',
    module_name = 'chart_account'
WHERE event_type LIKE 'accounting.chart_account_%'
  AND entity_type <> 'chart_account';

UPDATE audit_logs
SET entity_type = 'payment_account',
    module_name = 'payment_account'
WHERE event_type LIKE 'payment_account.%'
  AND entity_type <> 'payment_account';

UPDATE audit_logs
SET entity_type = 'stock_transfer',
    module_name = 'stock_transfer'
WHERE event_type LIKE 'stock_transfer.%'
  AND entity_type <> 'stock_transfer';

UPDATE audit_logs
SET entity_type = 'stock_movement',
    module_name = 'stock_movement'
WHERE event_type LIKE 'stock_movement.%'
  AND entity_type <> 'stock_movement';

UPDATE audit_logs
SET entity_type = 'stock_movement',
    module_name = 'stock_movement'
WHERE event_type IN ('inventory.opening_stock_created', 'inventory.adjusted')
  AND entity_type <> 'stock_movement';

UPDATE audit_logs
SET entity_type = 'purchase_return',
    module_name = 'purchase_return'
WHERE event_type LIKE 'purchase_return.%'
  AND entity_type <> 'purchase_return';

UPDATE audit_logs
SET entity_type = 'production_batch',
    module_name = 'production_batch'
WHERE (event_type LIKE 'production_batch.%' OR event_type LIKE 'production.%')
  AND entity_type <> 'production_batch';

UPDATE audit_logs
SET entity_type = 'sale_refund',
    module_name = 'sale_refund'
WHERE event_type = 'sale.refunded'
  AND entity_type <> 'sale_refund'
  AND metadata ? 'refund_number';

UPDATE audit_logs
SET entity_type = 'bakery_order_payment',
    module_name = 'bakery_order_payment'
WHERE event_type = 'bakery_order.payment_added'
  AND entity_type <> 'bakery_order_payment'
  AND (metadata ? 'payment_method_name' OR metadata ? 'payment_method_name_snapshot');
