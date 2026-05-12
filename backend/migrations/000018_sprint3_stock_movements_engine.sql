-- Sprint 3.2 stock movements engine finalization.

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS movement_direction varchar(20),
  ADD COLUMN IF NOT EXISTS reference_number varchar(150),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS is_reversal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reversed_movement_id uuid REFERENCES stock_movements(id),
  ADD COLUMN IF NOT EXISTS is_reversed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reversed_by_movement_id uuid REFERENCES stock_movements(id);

UPDATE stock_movements
SET movement_direction = CASE
  WHEN movement_type IN ('opening_stock', 'purchase_in', 'adjustment_in', 'return_in', 'transfer_in', 'production_in') THEN 'in'
  WHEN movement_type IN ('sale_out', 'adjustment_out', 'wastage', 'transfer_out', 'production_out') THEN 'out'
  ELSE 'neutral'
END
WHERE movement_direction IS NULL OR movement_direction = '';

ALTER TABLE stock_movements
  ALTER COLUMN movement_direction SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_movement_direction'
  ) THEN
    ALTER TABLE stock_movements
      ADD CONSTRAINT chk_stock_movement_direction
      CHECK (movement_direction IN ('in', 'out', 'neutral'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_movement_reversal_link'
  ) THEN
    ALTER TABLE stock_movements
      ADD CONSTRAINT chk_stock_movement_reversal_link
      CHECK ((is_reversal = false) OR (reversed_movement_id IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_movements_direction ON stock_movements(movement_direction);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_number ON stock_movements(reference_number);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by_user_id ON stock_movements(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reversed_movement_id ON stock_movements(reversed_movement_id);
