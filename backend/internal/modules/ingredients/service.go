package ingredients

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
		return nil, apperrors.Internal("failed to list ingredients")
	}
	responses := make([]IngredientResponse, 0, len(items))
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
		return nil, apperrors.Internal("failed to lookup ingredients")
	}
	return &LookupResponse{Items: items}, nil
}

func (s *Service) Create(currentUser *utils.AuthContext, req CreateIngredientRequest, ipAddress, userAgent string) (*IngredientResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if err := s.validateCreatePayload(s.db, currentUser.BusinessID, branchID, req); err != nil {
		return nil, err
	}
	var id string
	err = s.db.Transaction(func(tx *gorm.DB) error {
		exists, err := s.repo.NameExists(tx, currentUser.BusinessID, branchID, req.IngredientName, "")
		if err != nil {
			return err
		}
		if exists {
			return apperrors.Conflict("ingredient name already exists", nil)
		}
		code, err := s.generateCode(tx, currentUser.BusinessID, branchID)
		if err != nil {
			return err
		}
		item := &Ingredient{
			ID:                   utils.NewUUID(),
			BusinessID:           currentUser.BusinessID,
			BranchID:             branchID,
			IngredientCategoryID: strings.TrimSpace(req.IngredientCategoryID),
			SupplierID:           nullableString(req.SupplierID),
			IngredientName:       strings.TrimSpace(req.IngredientName),
			IngredientCode:       code,
			Description:          strings.TrimSpace(req.Description),
			UnitID:               strings.TrimSpace(req.UnitID),
			CostPerUnit:          req.CostPerUnit,
			IsStockTracked:       req.IsStockTracked,
			IsExpiryTracked:      req.IsExpiryTracked,
			ReorderLevel:         req.ReorderLevel,
			ImageURL:             nullableString(req.ImageURL),
			ImageFileID:          strings.TrimSpace(req.ImageFileID),
			Status:               "active",
			CreatedByUserID:      currentUser.UserID,
			UpdatedByUserID:      currentUser.UserID,
		}
		if err := s.repo.Create(tx, item); err != nil {
			return err
		}
		if item.IsStockTracked {
			if err := s.ensureInventoryItem(tx, item); err != nil {
				return err
			}
		}
		if err := s.audit(tx, currentUser, "ingredient.created", item.ID, "Ingredient created", ipAddress, userAgent); err != nil {
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

func (s *Service) Get(currentUser *utils.AuthContext, id string) (*IngredientResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	item, err := s.repo.FindByID(id, currentUser.BusinessID, branchID)
	if err != nil {
		return nil, notFound(err, "ingredient not found")
	}
	dto := s.repo.ToResponse(currentUser.BusinessID, *item)
	return &dto, nil
}

func (s *Service) Update(currentUser *utils.AuthContext, id string, req UpdateIngredientRequest, ipAddress, userAgent string) (*IngredientResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		item, err := s.repo.FindByID(id, currentUser.BusinessID, branchID)
		if err != nil {
			return notFound(err, "ingredient not found")
		}
		updates := map[string]interface{}{"updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
		if strings.TrimSpace(req.IngredientName) != "" {
			exists, err := s.repo.NameExists(tx, currentUser.BusinessID, branchID, req.IngredientName, id)
			if err != nil {
				return err
			}
			if exists {
				return apperrors.Conflict("ingredient name already exists", nil)
			}
			updates["ingredient_name"] = strings.TrimSpace(req.IngredientName)
		}
		if strings.TrimSpace(req.IngredientCategoryID) != "" {
			if err := validateUUID(req.IngredientCategoryID, "ingredient_category_id"); err != nil {
				return err
			}
			if err := s.repo.ValidateCategory(tx, currentUser.BusinessID, branchID, req.IngredientCategoryID); err != nil {
				return notFound(err, "ingredient category not found")
			}
			updates["ingredient_category_id"] = strings.TrimSpace(req.IngredientCategoryID)
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
		if req.IsExpiryTracked != nil {
			updates["is_expiry_tracked"] = *req.IsExpiryTracked
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
			return notFound(err, "ingredient not found")
		}
		if req.IsStockTracked != nil && *req.IsStockTracked && !item.IsStockTracked {
			if strings.TrimSpace(req.UnitID) != "" {
				item.UnitID = strings.TrimSpace(req.UnitID)
			}
			if req.ReorderLevel != nil {
				item.ReorderLevel = *req.ReorderLevel
			}
			if req.IsExpiryTracked != nil {
				item.IsExpiryTracked = *req.IsExpiryTracked
			}
			item.IsStockTracked = true
			if err := s.ensureInventoryItem(tx, item); err != nil {
				return err
			}
		}
		return s.audit(tx, currentUser, "ingredient.updated", id, "Ingredient updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.Get(currentUser, id)
}

func (s *Service) UpdateStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*IngredientResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if !validStatus(req.Status) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.Update(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{"status": req.Status, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}); err != nil {
			return notFound(err, "ingredient not found")
		}
		return s.audit(tx, currentUser, "ingredient.status_updated", id, "Ingredient status updated", ipAddress, userAgent)
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
		hasInventory, err := s.repo.HasInventory(tx, currentUser.BusinessID, id)
		if err != nil {
			return err
		}
		hasRecipeLines, err := s.repo.HasRecipeLines(tx, currentUser.BusinessID, id)
		if err != nil {
			return err
		}
		if hasInventory || hasRecipeLines {
			return apperrors.BadRequest("ingredient is linked to inventory or recipes; deactivate it instead", nil)
		}
		if err := s.repo.Update(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{"status": "inactive", "deleted_at": gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}); err != nil {
			return notFound(err, "ingredient not found")
		}
		return s.audit(tx, currentUser, "ingredient.deleted", id, "Ingredient deleted", ipAddress, userAgent)
	})
}

func (s *Service) validateCreatePayload(tx *gorm.DB, businessID, branchID string, req CreateIngredientRequest) error {
	if strings.TrimSpace(req.IngredientName) == "" {
		return apperrors.BadRequest("ingredient_name is required", nil)
	}
	if err := validateUUID(req.IngredientCategoryID, "ingredient_category_id"); err != nil {
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
	if err := s.repo.ValidateCategory(tx, businessID, branchID, req.IngredientCategoryID); err != nil {
		return notFound(err, "ingredient category not found")
	}
	if err := s.repo.ValidateSupplier(tx, businessID, branchID, req.SupplierID); err != nil {
		return notFound(err, "supplier not found")
	}
	if err := s.repo.ValidateUnit(tx, businessID, req.UnitID); err != nil {
		return notFound(err, "unit not found")
	}
	return nil
}

func (s *Service) ensureInventoryItem(tx *gorm.DB, item *Ingredient) error {
	if _, err := s.inventoryRepo.FindExistingItem(tx, item.BusinessID, item.BranchID, "ingredient", &item.ID); err == nil {
		return nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	inventoryItem := &inventory.InventoryItem{
		ID:                utils.NewUUID(),
		BusinessID:        item.BusinessID,
		BranchID:          item.BranchID,
		IngredientID:      &item.ID,
		ItemType:          "ingredient",
		CurrentQuantity:   money.Zero,
		ReservedQuantity:  money.Zero,
		AvailableQuantity: money.Zero,
		ReorderLevel:      item.ReorderLevel,
		UnitID:            item.UnitID,
		IsExpiryTracked:   item.IsExpiryTracked,
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
	return "ING-" + time.Now().UTC().Format("20060102150405"), nil
}

func (s *Service) audit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	return s.auditRepo.CreateActivity(tx, audit.ActivityInput{BusinessID: currentUser.BusinessID, ActorUserID: currentUser.UserID, EventType: eventType, EntityType: "ingredients", EntityID: entityID, Summary: summary, IPAddress: ipAddress, UserAgent: userAgent})
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
