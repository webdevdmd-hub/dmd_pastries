package products

import (
	"database/sql"
	"math"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db        *gorm.DB
	repo      *Repository
	auditRepo *audit.Repository
}

func NewService(db *gorm.DB, repo *Repository, auditRepo *audit.Repository) *Service {
	return &Service{db: db, repo: repo, auditRepo: auditRepo}
}

func (s *Service) ListProducts(currentUser *utils.AuthContext, query ProductListQuery) (*ProductListResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	normalizeListQuery(&query)
	if query.ProductType != "" {
		if err := validateProductType(query.ProductType); err != nil {
			return nil, err
		}
	}
	if query.ItemStructure != "" {
		if err := validateItemStructure(query.ItemStructure); err != nil {
			return nil, err
		}
	}
	products, total, err := s.repo.List(currentUser.BusinessID, branchID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list products")
	}
	items, err := s.repo.LoadProductResponses(currentUser.BusinessID, products)
	if err != nil {
		return nil, apperrors.Internal("failed to load product details")
	}
	return &ProductListResponse{
		Items: items,
		Pagination: PaginationResponse{
			Page:       query.Page,
			Limit:      query.Limit,
			Total:      total,
			TotalPages: totalPages(total, query.Limit),
		},
	}, nil
}

func (s *Service) CreateProduct(currentUser *utils.AuthContext, req CreateProductRequest, ipAddress, userAgent string) (*ProductResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if err := s.validateCreate(currentUser.BusinessID, branchID, req); err != nil {
		return nil, err
	}

	productCode := strings.TrimSpace(req.ProductCode)
	if productCode == "" {
		code, err := s.generateProductCode(currentUser.BusinessID, branchID)
		if err != nil {
			return nil, apperrors.Internal("failed to generate product code")
		}
		productCode = code
	}
	if exists, err := s.repo.ProductCodeExists(currentUser.BusinessID, branchID, productCode, ""); err != nil {
		return nil, apperrors.Internal("failed to validate product code")
	} else if exists {
		return nil, apperrors.Conflict("product_code already exists", nil)
	}

	isSellable := defaultSellableForProductType(req.ProductType)
	if req.IsSellable != nil {
		isSellable = *req.IsSellable
	}
	isPOSVisible := isSellable
	if req.IsPOSVisible != nil {
		isPOSVisible = *req.IsPOSVisible
	}
	isPurchasable := defaultPurchasableForProductType(req.ProductType)
	if req.IsPurchasable != nil {
		isPurchasable = *req.IsPurchasable
	}
	product := &Product{
		ID:                     utils.NewUUID(),
		BusinessID:             currentUser.BusinessID,
		BranchID:               branchID,
		CategoryID:             req.CategoryID,
		UnitID:                 req.UnitID,
		TaxRateID:              cleanStringPointer(req.TaxRateID),
		ProductName:            strings.TrimSpace(req.ProductName),
		ProductCode:            productCode,
		SKU:                    strings.TrimSpace(req.SKU),
		Barcode:                strings.TrimSpace(req.Barcode),
		Description:            strings.TrimSpace(req.Description),
		ProductType:            strings.TrimSpace(req.ProductType),
		ItemStructure:          normalizeItemStructure(req.ItemStructure),
		SalePrice:              req.SalePrice,
		CostPrice:              req.CostPrice,
		CompareAtPrice:         req.CompareAtPrice,
		CostUpdatePolicy:       normalizeCostUpdatePolicy(req.CostUpdatePolicy),
		PricingType:            normalizePricingType(req.PricingType),
		PricingPercent:         roundQuantity(req.PricingPercent),
		MinimumSalePrice:       req.MinimumSalePrice,
		AutoPriceUpdateEnabled: req.AutoPriceUpdateEnabled,
		SalePriceLocked:        req.SalePriceLocked,
		ImageFileID:            strings.TrimSpace(req.ImageFileID),
		IsSellable:             isSellable,
		IsPOSVisible:           isPOSVisible,
		IsPurchasable:          isPurchasable,
		IsStockTracked:         req.IsStockTracked,
		IsExpiryTracked:        req.IsExpiryTracked,
		IsCustomOrderAvailable: req.IsCustomOrderAvailable,
		PreparationTimeMinutes: req.PreparationTimeMinutes,
		Status:                 "active",
		CreatedBy:              currentUser.UserID,
		UpdatedBy:              currentUser.UserID,
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.Create(tx, product); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create product")
	}
	if err := s.writeAudit(tx, currentUser, "product.created", product.ID, "Product created.", ipAddress, userAgent, audit.RecordMetadata(product.ProductName, map[string]interface{}{
		"product_name":   product.ProductName,
		"product_code":   product.ProductCode,
		"sku":            product.SKU,
		"branch_id":      product.BranchID,
		"category_id":    product.CategoryID,
		"product_type":   product.ProductType,
		"is_sellable":    product.IsSellable,
		"is_pos_visible": product.IsPOSVisible,
		"is_purchasable": product.IsPurchasable,
		"status":         product.Status,
	}, nil)); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit product creation")
	}
	return s.GetProduct(currentUser, product.ID)
}

