package permissions

import (
	"sort"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"pastries-pos/internal/shared/utils"
)

type Seed struct {
	ModuleName    string
	PermissionKey string
	Description   string
}

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func DefaultSeeds() []Seed {
	return []Seed{
		{ModuleName: "users", PermissionKey: "users.view", Description: "View staff users"},
		{ModuleName: "users", PermissionKey: "users.create", Description: "Create staff users"},
		{ModuleName: "users", PermissionKey: "users.edit", Description: "Edit staff users"},
		{ModuleName: "users", PermissionKey: "users.delete", Description: "Delete staff users"},
		{ModuleName: "users", PermissionKey: "users.status.update", Description: "Update staff user status"},
		{ModuleName: "users", PermissionKey: "users.invite", Description: "Invite staff users"},
		{ModuleName: "users", PermissionKey: "users.invitation.resend", Description: "Resend staff invitations"},
		{ModuleName: "users", PermissionKey: "users.invitation.cancel", Description: "Cancel staff invitations"},
		{ModuleName: "users", PermissionKey: "users.activity.view", Description: "View staff activity logs"},
		{ModuleName: "roles", PermissionKey: "roles.view", Description: "View roles"},
		{ModuleName: "roles", PermissionKey: "roles.create", Description: "Create roles"},
		{ModuleName: "roles", PermissionKey: "roles.edit", Description: "Edit roles"},
		{ModuleName: "roles", PermissionKey: "roles.delete", Description: "Delete roles"},
		{ModuleName: "roles", PermissionKey: "roles.permissions.view", Description: "View role permissions"},
		{ModuleName: "roles", PermissionKey: "roles.permissions.update", Description: "Update role permissions"},
		{ModuleName: "branches", PermissionKey: "branches.view", Description: "View branches"},
		{ModuleName: "branches", PermissionKey: "branches.create", Description: "Create branches"},
		{ModuleName: "branches", PermissionKey: "branches.edit", Description: "Edit branches"},
		{ModuleName: "branches", PermissionKey: "branches.status.update", Description: "Update branch status"},
		{ModuleName: "branches", PermissionKey: "branches.switch", Description: "Switch current branch"},
		{ModuleName: "branches", PermissionKey: "branches.access.manage", Description: "Manage user branch access"},
		{ModuleName: "settings", PermissionKey: "settings.view", Description: "View settings"},
		{ModuleName: "settings", PermissionKey: "settings.company.update", Description: "Update company settings"},
		{ModuleName: "settings", PermissionKey: "settings.tax_rates.manage", Description: "Manage tax rates"},
		{ModuleName: "settings", PermissionKey: "settings.payment_methods.manage", Description: "Manage payment methods"},
		{ModuleName: "settings", PermissionKey: "settings.receipt.update", Description: "Update receipt settings"},
		{ModuleName: "settings", PermissionKey: "settings.hardware.update", Description: "Update hardware settings"},
		{ModuleName: "settings", PermissionKey: "settings.notifications.update", Description: "Update notification settings"},
		{ModuleName: "master_data", PermissionKey: "master_data.view", Description: "View master data"},
		{ModuleName: "master_data", PermissionKey: "master_data.units.manage", Description: "Manage units"},
		{ModuleName: "master_data", PermissionKey: "master_data.product_categories.manage", Description: "Manage product categories"},
		{ModuleName: "master_data", PermissionKey: "master_data.ingredient_categories.manage", Description: "Manage ingredient categories"},
		{ModuleName: "master_data", PermissionKey: "master_data.packaging_categories.manage", Description: "Manage packaging categories"},
		{ModuleName: "master_data", PermissionKey: "master_data.supplier_categories.manage", Description: "Manage supplier categories"},
		{ModuleName: "master_data", PermissionKey: "master_data.order_statuses.manage", Description: "Manage order statuses"},
		{ModuleName: "master_data", PermissionKey: "master_data.payment_statuses.manage", Description: "Manage payment statuses"},
		{ModuleName: "products", PermissionKey: "products.view", Description: "View products"},
		{ModuleName: "products", PermissionKey: "products.create", Description: "Create products"},
		{ModuleName: "products", PermissionKey: "products.edit", Description: "Edit products"},
		{ModuleName: "products", PermissionKey: "products.delete", Description: "Delete products"},
		{ModuleName: "products", PermissionKey: "products.status.update", Description: "Update product status"},
		{ModuleName: "products", PermissionKey: "products.variants.manage", Description: "Manage product variants"},
		{ModuleName: "products", PermissionKey: "products.images.manage", Description: "Manage product images"},
		{ModuleName: "pos", PermissionKey: "pos.view", Description: "View POS module"},
		{ModuleName: "pos", PermissionKey: "pos.sell", Description: "Sell through POS"},
		{ModuleName: "pos", PermissionKey: "pos.checkout", Description: "Complete POS checkout"},
		{ModuleName: "pos", PermissionKey: "pos.discount.apply", Description: "Apply POS discounts"},
		{ModuleName: "pos", PermissionKey: "pos.hold_sale", Description: "Hold POS sales"},
		{ModuleName: "pos", PermissionKey: "pos.resume_sale", Description: "Resume held sales"},
		{ModuleName: "pos", PermissionKey: "pos.cancel_held_sale", Description: "Cancel held sales"},
		{ModuleName: "pos", PermissionKey: "pos.refund", Description: "Refund POS orders"},
		{ModuleName: "pos", PermissionKey: "pos.void", Description: "Void POS sales"},
		{ModuleName: "payments", PermissionKey: "payments.view", Description: "View payments"},
		{ModuleName: "payments", PermissionKey: "payments.add", Description: "Add payments to sales"},
		{ModuleName: "payments", PermissionKey: "payments.refund", Description: "Refund payments"},
		{ModuleName: "payments", PermissionKey: "payments.reconcile", Description: "Reconcile payments"},
		{ModuleName: "payments", PermissionKey: "payments.summary.view", Description: "View payment summaries"},
		{ModuleName: "payments", PermissionKey: "payments.methods.view", Description: "View payment methods"},
		{ModuleName: "customers", PermissionKey: "customers.view", Description: "View customers"},
		{ModuleName: "customers", PermissionKey: "customers.create", Description: "Create customers"},
		{ModuleName: "customers", PermissionKey: "customers.edit", Description: "Edit customers"},
		{ModuleName: "customers", PermissionKey: "customers.delete", Description: "Delete customers"},
		{ModuleName: "customers", PermissionKey: "customers.status.update", Description: "Update customer status"},
		{ModuleName: "customers", PermissionKey: "customers.notes.manage", Description: "Manage customer notes"},
		{ModuleName: "customers", PermissionKey: "customers.tags.manage", Description: "Manage customer tags"},
		{ModuleName: "customers", PermissionKey: "customers.quick_create", Description: "Quick-create POS customers"},
		{ModuleName: "orders", PermissionKey: "orders.view", Description: "View orders"},
		{ModuleName: "orders", PermissionKey: "orders.create", Description: "Create orders"},
		{ModuleName: "orders", PermissionKey: "orders.edit", Description: "Edit orders"},
		{ModuleName: "orders", PermissionKey: "orders.delete", Description: "Delete orders"},
		{ModuleName: "orders", PermissionKey: "orders.status.update", Description: "Update order status"},
		{ModuleName: "orders", PermissionKey: "orders.payments.manage", Description: "Manage order payments"},
		{ModuleName: "orders", PermissionKey: "orders.production.assign", Description: "Assign order production"},
		{ModuleName: "orders", PermissionKey: "orders.packaging.manage", Description: "Manage order packaging"},
		{ModuleName: "inventory", PermissionKey: "inventory.view", Description: "View inventory"},
		{ModuleName: "inventory", PermissionKey: "inventory.opening_stock", Description: "Create opening stock"},
		{ModuleName: "inventory", PermissionKey: "inventory.adjust", Description: "Adjust inventory stock"},
		{ModuleName: "inventory", PermissionKey: "inventory.movements.view", Description: "View inventory movements"},
		{ModuleName: "inventory", PermissionKey: "inventory.low_stock.view", Description: "View low stock alerts"},
		{ModuleName: "inventory", PermissionKey: "inventory.expiry.view", Description: "View expiry alerts"},
		{ModuleName: "inventory", PermissionKey: "inventory.expiry_batches.manage", Description: "Manage expiry batches"},
		{ModuleName: "inventory", PermissionKey: "inventory.locations.manage", Description: "Manage stock locations"},
		{ModuleName: "inventory", PermissionKey: "inventory.transfer.create", Description: "Create internal stock transfers"},
		{ModuleName: "inventory", PermissionKey: "inventory.transfer.complete", Description: "Complete internal stock transfers"},
		{ModuleName: "inventory", PermissionKey: "inventory.transfer.cancel", Description: "Cancel internal stock transfers"},
		{ModuleName: "stock_movements", PermissionKey: "stock_movements.view", Description: "View stock movements"},
		{ModuleName: "stock_movements", PermissionKey: "stock_movements.manual_create", Description: "Create manual stock movements"},
		{ModuleName: "stock_movements", PermissionKey: "stock_movements.reverse", Description: "Reverse stock movements"},
		{ModuleName: "stock_movements", PermissionKey: "stock_movements.audit.view", Description: "View stock movement audits"},
		{ModuleName: "stock_movements", PermissionKey: "stock_movements.summary.view", Description: "View stock movement summaries"},
		{ModuleName: "ingredients", PermissionKey: "ingredients.view", Description: "View ingredients"},
		{ModuleName: "ingredients", PermissionKey: "ingredients.create", Description: "Create ingredients"},
		{ModuleName: "ingredients", PermissionKey: "ingredients.edit", Description: "Edit ingredients"},
		{ModuleName: "ingredients", PermissionKey: "ingredients.delete", Description: "Delete ingredients"},
		{ModuleName: "ingredients", PermissionKey: "ingredients.status.update", Description: "Update ingredient status"},
		{ModuleName: "suppliers", PermissionKey: "suppliers.view", Description: "View suppliers"},
		{ModuleName: "suppliers", PermissionKey: "suppliers.create", Description: "Create suppliers"},
		{ModuleName: "suppliers", PermissionKey: "suppliers.edit", Description: "Edit suppliers"},
		{ModuleName: "suppliers", PermissionKey: "suppliers.delete", Description: "Delete suppliers"},
		{ModuleName: "suppliers", PermissionKey: "suppliers.status.update", Description: "Update supplier status"},
		{ModuleName: "suppliers", PermissionKey: "suppliers.contacts.manage", Description: "Manage supplier contacts"},
		{ModuleName: "suppliers", PermissionKey: "suppliers.notes.manage", Description: "Manage supplier notes"},
		{ModuleName: "suppliers", PermissionKey: "suppliers.lookup", Description: "Lookup active suppliers"},
		{ModuleName: "purchasing", PermissionKey: "purchasing.view", Description: "View purchasing"},
		{ModuleName: "purchasing", PermissionKey: "purchasing.orders.create", Description: "Create purchase orders"},
		{ModuleName: "purchasing", PermissionKey: "purchasing.orders.edit", Description: "Edit purchase orders"},
		{ModuleName: "purchasing", PermissionKey: "purchasing.orders.delete", Description: "Delete purchase orders"},
		{ModuleName: "purchasing", PermissionKey: "purchasing.orders.status.update", Description: "Update purchase order status"},
		{ModuleName: "purchasing", PermissionKey: "purchasing.invoices.create", Description: "Create purchase invoices"},
		{ModuleName: "purchasing", PermissionKey: "purchasing.invoices.edit", Description: "Edit purchase invoices"},
		{ModuleName: "purchasing", PermissionKey: "purchasing.invoices.post", Description: "Post purchase invoices"},
		{ModuleName: "purchasing", PermissionKey: "purchasing.invoices.cancel", Description: "Cancel purchase invoices"},
		{ModuleName: "purchasing", PermissionKey: "purchasing.receipts.create", Description: "Create purchase receipts"},
		{ModuleName: "purchasing", PermissionKey: "purchasing.receipts.post", Description: "Post purchase receipts"},
		{ModuleName: "purchasing", PermissionKey: "purchasing.receipts.cancel", Description: "Cancel purchase receipts"},
		{ModuleName: "purchasing", PermissionKey: "purchasing.receive_stock", Description: "Receive purchase stock"},
		{ModuleName: "packaging", PermissionKey: "packaging.view", Description: "View packaging items"},
		{ModuleName: "packaging", PermissionKey: "packaging.create", Description: "Create packaging items"},
		{ModuleName: "packaging", PermissionKey: "packaging.edit", Description: "Edit packaging items"},
		{ModuleName: "packaging", PermissionKey: "packaging.delete", Description: "Delete packaging items"},
		{ModuleName: "packaging", PermissionKey: "packaging.status.update", Description: "Update packaging status"},
		{ModuleName: "packaging", PermissionKey: "packaging.usage_rules.manage", Description: "Manage packaging usage rules"},
		{ModuleName: "recipes", PermissionKey: "recipes.view", Description: "View recipes"},
		{ModuleName: "recipes", PermissionKey: "recipes.create", Description: "Create recipes"},
		{ModuleName: "recipes", PermissionKey: "recipes.edit", Description: "Edit recipes"},
		{ModuleName: "recipes", PermissionKey: "recipes.delete", Description: "Delete recipes"},
		{ModuleName: "recipes", PermissionKey: "recipes.status.update", Description: "Update recipe status"},
		{ModuleName: "recipes", PermissionKey: "recipes.ingredients.manage", Description: "Manage recipe ingredients"},
		{ModuleName: "recipes", PermissionKey: "recipes.packaging.manage", Description: "Manage recipe packaging"},
		{ModuleName: "recipes", PermissionKey: "recipes.cost.recalculate", Description: "Recalculate recipe costs"},
		{ModuleName: "recipes", PermissionKey: "recipes.versions.create", Description: "Create recipe versions"},
		{ModuleName: "manufacturing", PermissionKey: "manufacturing.view", Description: "View manufacturing"},
		{ModuleName: "manufacturing", PermissionKey: "manufacturing.batches.create", Description: "Create production batches"},
		{ModuleName: "manufacturing", PermissionKey: "manufacturing.batches.edit", Description: "Edit production batches"},
		{ModuleName: "manufacturing", PermissionKey: "manufacturing.batches.delete", Description: "Delete production batches"},
		{ModuleName: "manufacturing", PermissionKey: "manufacturing.batches.start", Description: "Start production batches"},
		{ModuleName: "manufacturing", PermissionKey: "manufacturing.batches.consume", Description: "Update production consumption"},
		{ModuleName: "manufacturing", PermissionKey: "manufacturing.batches.produce", Description: "Produce finished goods"},
		{ModuleName: "manufacturing", PermissionKey: "manufacturing.batches.wastage", Description: "Track production wastage"},
		{ModuleName: "manufacturing", PermissionKey: "manufacturing.batches.complete", Description: "Complete production batches"},
		{ModuleName: "manufacturing", PermissionKey: "manufacturing.batches.cancel", Description: "Cancel production batches"},
		{ModuleName: "reports", PermissionKey: "reports.view", Description: "View reports"},
		{ModuleName: "reports", PermissionKey: "reports.sales.view", Description: "View sales reports"},
		{ModuleName: "reports", PermissionKey: "reports.inventory.view", Description: "View inventory reports"},
		{ModuleName: "reports", PermissionKey: "reports.payments.view", Description: "View payment reports"},
		{ModuleName: "reports", PermissionKey: "reports.production.view", Description: "View production reports"},
		{ModuleName: "reports", PermissionKey: "reports.export", Description: "Export reports"},
		{ModuleName: "accounting", PermissionKey: "accounting.view", Description: "View accounting records"},
		{ModuleName: "accounting", PermissionKey: "accounting.accounts.manage", Description: "Manage chart of accounts"},
		{ModuleName: "accounting", PermissionKey: "accounting.journal_entries.manage", Description: "Manage journal entries"},
		{ModuleName: "dashboard", PermissionKey: "dashboard.view", Description: "View operational dashboards"},
		{ModuleName: "audit_logs", PermissionKey: "audit_logs.view", Description: "View audit logs"},
	}
}

