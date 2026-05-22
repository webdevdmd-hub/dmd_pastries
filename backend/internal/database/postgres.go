package database

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"pastries-pos/internal/config"
)

func NewPostgres(cfg config.Config) (*gorm.DB, error) {
	return gorm.Open(postgres.New(postgres.Config{
		DSN:                  cfg.PostgresDSN(),
		PreferSimpleProtocol: true,
	}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
}

func VerifySchema(db *gorm.DB) error {
	requiredTables := []string{
		"businesses",
		"company_settings",
		"business_settings",
		"branches",
		"tax_rates",
		"payment_methods",
		"unit_categories",
		"units",
		"order_statuses",
		"payment_statuses",
		"product_categories",
		"ingredient_categories",
		"packaging_categories",
		"supplier_categories",
		"products",
		"product_variants",
		"product_media",
		"product_prices",
		"product_taxes",
		"sales",
		"sale_items",
		"sale_payments",
		"sale_refunds",
		"sale_voids",
		"held_sales",
		"held_sale_items",
		"payment_refunds",
		"payment_reconciliations",
		"chart_of_accounts",
		"journal_entries",
		"journal_entry_lines",
		"customers",
		"customer_tags",
		"customer_tag_mappings",
		"customer_notes",
		"inventory_items",
		"stock_locations",
		"inventory_location_balances",
		"stock_transfers",
		"stock_movements",
		"inventory_adjustments",
		"expiry_batches",
		"ingredients",
		"suppliers",
		"supplier_contacts",
		"supplier_notes",
		"purchase_orders",
		"purchase_order_items",
		"purchase_invoices",
		"purchase_invoice_items",
		"purchase_invoice_payments",
		"purchase_receipts",
		"purchase_receipt_items",
		"packaging_items",
		"packaging_usage_rules",
		"recipes",
		"recipe_ingredients",
		"recipe_packaging",
		"recipe_versions",
		"production_batches",
		"production_ingredient_consumptions",
		"production_packaging_consumptions",
		"production_outputs",
		"bakery_orders",
		"bakery_order_items",
		"bakery_order_payments",
		"bakery_order_productions",
		"bakery_order_packaging",
		"users",
		"user_branch_access",
		"user_invitations",
		"roles",
		"permissions",
		"role_permissions",
		"subscriptions",
		"audit_logs",
	}

	for _, table := range requiredTables {
		if !db.Migrator().HasTable(table) {
			return fmt.Errorf("missing required table %q; run go run ./cmd/migrate", table)
		}
	}

	requiredColumns := map[string][]string{
		"users":                     {"avatar_file_id", "current_branch_id", "can_access_all_branches"},
		"company_settings":          {"logo_file_id"},
		"product_categories":        {"image_file_id"},
		"products":                  {"image_file_id"},
		"product_variants":          {"image_file_id"},
		"product_media":             {"file_id", "bucket_id"},
		"inventory_items":           {"product_variant_id"},
		"recipes":                   {"product_variant_id"},
		"production_batches":        {"product_variant_id"},
		"production_outputs":        {"product_variant_id"},
		"bakery_order_items":        {"product_variant_id", "product_variant_name_snapshot", "item_name_snapshot", "item_source"},
		"bakery_order_productions":  {"bakery_order_item_id"},
		"purchase_invoice_payments": {"payment_method_type_snapshot", "payment_status", "reference_number", "paid_by_user_id", "paid_at", "deleted_at"},
		"sale_payments":             {"branch_id", "payment_method_type_snapshot", "provider_transaction_id", "payment_status", "paid_by_user_id", "notes", "deleted_at"},
		"chart_of_accounts":         {"parent_account_id", "account_code", "account_name", "account_type", "account_group", "normal_balance", "is_system_account", "is_control_account", "allow_manual_posting", "status", "deleted_at"},
		"journal_entries":           {"branch_id", "entry_number", "entry_date", "reference_number", "source_type", "source_id", "narration", "status", "total_debit", "total_credit", "posted_at", "posted_by_user_id", "reversed_entry_id", "reversed_at", "reversed_by_user_id", "deleted_at"},
		"journal_entry_lines":       {"journal_entry_id", "account_id", "line_number", "debit_amount", "credit_amount", "description", "deleted_at"},
		"stock_movements":           {"movement_direction", "reference_number", "notes", "is_reversal", "reversed_movement_id", "is_reversed", "reversed_by_movement_id", "stock_location_id", "from_stock_location_id", "to_stock_location_id"},
	}

	for table, columns := range requiredColumns {
		for _, column := range columns {
			if !db.Migrator().HasColumn(table, column) {
				return fmt.Errorf("missing required column %q.%q; run go run ./cmd/migrate", table, column)
			}
		}
	}

	return nil
}