func (s *Service) GetProduct(currentUser *utils.AuthContext, id string) (*ProductResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	product, err := s.repo.FindByID(id, currentUser.BusinessID, branchID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("product not found")
		}
		return nil, apperrors.Internal("failed to load product")
	}
	response, err := s.repo.LoadProductResponse(currentUser.BusinessID, *product)
	if err != nil {
		return nil, apperrors.Internal("failed to load product details")
	}
	return &response, nil
}

func (s *Service) UpdateProduct(currentUser *utils.AuthContext, id string, req UpdateProductRequest, ipAddress, userAgent string) (*ProductResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	product, err := s.repo.FindByID(id, currentUser.BusinessID, branchID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("product not found")
		}
		return nil, apperrors.Internal("failed to load product")
	}
	if err := s.validateUpdate(currentUser.BusinessID, branchID, product, req); err != nil {
		return nil, err
	}

	updates := map[string]interface{}{"updated_by": currentUser.UserID, "updated_at": time.Now().UTC()}
	if req.ProductName != "" {
		updates["product_name"] = strings.TrimSpace(req.ProductName)
	}
	if req.CategoryID != "" {
		updates["category_id"] = req.CategoryID
	}
	if req.UnitID != "" {
		updates["unit_id"] = req.UnitID
	}
	if req.TaxRateID != nil {
		updates["tax_rate_id"] = cleanStringPointer(req.TaxRateID)
	}
	if req.Description != "" {
		updates["description"] = strings.TrimSpace(req.Description)
	}
	if req.ProductType != "" {
		updates["product_type"] = strings.TrimSpace(req.ProductType)
	}
	if req.ItemStructure != "" {
		updates["item_structure"] = normalizeItemStructure(req.ItemStructure)
	}
	if req.SalePrice != nil {
		updates["sale_price"] = *req.SalePrice
	}
	if req.CostPrice != nil {
		updates["cost_price"] = *req.CostPrice
	}
	if req.CompareAtPrice != nil {
		updates["compare_at_price"] = *req.CompareAtPrice
	}
	if req.CostUpdatePolicy != nil {
		updates["cost_update_policy"] = normalizeCostUpdatePolicy(*req.CostUpdatePolicy)
	}
	if req.PricingType != nil {
		updates["pricing_type"] = normalizePricingType(*req.PricingType)
	}
	if req.PricingPercent != nil {
		updates["pricing_percent"] = roundQuantity(*req.PricingPercent)
	}
	if req.MinimumSalePrice != nil {
		updates["minimum_sale_price"] = *req.MinimumSalePrice
	}
	if req.AutoPriceUpdateEnabled != nil {
		updates["auto_price_update_enabled"] = *req.AutoPriceUpdateEnabled
	}
	if req.SalePriceLocked != nil {
		updates["sale_price_locked"] = *req.SalePriceLocked
	}
	if req.SKU != "" {
		updates["sku"] = strings.TrimSpace(req.SKU)
	}
	if req.Barcode != "" {
		updates["barcode"] = strings.TrimSpace(req.Barcode)
	}
	if req.ImageFileID != "" {
		updates["image_file_id"] = strings.TrimSpace(req.ImageFileID)
	}
	if req.IsSellable != nil {
		updates["is_sellable"] = *req.IsSellable
	}
	if req.IsPOSVisible != nil {
		updates["is_pos_visible"] = *req.IsPOSVisible
	}
	if req.IsPurchasable != nil {
		updates["is_purchasable"] = *req.IsPurchasable
	}
	if req.IsStockTracked != nil {
		updates["is_stock_tracked"] = *req.IsStockTracked
	}
	if req.IsExpiryTracked != nil {
		updates["is_expiry_tracked"] = *req.IsExpiryTracked
	}
	if req.IsCustomOrderAvailable != nil {
		updates["is_custom_order_available"] = *req.IsCustomOrderAvailable
	}
	if req.PreparationTimeMinutes != nil {
		updates["preparation_time_minutes"] = *req.PreparationTimeMinutes
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}

	changes := productChanges(*product, updates)
	if err := s.updateWithAudit(currentUser, "product.updated", id, "Product updated.", ipAddress, userAgent, audit.RecordMetadata(product.ProductName, map[string]interface{}{
		"product_name": product.ProductName,
		"product_code": product.ProductCode,
		"sku":          product.SKU,
		"branch_id":    product.BranchID,
	}, changes), func(tx *gorm.DB) error {
		return s.repo.Update(tx, id, currentUser.BusinessID, branchID, updates)
	}); err != nil {
		return nil, err
	}
	return s.GetProduct(currentUser, id)
}

