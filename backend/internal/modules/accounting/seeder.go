package accounting

import (
	"strings"

	"gorm.io/gorm"

	"pastries-pos/internal/shared/utils"
)

type defaultAccountSeed struct {
	Code               string
	Name               string
	Type               string
	Group              string
	NormalBalance      string
	Description        string
	IsControlAccount   bool
	AllowManualPosting bool
}

func DefaultChartAccountSeeds() []defaultAccountSeed {
	return []defaultAccountSeed{
		{Code: "1000", Name: "Cash in Hand", Type: "asset", Group: "current_asset", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: true},
		{Code: "1010", Name: "Bank Account", Type: "asset", Group: "current_asset", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: true},
		{Code: "1020", Name: "Petty Cash", Type: "asset", Group: "current_asset", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: true},
		{Code: "1030", Name: "Card Clearing Account", Type: "asset", Group: "current_asset", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "1100", Name: "Accounts Receivable", Type: "asset", Group: "current_asset", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "1200", Name: "Inventory / Stock", Type: "asset", Group: "current_asset", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "1210", Name: "Work in Process Inventory", Type: "asset", Group: "current_asset", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "1300", Name: "VAT Receivable", Type: "asset", Group: "current_asset", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "1400", Name: "Supplier Advances / Vendor Prepayments", Type: "asset", Group: "current_asset", NormalBalance: "debit", Description: "Unapplied supplier payments and vendor prepayments", IsControlAccount: true, AllowManualPosting: false},
		{Code: "1500", Name: "Prepaid Expenses", Type: "asset", Group: "current_asset", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "1600", Name: "Security Deposit", Type: "asset", Group: "current_asset", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "1700", Name: "Other Current Assets", Type: "asset", Group: "other_current_asset", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "1800", Name: "Furniture & Fixtures", Type: "asset", Group: "fixed_asset", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "1810", Name: "Office Equipment", Type: "asset", Group: "fixed_asset", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "1820", Name: "Computer & Laptop", Type: "asset", Group: "fixed_asset", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "1830", Name: "Machinery", Type: "asset", Group: "fixed_asset", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "1840", Name: "Accumulated Depreciation", Type: "asset", Group: "accumulated_depreciation", NormalBalance: "credit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "1900", Name: "Other Non-Current Assets", Type: "asset", Group: "non_current_asset", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "2000", Name: "Accounts Payable", Type: "liability", Group: "current_liability", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "2050", Name: "Goods Received Not Invoiced / GRNI", Type: "liability", Group: "current_liability", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "2100", Name: "VAT Payable", Type: "liability", Group: "current_liability", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "2200", Name: "Customer Advance", Type: "liability", Group: "current_liability", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "2300", Name: "Salary Payable", Type: "liability", Group: "current_liability", NormalBalance: "credit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "2400", Name: "Utility Payable", Type: "liability", Group: "current_liability", NormalBalance: "credit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "2500", Name: "Expense Payable", Type: "liability", Group: "current_liability", NormalBalance: "credit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "2600", Name: "Other Current Liabilities", Type: "liability", Group: "other_current_liability", NormalBalance: "credit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "2800", Name: "Bank Loan", Type: "liability", Group: "long_term_liability", NormalBalance: "credit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "2900", Name: "Other Liabilities", Type: "liability", Group: "other_liability", NormalBalance: "credit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "3000", Name: "Owner Capital", Type: "equity", Group: "equity", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: true},
		{Code: "3010", Name: "Partner Capital", Type: "equity", Group: "partner_capital", NormalBalance: "credit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "3100", Name: "Retained Earnings", Type: "equity", Group: "equity", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "3200", Name: "Current Year Profit / Loss", Type: "equity", Group: "equity", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "3300", Name: "Drawings", Type: "equity", Group: "equity", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "3400", Name: "Opening Balance Equity", Type: "equity", Group: "equity", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "4000", Name: "Sales Income", Type: "income", Group: "sales_income", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "4010", Name: "Bakery Order Income", Type: "income", Group: "sales_income", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "4020", Name: "Service Income", Type: "income", Group: "service_income", NormalBalance: "credit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "4030", Name: "Discount Received", Type: "income", Group: "discount_income", NormalBalance: "credit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "4040", Name: "Sales Returns and Allowances", Type: "income", Group: "sales_income", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "4050", Name: "Delivery Charge Income", Type: "income", Group: "sales_income", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "4060", Name: "Service Charge Income", Type: "income", Group: "service_income", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "4070", Name: "Packing Charge Income", Type: "income", Group: "sales_income", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "4080", Name: "Delivery Charge Returns", Type: "income", Group: "sales_income", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "4090", Name: "Other Income", Type: "income", Group: "other_income", NormalBalance: "credit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "4100", Name: "Inventory Adjustment Gain", Type: "income", Group: "other_income", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "5000", Name: "Opening Stock", Type: "cogs", Group: "direct_expense", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "5010", Name: "Purchase", Type: "cogs", Group: "direct_expense", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "5020", Name: "Purchase Return", Type: "cogs", Group: "direct_expense", NormalBalance: "credit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "5030", Name: "Freight / Carriage Inward", Type: "cogs", Group: "direct_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "5040", Name: "Direct Labour", Type: "cogs", Group: "direct_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "5050", Name: "Production Cost", Type: "cogs", Group: "direct_expense", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "5060", Name: "Manufacturing Expense", Type: "cogs", Group: "direct_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "5070", Name: "Cost of Goods Sold", Type: "cogs", Group: "direct_expense", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "5080", Name: "Wastage Expense", Type: "cogs", Group: "direct_expense", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "5090", Name: "Inventory Adjustment Loss", Type: "cogs", Group: "direct_expense", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: false},
		{Code: "6000", Name: "Salary Expense", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6010", Name: "Rent Expense", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6020", Name: "Electricity Expense", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6030", Name: "Water Expense", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6040", Name: "Telephone & Internet Expense", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6050", Name: "Bank Charges", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6060", Name: "Cleaning Expense", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6070", Name: "Repair & Maintenance", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6080", Name: "Advertising Expense", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6090", Name: "Professional Fees / Audit Fees", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6100", Name: "Depreciation Expense", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6110", Name: "Office Expense", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6120", Name: "Insurance Expense", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6200", Name: "Administrative Expense", Type: "expense", Group: "admin_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6210", Name: "Selling Expense", Type: "expense", Group: "selling_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6220", Name: "Finance Cost", Type: "expense", Group: "finance_cost", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6230", Name: "Tax Expense", Type: "expense", Group: "tax_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
		{Code: "6240", Name: "Platform Commission Expense", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: true, AllowManualPosting: true},
		{Code: "6250", Name: "Delivery Platform Charges", Type: "expense", Group: "operating_expense", NormalBalance: "debit", IsControlAccount: false, AllowManualPosting: true},
	}
}

func SeedDefaultChartOfAccounts(tx *gorm.DB, businessID string, requestedBranchIDs ...string) error {
	branchIDs := requestedBranchIDs
	if len(branchIDs) == 0 {
		if err := tx.Table("branches").Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active").Pluck("id", &branchIDs).Error; err != nil {
			return err
		}
	}
	for _, branchID := range branchIDs {
	for _, seed := range DefaultChartAccountSeeds() {
		var count int64
		if err := tx.Model(&ChartAccount{}).Where("business_id = ? AND branch_id = ? AND LOWER(account_code) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, seed.Code).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		account := ChartAccount{
			ID:                 utils.NewUUID(),
			BusinessID:         businessID,
			BranchID:           branchID,
			AccountCode:        seed.Code,
			AccountName:        seed.Name,
			AccountType:        seed.Type,
			AccountGroup:       seed.Group,
			NormalBalance:      seed.NormalBalance,
			Description:        strings.TrimSpace(seed.Description),
			IsSystemAccount:    true,
			IsControlAccount:   seed.IsControlAccount,
			AllowManualPosting: seed.AllowManualPosting,
			Status:             "active",
		}
		if err := tx.Create(&account).Error; err != nil {
			return err
		}
	}
	}
	return nil
}

type defaultAccountMappingSeed struct {
	Key         string
	AccountCode string
	Description string
}

func DefaultAccountMappingSeeds() []defaultAccountMappingSeed {
	return []defaultAccountMappingSeed{
		{Key: "accounts_receivable", AccountCode: "1100", Description: "Customer unpaid balances"},
		{Key: "accounts_payable", AccountCode: "2000", Description: "Supplier unpaid balances"},
		{Key: "supplier_advance", AccountCode: "1400", Description: "Unapplied supplier payments and vendor prepayments"},
		{Key: "inventory_stock", AccountCode: "1200", Description: "Inventory stock value"},
		{Key: "sales_income", AccountCode: "4000", Description: "POS sales income"},
		{Key: "bakery_income", AccountCode: "4010", Description: "Bakery order income"},
		{Key: "customer_advance", AccountCode: "2200", Description: "Customer deposits and advances"},
		{Key: "vat_receivable", AccountCode: "1300", Description: "Input VAT receivable"},
		{Key: "vat_payable", AccountCode: "2100", Description: "Output VAT payable"},
		{Key: "cogs", AccountCode: "5070", Description: "Cost of goods sold"},
		{Key: "sales_returns", AccountCode: "4040", Description: "Sales returns and allowances"},
		{Key: "purchase_returns", AccountCode: "5020", Description: "Purchase returns"},
		{Key: "wip_inventory", AccountCode: "1210", Description: "Manufacturing work in process"},
		{Key: "wastage_expense", AccountCode: "5080", Description: "Inventory and production wastage"},
		{Key: "inventory_adjustment_gain", AccountCode: "4100", Description: "Inventory adjustment gains"},
		{Key: "inventory_adjustment_loss", AccountCode: "5090", Description: "Inventory adjustment losses"},
		{Key: "opening_balance_equity", AccountCode: "3400", Description: "Opening stock/equity offset"},
		{Key: "grni", AccountCode: "2050", Description: "Goods received not invoiced"},
		{Key: "platform_commission_expense", AccountCode: "6240", Description: "Delivery platform commissions"},
		{Key: "delivery_charge_income", AccountCode: "4050", Description: "Customer delivery charge income"},
		{Key: "service_charge_income", AccountCode: "4060", Description: "Customer service charge income"},
		{Key: "packing_charge_income", AccountCode: "4070", Description: "Customer packing charge income"},
		{Key: "charge_refund_account", AccountCode: "4080", Description: "Refunded customer charges"},
		{Key: "freight_inward", AccountCode: "5030", Description: "Supplier freight and carriage inward"},
	}
}

func SeedDefaultAccountMappings(tx *gorm.DB, businessID, branchID string) error {
	if err := SeedDefaultChartOfAccounts(tx, businessID, branchID); err != nil {
		return err
	}
	for _, seed := range DefaultAccountMappingSeeds() {
		var account ChartAccount
		if err := tx.Where("business_id = ? AND branch_id = ? AND account_code = ? AND status = ? AND deleted_at IS NULL", businessID, branchID, seed.AccountCode, "active").First(&account).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&AccountMapping{}).Where("business_id = ? AND branch_id = ? AND mapping_key = ? AND deleted_at IS NULL", businessID, branchID, seed.Key).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		mapping := AccountMapping{
			ID:             utils.NewUUID(),
			BusinessID:     businessID,
			BranchID:       branchID,
			MappingKey:     seed.Key,
			ChartAccountID: account.ID,
			Description:    seed.Description,
		}
		if err := tx.Create(&mapping).Error; err != nil {
			return err
		}
	}
	return nil
}
