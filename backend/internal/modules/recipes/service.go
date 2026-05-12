package recipes

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
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

func (s *Service) List(currentUser *utils.AuthContext, query ListQuery) (*ListResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	normalizeQuery(&query)
	if query.Status != "" && !validStatus(query.Status) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	recipes, total, err := s.repo.ListRecipes(currentUser.BusinessID, branchID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list recipes")
	}
	items := make([]RecipeResponse, 0, len(recipes))
	for _, recipe := range recipes {
		items = append(items, s.repo.ToResponse(currentUser.BusinessID, recipe, false))
	}
	return &ListResponse{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) Create(currentUser *utils.AuthContext, req CreateRecipeRequest, ipAddress, userAgent string) (*RecipeResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	var recipeID string
	err = s.db.Transaction(func(tx *gorm.DB) error {
		recipe, ingredients, packaging, err := s.buildRecipe(tx, currentUser, branchID, "", req)
		if err != nil {
			return err
		}
		code, err := s.repo.NextRecipeCode(tx, currentUser.BusinessID, branchID)
		if err != nil {
			return err
		}
		recipe.RecipeCode = code
		if recipe.IsActive {
			if err := s.repo.DeactivateOtherActiveRecipes(tx, currentUser.BusinessID, branchID, recipe.ProductID, recipe.ID); err != nil {
				return err
			}
		}
		if err := s.repo.CreateRecipe(tx, recipe, ingredients, packaging); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "recipe.created", recipe.ID, "Recipe created", ipAddress, userAgent); err != nil {
			return err
		}
		recipeID = recipe.ID
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.Get(currentUser, recipeID)
}

func (s *Service) Get(currentUser *utils.AuthContext, id string) (*RecipeResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	recipe, err := s.repo.FindRecipe(id, currentUser.BusinessID, branchID)
	if err != nil {
		return nil, notFound(err, "recipe not found")
	}
	dto := s.repo.ToResponse(currentUser.BusinessID, *recipe, true)
	return &dto, nil
}

func (s *Service) Update(currentUser *utils.AuthContext, id string, req UpdateRecipeRequest, ipAddress, userAgent string) (*RecipeResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		recipe, err := s.repo.FindRecipeForUpdate(tx, id, currentUser.BusinessID, branchID)
		if err != nil {
			return notFound(err, "recipe not found")
		}
		if _, err := s.createVersionSnapshot(tx, currentUser, recipe, "Auto snapshot before recipe update"); err != nil {
			return err
		}
		updates := map[string]interface{}{"updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC(), "version_number": recipe.VersionNumber + 1}
		if strings.TrimSpace(req.RecipeName) != "" {
			updates["recipe_name"] = strings.TrimSpace(req.RecipeName)
		}
		if strings.TrimSpace(req.Description) != "" {
			updates["description"] = strings.TrimSpace(req.Description)
		}
		if req.BatchYieldQuantity != nil {
			if *req.BatchYieldQuantity <= 0 {
				return apperrors.BadRequest("batch_yield_quantity must be greater than zero", nil)
			}
			updates["batch_yield_quantity"] = *req.BatchYieldQuantity
			recipe.BatchYieldQuantity = *req.BatchYieldQuantity
		}
		if strings.TrimSpace(req.BatchYieldUnitID) != "" {
			if err := validateUUID(req.BatchYieldUnitID, "batch_yield_unit_id"); err != nil {
				return err
			}
			if err := s.repo.ValidateUnit(tx, currentUser.BusinessID, req.BatchYieldUnitID); err != nil {
				return notFound(err, "batch yield unit not found")
			}
			updates["batch_yield_unit_id"] = strings.TrimSpace(req.BatchYieldUnitID)
		}
		if req.PreparationTimeMinutes != nil {
			if *req.PreparationTimeMinutes < 0 {
				return apperrors.BadRequest("preparation_time_minutes must be non-negative", nil)
			}
			updates["preparation_time_minutes"] = *req.PreparationTimeMinutes
		}
		if strings.TrimSpace(req.Instructions) != "" {
			updates["instructions"] = strings.TrimSpace(req.Instructions)
		}
		if strings.TrimSpace(req.Status) != "" {
			if !validStatus(req.Status) {
				return apperrors.BadRequest("invalid status", nil)
			}
			updates["status"] = req.Status
			updates["is_active"] = req.Status == "active"
			if req.Status == "active" {
				if err := s.repo.DeactivateOtherActiveRecipes(tx, currentUser.BusinessID, branchID, recipe.ProductID, recipe.ID); err != nil {
					return err
				}
			}
		}
		if err := s.repo.UpdateRecipe(tx, id, currentUser.BusinessID, branchID, updates); err != nil {
			return err
		}
		if err := s.recalculateCost(tx, currentUser.BusinessID, branchID, id); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "recipe.updated", id, "Recipe updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.Get(currentUser, id)
}

func (s *Service) UpdateStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*RecipeResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if !validStatus(req.Status) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		recipe, err := s.repo.FindRecipeForUpdate(tx, id, currentUser.BusinessID, branchID)
		if err != nil {
			return notFound(err, "recipe not found")
		}
		if req.Status == "active" {
			if err := s.repo.DeactivateOtherActiveRecipes(tx, currentUser.BusinessID, branchID, recipe.ProductID, recipe.ID); err != nil {
				return err
			}
		}
		if err := s.repo.UpdateRecipe(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{"status": req.Status, "is_active": req.Status == "active", "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "recipe.status_updated", id, "Recipe status updated", ipAddress, userAgent)
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
		if err := s.repo.UpdateRecipe(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{"status": "archived", "is_active": false, "deleted_at": gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}); err != nil {
			return notFound(err, "recipe not found")
		}
		return s.audit(tx, currentUser, "recipe.deleted", id, "Recipe deleted", ipAddress, userAgent)
	})
}

func (s *Service) ListIngredients(currentUser *utils.AuthContext, recipeID string) ([]RecipeIngredientResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindRecipe(recipeID, currentUser.BusinessID, branchID); err != nil {
		return nil, notFound(err, "recipe not found")
	}
	items, err := s.repo.Ingredients(recipeID, currentUser.BusinessID, branchID)
	return s.repo.ToIngredientResponses(items), err
}

func (s *Service) AddIngredient(currentUser *utils.AuthContext, recipeID string, req RecipeIngredientInput, ipAddress, userAgent string) (*RecipeIngredientResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	var lineID string
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if _, err := s.repo.FindRecipeForUpdate(tx, recipeID, currentUser.BusinessID, branchID); err != nil {
			return notFound(err, "recipe not found")
		}
		line, err := s.buildIngredientLine(tx, currentUser.BusinessID, branchID, recipeID, req)
		if err != nil {
			return err
		}
		if err := s.repo.CreateIngredient(tx, line); err != nil {
			return err
		}
		if err := s.recalculateCost(tx, currentUser.BusinessID, branchID, recipeID); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "recipe.ingredient_added", recipeID, "Recipe ingredient added", ipAddress, userAgent); err != nil {
			return err
		}
		lineID = line.ID
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.findIngredientResponse(currentUser.BusinessID, branchID, recipeID, lineID)
}

func (s *Service) UpdateIngredient(currentUser *utils.AuthContext, recipeID, lineID string, req RecipeIngredientInput, ipAddress, userAgent string) (*RecipeIngredientResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if _, err := s.repo.FindRecipeForUpdate(tx, recipeID, currentUser.BusinessID, branchID); err != nil {
			return notFound(err, "recipe not found")
		}
		line, err := s.buildIngredientLine(tx, currentUser.BusinessID, branchID, recipeID, req)
		if err != nil {
			return err
		}
		updates := map[string]interface{}{"ingredient_id": line.IngredientID, "inventory_item_id": line.InventoryItemID, "item_name_snapshot": line.ItemNameSnapshot, "quantity_required": line.QuantityRequired, "unit_id": line.UnitID, "unit_cost_snapshot": line.UnitCostSnapshot, "total_cost": line.TotalCost, "wastage_percentage": line.WastagePercentage, "sort_order": line.SortOrder, "notes": line.Notes, "updated_at": time.Now().UTC()}
		if err := s.repo.UpdateIngredient(tx, lineID, recipeID, currentUser.BusinessID, branchID, updates); err != nil {
			return notFound(err, "recipe ingredient not found")
		}
		if err := s.recalculateCost(tx, currentUser.BusinessID, branchID, recipeID); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "recipe.ingredient_updated", recipeID, "Recipe ingredient updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.findIngredientResponse(currentUser.BusinessID, branchID, recipeID, lineID)
}

func (s *Service) DeleteIngredient(currentUser *utils.AuthContext, recipeID, lineID, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.DeleteIngredient(tx, lineID, recipeID, currentUser.BusinessID, branchID); err != nil {
			return notFound(err, "recipe ingredient not found")
		}
		if err := s.recalculateCost(tx, currentUser.BusinessID, branchID, recipeID); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "recipe.ingredient_deleted", recipeID, "Recipe ingredient deleted", ipAddress, userAgent)
	})
}