func (s *Service) UpdateProductStatus(currentUser *utils.AuthContext, id string, req UpdateProductStatusRequest, ipAddress, userAgent string) (*ProductResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if !validProductStatus(req.Status) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	product, err := s.repo.FindByID(id, currentUser.BusinessID, branchID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("product not found")
		}
		return nil, apperrors.Internal("failed to load product")
	}
	updates := map[string]interface{}{"status": req.Status, "updated_by": currentUser.UserID, "updated_at": time.Now().UTC()}
	if req.Status != "active" {
		updates["is_pos_visible"] = false
		updates["is_sellable"] = false
		updates["is_purchasable"] = false
	}
	changes := productChanges(*product, updates)
	if err := s.updateWithAudit(currentUser, "product.status_updated", id, "Product status updated.", ipAddress, userAgent, audit.RecordMetadata(product.ProductName, map[string]interface{}{
		"product_name": product.ProductName,
		"product_code": product.ProductCode,
		"branch_id":    product.BranchID,
		"status":       req.Status,
	}, changes), func(tx *gorm.DB) error {
		return s.repo.Update(tx, id, currentUser.BusinessID, branchID, updates)
	}); err != nil {
		return nil, err
	}
	return s.GetProduct(currentUser, id)
}

func (s *Service) DeleteProduct(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	product, err := s.repo.FindByID(id, currentUser.BusinessID, branchID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("product not found")
		}
		return apperrors.Internal("failed to load product")
	}
	references, err := s.repo.ProductHistoryReferences(currentUser.BusinessID, branchID, id)
	if err != nil {
		return apperrors.Internal("failed to validate product history")
	}
	if len(references) > 0 {
		return apperrors.Conflict("Product has transaction history and cannot be deleted. Deactivate it instead.", map[string]interface{}{
			"reason":     "product_has_history",
			"references": references,
		})
	}
	updates := map[string]interface{}{
		"status":         "archived",
		"is_pos_visible": false,
		"is_sellable":    false,
		"is_purchasable": false,
		"updated_by":     currentUser.UserID,
		"updated_at":     time.Now().UTC(),
		"deleted_at":     gorm.DeletedAt{Time: time.Now().UTC(), Valid: true},
	}
	return s.updateWithAudit(currentUser, "product.deleted", id, "Product deleted.", ipAddress, userAgent, audit.RecordMetadata(product.ProductName, map[string]interface{}{
		"product_name": product.ProductName,
		"product_code": product.ProductCode,
		"branch_id":    product.BranchID,
		"status":       "archived",
	}, productChanges(*product, updates)), func(tx *gorm.DB) error {
		return s.repo.Update(tx, id, currentUser.BusinessID, branchID, updates)
	})
}

