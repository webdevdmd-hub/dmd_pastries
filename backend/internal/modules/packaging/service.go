package packaging

import (
	"errors"
	"pastries-pos/internal/shared/money"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/inventory"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db            *gorm.DB
	repo          *Repository
	inventoryRepo *inventory.Repository
	auditRepo     *audit.Repository
}

func NewService(db *gorm.DB, repo *Repository, inventoryRepo *inventory.Repository, auditRepo *audit.Repository) *Service {
	return &Service{db: db, repo: repo, inventoryRepo: inventoryRepo, auditRepo: auditRepo}
}

func (s *Service) List(currentUser *utils.AuthContext, query ListQuery) (*ListResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	normalizeQuery(&query)
	if query.Status != "" && !validStatus(query.Status) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	items, total, err := s.repo.List(currentUser.BusinessID, branchID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list packaging items")
	}
	responses := make([]PackagingResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, s.repo.ToResponse(currentUser.BusinessID, item))
	}
	return &ListResponse{Items: responses, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) Lookup(currentUser *utils.AuthContext, query LookupQuery) (*LookupResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	query.Search = strings.TrimSpace(query.Search)
	if query.Limit <= 0 {
		query.Limit = 10
	}
	if query.Limit > 20 {
		query.Limit = 20
	}
	items, err := s.repo.Lookup(currentUser.BusinessID, branchID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to lookup packaging")
	}
	return &LookupResponse{Items: items}, nil
}

