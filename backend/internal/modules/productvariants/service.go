package productvariants

import (
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

func (s *Service) ListVariants(currentUser *utils.AuthContext, productID string) ([]VariantResponse, error) {
	if err := s.ensureProduct(currentUser, productID); err != nil {
		return nil, err
	}
	variants, err := s.repo.List(productID, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to list variants")
	}
	response := make([]VariantResponse, 0, len(variants))
	for _, variant := range variants {
		response = append(response, toVariantResponse(variant))
	}
	return response, nil
}

func (s *Service) CreateVariant(currentUser *utils.AuthContext, productID string, req CreateVariantRequest, ipAddress, userAgent string) (*VariantResponse, error) {
	if err := s.ensureProduct(currentUser, productID); err != nil {
		return nil, err
	}
	if err := s.validateCreate(currentUser.BusinessID, req); err != nil {
		return nil, err
	}
	variant := &ProductVariant{
		ID:                     utils.NewUUID(),
		BusinessID:             currentUser.BusinessID,
		ProductID:              productID,
		VariantName:            strings.TrimSpace(req.VariantName),
		SKU:                    strings.TrimSpace(req.SKU),
		Barcode:                strings.TrimSpace(req.Barcode),
		SalePrice:              req.SalePrice,
		CostPrice:              req.CostPrice,
		CostUpdatePolicy:       normalizeCostUpdatePolicy(req.CostUpdatePolicy),
		PricingType:            normalizePricingType(req.PricingType),
		PricingPercent:         req.PricingPercent,
		MinimumSalePrice:       req.MinimumSalePrice,
		AutoPriceUpdateEnabled: req.AutoPriceUpdateEnabled,
		SalePriceLocked:        req.SalePriceLocked,
		ImageFileID:            strings.TrimSpace(req.ImageFileID),
		SortOrder:              req.SortOrder,
		Status:                 "active",
	}
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.Create(tx, variant); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create variant")
	}
	if err := s.writeAudit(tx, currentUser, "product_variant.created", variant.ID, "Product variant created.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit variant creation")
	}
	return s.GetVariant(currentUser, productID, variant.ID)
}

func (s *Service) GetVariant(currentUser *utils.AuthContext, productID, variantID string) (*VariantResponse, error) {
	if err := s.ensureProduct(currentUser, productID); err != nil {
		return nil, err
	}
	variant, err := s.repo.FindByID(productID, variantID, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("variant not found")
		}
		return nil, apperrors.Internal("failed to load variant")
	}
	response := toVariantResponse(*variant)
	return &response, nil
}

func (s *Service) UpdateVariant(currentUser *utils.AuthContext, productID, variantID string, req UpdateVariantRequest, ipAddress, userAgent string) (*VariantResponse, error) {
	if err := s.ensureProduct(currentUser, productID); err != nil {
		return nil, err
	}
	if _, err := s.repo.FindByID(productID, variantID, currentUser.BusinessID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("variant not found")
		}
		return nil, apperrors.Internal("failed to load variant")
	}
	if err := s.validateUpdate(currentUser.BusinessID, variantID, req); err != nil {
		return nil, err
	}
	updates := map[string]interface{}{"updated_at": time.Now().UTC()}
	if req.VariantName != "" {
		updates["variant_name"] = strings.TrimSpace(req.VariantName)
	}
	if req.SKU != "" {
		updates["sku"] = strings.TrimSpace(req.SKU)
	}
	if req.Barcode != "" {
		updates["barcode"] = strings.TrimSpace(req.Barcode)
	}
	if req.SalePrice != nil {
		updates["sale_price"] = *req.SalePrice
	}
	if req.CostPrice != nil {
		updates["cost_price"] = *req.CostPrice
	}
	if req.CostUpdatePolicy != nil {
		updates["cost_update_policy"] = normalizeCostUpdatePolicy(*req.CostUpdatePolicy)
	}
	if req.PricingType != nil {
		updates["pricing_type"] = normalizePricingType(*req.PricingType)
	}
	if req.PricingPercent != nil {
		updates["pricing_percent"] = *req.PricingPercent
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
	if req.ImageFileID != "" {
		updates["image_file_id"] = strings.TrimSpace(req.ImageFileID)
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}
	if err := s.updateWithAudit(currentUser, "product_variant.updated", variantID, "Product variant updated.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.Update(tx, productID, variantID, currentUser.BusinessID, updates)
	}); err != nil {
		return nil, err
	}
	return s.GetVariant(currentUser, productID, variantID)
}

func (s *Service) UpdateVariantStatus(currentUser *utils.AuthContext, productID, variantID string, req UpdateVariantStatusRequest, ipAddress, userAgent string) (*VariantResponse, error) {
	if err := s.ensureProduct(currentUser, productID); err != nil {
		return nil, err
	}
	if !validVariantStatus(req.Status) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	if err := s.updateWithAudit(currentUser, "product_variant.status_updated", variantID, "Product variant status updated.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.Update(tx, productID, variantID, currentUser.BusinessID, map[string]interface{}{"status": req.Status, "updated_at": time.Now().UTC()})
	}); err != nil {
		return nil, err
	}
	return s.GetVariant(currentUser, productID, variantID)
}