func (s *Service) POSProducts(currentUser *utils.AuthContext) ([]ProductResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	products, err := s.repo.POSProducts(currentUser.BusinessID, branchID)
	if err != nil {
		return nil, apperrors.Internal("failed to list POS products")
	}
	return s.repo.LoadProductResponses(currentUser.BusinessID, products)
}

func (s *Service) LookupProduct(currentUser *utils.AuthContext, barcode, sku, productCode string) (*ProductLookupResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	field, value, matchedBy := lookupField(barcode, sku, productCode)
	if value == "" {
		return nil, apperrors.BadRequest("barcode, sku, or product_code is required", nil)
	}

	if field == "sku" || field == "barcode" {
		if variant, productID, err := s.repo.FindVariantLookup(currentUser.BusinessID, branchID, field, value); err == nil {
			product, err := s.repo.FindByID(productID, currentUser.BusinessID, branchID)
			if err != nil || product.Status != "active" || !product.IsPOSVisible || !product.IsSellable {
				return nil, apperrors.NotFound("product not found")
			}
			response, err := s.repo.LoadProductResponse(currentUser.BusinessID, *product)
			if err != nil {
				return nil, apperrors.Internal("failed to load product details")
			}
			return &ProductLookupResponse{Product: response, Variant: variant, MatchedBy: matchedBy}, nil
		}
	}

	product, err := s.repo.FindPOSByLookup(currentUser.BusinessID, branchID, field, value)
	if err != nil {
		if err == gorm.ErrRecordNotFound || err == sql.ErrNoRows {
			return nil, apperrors.NotFound("product not found")
		}
		return nil, apperrors.Internal("failed to lookup product")
	}
	response, err := s.repo.LoadProductResponse(currentUser.BusinessID, *product)
	if err != nil {
		return nil, apperrors.Internal("failed to load product details")
	}
	return &ProductLookupResponse{Product: response, MatchedBy: matchedBy}, nil
}

func (s *Service) validateCreate(businessID, branchID string, req CreateProductRequest) error {
	if strings.TrimSpace(req.ProductName) == "" {
		return apperrors.BadRequest("product_name is required", nil)
	}
	productType := strings.TrimSpace(req.ProductType)
	if err := validateProductType(productType); err != nil {
		return err
	}
	if err := validateItemStructure(req.ItemStructure); err != nil {
		return err
	}
	if err := validatePrices(req.SalePrice, req.CostPrice, req.CompareAtPrice); err != nil {
		return err
	}
	if !validCostUpdatePolicy(req.CostUpdatePolicy) {
		return apperrors.BadRequest("invalid cost_update_policy", nil)
	}
	if !validPricingType(req.PricingType) {
		return apperrors.BadRequest("invalid pricing_type", nil)
	}
	if req.PricingPercent < 0 {
		return apperrors.BadRequest("pricing_percent must be >= 0", nil)
	}
	if req.MinimumSalePrice != nil && *req.MinimumSalePrice < 0 {
		return apperrors.BadRequest("minimum_sale_price must be >= 0", nil)
	}
	if err := validatePreparationTime(req.PreparationTimeMinutes); err != nil {
		return err
	}
	if err := s.validateReferences(businessID, branchID, req.CategoryID, productType, req.UnitID, cleanStringPointer(req.TaxRateID)); err != nil {
		return err
	}
	if err := s.validateUniqueCodes(businessID, branchID, "", strings.TrimSpace(req.SKU), strings.TrimSpace(req.Barcode)); err != nil {
		return err
	}
	return nil
}

