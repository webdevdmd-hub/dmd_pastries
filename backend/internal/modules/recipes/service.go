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
			if err := s.repo.DeactivateOtherActiveRecipes(tx, currentUser.BusinessID, branchID, recipe.ProductID, recipe.ProductVariantID, recipe.ID); err != nil {
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
		}
		if req.NewProductVariant != nil || req.ProductVariantID != nil {
			variantID, err := s.resolveRecipeVariant(tx, currentUser.BusinessID, branchID, recipe.ProductID, recipe, req.ProductVariantID, req.NewProductVariant)
			if err != nil {
				return err
			}
			updates["product_variant_id"] = variantID
			recipe.ProductVariantID = variantID
		}
		if updates["is_active"] == true || (recipe.IsActive && (req.NewProductVariant != nil || req.ProductVariantID != nil)) {
			if err := s.repo.DeactivateOtherActiveRecipes(tx, currentUser.BusinessID, branchID, recipe.ProductID, recipe.ProductVariantID, recipe.ID); err != nil {
				return err
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
			if err := s.repo.DeactivateOtherActiveRecipes(tx, currentUser.BusinessID, branchID, recipe.ProductID, recipe.ProductVariantID, recipe.ID); err != nil {
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
		updates := map[string]interface{}{"component_product_id": line.ComponentProductID, "component_variant_id": line.ComponentVariantID, "ingredient_id": line.IngredientID, "inventory_item_id": line.InventoryItemID, "item_name_snapshot": line.ItemNameSnapshot, "quantity_required": line.QuantityRequired, "unit_id": line.UnitID, "unit_cost_snapshot": line.UnitCostSnapshot, "total_cost": line.TotalCost, "wastage_percentage": line.WastagePercentage, "sort_order": line.SortOrder, "notes": line.Notes, "updated_at": time.Now().UTC()}
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
		updates := map[string]interface{}{"component_product_id": line.ComponentProductID, "component_variant_id": line.ComponentVariantID, "packaging_item_id": line.PackagingItemID, "packaging_name_snapshot": line.PackagingNameSnapshot, "quantity_required": line.QuantityRequired, "unit_id": line.UnitID, "unit_cost_snapshot": line.UnitCostSnapshot, "total_cost": line.TotalCost, "is_optional": line.IsOptional, "sort_order": line.SortOrder, "updated_at": time.Now().UTC()}
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

func (s *Service) ActiveByProduct(currentUser *utils.AuthContext, productID, productVariantID string) (*RecipeResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if err := validateUUID(productID, "product_id"); err != nil {
		return nil, err
	}
	if strings.TrimSpace(productVariantID) != "" {
		if err := validateUUID(productVariantID, "product_variant_id"); err != nil {
			return nil, err
		}
	}
	recipe, err := s.repo.ActiveByProduct(currentUser.BusinessID, branchID, productID, strings.TrimSpace(productVariantID))
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
	productVariantID, err := s.resolveCreateRecipeVariant(tx, currentUser.BusinessID, branchID, product, req)
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
	return &Recipe{ID: recipeID, BusinessID: currentUser.BusinessID, BranchID: branchID, ProductID: product.ID, ProductVariantID: productVariantID, RecipeName: strings.TrimSpace(req.RecipeName), Description: strings.TrimSpace(req.Description), BatchYieldQuantity: req.BatchYieldQuantity, BatchYieldUnitID: req.BatchYieldUnitID, PreparationTimeMinutes: req.PreparationTimeMinutes, Instructions: strings.TrimSpace(req.Instructions), EstimatedIngredientCost: ingredientCost, EstimatedPackagingCost: packagingCost, EstimatedTotalCost: totalCost, CostPerYieldUnit: roundQuantity(totalCost / req.BatchYieldQuantity), VersionNumber: 1, IsActive: status == "active", Status: status, CreatedByUserID: currentUser.UserID, UpdatedByUserID: currentUser.UserID}, ingredients, packaging, nil
}

func (s *Service) resolveCreateRecipeVariant(tx *gorm.DB, businessID, branchID string, product *ProductInfo, req CreateRecipeRequest) (*string, error) {
	if req.NewProductVariant != nil && strings.TrimSpace(req.ProductVariantID) != "" {
		return nil, apperrors.BadRequest("use either product_variant_id or new_product_variant, not both", nil)
	}
	if req.NewProductVariant != nil {
		return s.createRecipeProductVariant(tx, businessID, branchID, product, req.NewProductVariant)
	}
	if strings.TrimSpace(req.ProductVariantID) == "" {
		return nil, nil
	}
	if err := validateUUID(req.ProductVariantID, "product_variant_id"); err != nil {
		return nil, err
	}
	variant, err := s.repo.ProductVariant(tx, businessID, branchID, product.ID, req.ProductVariantID)
	if err != nil {
		return nil, notFound(err, "product variant not found")
	}
	if variant.Status != "active" {
		return nil, apperrors.BadRequest("product variant must be active", nil)
	}
	return &variant.ID, nil
}

func (s *Service) resolveRecipeVariant(tx *gorm.DB, businessID, branchID, productID string, product *Recipe, variantIDInput *string, newVariant *RecipeVariantInput) (*string, error) {
	if newVariant != nil && variantIDInput != nil && strings.TrimSpace(*variantIDInput) != "" {
		return nil, apperrors.BadRequest("use either product_variant_id or new_product_variant, not both", nil)
	}
	productInfo, err := s.validateProduct(tx, businessID, branchID, productID)
	if err != nil {
		return nil, err
	}
	if newVariant != nil {
		return s.createRecipeProductVariant(tx, businessID, branchID, productInfo, newVariant)
	}
	if variantIDInput == nil {
		return product.ProductVariantID, nil
	}
	variantID := strings.TrimSpace(*variantIDInput)
	if variantID == "" {
		return nil, nil
	}
	if err := validateUUID(variantID, "product_variant_id"); err != nil {
		return nil, err
	}
	variant, err := s.repo.ProductVariant(tx, businessID, branchID, productID, variantID)
	if err != nil {
		return nil, notFound(err, "product variant not found")
	}
	if variant.Status != "active" {
		return nil, apperrors.BadRequest("product variant must be active", nil)
	}
	return &variant.ID, nil
}

func (s *Service) createRecipeProductVariant(tx *gorm.DB, businessID, branchID string, product *ProductInfo, input *RecipeVariantInput) (*string, error) {
	if input == nil {
		return nil, nil
	}
	name := strings.TrimSpace(input.VariantName)
	if name == "" {
		return nil, apperrors.BadRequest("new_product_variant.variant_name is required", nil)
	}
	if input.SalePrice != nil && *input.SalePrice < 0 {
		return nil, apperrors.BadRequest("new_product_variant.sale_price must be non-negative", nil)
	}
	if input.CostPrice != nil && *input.CostPrice < 0 {
		return nil, apperrors.BadRequest("new_product_variant.cost_price must be non-negative", nil)
	}
	exists, err := s.repo.ProductVariantNameExists(tx, businessID, product.ID, name)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, apperrors.Conflict("product variant already exists", nil)
	}
	if exists, err = s.repo.VariantSKUExists(tx, businessID, input.SKU); err != nil {
		return nil, err
	} else if exists {
		return nil, apperrors.Conflict("variant SKU already exists", nil)
	}
	if exists, err = s.repo.VariantBarcodeExists(tx, businessID, input.Barcode); err != nil {
		return nil, err
	} else if exists {
		return nil, apperrors.Conflict("variant barcode already exists", nil)
	}
	salePrice := product.SalePrice
	if input.SalePrice != nil {
		salePrice = *input.SalePrice
	}
	costPrice := product.CostPrice
	if input.CostPrice != nil {
		costPrice = input.CostPrice
	}
	variant := &ProductVariantInfo{
		ID:          utils.NewUUID(),
		BusinessID:  businessID,
		ProductID:   product.ID,
		VariantName: name,
		SKU:         strings.TrimSpace(input.SKU),
		Barcode:     strings.TrimSpace(input.Barcode),
		SalePrice:   salePrice,
		CostPrice:   costPrice,
		ImageFileID: strings.TrimSpace(input.ImageFileID),
		SortOrder:   input.SortOrder,
		Status:      "active",
	}
	if err := s.repo.CreateProductVariant(tx, variant); err != nil {
		return nil, err
	}
	return &variant.ID, nil
}

func (s *Service) validateProduct(tx *gorm.DB, businessID, branchID, productID string) (*ProductInfo, error) {
	if err := validateUUID(productID, "product_id"); err != nil {
		return nil, err
	}
	product, err := s.repo.Product(tx, businessID, branchID, productID)
	if err != nil {
		return nil, notFound(err, "product not found")
	}
	if !validRecipeOutputProductType(product.ProductType) {
		return nil, apperrors.BadRequest("recipe product must be finished_product or semi_finished", nil)
	}
	return product, nil
}

func validRecipeOutputProductType(value string) bool {
	switch strings.TrimSpace(value) {
	case "finished_product", "semi_finished":
		return true
	default:
		return false
	}
}

func validRecipeComponentProductType(value, role string) bool {
	switch strings.TrimSpace(role) {
	case "packaging":
		return strings.TrimSpace(value) == "packaging"
	default:
		switch strings.TrimSpace(value) {
		case "ingredient", "raw_material", "semi_finished", "finished_product", "consumable":
			return true
		default:
			return false
		}
	}
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
	if strings.TrimSpace(req.IngredientID) != "" || strings.TrimSpace(req.InventoryItemID) != "" {
		return nil, apperrors.BadRequest("recipe components must use component_product_id from Product Master; ingredient_id and inventory_item_id are no longer supported for new recipe lines", nil)
	}
	component, err := s.resolveRecipeComponentProduct(tx, businessID, branchID, req.ComponentProductID, req.ComponentVariantID, req.UnitID, "ingredient")
	if err != nil {
		return nil, err
	}
	effectiveQty := req.QuantityRequired * (1 + req.WastagePercentage/100)
	return &RecipeIngredient{ID: utils.NewUUID(), BusinessID: businessID, BranchID: branchID, RecipeID: recipeID, ComponentProductID: &component.ProductID, ComponentVariantID: component.VariantID, ItemNameSnapshot: component.Name, QuantityRequired: req.QuantityRequired, UnitID: req.UnitID, UnitCostSnapshot: roundMoney(component.UnitCost), TotalCost: roundMoney(effectiveQty * component.UnitCost), WastagePercentage: req.WastagePercentage, SortOrder: req.SortOrder, Notes: strings.TrimSpace(req.Notes)}, nil
}

func (s *Service) buildPackagingLine(tx *gorm.DB, businessID, branchID, recipeID string, req RecipePackagingInput) (*RecipePackaging, error) {
	if req.QuantityRequired <= 0 {
		return nil, apperrors.BadRequest("quantity_required must be greater than zero", nil)
	}
	if err := validateUUID(req.UnitID, "unit_id"); err != nil {
		return nil, err
	}
	if strings.TrimSpace(req.PackagingItemID) != "" {
		return nil, apperrors.BadRequest("recipe packaging components must use component_product_id from Product Master; packaging_item_id is no longer supported for new recipe lines", nil)
	}
	component, err := s.resolveRecipeComponentProduct(tx, businessID, branchID, req.ComponentProductID, req.ComponentVariantID, req.UnitID, "packaging")
	if err != nil {
		return nil, err
	}
	return &RecipePackaging{ID: utils.NewUUID(), BusinessID: businessID, BranchID: branchID, RecipeID: recipeID, ComponentProductID: &component.ProductID, ComponentVariantID: component.VariantID, PackagingNameSnapshot: component.Name, QuantityRequired: req.QuantityRequired, UnitID: req.UnitID, UnitCostSnapshot: roundMoney(component.UnitCost), TotalCost: roundMoney(req.QuantityRequired * component.UnitCost), IsOptional: req.IsOptional, SortOrder: req.SortOrder}, nil
}

func (s *Service) resolveRecipeComponentProduct(tx *gorm.DB, businessID, branchID, productID, variantID, unitID, componentRole string) (recipeComponent, error) {
	if err := validateUUID(productID, "component_product_id"); err != nil {
		return recipeComponent{}, err
	}
	product, err := s.repo.Product(tx, businessID, branchID, productID)
	if err != nil {
		return recipeComponent{}, notFound(err, "component product not found")
	}
	if !validRecipeComponentProductType(product.ProductType, componentRole) {
		return recipeComponent{}, apperrors.BadRequest("component product_type is not valid for this recipe line", map[string]interface{}{"product_type": product.ProductType, "component_role": componentRole})
	}
	if product.UnitID != unitID {
		return recipeComponent{}, apperrors.BadRequest("unit conversion is not available yet; component unit must match product unit", nil)
	}
	component := recipeComponent{ProductID: product.ID, Name: product.ProductName}
	if product.CostPrice != nil {
		component.UnitCost = *product.CostPrice
	}
	if strings.TrimSpace(variantID) == "" {
		return component, nil
	}
	if err := validateUUID(variantID, "component_variant_id"); err != nil {
		return recipeComponent{}, err
	}
	variant, err := s.repo.ProductVariant(tx, businessID, branchID, product.ID, variantID)
	if err != nil {
		return recipeComponent{}, notFound(err, "component variant not found")
	}
	if variant.Status != "active" {
		return recipeComponent{}, apperrors.BadRequest("component variant must be active", nil)
	}
	component.VariantID = &variant.ID
	component.Name = product.ProductName + " - " + variant.VariantName
	if variant.CostPrice != nil {
		component.UnitCost = *variant.CostPrice
	}
	return component, nil
}

func (s *Service) refreshLineCosts(tx *gorm.DB, businessID, branchID, recipeID string) error {
	ingredients, err := s.repo.Ingredients(recipeID, businessID, branchID)
	if err != nil {
		return err
	}
	for _, line := range ingredients {
		name, cost := line.ItemNameSnapshot, line.UnitCostSnapshot
		if line.ComponentProductID != nil {
			component, err := s.resolveRecipeComponentProduct(tx, businessID, branchID, *line.ComponentProductID, deref(line.ComponentVariantID), line.UnitID, "ingredient")
			if err != nil {
				continue
			}
			name, cost = component.Name, component.UnitCost
		} else if line.InventoryItemID != nil {
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
		name, cost := line.PackagingNameSnapshot, line.UnitCostSnapshot
		if line.ComponentProductID != nil {
			component, err := s.resolveRecipeComponentProduct(tx, businessID, branchID, *line.ComponentProductID, deref(line.ComponentVariantID), line.UnitID, "packaging")
			if err != nil {
				continue
			}
			name, cost = component.Name, component.UnitCost
		} else if line.PackagingItemID != nil {
			item, err := s.repo.PackagingItem(tx, businessID, branchID, *line.PackagingItemID)
			if err != nil {
				continue
			}
			name, cost = item.PackagingName, item.CostPerUnit
		}
		total := roundMoney(line.QuantityRequired * cost)
		if err := s.repo.UpdatePackaging(tx, line.ID, recipeID, businessID, branchID, map[string]interface{}{"packaging_name_snapshot": name, "unit_cost_snapshot": cost, "total_cost": total, "updated_at": time.Now().UTC()}); err != nil {
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

type recipeComponent struct {
	ProductID string
	VariantID *string
	Name      string
	UnitCost  float64
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

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
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
