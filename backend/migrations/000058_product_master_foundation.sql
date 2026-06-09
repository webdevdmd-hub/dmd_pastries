-- Product Master foundation for unified item architecture.
-- This phase is additive: ingredients/packaging tables remain until downstream
-- modules are migrated to Product Master in later phases.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS item_structure varchar(50) NOT NULL DEFAULT 'single';

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS chk_products_product_type;

ALTER TABLE products
  ADD CONSTRAINT chk_products_product_type CHECK (
    product_type IN (
      'finished_product',
      'ingredient',
      'packaging',
      'raw_material',
      'semi_finished',
      'consumable',
      'equipment',
      'service',
      -- Legacy values kept temporarily so existing rows remain valid.
      'ready_to_sell',
      'made_to_order',
      'manufactured',
      'retail'
    )
  );

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS chk_products_item_structure;

ALTER TABLE products
  ADD CONSTRAINT chk_products_item_structure CHECK (
    item_structure IN ('single', 'variant', 'recipe_based', 'custom')
  );

CREATE INDEX IF NOT EXISTS idx_products_item_structure ON products(item_structure);