func (s *Service) validateUpdate(businessID, branchID string, product *Product, req UpdateProductRequest) error {
	productID := product.ID
	productType := product.ProductType
	if req.ProductType != "" {
		if err := validateProductType(req.ProductType); err != nil {
			return err
		}
		productType = strings.TrimSpace(req.ProductType)
	}
	if req.ItemStructure != "" {
		if err := validateItemStructure(req.ItemStructure); err != nil {
			return err
		}
	}
	salePrice := 0.0
	if req.SalePrice != nil {
		salePrice = *req.SalePrice
	}
	if req.SalePrice != nil || req.CostPrice != nil || req.CompareAtPrice != nil {
		if err := validatePrices(salePrice, req.CostPrice, req.CompareAtPrice); err != nil {
			return err
		}
	}
	if req.CostUpdatePolicy != nil && !validCostUpdatePolicy(*req.CostUpdatePolicy) {
		return apperrors.BadRequest("invalid cost_update_policy", nil)
	}
	if req.PricingType != nil && !validPricingType(*req.PricingType) {
		return apperrors.BadRequest("invalid pricing_type", nil)
	}
	if req.PricingPercent != nil && *req.PricingPercent < 0 {
		return apperrors.BadRequest("pricing_percent must be >= 0", nil)
	}
	if req.MinimumSalePrice != nil && *req.MinimumSalePrice < 0 {
		return apperrors.BadRequest("minimum_sale_price must be >= 0", nil)
	}
	if req.Status != "" && !validProductStatus(req.Status) {
		return apperrors.BadRequest("invalid status", nil)
	}
	if err := validatePreparationTime(req.PreparationTimeMinutes); err != nil {
		return err
	}
	categoryID := product.CategoryID
	if req.CategoryID != "" {
		categoryID = req.CategoryID
	}
	if req.CategoryID != "" || req.ProductType != "" || req.UnitID != "" || req.TaxRateID != nil {
		if err := s.validateReferences(businessID, branchID, categoryID, productType, req.UnitID, cleanStringPointer(req.TaxRateID)); err != nil {
			return err
		}
	}
	if err := s.validateUniqueCodes(businessID, branchID, productID, strings.TrimSpace(req.SKU), strings.TrimSpace(req.Barcode)); err != nil {
		return err
	}
	return nil
}

func (s *Service) validateReferences(businessID, branchID, categoryID, productType, unitID string, taxRateID *string) error {
	if categoryID != "" {
		var count int64
		if err := s.db.Table("product_categories").Where("id = ? AND business_id = ? AND branch_id = ? AND status = ? AND deleted_at IS NULL", categoryID, businessID, branchID, "active").Count(&count).Error; err != nil || count == 0 {
			return apperrors.BadRequest("invalid category_id", nil)
		}
		count = 0
		if err := s.db.Table("product_category_allowed_types").Where("business_id = ? AND branch_id = ? AND product_category_id = ? AND product_type = ?", businessID, branchID, categoryID, productType).Count(&count).Error; err != nil {
			return apperrors.Internal("failed to validate product category type")
		}
		if count == 0 {
			return apperrors.BadRequest("product category is not allowed for selected product_type", nil)
		}
	}
	if unitID != "" {
		var count int64
		if err := s.db.Table("units").Where("id = ? AND (business_id IS NULL OR business_id = ?) AND deleted_at IS NULL", unitID, businessID).Count(&count).Error; err != nil || count == 0 {
			return apperrors.BadRequest("invalid unit_id", nil)
		}
	}
	if taxRateID != nil {
		var count int64
		if err := s.db.Table("tax_rates").Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", *taxRateID, businessID, "active").Count(&count).Error; err != nil || count == 0 {
			return apperrors.BadRequest("invalid tax_rate_id", nil)
		}
	}
	return nil
}

