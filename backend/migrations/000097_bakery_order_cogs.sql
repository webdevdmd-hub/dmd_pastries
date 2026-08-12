-- 000097: Bakery order COGS at completion (Phase 4 / W1)
--
-- Decision (2026-08-12 workshop, §1): stock leaves and COGS posts when a
-- bakery order is marked completed — the same event that posts revenue.
-- These columns link the order to its COGS journal (idempotency) and to the
-- reversal posted when a completed order is cancelled.

ALTER TABLE bakery_orders
  ADD COLUMN IF NOT EXISTS cogs_journal_entry_id uuid,
  ADD COLUMN IF NOT EXISTS cogs_reversal_journal_entry_id uuid;

CREATE INDEX IF NOT EXISTS idx_bakery_orders_cogs_journal
  ON bakery_orders (cogs_journal_entry_id)
  WHERE cogs_journal_entry_id IS NOT NULL;