func (s *Service) ListPackaging(currentUser *utils.AuthContext, recipeID string) ([]RecipePackagingResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindRecipe(recipeID, currentUser.BusinessID, branchID); err != nil {
		return nil, notFound(err, "recipe not found")
	}
	items, err := s.repo.Packaging(recipeID, currentUser.BusinessID, branchID)
	return s.repo.ToPackagingResponses(items), err
}

func (s *Service) AddPackaging(currentUser *utils.AuthContext, recipeID string, req RecipePackagingInput, ipAddress, userAgent string) (*RecipePackagingResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	var lineID string
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if _, err := s.repo.FindRecipeForUpdate(tx, recipeID, currentUser.BusinessID, branchID); err != nil {
			return notFound(err, "recipe not found")
		}
		line, err := s.buildPackagingLine(tx, currentUser.BusinessID, branchID, recipeID, req)
		if err != nil {
			return err
		}
		if err := s.repo.CreatePackaging(tx, line); err != nil {
			return err
		}
		if err := s.recalculateCost(tx, currentUser.BusinessID, branchID, recipeID); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "recipe.packaging_added", recipeID, "Recipe packaging added", ipAddress, userAgent); err != nil {
			return err
		}
		lineID = line.ID
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.findPackagingResponse(currentUser.BusinessID, branchID, recipeID, lineID)
}

