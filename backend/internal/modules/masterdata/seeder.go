package masterdata

import (
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/shared/utils"
)

type simpleCategorySeed struct {
	Name        string
	Description string
}

func SeedDefaults(tx *gorm.DB, businessID, branchID string) error {
	if err := EnsureUnitDefaults(tx); err != nil {
		return err
	}
	if err := EnsureWorkflowStatusDefaults(tx); err != nil {
		return err
	}
	if err := seedProductCategories(tx, businessID, branchID); err != nil {
		return err
	}
	if err := seedSimpleCategoryDefaults(tx, "ingredient_categories", businessID, branchID, []simpleCategorySeed{
		{Name: "Flour"},
		{Name: "Sugar"},
		{Name: "Dairy"},
		{Name: "Chocolate"},
		{Name: "Flavoring"},
		{Name: "Fruits"},
		{Name: "Dry Ingredients"},
	}); err != nil {
		return err
	}
	if err := seedSimpleCategoryDefaults(tx, "packaging_categories", businessID, branchID, []simpleCategorySeed{
		{Name: "Cake Boxes"},
		{Name: "Cups"},
		{Name: "Trays"},
		{Name: "Bags"},
		{Name: "Stickers"},
		{Name: "Candles"},
		{Name: "Labels"},
	}); err != nil {
		return err
	}
	return seedSimpleCategoryDefaults(tx, "supplier_categories", businessID, branchID, []simpleCategorySeed{
		{Name: "Ingredient Supplier"},
		{Name: "Packaging Supplier"},
		{Name: "Equipment Supplier"},
		{Name: "Logistics Supplier"},
		{Name: "Service Provider"},
	})
}

func EnsureUnitDefaults(tx *gorm.DB) error {
	categoryIDs := map[string]string{}
	categories := []simpleCategorySeed{
		{Name: "Weight"},
		{Name: "Volume"},
		{Name: "Quantity"},
		{Name: "Packaging"},
		{Name: "Custom"},
	}

	now := time.Now().UTC()
	for _, seed := range categories {
		var category UnitCategory
		err := tx.Where("LOWER(name) = LOWER(?)", seed.Name).First(&category).Error
		if err == gorm.ErrRecordNotFound {
			category = UnitCategory{
				ID:          utils.NewUUID(),
				Name:        seed.Name,
				Description: seed.Description,
				CreatedAt:   now,
				UpdatedAt:   now,
			}
			if err := tx.Create(&category).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		}
		categoryIDs[seed.Name] = category.ID
	}

	type unitSeed struct {
		Category         string
		Name             string
		Symbol           string
		BaseSymbol       string
		ConversionFactor float64
		DecimalPrecision int
	}

	seeds := []unitSeed{
		{Category: "Weight", Name: "Kilogram", Symbol: "kg", ConversionFactor: 1, DecimalPrecision: 3},
		{Category: "Weight", Name: "Gram", Symbol: "g", BaseSymbol: "kg", ConversionFactor: 0.001, DecimalPrecision: 3},
		{Category: "Weight", Name: "Milligram", Symbol: "mg", BaseSymbol: "kg", ConversionFactor: 0.000001, DecimalPrecision: 3},
		{Category: "Volume", Name: "Liter", Symbol: "ltr", ConversionFactor: 1, DecimalPrecision: 3},
		{Category: "Volume", Name: "Milliliter", Symbol: "ml", BaseSymbol: "ltr", ConversionFactor: 0.001, DecimalPrecision: 3},
		{Category: "Quantity", Name: "Piece", Symbol: "pcs", ConversionFactor: 1, DecimalPrecision: 0},
		{Category: "Quantity", Name: "Dozen", Symbol: "dozen", BaseSymbol: "pcs", ConversionFactor: 12, DecimalPrecision: 0},
		{Category: "Packaging", Name: "Box", Symbol: "box", ConversionFactor: 1, DecimalPrecision: 0},
		{Category: "Packaging", Name: "Tray", Symbol: "tray", ConversionFactor: 1, DecimalPrecision: 0},
		{Category: "Packaging", Name: "Cup", Symbol: "cup", ConversionFactor: 1, DecimalPrecision: 0},
		{Category: "Packaging", Name: "Packet", Symbol: "packet", ConversionFactor: 1, DecimalPrecision: 0},
		{Category: "Packaging", Name: "Bottle", Symbol: "bottle", ConversionFactor: 1, DecimalPrecision: 0},
	}

	symbolToID := map[string]string{}
	for _, seed := range seeds {
		var unit Unit
		err := tx.Where("business_id IS NULL AND LOWER(symbol) = LOWER(?) AND deleted_at IS NULL", seed.Symbol).First(&unit).Error
		if err == gorm.ErrRecordNotFound {
			unit = Unit{
				ID:               utils.NewUUID(),
				UnitCategoryID:   categoryIDs[seed.Category],
				UnitName:         seed.Name,
				Symbol:           seed.Symbol,
				ConversionFactor: seed.ConversionFactor,
				DecimalPrecision: seed.DecimalPrecision,
				IsSystemDefault:  true,
				Status:           "active",
				CreatedAt:        now,
				UpdatedAt:        now,
			}
			if err := tx.Create(&unit).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		}
		symbolToID[seed.Symbol] = unit.ID
	}

	for _, seed := range seeds {
		if seed.BaseSymbol == "" {
			continue
		}
		baseID, ok := symbolToID[seed.BaseSymbol]
		if !ok {
			continue
		}
		if err := tx.Model(&Unit{}).
			Where("business_id IS NULL AND LOWER(symbol) = LOWER(?) AND base_unit_id IS NULL", seed.Symbol).
			Updates(map[string]interface{}{"base_unit_id": baseID, "updated_at": now}).Error; err != nil {
			return err
		}
	}

	return nil
}

