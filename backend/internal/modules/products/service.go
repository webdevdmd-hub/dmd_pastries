package products

import (
	"database/sql"
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

	isPOSVisible := true
	if req.IsPOSVisible != nil {
		isPOSVisible = *req.IsPOSVisible
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
		ProductType:            req.ProductType,
		SalePrice:              req.SalePrice,
		CostPrice:              req.CostPrice,
		CompareAtPrice:         req.CompareAtPrice,
		ImageFileID:            strings.TrimSpace(req.ImageFileID),
		IsPOSVisible:           isPOSVisible,
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
	if err := s.writeAudit(tx, currentUser, "product.created", product.ID, "Product created.", ipAddress, userAgent); err != nil {
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
	if err := s.validateUpdate(currentUser.BusinessID, branchID, product.ID, req); err != nil {
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
		updates["product_type"] = req.ProductType
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
	if req.SKU != "" {
		updates["sku"] = strings.TrimSpace(req.SKU)
	}
	if req.Barcode != "" {
		updates["barcode"] = strings.TrimSpace(req.Barcode)
	}
	if req.ImageFileID != "" {
		updates["image_file_id"] = strings.TrimSpace(req.ImageFileID)
	}
	if req.IsPOSVisible != nil {
		updates["is_pos_visible"] = *req.IsPOSVisible
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

	if err := s.updateWithAudit(currentUser, "product.updated", id, "Product updated.", ipAddress, userAgent, func(tx *gorm.DB) error {
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
	if _, err := s.repo.FindByID(id, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("product not found")
		}
		return nil, apperrors.Internal("failed to load product")
	}
	updates := map[string]interface{}{"status": req.Status, "updated_by": currentUser.UserID, "updated_at": time.Now().UTC()}
	if req.Status != "active" {
		updates["is_pos_visible"] = false
	}
	if err := s.updateWithAudit(currentUser, "product.status_updated", id, "Product status updated.", ipAddress, userAgent, func(tx *gorm.DB) error {
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
	if _, err := s.repo.FindByID(id, currentUser.BusinessID, branchID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("product not found")
		}
		return apperrors.Internal("failed to load product")
	}
	return s.updateWithAudit(currentUser, "product.deleted", id, "Product deleted.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.Update(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{
			"status":         "archived",
			"is_pos_visible": false,
			"updated_by":     currentUser.UserID,
			"updated_at":     time.Now().UTC(),
			"deleted_at":     gorm.DeletedAt{Time: time.Now().UTC(), Valid: true},
		})
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
			if err != nil || product.Status != "active" || !product.IsPOSVisible {
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
	if err := validateProductType(req.ProductType); err != nil {
		return err
	}
	if err := validatePrices(req.SalePrice, req.CostPrice, req.CompareAtPrice); err != nil {
		return err
	}
	if err := validatePreparationTime(req.PreparationTimeMinutes); err != nil {
		return err
	}
	if err := s.validateReferences(businessID, branchID, req.CategoryID, req.UnitID, cleanStringPointer(req.TaxRateID)); err != nil {
		return err
	}
	if err := s.validateUniqueCodes(businessID, branchID, "", strings.TrimSpace(req.SKU), strings.TrimSpace(req.Barcode)); err != nil {
		return err
	}
	return nil
}

func (s *Service) validateUpdate(businessID, branchID, productID string, req UpdateProductRequest) error {
	if req.ProductType != "" {
		if err := validateProductType(req.ProductType); err != nil {
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
	if req.Status != "" && !validProductStatus(req.Status) {
		return apperrors.BadRequest("invalid status", nil)
	}
	if err := validatePreparationTime(req.PreparationTimeMinutes); err != nil {
		return err
	}
	if req.CategoryID != "" || req.UnitID != "" || req.TaxRateID != nil {
		if err := s.validateReferences(businessID, branchID, req.CategoryID, req.UnitID, cleanStringPointer(req.TaxRateID)); err != nil {
			return err
		}
	}
	if err := s.validateUniqueCodes(businessID, branchID, productID, strings.TrimSpace(req.SKU), strings.TrimSpace(req.Barcode)); err != nil {
		return err
	}
	return nil
}

func (s *Service) validateReferences(businessID, branchID, categoryID, unitID string, taxRateID *string) error {
	if categoryID != "" {
		var count int64
		if err := s.db.Table("product_categories").Where("id = ? AND business_id = ? AND branch_id = ? AND deleted_at IS NULL", categoryID, businessID, branchID).Count(&count).Error; err != nil || count == 0 {
			return apperrors.BadRequest("invalid category_id", nil)
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
		if err := s.db.Table("tax_rates").Where("id = ? AND business_id = ? AND deleted_at IS NULL", *taxRateID, businessID).Count(&count).Error; err != nil || count == 0 {
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

func (s *Service) updateWithAudit(currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string, update func(tx *gorm.DB) error) error {
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
	if err := s.writeAudit(tx, currentUser, eventType, entityID, summary, ipAddress, userAgent); err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return apperrors.Internal("failed to commit product change")
	}
	return nil
}

func (s *Service) writeAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "product",
		EntityID:    entityID,
		Summary:     summary,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
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
	switch value {
	case "ready_to_sell", "made_to_order", "manufactured", "retail", "service":
		return nil
	default:
		return apperrors.BadRequest("invalid product_type", nil)
	}
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
		SalePrice:              product.SalePrice,
		CostPrice:              product.CostPrice,
		CompareAtPrice:         product.CompareAtPrice,
		Description:            product.Description,
		ImageFileID:            product.ImageFileID,
		IsPOSVisible:           product.IsPOSVisible,
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
