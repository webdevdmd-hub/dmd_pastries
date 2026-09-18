// Package userhistory answers one question: has this staff member left
// anything behind that the business must keep? A sale rung up, a payment
// taken, a bill posted, a record created or edited.
//
// Staff delete and the Super Admin hard delete share this list, so "can this
// person be erased" means the same thing on both screens (ISSUE-075). Audit
// rows are deliberately not on it: they are the trail that the account
// existed and was deleted, they carry no foreign key to users, and counting
// them made every real account permanently undeletable.
package userhistory

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
)

// Reference is one table whose rows name a user.
type Reference struct {
	Module string
	Table  string
	Where  string
}

// Count is how many rows of one Reference name the user.
type Count struct {
	Module string
	Table  string
	Count  int64
}

// References lists every business record that names its author, cashier,
// payer or approver. Each of these columns is a foreign key to users (or the
// business would lose who did what), so a user named here can only be
// soft-deleted.
func References() []Reference {
	return []Reference{
		{Module: "Business", Table: "businesses", Where: "owner_user_id = ?"},
		{Module: "Branches", Table: "branches", Where: "manager_user_id = ?"},
		{Module: "Sales", Table: "sales", Where: "cashier_user_id = ?"},
		{Module: "Sales", Table: "held_sales", Where: "cashier_user_id = ?"},
		{Module: "Sales", Table: "sale_refunds", Where: "created_by_user_id = ? OR approved_by_user_id = ?"},
		{Module: "Sales returns", Table: "sales_returns", Where: "created_by_user_id = ? OR approved_by_user_id = ? OR posted_by_user_id = ? OR cancelled_by_user_id = ?"},
		{Module: "Payments", Table: "sale_payments", Where: "paid_by_user_id = ?"},
		{Module: "Payments", Table: "payment_refunds", Where: "created_by_user_id = ? OR approved_by_user_id = ?"},
		{Module: "Payments", Table: "purchase_invoice_payments", Where: "paid_by_user_id = ?"},
		{Module: "Payments", Table: "supplier_payments", Where: "paid_by_user_id = ?"},
		{Module: "Customers", Table: "customers", Where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{Module: "Customers", Table: "customer_notes", Where: "created_by_user_id = ?"},
		{Module: "Products", Table: "products", Where: "created_by = ? OR updated_by = ?"},
		{Module: "Suppliers", Table: "suppliers", Where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{Module: "Suppliers", Table: "supplier_notes", Where: "created_by_user_id = ?"},
		{Module: "Inventory", Table: "stock_movements", Where: "created_by_user_id = ?"},
		{Module: "Inventory", Table: "inventory_adjustments", Where: "created_by_user_id = ?"},
		{Module: "Inventory", Table: "stock_locations", Where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{Module: "Inventory", Table: "stock_transfers", Where: "created_by_user_id = ? OR completed_by_user_id = ?"},
		{Module: "Purchasing", Table: "purchase_orders", Where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{Module: "Purchasing", Table: "purchase_invoices", Where: "created_by_user_id = ? OR updated_by_user_id = ? OR cancelled_by_user_id = ?"},
		{Module: "Purchasing", Table: "purchase_receipts", Where: "received_by_user_id = ?"},
		{Module: "Purchasing", Table: "purchase_returns", Where: "created_by_user_id = ? OR posted_by_user_id = ? OR cancelled_by_user_id = ? OR reversed_by_user_id = ?"},
		{Module: "Purchasing", Table: "purchase_order_revisions", Where: "created_by_user_id = ?"},
		{Module: "Manufacturing", Table: "production_batches", Where: "created_by_user_id = ? OR updated_by_user_id = ? OR completed_by_user_id = ?"},
		{Module: "Bakery orders", Table: "bakery_orders", Where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{Module: "Bakery orders", Table: "bakery_order_payments", Where: "paid_by_user_id = ?"},
		{Module: "Recipes", Table: "recipes", Where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{Module: "Recipes", Table: "recipe_versions", Where: "created_by_user_id = ?"},
		{Module: "Ingredients", Table: "ingredients", Where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{Module: "Packaging", Table: "packaging_items", Where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{Module: "Accounting", Table: "chart_of_accounts", Where: "created_by_user_id = ? OR updated_by_user_id = ?"},
		{Module: "Accounting", Table: "journal_entries", Where: "created_by_user_id = ? OR updated_by_user_id = ? OR posted_by_user_id = ? OR reversed_by_user_id = ?"},
		{Module: "Accounting", Table: "expenses", Where: "created_by_user_id = ? OR updated_by_user_id = ? OR voided_by_user_id = ?"},
		{Module: "Accounting", Table: "account_transfers", Where: "created_by_user_id = ?"},
		{Module: "Accounting", Table: "platform_settlements", Where: "created_by_user_id = ?"},
		{Module: "Accounting", Table: "payment_accounts", Where: "created_by_user_id = ? OR updated_by_user_id = ?"},
	}
}

// Counts returns the non-zero reference counts for a user. Soft-deleted rows
// count too: they are still rows, and their foreign keys still hold.
func Counts(db *gorm.DB, userID string) ([]Count, error) {
	counts := make([]Count, 0)
	for _, ref := range References() {
		var count int64
		args := make([]interface{}, strings.Count(ref.Where, "?"))
		for index := range args {
			args[index] = userID
		}
		if err := db.Table(ref.Table).Where(ref.Where, args...).Count(&count).Error; err != nil {
			return nil, fmt.Errorf("count %s: %w", ref.Table, err)
		}
		if count > 0 {
			counts = append(counts, Count{Module: ref.Module, Table: ref.Table, Count: count})
		}
	}
	return counts, nil
}

// Has reports whether the user has any history the business must keep.
func Has(db *gorm.DB, userID string) (bool, error) {
	counts, err := Counts(db, userID)
	if err != nil {
		return false, err
	}
	return len(counts) > 0, nil
}