func (s *Service) UpdatePackaging(currentUser *utils.AuthContext, recipeID, lineID string, req RecipePackagingInput, ipAddress, userAgent string) (*RecipePackagingResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if _, err := s.repo.FindRecipeForUpdate(tx, recipeID, currentUser.BusinessID, branchID); err != nil {
			return notFound(err, "recipe not found")
		}
		line, err := s.buildPackagingLine(tx, currentUser.BusinessID, branchID, recipeID, req)
		if err != nil {
			return err
		}
		updates := map[string]interface{}{"packaging_item_id": line.PackagingItemID, "packaging_name_snapshot": line.PackagingNameSnapshot, "quantity_required": line.QuantityRequired, "unit_id": line.UnitID, "unit_cost_snapshot": line.UnitCostSnapshot, "total_cost": line.TotalCost, "is_optional": line.IsOptional, "sort_order": line.SortOrder, "updated_at": time.Now().UTC()}
		if err := s.repo.UpdatePackaging(tx, lineID, recipeID, currentUser.BusinessID, branchID, updates); err != nil {
			return notFound(err, "recipe packaging line not found")
		}
		if err := s.recalculateCost(tx, currentUser.BusinessID, branchID, recipeID); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "recipe.packaging_updated", recipeID, "Recipe packaging updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.findPackagingResponse(currentUser.BusinessID, branchID, recipeID, lineID)
}

func (s *Service) DeletePackaging(currentUser *utils.AuthContext, recipeID, lineID, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.DeletePackaging(tx, lineID, recipeID, currentUser.BusinessID, branchID); err != nil {
			return notFound(err, "recipe packaging line not found")
		}
		if err := s.recalculateCost(tx, currentUser.BusinessID, branchID, recipeID); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "recipe.packaging_deleted", recipeID, "Recipe packaging deleted", ipAddress, userAgent)
	})
}

func (s *Service) Cost(currentUser *utils.AuthContext, recipeID string) (*CostResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	recipe, err := s.repo.FindRecipe(recipeID, currentUser.BusinessID, branchID)
	if err != nil {
		return nil, notFound(err, "recipe not found")
	}
	ingredients, _ := s.repo.Ingredients(recipeID, currentUser.BusinessID, branchID)
	packaging, _ := s.repo.Packaging(recipeID, currentUser.BusinessID, branchID)
	return &CostResponse{EstimatedIngredientCost: roundMoney(recipe.EstimatedIngredientCost), EstimatedPackagingCost: roundMoney(recipe.EstimatedPackagingCost), EstimatedTotalCost: roundMoney(recipe.EstimatedTotalCost), BatchYieldQuantity: roundQuantity(recipe.BatchYieldQuantity), CostPerYieldUnit: roundQuantity(recipe.CostPerYieldUnit), Ingredients: s.repo.ToIngredientResponses(ingredients), Packaging: s.repo.ToPackagingResponses(packaging)}, nil
}