func (s *Service) validateUniqueCodes(businessID, branchID, productID, sku, barcode string) error {
	if sku != "" {
		productExists, err := s.repo.SKUExists(businessID, branchID, sku, productID)
		if err != nil {
			return apperrors.Internal("failed to validate SKU")
		}
		variantExists, err := s.repo.VariantSKUExists(businessID, branchID, sku, "")
		if err != nil {
			return apperrors.Internal("failed to validate SKU")
		}
		if productExists || variantExists {
			return apperrors.Conflict("sku already exists", nil)
		}
	}
	if barcode != "" {
		productExists, err := s.repo.BarcodeExists(businessID, branchID, barcode, productID)
		if err != nil {
			return apperrors.Internal("failed to validate barcode")
		}
		variantExists, err := s.repo.VariantBarcodeExists(businessID, branchID, barcode, "")
		if err != nil {
			return apperrors.Internal("failed to validate barcode")
		}
		if productExists || variantExists {
			return apperrors.Conflict("barcode already exists", nil)
		}
	}
	return nil
}

func (s *Service) generateProductCode(businessID, branchID string) (string, error) {
	for i := 0; i < 10; i++ {
		code, err := s.repo.NextProductCode(businessID, branchID)
		if err != nil {
			return "", err
		}
		exists, err := s.repo.ProductCodeExists(businessID, branchID, code, "")
		if err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}
	return "PRD-" + strconv.FormatInt(time.Now().UnixNano(), 10), nil
}

func (s *Service) updateWithAudit(currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string, metadata map[string]interface{}, update func(tx *gorm.DB) error) error {
	tx := s.db.Begin()
	if tx.Error != nil {
		return apperrors.Internal("failed to start transaction")
	}
	if err := update(tx); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("product not found")
		}
		return err
	}
	if err := s.writeAudit(tx, currentUser, eventType, entityID, summary, ipAddress, userAgent, metadata); err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return apperrors.Internal("failed to commit product change")
	}
	return nil
}

