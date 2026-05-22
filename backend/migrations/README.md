# Migrations

Runtime `gorm.AutoMigrate` is disabled.

The Docker image runs migrations automatically before starting the API:

```bash
/app/migrate && /app/api
```

For local development, run all pending migrations with:

```bash
go run ./cmd/migrate
```

The runner stores applied migrations in `schema_migrations`.

Manual psql execution is still supported:

```bash
psql "$DATABASE_URL" -f migrations/000001_phase0_foundation.sql
psql "$DATABASE_URL" -f migrations/000002_phase1_business_workspace.sql
psql "$DATABASE_URL" -f migrations/000003_phase2_settings_foundation.sql
psql "$DATABASE_URL" -f migrations/000004_phase2_branch_settings_upgrade.sql
psql "$DATABASE_URL" -f migrations/000005_phase2_masterdata_categories.sql
psql "$DATABASE_URL" -f migrations/000006_phase2_units_measurements.sql
psql "$DATABASE_URL" -f migrations/000007_phase2_tax_rates.sql
psql "$DATABASE_URL" -f migrations/000008_phase2_payment_methods.sql
psql "$DATABASE_URL" -f migrations/000009_phase2_workflow_statuses.sql
psql "$DATABASE_URL" -f migrations/000010_sprint2_products.sql
psql "$DATABASE_URL" -f migrations/000011_storage_file_ids.sql
psql "$DATABASE_URL" -f migrations/000012_sprint2_pos_billing.sql
psql "$DATABASE_URL" -f migrations/000013_sprint2_payments.sql
psql "$DATABASE_URL" -f migrations/000014_sprint2_held_sales.sql
psql "$DATABASE_URL" -f migrations/000015_sprint2_customers.sql
psql "$DATABASE_URL" -f migrations/000016_customers_quick_create_contact_optional.sql
psql "$DATABASE_URL" -f migrations/000017_sprint3_inventory.sql
psql "$DATABASE_URL" -f migrations/000018_sprint3_stock_movements_engine.sql
psql "$DATABASE_URL" -f migrations/000019_sprint3_suppliers.sql
psql "$DATABASE_URL" -f migrations/000020_sprint3_purchasing.sql
psql "$DATABASE_URL" -f migrations/000021_sprint4_packaging.sql
psql "$DATABASE_URL" -f migrations/000022_sprint4_recipes.sql
psql "$DATABASE_URL" -f migrations/000023_sprint4_manufacturing.sql
psql "$DATABASE_URL" -f migrations/000024_sprint4_ingredients.sql
psql "$DATABASE_URL" -f migrations/000025_sprint4_bakery_orders.sql
psql "$DATABASE_URL" -f migrations/000026_branch_access_scope.sql
psql "$DATABASE_URL" -f migrations/000027_backfill_default_branches.sql
psql "$DATABASE_URL" -f migrations/000028_backfill_role_permissions.sql
psql "$DATABASE_URL" -f migrations/000029_granular_rbac_permissions.sql
psql "$DATABASE_URL" -f migrations/000030_convert_manage_permissions_to_granular.sql
psql "$DATABASE_URL" -f migrations/000031_ingredient_packaging_image_url_compat.sql
psql "$DATABASE_URL" -f migrations/000032_strict_branch_owned_data.sql
psql "$DATABASE_URL" -f migrations/000033_dashboard_intelligence_permissions.sql
psql "$DATABASE_URL" -f migrations/000034_receipt_layouts.sql
psql "$DATABASE_URL" -f migrations/000035_stock_locations_inventory_foundation.sql
psql "$DATABASE_URL" -f migrations/000036_product_variant_inventory.sql
psql "$DATABASE_URL" -f migrations/000037_recipe_product_variant_output.sql
psql "$DATABASE_URL" -f migrations/000038_bakery_order_item_variants_custom.sql
psql "$DATABASE_URL" -f migrations/000039_bakery_order_item_production_batches.sql
psql "$DATABASE_URL" -f migrations/000040_purchase_invoice_payments.sql
psql "$DATABASE_URL" -f migrations/000041_chart_of_accounts.sql
psql "$DATABASE_URL" -f migrations/000042_journal_entries.sql
```

The API now verifies required tables at startup and fails fast if migrations were not applied.