func EnsureWorkflowStatusDefaults(tx *gorm.DB) error {
	now := time.Now().UTC()
	orderStatuses := []OrderStatus{
		{ID: utils.NewUUID(), StatusName: "New", StatusKey: "NEW", SortOrder: 10, Color: "#64748b", IsSystemDefault: true, Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: utils.NewUUID(), StatusName: "Confirmed", StatusKey: "CONFIRMED", SortOrder: 20, Color: "#2563eb", IsSystemDefault: true, Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: utils.NewUUID(), StatusName: "In Production", StatusKey: "IN_PRODUCTION", SortOrder: 30, Color: "#f59e0b", IsSystemDefault: true, Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: utils.NewUUID(), StatusName: "Ready", StatusKey: "READY", SortOrder: 40, Color: "#16a34a", IsSystemDefault: true, Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: utils.NewUUID(), StatusName: "Delivered", StatusKey: "DELIVERED", SortOrder: 50, Color: "#0f766e", IsSystemDefault: true, IsFinalStatus: true, Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: utils.NewUUID(), StatusName: "Completed", StatusKey: "COMPLETED", SortOrder: 60, Color: "#15803d", IsSystemDefault: true, IsFinalStatus: true, Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: utils.NewUUID(), StatusName: "Cancelled", StatusKey: "CANCELLED", SortOrder: 70, Color: "#dc2626", IsSystemDefault: true, IsFinalStatus: true, Status: "active", CreatedAt: now, UpdatedAt: now},
	}
	for _, seed := range orderStatuses {
		var count int64
		if err := tx.Model(&OrderStatus{}).Where("business_id IS NULL AND LOWER(status_key) = LOWER(?) AND deleted_at IS NULL", seed.StatusKey).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			if err := tx.Create(&seed).Error; err != nil {
				return err
			}
		}
	}

	paymentStatuses := []PaymentStatus{
		{ID: utils.NewUUID(), StatusName: "Pending", StatusKey: "PENDING", Color: "#f59e0b", IsSystemDefault: true, Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: utils.NewUUID(), StatusName: "Partial", StatusKey: "PARTIAL", Color: "#2563eb", IsSystemDefault: true, Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: utils.NewUUID(), StatusName: "Paid", StatusKey: "PAID", Color: "#16a34a", IsSystemDefault: true, Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: utils.NewUUID(), StatusName: "Refunded", StatusKey: "REFUNDED", Color: "#7c3aed", IsSystemDefault: true, Status: "active", CreatedAt: now, UpdatedAt: now},
		{ID: utils.NewUUID(), StatusName: "Overdue", StatusKey: "OVERDUE", Color: "#dc2626", IsSystemDefault: true, Status: "active", CreatedAt: now, UpdatedAt: now},
	}
	for _, seed := range paymentStatuses {
		var count int64
		if err := tx.Model(&PaymentStatus{}).Where("business_id IS NULL AND LOWER(status_key) = LOWER(?) AND deleted_at IS NULL", seed.StatusKey).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			if err := tx.Create(&seed).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

func seedProductCategories(tx *gorm.DB, businessID, branchID string) error {
	seeds := []struct {
		Name      string
		Code      string
		SortOrder int
	}{
		{Name: "Cakes", Code: "CAKES", SortOrder: 10},
		{Name: "Pastries", Code: "PASTRIES", SortOrder: 20},
		{Name: "Beverages", Code: "BEVERAGES", SortOrder: 30},
		{Name: "Snacks", Code: "SNACKS", SortOrder: 40},
		{Name: "Retail Items", Code: "RETAIL_ITEMS", SortOrder: 50},
	}

	now := time.Now().UTC()
	for _, seed := range seeds {
		var count int64
		if err := tx.Model(&ProductCategory{}).
			Where("business_id = ? AND branch_id = ? AND LOWER(category_name) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, seed.Name).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			continue
		}

		category := ProductCategory{
			ID:           utils.NewUUID(),
			BusinessID:   businessID,
			BranchID:     branchID,
			CategoryName: seed.Name,
			CategoryCode: seed.Code,
			SortOrder:    seed.SortOrder,
			Status:       "active",
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		if err := tx.Create(&category).Error; err != nil {
			return err
		}
	}
	return nil
}

func seedSimpleCategoryDefaults(tx *gorm.DB, table, businessID, branchID string, seeds []simpleCategorySeed) error {
	now := time.Now().UTC()
	for _, seed := range seeds {
		var count int64
		if err := tx.Table(table).
			Where("business_id = ? AND branch_id = ? AND LOWER(category_name) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, seed.Name).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			continue
		}

		category := map[string]interface{}{
			"id":            utils.NewUUID(),
			"business_id":   businessID,
			"branch_id":     branchID,
			"category_name": seed.Name,
			"description":   seed.Description,
			"status":        "active",
			"created_at":    now,
			"updated_at":    now,
		}
		if err := tx.Table(table).Create(&category).Error; err != nil {
			return err
		}
	}
	return nil
}