func (s *Service) writeAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string, metadata ...map[string]interface{}) error {
	auditMetadata := map[string]interface{}(nil)
	if len(metadata) > 0 {
		auditMetadata = metadata[0]
	}
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "product",
		EntityID:    entityID,
		Summary:     summary,
		Metadata:    auditMetadata,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

func productChanges(existing Product, updates map[string]interface{}) []audit.AuditChange {
	changes := []audit.AuditChange{}
	for field, next := range updates {
		switch field {
		case "product_name":
			audit.AddChange(&changes, field, "Product name", existing.ProductName, next)
		case "category_id":
			audit.AddChange(&changes, field, "Category", existing.CategoryID, next)
		case "unit_id":
			audit.AddChange(&changes, field, "Unit", existing.UnitID, next)
		case "tax_rate_id":
			audit.AddChange(&changes, field, "Tax rate", existing.TaxRateID, next)
		case "description":
			audit.AddChange(&changes, field, "Description", existing.Description, next)
		case "product_type":
			audit.AddChange(&changes, field, "Product type", existing.ProductType, next)
		case "item_structure":
			audit.AddChange(&changes, field, "Item structure", existing.ItemStructure, next)
		case "sale_price":
			audit.AddChange(&changes, field, "Sale price", existing.SalePrice, next)
		case "cost_price":
			audit.AddChange(&changes, field, "Cost price", existing.CostPrice, next)
		case "compare_at_price":
			audit.AddChange(&changes, field, "Compare at price", existing.CompareAtPrice, next)
		case "cost_update_policy":
			audit.AddChange(&changes, field, "Cost update policy", existing.CostUpdatePolicy, next)
		case "pricing_type":
			audit.AddChange(&changes, field, "Pricing type", existing.PricingType, next)
		case "pricing_percent":
			audit.AddChange(&changes, field, "Pricing percent", existing.PricingPercent, next)
		case "minimum_sale_price":
			audit.AddChange(&changes, field, "Minimum sale price", existing.MinimumSalePrice, next)
		case "auto_price_update_enabled":
			audit.AddChange(&changes, field, "Auto price update", existing.AutoPriceUpdateEnabled, next)
		case "sale_price_locked":
			audit.AddChange(&changes, field, "Sale price locked", existing.SalePriceLocked, next)
		case "sku":
			audit.AddChange(&changes, field, "SKU", existing.SKU, next)
		case "barcode":
			audit.AddChange(&changes, field, "Barcode", existing.Barcode, next)
		case "image_file_id":
			audit.AddChange(&changes, field, "Image file", existing.ImageFileID, next)
		case "is_sellable":
			audit.AddChange(&changes, field, "Sellable", existing.IsSellable, next)
		case "is_pos_visible":
			audit.AddChange(&changes, field, "POS visible", existing.IsPOSVisible, next)
		case "is_purchasable":
			audit.AddChange(&changes, field, "Purchasable", existing.IsPurchasable, next)
		case "is_stock_tracked":
			audit.AddChange(&changes, field, "Stock tracked", existing.IsStockTracked, next)
		case "is_expiry_tracked":
			audit.AddChange(&changes, field, "Expiry tracked", existing.IsExpiryTracked, next)
		case "is_custom_order_available":
			audit.AddChange(&changes, field, "Custom order available", existing.IsCustomOrderAvailable, next)
		case "preparation_time_minutes":
			audit.AddChange(&changes, field, "Preparation time", existing.PreparationTimeMinutes, next)
		case "status":
			audit.AddChange(&changes, field, "Status", existing.Status, next)
		}
	}
	return changes
}

func normalizeListQuery(query *ProductListQuery) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.Limit <= 0 || query.Limit > 100 {
		query.Limit = 20
	}
	if query.SortBy == "" {
		query.SortBy = "created_at"
	}
	if query.SortOrder == "" {
		query.SortOrder = "desc"
	}
}

func validateProductType(value string) error {
	switch strings.TrimSpace(value) {
	case "finished_product", "ingredient", "packaging", "raw_material", "semi_finished", "consumable", "equipment", "service":
		return nil
	default:
		return apperrors.BadRequest("invalid product_type", nil)
	}
}

func defaultSellableForProductType(value string) bool {
	switch strings.TrimSpace(value) {
	case "finished_product", "service", "ready_to_sell", "made_to_order", "retail":
		return true
	default:
		return false
	}
}

func defaultPurchasableForProductType(value string) bool {
	switch strings.TrimSpace(value) {
	case "ingredient", "packaging", "raw_material", "semi_finished", "consumable", "equipment":
		return true
	default:
		return false
	}
}

func validateItemStructure(value string) error {
	switch normalizeItemStructure(value) {
	case "single", "variant", "recipe_based", "custom":
		return nil
	default:
		return apperrors.BadRequest("invalid item_structure", nil)
	}
}

func normalizeItemStructure(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "single"
	}
	return trimmed
}

func validProductStatus(value string) bool {
	switch value {
	case "active", "inactive", "archived":
		return true
	default:
		return false
	}
}

func validatePrices(salePrice float64, costPrice, compareAtPrice *float64) error {
	if salePrice < 0 {
		return apperrors.BadRequest("sale_price must be >= 0", nil)
	}
	if costPrice != nil && *costPrice < 0 {
		return apperrors.BadRequest("cost_price must be >= 0", nil)
	}
	if compareAtPrice != nil && *compareAtPrice < salePrice {
		return apperrors.BadRequest("compare_at_price must be >= sale_price", nil)
	}
	return nil
}