func (s *Service) RecalculateCost(currentUser *utils.AuthContext, recipeID, ipAddress, userAgent string) (*CostResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if _, err := s.repo.FindRecipeForUpdate(tx, recipeID, currentUser.BusinessID, branchID); err != nil {
			return notFound(err, "recipe not found")
		}
		if err := s.refreshLineCosts(tx, currentUser.BusinessID, branchID, recipeID); err != nil {
			return err
		}
		if err := s.recalculateCost(tx, currentUser.BusinessID, branchID, recipeID); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "recipe.cost_recalculated", recipeID, "Recipe cost recalculated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.Cost(currentUser, recipeID)
}

func (s *Service) Versions(currentUser *utils.AuthContext, recipeID string) ([]VersionResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindRecipe(recipeID, currentUser.BusinessID, branchID); err != nil {
		return nil, notFound(err, "recipe not found")
	}
	versions, err := s.repo.Versions(recipeID, currentUser.BusinessID, branchID)
	responses := make([]VersionResponse, 0, len(versions))
	for _, version := range versions {
		responses = append(responses, VersionResponse{ID: version.ID, RecipeID: version.RecipeID, VersionNumber: version.VersionNumber, ChangeNote: version.ChangeNote, SnapshotJSON: version.SnapshotJSON, CreatedByUserID: version.CreatedByUserID, CreatedAt: version.CreatedAt})
	}
	return responses, err
}

func (s *Service) CreateVersion(currentUser *utils.AuthContext, recipeID string, req CreateVersionRequest, ipAddress, userAgent string) (*VersionResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	var versionID string
	err = s.db.Transaction(func(tx *gorm.DB) error {
		recipe, err := s.repo.FindRecipeForUpdate(tx, recipeID, currentUser.BusinessID, branchID)
		if err != nil {
			return notFound(err, "recipe not found")
		}
		version, err := s.createVersionSnapshot(tx, currentUser, recipe, req.ChangeNote)
		if err != nil {
			return err
		}
		if err := s.repo.UpdateRecipe(tx, recipeID, currentUser.BusinessID, branchID, map[string]interface{}{"version_number": recipe.VersionNumber + 1, "updated_at": time.Now().UTC(), "updated_by_user_id": currentUser.UserID}); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "recipe.version_created", recipeID, "Recipe version created", ipAddress, userAgent); err != nil {
			return err
		}
		versionID = version.ID
		return nil
	})
	if err != nil {
		return nil, err
	}
	versions, err := s.Versions(currentUser, recipeID)
	if err != nil {
		return nil, err
	}
	for _, version := range versions {
		if version.ID == versionID {
			return &version, nil
		}
	}
	return nil, apperrors.Internal("failed to load recipe version")
}

func (s *Service) ActiveByProduct(currentUser *utils.AuthContext, productID string) (*RecipeResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if err := validateUUID(productID, "product_id"); err != nil {
		return nil, err
	}
	recipe, err := s.repo.ActiveByProduct(currentUser.BusinessID, branchID, productID)
	if err != nil {
		return nil, notFound(err, "active recipe not found")
	}
	dto := s.repo.ToResponse(currentUser.BusinessID, *recipe, true)
	return &dto, nil
}

func (s *Service) Lookup(currentUser *utils.AuthContext, search string, limit int) (*LookupResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 10
	}
	if limit > 20 {
		limit = 20
	}
	items, err := s.repo.Lookup(currentUser.BusinessID, branchID, strings.TrimSpace(search), limit)
	return &LookupResponse{Items: items}, err
}

