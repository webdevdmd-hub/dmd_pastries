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
		"payment_accounts",
		"account_transfers",
		"platform_settlements",
		"platform_settlement_deductions",
		"sales_channels",
		"unit_categories",
		"units",
		"order_statuses",
		"payment_statuses",
		"product_categories",
		"product_category_allowed_types",
		"ingredient_categories",
		"packaging_categories",
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
		"sales_returns",
		"sales_return_items",
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
		"purchase_returns",
		"purchase_return_items",
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
		"platform_audit_logs",
	}

	for _, table := range requiredTables {
		if !db.Migrator().HasTable(table) {
			return fmt.Errorf("missing required table %q; run go run ./cmd/migrate", table)
		}
	}

	requiredColumns := map[string][]string{
		"users":                              {"avatar_file_id", "current_branch_id", "can_access_all_branches"},
		"company_settings":                   {"logo_file_id"},
		"product_categories":                 {"image_file_id"},
		"product_category_allowed_types":     {"product_category_id", "product_type"},
		"products":                           {"image_file_id"},
		"product_variants":                   {"image_file_id"},
		"product_media":                      {"file_id", "bucket_id"},
		"inventory_items":                    {"product_variant_id"},
		"recipes":                            {"product_variant_id"},
		"recipe_ingredients":                 {"branch_id", "component_product_id", "component_variant_id"},
		"recipe_packaging":                   {"branch_id", "component_product_id", "component_variant_id"},
		"production_batches":                 {"product_variant_id"},
		"production_ingredient_consumptions": {"component_product_id", "component_variant_id"},
		"production_packaging_consumptions": {
			"component_product_id",
			"component_variant_id",
			"inventory_item_id",
		},
		"production_outputs":             {"product_variant_id"},
		"bakery_order_items":             {"product_variant_id", "product_variant_name_snapshot", "item_name_snapshot", "item_source"},
		"bakery_orders":                  {"sales_channel_id", "sales_channel_name_snapshot", "external_order_number", "accounting_journal_entry_id"},
		"bakery_order_payments":          {"journal_entry_id"},
		"bakery_order_productions":       {"bakery_order_item_id"},
		"purchase_invoice_payments":      {"payment_method_type_snapshot", "payment_status", "reference_number", "paid_by_user_id", "paid_at", "deleted_at"},
		"purchase_invoices":              {"returned_amount", "credited_amount", "return_status"},
		"purchase_order_items":           {"line_type", "account_id", "account_name_snapshot", "account_code_snapshot", "description"},
		"purchase_returns":               {"purchase_receipt_id", "purchase_invoice_id", "return_number", "return_date", "status", "applied_credit_amount", "open_credit_amount", "journal_entry_id", "deleted_at"},
		"purchase_return_items":          {"purchase_return_id", "purchase_receipt_item_id", "inventory_item_id", "quantity", "stock_location_id", "stock_movement_id", "deleted_at"},
		"payment_methods":                {"show_in_pos", "show_in_bakery_orders", "show_in_purchasing", "show_in_expenses", "show_in_dashboard_collection", "default_payment_account_id"},
		"payment_accounts":               {"branch_id", "account_name", "account_type", "chart_account_id", "description", "status", "deleted_at"},
		"account_transfers":              {"branch_id", "transfer_number", "transfer_date", "from_payment_account_id", "to_payment_account_id", "from_chart_account_id", "to_chart_account_id", "amount", "status", "journal_entry_id", "deleted_at"},
		"platform_settlements":           {"branch_id", "settlement_number", "settlement_date", "platform_payment_account_id", "deposit_payment_account_id", "platform_chart_account_id", "deposit_chart_account_id", "gross_amount", "deductions_total", "net_received_amount", "status", "journal_entry_id", "deleted_at"},
		"platform_settlement_deductions": {"platform_settlement_id", "expense_account_id", "deduction_type", "amount", "deleted_at"},
		"sale_payments":                  {"branch_id", "payment_method_type_snapshot", "provider_transaction_id", "payment_status", "paid_by_user_id", "notes", "journal_entry_id", "deleted_at"},
		"payment_refunds":                {"sales_return_id", "refund_source"},
		"sales":                          {"sales_channel_id", "sales_channel_name_snapshot", "external_order_number", "accounting_journal_entry_id", "return_status", "returned_amount", "return_refunded_amount"},
		"sales_returns":                  {"return_number", "return_date", "status", "refund_mode", "refund_payment_method_id", "payment_refund_id", "journal_entry_id", "deleted_at"},
		"sales_return_items":             {"sales_return_id", "sale_item_id", "product_id", "product_variant_id", "restock_action", "stock_location_id", "stock_movement_id", "deleted_at"},
		"sales_channels":                 {"channel_name", "channel_type", "requires_external_order_number", "default_payment_method_id", "commission_rate", "is_default", "status", "deleted_at"},
		"chart_of_accounts":              {"parent_account_id", "account_code", "account_name", "account_type", "account_group", "normal_balance", "is_system_account", "is_control_account", "allow_manual_posting", "status", "deleted_at"},
		"journal_entries":                {"branch_id", "entry_number", "entry_date", "reference_number", "source_type", "source_id", "narration", "status", "total_debit", "total_credit", "posted_at", "posted_by_user_id", "reversed_entry_id", "reversed_at", "reversed_by_user_id", "deleted_at"},
		"journal_entry_lines":            {"journal_entry_id", "account_id", "line_number", "debit_amount", "credit_amount", "description", "deleted_at"},
		"stock_movements":                {"movement_direction", "reference_number", "notes", "is_reversal", "reversed_movement_id", "is_reversed", "reversed_by_movement_id", "stock_location_id", "from_stock_location_id", "to_stock_location_id"},
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
