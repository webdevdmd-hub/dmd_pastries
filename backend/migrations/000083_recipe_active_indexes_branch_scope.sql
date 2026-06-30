-- Keep active recipe uniqueness scoped to the branch that owns the recipe.
-- Migration 000037 added variant-aware indexes, but they were business-wide.
-- Recipes are branch-owned after 000032, so cross-branch recipes for the same
-- product should not conflict.

DROP INDEX IF EXISTS idx_recipes_one_active_per_product_root;
DROP INDEX IF EXISTS idx_recipes_one_active_per_product_variant;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_one_active_per_branch_product_root
  ON recipes(business_id, branch_id, product_id)
  WHERE product_variant_id IS NULL
    AND is_active = true
    AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_one_active_per_branch_product_variant
  ON recipes(business_id, branch_id, product_id, product_variant_id)
  WHERE product_variant_id IS NOT NULL
    AND is_active = true
    AND deleted_at IS NULL;