func (s *Service) buildRecipe(tx *gorm.DB, currentUser *utils.AuthContext, branchID, id string, req CreateRecipeRequest) (*Recipe, []RecipeIngredient, []RecipePackaging, error) {
	if strings.TrimSpace(req.RecipeName) == "" {
		return nil, nil, nil, apperrors.BadRequest("recipe_name is required", nil)
	}
	product, err := s.validateProduct(tx, currentUser.BusinessID, branchID, req.ProductID)
	if err != nil {
		return nil, nil, nil, err
	}
	if req.BatchYieldQuantity <= 0 {
		return nil, nil, nil, apperrors.BadRequest("batch_yield_quantity must be greater than zero", nil)
	}
	if err := validateUUID(req.BatchYieldUnitID, "batch_yield_unit_id"); err != nil {
		return nil, nil, nil, err
	}
	if err := s.repo.ValidateUnit(tx, currentUser.BusinessID, req.BatchYieldUnitID); err != nil {
		return nil, nil, nil, notFound(err, "batch yield unit not found")
	}
	if req.PreparationTimeMinutes != nil && *req.PreparationTimeMinutes < 0 {
		return nil, nil, nil, apperrors.BadRequest("preparation_time_minutes must be non-negative", nil)
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "draft"
	}
	if !validStatus(status) {
		return nil, nil, nil, apperrors.BadRequest("invalid status", nil)
	}
	recipeID := id
	if recipeID == "" {
		recipeID = utils.NewUUID()
	}
	ingredients := make([]RecipeIngredient, 0, len(req.Ingredients))
	packaging := make([]RecipePackaging, 0, len(req.Packaging))
	for _, input := range req.Ingredients {
		line, err := s.buildIngredientLine(tx, currentUser.BusinessID, branchID, recipeID, input)
		if err != nil {
			return nil, nil, nil, err
		}
		ingredients = append(ingredients, *line)
	}
	for _, input := range req.Packaging {
		line, err := s.buildPackagingLine(tx, currentUser.BusinessID, branchID, recipeID, input)
		if err != nil {
			return nil, nil, nil, err
		}
		packaging = append(packaging, *line)
	}
	ingredientCost, packagingCost := sumIngredientCost(ingredients), sumPackagingCost(packaging)
	totalCost := roundMoney(ingredientCost + packagingCost)
	return &Recipe{ID: recipeID, BusinessID: currentUser.BusinessID, BranchID: branchID, ProductID: product.ID, RecipeName: strings.TrimSpace(req.RecipeName), Description: strings.TrimSpace(req.Description), BatchYieldQuantity: req.BatchYieldQuantity, BatchYieldUnitID: req.BatchYieldUnitID, PreparationTimeMinutes: req.PreparationTimeMinutes, Instructions: strings.TrimSpace(req.Instructions), EstimatedIngredientCost: ingredientCost, EstimatedPackagingCost: packagingCost, EstimatedTotalCost: totalCost, CostPerYieldUnit: roundQuantity(totalCost / req.BatchYieldQuantity), VersionNumber: 1, IsActive: status == "active", Status: status, CreatedByUserID: currentUser.UserID, UpdatedByUserID: currentUser.UserID}, ingredients, packaging, nil
}

func (s *Service) validateProduct(tx *gorm.DB, businessID, branchID, productID string) (*ProductInfo, error) {
	if err := validateUUID(productID, "product_id"); err != nil {
		return nil, err
	}
	product, err := s.repo.Product(tx, businessID, branchID, productID)
	if err != nil {
		return nil, notFound(err, "product not found")
	}
	if product.ProductType != "manufactured" && product.ProductType != "made_to_order" {
		return nil, apperrors.BadRequest("recipe product must be manufactured or made_to_order", nil)
	}
	return product, nil
}