func IsDeprecatedBroadPermission(permissionKey string) bool {
	switch permissionKey {
	case "roles.manage",
		"branches.manage",
		"settings.manage",
		"master_data.manage",
		"products.manage",
		"payments.manage",
		"customers.manage",
		"orders.manage",
		"inventory.manage",
		"suppliers.manage",
		"purchasing.manage",
		"recipes.manage",
		"manufacturing.manage":
		return true
	default:
		return false
	}
}

func (r *Repository) EnsureDefaults(tx *gorm.DB) ([]Permission, error) {
	seeds := DefaultSeeds()
	permissionsToInsert := make([]Permission, 0, len(seeds))
	for _, seed := range seeds {
		permissionsToInsert = append(permissionsToInsert, Permission{
			ID:            utils.NewUUID(),
			ModuleName:    seed.ModuleName,
			PermissionKey: seed.PermissionKey,
			Description:   seed.Description,
		})
	}

	if err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "permission_key"}},
		DoNothing: true,
	}).Create(&permissionsToInsert).Error; err != nil {
		return nil, err
	}

	var permissions []Permission
	if err := tx.Order("permission_key ASC").Find(&permissions).Error; err != nil {
		return nil, err
	}

	sort.Slice(permissions, func(i, j int) bool {
		return permissions[i].PermissionKey < permissions[j].PermissionKey
	})

	return permissions, nil
}

func (r *Repository) FindByKeys(keys []string) ([]Permission, error) {
	var permissions []Permission
	err := r.db.Where("permission_key IN ?", keys).Order("permission_key ASC").Find(&permissions).Error
	return permissions, err
}

func (r *Repository) ListAll() ([]Permission, error) {
	var permissions []Permission
	err := r.db.Order("module_name ASC, permission_key ASC").Find(&permissions).Error
	return permissions, err
}