func (s *Service) DeleteVariant(currentUser *utils.AuthContext, productID, variantID string, ipAddress, userAgent string) error {
	if err := s.ensureProduct(currentUser, productID); err != nil {
		return err
	}
	return s.updateWithAudit(currentUser, "product_variant.deleted", variantID, "Product variant deleted.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.Update(tx, productID, variantID, currentUser.BusinessID, map[string]interface{}{
			"status":     "archived",
			"updated_at": time.Now().UTC(),
			"deleted_at": gorm.DeletedAt{Time: time.Now().UTC(), Valid: true},
		})
	})
}

// ensureProduct confines every variant operation to the caller's branch.
//
// product_variants carries no branch column, so without this check a request
// could read and modify another branch's catalogue and pricing simply by
// addressing that branch's product id.
func (s *Service) ensureProduct(currentUser *utils.AuthContext, productID string) error {
	branchID, allBranches, err := currentUser.ResolveBranchScope("", "")
	if err != nil {
		return err
	}
	if allBranches {
		branchID = ""
	}
	exists, err := s.repo.ProductExists(productID, currentUser.BusinessID, branchID)
	if err != nil {
		return apperrors.Internal("failed to load product")
	}
	if !exists {
		return apperrors.NotFound("product not found")
	}
	return nil
}

func (s *Service) validateCreate(businessID string, req CreateVariantRequest) error {
	if strings.TrimSpace(req.VariantName) == "" {
		return apperrors.BadRequest("variant_name is required", nil)
	}
	if req.SalePrice < 0 {
		return apperrors.BadRequest("sale_price must be >= 0", nil)
	}
	if req.CostPrice != nil && *req.CostPrice < 0 {
		return apperrors.BadRequest("cost_price must be >= 0", nil)
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
	return s.validateUnique(businessID, "", strings.TrimSpace(req.SKU), strings.TrimSpace(req.Barcode))
}

func (s *Service) validateUpdate(businessID, variantID string, req UpdateVariantRequest) error {
	if req.SalePrice != nil && *req.SalePrice < 0 {
		return apperrors.BadRequest("sale_price must be >= 0", nil)
	}
	if req.CostPrice != nil && *req.CostPrice < 0 {
		return apperrors.BadRequest("cost_price must be >= 0", nil)
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
	return s.validateUnique(businessID, variantID, strings.TrimSpace(req.SKU), strings.TrimSpace(req.Barcode))
}

func (s *Service) validateUnique(businessID, variantID, sku, barcode string) error {
	if sku != "" {
		productExists, err := s.repo.ProductSKUExists(businessID, sku)
		if err != nil {
			return apperrors.Internal("failed to validate SKU")
		}
		variantExists, err := s.repo.SKUExists(businessID, sku, variantID)
		if err != nil {
			return apperrors.Internal("failed to validate SKU")
		}
		if productExists || variantExists {
			return apperrors.Conflict("sku already exists", nil)
		}
	}
	if barcode != "" {
		productExists, err := s.repo.ProductBarcodeExists(businessID, barcode)
		if err != nil {
			return apperrors.Internal("failed to validate barcode")
		}
		variantExists, err := s.repo.BarcodeExists(businessID, barcode, variantID)
		if err != nil {
			return apperrors.Internal("failed to validate barcode")
		}
		if productExists || variantExists {
			return apperrors.Conflict("barcode already exists", nil)
		}
	}
	return nil
}

func (s *Service) updateWithAudit(currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string, update func(tx *gorm.DB) error) error {
	tx := s.db.Begin()
	if tx.Error != nil {
		return apperrors.Internal("failed to start transaction")
	}
	if err := update(tx); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("variant not found")
		}
		return err
	}
	if err := s.writeAudit(tx, currentUser, eventType, entityID, summary, ipAddress, userAgent); err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return apperrors.Internal("failed to commit variant change")
	}
	return nil
}

func (s *Service) writeAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "product_variant",
		EntityID:    entityID,
		Summary:     summary,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

func validVariantStatus(value string) bool {
	switch value {
	case "active", "inactive", "archived":
		return true
	default:
		return false
	}
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
	if strings.TrimSpace(value) == "margin" {
		return "margin"
	}
	return "markup"
}

func toVariantResponse(variant ProductVariant) VariantResponse {
	return VariantResponse{
		ID:                     variant.ID,
		BusinessID:             variant.BusinessID,
		ProductID:              variant.ProductID,
		VariantName:            variant.VariantName,
		SKU:                    variant.SKU,
		Barcode:                variant.Barcode,
		SalePrice:              variant.SalePrice,
		CostPrice:              variant.CostPrice,
		CostUpdatePolicy:       normalizeCostUpdatePolicy(variant.CostUpdatePolicy),
		PricingType:            normalizePricingType(variant.PricingType),
		PricingPercent:         variant.PricingPercent,
		MinimumSalePrice:       variant.MinimumSalePrice,
		SuggestedSalePrice:     variant.SuggestedSalePrice,
		AutoPriceUpdateEnabled: variant.AutoPriceUpdateEnabled,
		SalePriceLocked:        variant.SalePriceLocked,
		LastPurchaseCost:       variant.LastPurchaseCost,
		LastPurchaseDate:       variant.LastPurchaseDate,
		LastProductionCost:     variant.LastProductionCost,
		LastProductionDate:     variant.LastProductionDate,
		AverageInventoryCost:   variant.AverageInventoryCost,
		ImageFileID:            variant.ImageFileID,
		SortOrder:              variant.SortOrder,
		Status:                 variant.Status,
		CreatedAt:              variant.CreatedAt,
		UpdatedAt:              variant.UpdatedAt,
	}
}