func (s *Service) buildIngredientLine(tx *gorm.DB, businessID, branchID, recipeID string, req RecipeIngredientInput) (*RecipeIngredient, error) {
	if req.QuantityRequired <= 0 {
		return nil, apperrors.BadRequest("quantity_required must be greater than zero", nil)
	}
	if req.WastagePercentage < 0 {
		return nil, apperrors.BadRequest("wastage_percentage must be non-negative", nil)
	}
	if err := validateUUID(req.UnitID, "unit_id"); err != nil {
		return nil, err
	}
	if err := s.repo.ValidateUnit(tx, businessID, req.UnitID); err != nil {
		return nil, notFound(err, "unit not found")
	}
	var ingredientID *string
	var inventoryItemID *string
	itemName := "Ingredient"
	unitCost := 0.0
	if strings.TrimSpace(req.InventoryItemID) != "" {
		if err := validateUUID(req.InventoryItemID, "inventory_item_id"); err != nil {
			return nil, err
		}
		item, err := s.repo.InventoryItem(tx, businessID, branchID, req.InventoryItemID)
		if err != nil {
			return nil, notFound(err, "inventory item not found")
		}
		if item.UnitID != req.UnitID {
			return nil, apperrors.BadRequest("unit conversion is not available yet; ingredient unit must match inventory item unit", nil)
		}
		itemName, unitCost = s.repo.ItemNameAndCost(tx, businessID, item)
		inventoryItemID = &req.InventoryItemID
		if item.IngredientID != nil {
			ingredientID = item.IngredientID
		}
	} else if strings.TrimSpace(req.IngredientID) != "" {
		if err := validateUUID(req.IngredientID, "ingredient_id"); err != nil {
			return nil, err
		}
		ingredient, err := s.repo.IngredientItem(tx, businessID, branchID, req.IngredientID)
		if err != nil {
			return nil, notFound(err, "ingredient not found")
		}
		if ingredient.UnitID != req.UnitID {
			return nil, apperrors.BadRequest("unit conversion is not available yet; ingredient unit must match ingredient unit", nil)
		}
		ingredientID = &req.IngredientID
		itemName = ingredient.IngredientName
		unitCost = ingredient.CostPerUnit
	} else {
		return nil, apperrors.BadRequest("inventory_item_id or ingredient_id is required", nil)
	}
	effectiveQty := req.QuantityRequired * (1 + req.WastagePercentage/100)
	return &RecipeIngredient{ID: utils.NewUUID(), BusinessID: businessID, BranchID: branchID, RecipeID: recipeID, IngredientID: ingredientID, InventoryItemID: inventoryItemID, ItemNameSnapshot: itemName, QuantityRequired: req.QuantityRequired, UnitID: req.UnitID, UnitCostSnapshot: roundMoney(unitCost), TotalCost: roundMoney(effectiveQty * unitCost), WastagePercentage: req.WastagePercentage, SortOrder: req.SortOrder, Notes: strings.TrimSpace(req.Notes)}, nil
}

func (s *Service) buildPackagingLine(tx *gorm.DB, businessID, branchID, recipeID string, req RecipePackagingInput) (*RecipePackaging, error) {
	if err := validateUUID(req.PackagingItemID, "packaging_item_id"); err != nil {
		return nil, err
	}
	if req.QuantityRequired <= 0 {
		return nil, apperrors.BadRequest("quantity_required must be greater than zero", nil)
	}
	if err := validateUUID(req.UnitID, "unit_id"); err != nil {
		return nil, err
	}
	item, err := s.repo.PackagingItem(tx, businessID, branchID, req.PackagingItemID)
	if err != nil {
		return nil, notFound(err, "packaging item not found")
	}
	if item.UnitID != req.UnitID {
		return nil, apperrors.BadRequest("unit conversion is not available yet; packaging unit must match packaging item unit", nil)
	}
	return &RecipePackaging{ID: utils.NewUUID(), BusinessID: businessID, BranchID: branchID, RecipeID: recipeID, PackagingItemID: item.ID, PackagingNameSnapshot: item.PackagingName, QuantityRequired: req.QuantityRequired, UnitID: req.UnitID, UnitCostSnapshot: roundMoney(item.CostPerUnit), TotalCost: roundMoney(req.QuantityRequired * item.CostPerUnit), IsOptional: req.IsOptional, SortOrder: req.SortOrder}, nil
}