func validCostUpdatePolicy(value string) bool {
	switch normalizeCostUpdatePolicy(value) {
	case "manual", "latest_purchase", "weighted_average", "recipe_actual":
		return true
	default:
		return false
	}
}

func normalizeCostUpdatePolicy(value string) string {
	switch strings.TrimSpace(value) {
	case "latest_purchase", "weighted_average", "recipe_actual":
		return strings.TrimSpace(value)
	default:
		return "manual"
	}
}

func validPricingType(value string) bool {
	switch normalizePricingType(value) {
	case "markup", "margin":
		return true
	default:
		return false
	}
}

func normalizePricingType(value string) string {
	switch strings.TrimSpace(value) {
	case "margin":
		return "margin"
	default:
		return "markup"
	}
}

func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}

func roundQuantity(value float64) float64 {
	return math.Round(value*10000) / 10000
}

func validatePreparationTime(value *int) error {
	if value != nil && *value < 0 {
		return apperrors.BadRequest("preparation_time_minutes must be >= 0", nil)
	}
	return nil
}

func cleanStringPointer(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func lookupField(barcode, sku, productCode string) (string, string, string) {
	if strings.TrimSpace(barcode) != "" {
		return "barcode", strings.TrimSpace(barcode), "barcode"
	}
	if strings.TrimSpace(sku) != "" {
		return "sku", strings.TrimSpace(sku), "sku"
	}
	return "product_code", strings.TrimSpace(productCode), "product_code"
}

func toProductResponse(product Product, category ProductCategoryInfo, unit ProductUnitInfo, taxRate *ProductTaxRateInfo, variants []ProductVariantInfo) ProductResponse {
	return ProductResponse{
		ID:                     product.ID,
		BusinessID:             product.BusinessID,
		BranchID:               product.BranchID,
		ProductName:            product.ProductName,
		ProductCode:            product.ProductCode,
		SKU:                    product.SKU,
		Barcode:                product.Barcode,
		Category:               category,
		Unit:                   unit,
		TaxRate:                taxRate,
		ProductType:            product.ProductType,
		ItemStructure:          normalizeItemStructure(product.ItemStructure),
		SalePrice:              product.SalePrice,
		CostPrice:              product.CostPrice,
		CompareAtPrice:         product.CompareAtPrice,
		CostUpdatePolicy:       normalizeCostUpdatePolicy(product.CostUpdatePolicy),
		PricingType:            normalizePricingType(product.PricingType),
		PricingPercent:         roundQuantity(product.PricingPercent),
		MinimumSalePrice:       product.MinimumSalePrice,
		SuggestedSalePrice:     product.SuggestedSalePrice,
		AutoPriceUpdateEnabled: product.AutoPriceUpdateEnabled,
		SalePriceLocked:        product.SalePriceLocked,
		LastPurchaseCost:       product.LastPurchaseCost,
		LastPurchaseDate:       product.LastPurchaseDate,
		LastProductionCost:     product.LastProductionCost,
		LastProductionDate:     product.LastProductionDate,
		AverageInventoryCost:   product.AverageInventoryCost,
		Description:            product.Description,
		ImageFileID:            product.ImageFileID,
		IsSellable:             product.IsSellable,
		IsPOSVisible:           product.IsPOSVisible,
		IsPurchasable:          product.IsPurchasable,
		IsStockTracked:         product.IsStockTracked,
		IsExpiryTracked:        product.IsExpiryTracked,
		IsCustomOrderAvailable: product.IsCustomOrderAvailable,
		PreparationTimeMinutes: product.PreparationTimeMinutes,
		Status:                 product.Status,
		Variants:               variants,
		CreatedAt:              product.CreatedAt,
		UpdatedAt:              product.UpdatedAt,
	}
}