func (s *Service) Create(currentUser *utils.AuthContext, req CreatePackagingRequest, ipAddress, userAgent string) (*PackagingResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if err := s.validateCreatePayload(s.db, currentUser.BusinessID, branchID, req); err != nil {
		return nil, err
	}
	var id string
	err = s.db.Transaction(func(tx *gorm.DB) error {
		code, err := s.generateCode(tx, currentUser.BusinessID, branchID)
		if err != nil {
			return err
		}
		item := &PackagingItem{
			ID:                  utils.NewUUID(),
			BusinessID:          currentUser.BusinessID,
			BranchID:            branchID,
			PackagingCategoryID: strings.TrimSpace(req.PackagingCategoryID),
			SupplierID:          nullableString(req.SupplierID),
			PackagingName:       strings.TrimSpace(req.PackagingName),
			PackagingCode:       code,
			Description:         strings.TrimSpace(req.Description),
			UnitID:              strings.TrimSpace(req.UnitID),
			CostPerUnit:         req.CostPerUnit,
			IsStockTracked:      req.IsStockTracked,
			IsConsumable:        req.IsConsumable,
			ReorderLevel:        req.ReorderLevel,
			ImageURL:            nullableString(req.ImageURL),
			ImageFileID:         strings.TrimSpace(req.ImageFileID),
			Status:              "active",
			CreatedByUserID:     currentUser.UserID,
			UpdatedByUserID:     currentUser.UserID,
		}
		if !req.IsStockTracked {
			item.IsStockTracked = false
		}
		if err := s.repo.Create(tx, item); err != nil {
			return err
		}
		if item.IsStockTracked {
			if err := s.ensureInventoryItem(tx, item); err != nil {
				return err
			}
		}
		if err := s.audit(tx, currentUser, "packaging.created", item.ID, "Packaging item created", ipAddress, userAgent); err != nil {
			return err
		}
		id = item.ID
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.Get(currentUser, id)
}

func (s *Service) Get(currentUser *utils.AuthContext, id string) (*PackagingResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	item, err := s.repo.FindByID(id, currentUser.BusinessID, branchID)
	if err != nil {
		return nil, notFound(err, "packaging item not found")
	}
	dto := s.repo.ToResponse(currentUser.BusinessID, *item)
	return &dto, nil
}

func (s *Service) Update(currentUser *utils.AuthContext, id string, req UpdatePackagingRequest, ipAddress, userAgent string) (*PackagingResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		item, err := s.repo.FindByID(id, currentUser.BusinessID, branchID)
		if err != nil {
			return notFound(err, "packaging item not found")
		}
		updates := map[string]interface{}{"updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
		if strings.TrimSpace(req.PackagingName) != "" {
			updates["packaging_name"] = strings.TrimSpace(req.PackagingName)
		}
		if strings.TrimSpace(req.PackagingCategoryID) != "" {
			if err := validateUUID(req.PackagingCategoryID, "packaging_category_id"); err != nil {
				return err
			}
			if err := s.repo.ValidateCategory(tx, currentUser.BusinessID, branchID, req.PackagingCategoryID); err != nil {
				return notFound(err, "packaging category not found")
			}
			updates["packaging_category_id"] = strings.TrimSpace(req.PackagingCategoryID)
		}
		if req.SupplierID != nil {
			if strings.TrimSpace(*req.SupplierID) != "" {
				if err := validateUUID(*req.SupplierID, "supplier_id"); err != nil {
					return err
				}
				if err := s.repo.ValidateSupplier(tx, currentUser.BusinessID, branchID, *req.SupplierID); err != nil {
					return notFound(err, "supplier not found")
				}
			}
			updates["supplier_id"] = nullableString(*req.SupplierID)
		}
		if strings.TrimSpace(req.UnitID) != "" {
			if err := validateUUID(req.UnitID, "unit_id"); err != nil {
				return err
			}
			if err := s.repo.ValidateUnit(tx, currentUser.BusinessID, req.UnitID); err != nil {
				return notFound(err, "unit not found")
			}
			updates["unit_id"] = strings.TrimSpace(req.UnitID)
		}
		if req.CostPerUnit != nil {
			if req.CostPerUnit.IsNegative() {
				return apperrors.BadRequest("cost_per_unit must be non-negative", nil)
			}
			updates["cost_per_unit"] = *req.CostPerUnit
		}
		if req.ReorderLevel != nil {
			if req.ReorderLevel.IsNegative() {
				return apperrors.BadRequest("reorder_level must be non-negative", nil)
			}
			updates["reorder_level"] = *req.ReorderLevel
		}
		if req.IsStockTracked != nil {
			updates["is_stock_tracked"] = *req.IsStockTracked
		}
		if req.IsConsumable != nil {
			updates["is_consumable"] = *req.IsConsumable
		}
		if strings.TrimSpace(req.Description) != "" {
			updates["description"] = strings.TrimSpace(req.Description)
		}
		if req.ImageURL != nil {
			updates["image_url"] = nullableString(*req.ImageURL)
		}
		if strings.TrimSpace(req.ImageFileID) != "" {
			updates["image_file_id"] = strings.TrimSpace(req.ImageFileID)
		}
		if strings.TrimSpace(req.Status) != "" {
			if !validStatus(req.Status) {
				return apperrors.BadRequest("invalid status", nil)
			}
			updates["status"] = req.Status
		}
		if err := s.repo.Update(tx, id, currentUser.BusinessID, branchID, updates); err != nil {
			return notFound(err, "packaging item not found")
		}
		if req.IsStockTracked != nil && *req.IsStockTracked && !item.IsStockTracked {
			item.IsStockTracked = true
			if err := s.ensureInventoryItem(tx, item); err != nil {
				return err
			}
		}
		return s.audit(tx, currentUser, "packaging.updated", id, "Packaging item updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.Get(currentUser, id)
}

func (s *Service) UpdateStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*PackagingResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if !validStatus(req.Status) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.Update(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{"status": req.Status, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}); err != nil {
			return notFound(err, "packaging item not found")
		}
		return s.audit(tx, currentUser, "packaging.status_updated", id, "Packaging status updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.Get(currentUser, id)
}

func (s *Service) Delete(currentUser *utils.AuthContext, id, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		used, err := s.repo.HasUsageRules(tx, currentUser.BusinessID, id)
		if err != nil {
			return err
		}
		if used {
			return apperrors.BadRequest("packaging item is used in product packaging rules", nil)
		}
		if err := s.repo.Update(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{"status": "inactive", "deleted_at": gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}); err != nil {
			return notFound(err, "packaging item not found")
		}
		return s.audit(tx, currentUser, "packaging.deleted", id, "Packaging item deleted", ipAddress, userAgent)
	})
}

func (s *Service) ListProductRules(currentUser *utils.AuthContext, productID string) ([]UsageRuleResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if err := validateUUID(productID, "product_id"); err != nil {
		return nil, err
	}
	if err := s.repo.ValidateProduct(s.db, currentUser.BusinessID, branchID, productID); err != nil {
		return nil, notFound(err, "product not found")
	}
	return s.repo.ListUsageRules(currentUser.BusinessID, branchID, productID)
}

func (s *Service) CreateProductRule(currentUser *utils.AuthContext, productID string, req CreateUsageRuleRequest, ipAddress, userAgent string) (*UsageRuleResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if err := validateUUID(productID, "product_id"); err != nil {
		return nil, err
	}
	if err := validateUUID(req.PackagingItemID, "packaging_item_id"); err != nil {
		return nil, err
	}
	if !req.QuantityRequired.IsPositive() {
		return nil, apperrors.BadRequest("quantity_required must be greater than zero", nil)
	}
	var ruleID string
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.ValidateProduct(tx, currentUser.BusinessID, branchID, productID); err != nil {
			return notFound(err, "product not found")
		}
		item, err := s.repo.FindByID(req.PackagingItemID, currentUser.BusinessID, branchID)
		if err != nil {
			return notFound(err, "packaging item not found")
		}
		if item.Status != "active" {
			return apperrors.BadRequest("inactive packaging cannot be used", nil)
		}
		exists, err := s.repo.UsageRuleExists(tx, currentUser.BusinessID, branchID, productID, req.PackagingItemID)
		if err != nil {
			return err
		}
		if exists {
			return apperrors.Conflict("packaging usage rule already exists", nil)
		}
		rule := &PackagingUsageRule{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, BranchID: branchID, ProductID: productID, PackagingItemID: req.PackagingItemID, QuantityRequired: req.QuantityRequired, IsDefault: req.IsDefault}
		if err := s.repo.CreateUsageRule(tx, rule); err != nil {
			return err
		}
		ruleID = rule.ID
		return s.audit(tx, currentUser, "packaging.rule_created", rule.ID, "Packaging usage rule created", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	rules, err := s.repo.ListUsageRules(currentUser.BusinessID, branchID, productID)
	if err != nil {
		return nil, err
	}
	for _, rule := range rules {
		if rule.ID == ruleID {
			return &rule, nil
		}
	}
	return nil, apperrors.Internal("failed to load packaging usage rule")
}

func (s *Service) DeleteProductRule(currentUser *utils.AuthContext, productID, ruleID, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	if err := validateUUID(productID, "product_id"); err != nil {
		return err
	}
	if err := validateUUID(ruleID, "rule_id"); err != nil {
		return err
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.DeleteUsageRule(tx, currentUser.BusinessID, branchID, productID, ruleID); err != nil {
			return notFound(err, "packaging usage rule not found")
		}
		return s.audit(tx, currentUser, "packaging.rule_deleted", ruleID, "Packaging usage rule deleted", ipAddress, userAgent)
	})
}

func (s *Service) validateCreatePayload(tx *gorm.DB, businessID, branchID string, req CreatePackagingRequest) error {
	if strings.TrimSpace(req.PackagingName) == "" {
		return apperrors.BadRequest("packaging_name is required", nil)
	}
	if err := validateUUID(req.PackagingCategoryID, "packaging_category_id"); err != nil {
		return err
	}
	if err := validateUUID(req.UnitID, "unit_id"); err != nil {
		return err
	}
	if req.CostPerUnit.IsNegative() {
		return apperrors.BadRequest("cost_per_unit must be non-negative", nil)
	}
	if req.ReorderLevel.IsNegative() {
		return apperrors.BadRequest("reorder_level must be non-negative", nil)
	}
	if err := s.repo.ValidateCategory(tx, businessID, branchID, req.PackagingCategoryID); err != nil {
		return notFound(err, "packaging category not found")
	}
	if err := s.repo.ValidateSupplier(tx, businessID, branchID, req.SupplierID); err != nil {
		return notFound(err, "supplier not found")
	}
	if err := s.repo.ValidateUnit(tx, businessID, req.UnitID); err != nil {
		return notFound(err, "unit not found")
	}
	return nil
}

func (s *Service) ensureInventoryItem(tx *gorm.DB, item *PackagingItem) error {
	if _, err := s.inventoryRepo.FindExistingItem(tx, item.BusinessID, item.BranchID, "packaging", &item.ID); err == nil {
		return nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	inventoryItem := &inventory.InventoryItem{
		ID:                utils.NewUUID(),
		BusinessID:        item.BusinessID,
		BranchID:          item.BranchID,
		PackagingItemID:   &item.ID,
		ItemType:          "packaging",
		CurrentQuantity:   money.Zero,
		ReservedQuantity:  money.Zero,
		AvailableQuantity: money.Zero,
		ReorderLevel:      item.ReorderLevel,
		UnitID:            item.UnitID,
		IsExpiryTracked:   false,
		Status:            "active",
	}
	return s.inventoryRepo.CreateInventoryItem(tx, inventoryItem)
}

func (s *Service) defaultBranchID(tx *gorm.DB, businessID string) (string, error) {
	var id string
	err := tx.Table("branches").Select("id").Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active").Order("is_default DESC, created_at ASC").Limit(1).Take(&id).Error
	return id, err
}

func (s *Service) generateCode(tx *gorm.DB, businessID, branchID string) (string, error) {
	for i := 0; i < 10; i++ {
		code, err := s.repo.NextCode(tx, businessID, branchID)
		if err != nil {
			return "", err
		}
		exists, err := s.repo.CodeExists(tx, businessID, branchID, code)
		if err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}
	return "PKG-" + time.Now().UTC().Format("20060102150405"), nil
}

func (s *Service) audit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	return s.auditRepo.CreateActivity(tx, audit.ActivityInput{BusinessID: currentUser.BusinessID, ActorUserID: currentUser.UserID, EventType: eventType, EntityType: "packaging", EntityID: entityID, Summary: summary, IPAddress: ipAddress, UserAgent: userAgent})
}

func normalizeQuery(query *ListQuery) {
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

func validStatus(value string) bool {
	return value == "active" || value == "inactive"
}

func validateUUID(value, field string) error {
	if _, err := uuid.Parse(strings.TrimSpace(value)); err != nil {
		return apperrors.BadRequest(field+" must be a valid UUID", nil)
	}
	return nil
}

func nullableString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func notFound(err error, message string) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apperrors.NotFound(message)
	}
	return err
}

func (s *Service) DeductPackagingOnSale(saleID string) error {
	// TODO: Wire after POS sale packaging rules are finalized.
	return nil
}