func (s *Service) refreshLineCosts(tx *gorm.DB, businessID, branchID, recipeID string) error {
	ingredients, err := s.repo.Ingredients(recipeID, businessID, branchID)
	if err != nil {
		return err
	}
	for _, line := range ingredients {
		name, cost := line.ItemNameSnapshot, line.UnitCostSnapshot
		if line.InventoryItemID != nil {
			item, err := s.repo.InventoryItem(tx, businessID, branchID, *line.InventoryItemID)
			if err != nil {
				continue
			}
			name, cost = s.repo.ItemNameAndCost(tx, businessID, item)
		} else if line.IngredientID != nil {
			item, err := s.repo.IngredientItem(tx, businessID, branchID, *line.IngredientID)
			if err != nil {
				continue
			}
			name, cost = item.IngredientName, item.CostPerUnit
		}
		total := roundMoney(line.QuantityRequired * (1 + line.WastagePercentage/100) * cost)
		if err := s.repo.UpdateIngredient(tx, line.ID, recipeID, businessID, branchID, map[string]interface{}{"item_name_snapshot": name, "unit_cost_snapshot": cost, "total_cost": total, "updated_at": time.Now().UTC()}); err != nil {
			return err
		}
	}
	packaging, err := s.repo.Packaging(recipeID, businessID, branchID)
	if err != nil {
		return err
	}
	for _, line := range packaging {
		item, err := s.repo.PackagingItem(tx, businessID, branchID, line.PackagingItemID)
		if err != nil {
			continue
		}
		total := roundMoney(line.QuantityRequired * item.CostPerUnit)
		if err := s.repo.UpdatePackaging(tx, line.ID, recipeID, businessID, branchID, map[string]interface{}{"packaging_name_snapshot": item.PackagingName, "unit_cost_snapshot": item.CostPerUnit, "total_cost": total, "updated_at": time.Now().UTC()}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) recalculateCost(tx *gorm.DB, businessID, branchID, recipeID string) error {
	recipe, err := s.repo.FindRecipeForUpdate(tx, recipeID, businessID, branchID)
	if err != nil {
		return err
	}
	ingredients, _ := s.repo.Ingredients(recipeID, businessID, branchID)
	packaging, _ := s.repo.Packaging(recipeID, businessID, branchID)
	ingredientCost := sumIngredientCost(ingredients)
	packagingCost := sumPackagingCost(packaging)
	totalCost := roundMoney(ingredientCost + packagingCost)
	return s.repo.UpdateRecipe(tx, recipeID, businessID, branchID, map[string]interface{}{"estimated_ingredient_cost": ingredientCost, "estimated_packaging_cost": packagingCost, "estimated_total_cost": totalCost, "cost_per_yield_unit": roundQuantity(totalCost / recipe.BatchYieldQuantity), "updated_at": time.Now().UTC()})
}

func (s *Service) createVersionSnapshot(tx *gorm.DB, currentUser *utils.AuthContext, recipe *Recipe, note string) (*RecipeVersion, error) {
	dto := s.repo.ToResponse(currentUser.BusinessID, *recipe, true)
	snapshot, err := json.Marshal(dto)
	if err != nil {
		return nil, err
	}
	version := &RecipeVersion{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, BranchID: recipe.BranchID, RecipeID: recipe.ID, VersionNumber: recipe.VersionNumber, ChangeNote: strings.TrimSpace(note), SnapshotJSON: string(snapshot), CreatedByUserID: currentUser.UserID}
	if err := s.repo.CreateVersion(tx, version); err != nil {
		return nil, err
	}
	return version, nil
}

func (s *Service) findIngredientResponse(businessID, branchID, recipeID, lineID string) (*RecipeIngredientResponse, error) {
	lines, err := s.repo.Ingredients(recipeID, businessID, branchID)
	if err != nil {
		return nil, err
	}
	responses := s.repo.ToIngredientResponses(lines)
	for _, line := range responses {
		if line.ID == lineID {
			return &line, nil
		}
	}
	return nil, apperrors.NotFound("recipe ingredient not found")
}

func (s *Service) findPackagingResponse(businessID, branchID, recipeID, lineID string) (*RecipePackagingResponse, error) {
	lines, err := s.repo.Packaging(recipeID, businessID, branchID)
	if err != nil {
		return nil, err
	}
	responses := s.repo.ToPackagingResponses(lines)
	for _, line := range responses {
		if line.ID == lineID {
			return &line, nil
		}
	}
	return nil, apperrors.NotFound("recipe packaging line not found")
}

func (s *Service) audit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	return s.auditRepo.CreateActivity(tx, audit.ActivityInput{BusinessID: currentUser.BusinessID, ActorUserID: currentUser.UserID, EventType: eventType, EntityType: "recipes", EntityID: entityID, Summary: summary, IPAddress: ipAddress, UserAgent: userAgent})
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
	return value == "draft" || value == "active" || value == "inactive" || value == "archived"
}

func validateUUID(value, field string) error {
	if _, err := uuid.Parse(strings.TrimSpace(value)); err != nil {
		return apperrors.BadRequest(field+" must be a valid UUID", nil)
	}
	return nil
}

func sumIngredientCost(items []RecipeIngredient) float64 {
	total := 0.0
	for _, item := range items {
		total += item.TotalCost
	}
	return roundMoney(total)
}

func sumPackagingCost(items []RecipePackaging) float64 {
	total := 0.0
	for _, item := range items {
		total += item.TotalCost
	}
	return roundMoney(total)
}

func notFound(err error, message string) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apperrors.NotFound(message)
	}
	return err
}
