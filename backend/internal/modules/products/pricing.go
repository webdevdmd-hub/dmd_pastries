package products

import (
	"math"
	"strings"
	"time"

	"gorm.io/gorm"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type PricingCostSource struct {
	BusinessID       string
	BranchID         string
	ProductID        string
	ProductVariantID *string
	InventoryItemID  string
	Cost             float64
	SourceType       string
	SourceID         *string
	SourceNumber     string
	Reason           string
}

func (s *Service) ApplyPurchaseCostUpdate(tx *gorm.DB, input PricingCostSource) error {
	if strings.TrimSpace(input.ProductID) == "" || input.Cost <= 0 {
		return nil
	}
	averageCost := input.Cost
	if strings.TrimSpace(input.InventoryItemID) != "" {
		if cost, err := s.repo.InventoryAverageCost(tx, input.BusinessID, input.InventoryItemID); err == nil && cost > 0 {
			averageCost = cost
		}
	}
	return s.applyCostUpdate(tx, input, "purchase", input.Cost, averageCost)
}

func (s *Service) ApplyRecipeCostUpdate(tx *gorm.DB, input PricingCostSource) error {
	if strings.TrimSpace(input.ProductID) == "" || input.Cost <= 0 {
		return nil
	}
	return s.applyCostUpdate(tx, input, "recipe", input.Cost, input.Cost)
}

func (s *Service) ApplyProductionCostUpdate(tx *gorm.DB, input PricingCostSource) error {
	if strings.TrimSpace(input.ProductID) == "" || input.Cost <= 0 {
		return nil
	}
	averageCost := input.Cost
	if strings.TrimSpace(input.InventoryItemID) != "" {
		if cost, err := s.repo.InventoryAverageCost(tx, input.BusinessID, input.InventoryItemID); err == nil && cost > 0 {
			averageCost = cost
		}
	}
	return s.applyCostUpdate(tx, input, "production", input.Cost, averageCost)
}

func (s *Service) applyCostUpdate(tx *gorm.DB, input PricingCostSource, sourceKind string, latestCost, averageCost float64) error {
	now := time.Now().UTC()
	target, err := s.repo.PricingTarget(tx, input.BusinessID, input.BranchID, input.ProductID, input.ProductVariantID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}
	costForSuggestion := latestCost
	costUpdate := map[string]interface{}{"updated_at": now}
	if sourceKind == "purchase" {
		costUpdate["last_purchase_cost"] = latestCost
		costUpdate["last_purchase_date"] = now
		costUpdate["average_inventory_cost"] = averageCost
		switch target.CostUpdatePolicy {
		case "latest_purchase":
			costUpdate["cost_price"] = latestCost
			costForSuggestion = latestCost
		case "weighted_average":
			costUpdate["cost_price"] = averageCost
			costForSuggestion = averageCost
		default:
			costForSuggestion = latestCost
		}
	}
	if sourceKind == "recipe" {
		costForSuggestion = latestCost
	}
	if sourceKind == "production" {
		costUpdate["last_production_cost"] = latestCost
		costUpdate["last_production_date"] = now
		costUpdate["average_inventory_cost"] = averageCost
		costForSuggestion = latestCost
		if target.CostUpdatePolicy == "recipe_actual" {
			costUpdate["cost_price"] = latestCost
		} else if target.CostUpdatePolicy == "weighted_average" {
			costUpdate["cost_price"] = averageCost
			costForSuggestion = averageCost
		}
	}
	suggested := suggestedSalePrice(costForSuggestion, target.PricingType, target.PricingPercent, target.MinimumSalePrice)
	if suggested > 0 {
		costUpdate["suggested_sale_price"] = suggested
	}
	if err := s.repo.UpdatePricingTarget(tx, input.BusinessID, input.BranchID, input.ProductID, input.ProductVariantID, costUpdate); err != nil {
		return err
	}
	if suggested <= 0 || math.Abs(suggested-target.SalePrice) < 0.0001 {
		return nil
	}
	if target.AutoPriceUpdateEnabled && !target.SalePriceLocked {
		return s.applyAutomaticSalePrice(tx, input, target, suggested, costForSuggestion, now)
	}
	return s.repo.CreatePriceSuggestion(tx, &ProductPriceSuggestion{
		ID:                 utils.NewUUID(),
		BusinessID:         input.BusinessID,
		BranchID:           input.BranchID,
		ProductID:          input.ProductID,
		ProductVariantID:   input.ProductVariantID,
		CurrentCost:        roundQuantity(costForSuggestion),
		PreviousCost:       target.CostPrice,
		CurrentSalePrice:   roundMoney(target.SalePrice),
		SuggestedSalePrice: roundMoney(suggested),
		PricingType:        target.PricingType,
		PricingPercent:     roundQuantity(target.PricingPercent),
		SourceType:         input.SourceType,
		SourceID:           input.SourceID,
		SourceNumber:       strings.TrimSpace(input.SourceNumber),
		Reason:             strings.TrimSpace(input.Reason),
		Status:             "pending",
		CreatedAt:          now,
		UpdatedAt:          now,
	})
}

func (s *Service) applyAutomaticSalePrice(tx *gorm.DB, input PricingCostSource, target pricingTarget, suggested float64, cost float64, now time.Time) error {
	if err := s.repo.UpdatePricingTarget(tx, input.BusinessID, input.BranchID, input.ProductID, input.ProductVariantID, map[string]interface{}{"sale_price": roundMoney(suggested), "suggested_sale_price": roundMoney(suggested), "updated_at": now}); err != nil {
		return err
	}
	return s.repo.CreatePriceSuggestion(tx, &ProductPriceSuggestion{
		ID:                 utils.NewUUID(),
		BusinessID:         input.BusinessID,
		BranchID:           input.BranchID,
		ProductID:          input.ProductID,
		ProductVariantID:   input.ProductVariantID,
		CurrentCost:        roundQuantity(cost),
		PreviousCost:       target.CostPrice,
		CurrentSalePrice:   roundMoney(target.SalePrice),
		SuggestedSalePrice: roundMoney(suggested),
		PricingType:        target.PricingType,
		PricingPercent:     roundQuantity(target.PricingPercent),
		SourceType:         input.SourceType,
		SourceID:           input.SourceID,
		SourceNumber:       strings.TrimSpace(input.SourceNumber),
		Reason:             strings.TrimSpace(input.Reason),
		Status:             "applied",
		AppliedAt:          &now,
		CreatedAt:          now,
		UpdatedAt:          now,
	})
}

func suggestedSalePrice(cost float64, pricingType string, percent float64, minimum *float64) float64 {
	if cost <= 0 || percent <= 0 {
		return 0
	}
	price := 0.0
	if normalizePricingType(pricingType) == "margin" {
		if percent >= 100 {
			return 0
		}
		price = cost / (1 - percent/100)
	} else {
		price = cost * (1 + percent/100)
	}
	price = roundMoney(price)
	if minimum != nil && price < *minimum {
		price = roundMoney(*minimum)
	}
	return price
}

func (s *Service) ListPriceSuggestions(currentUser *utils.AuthContext, query PriceSuggestionListQuery) (*ProductPriceSuggestionListResponse, error) {
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if allBranches {
		branchID = ""
	}
	if query.Status == "" {
		query.Status = "pending"
	}
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.Limit <= 0 || query.Limit > 100 {
		query.Limit = 20
	}
	items, total, err := s.repo.ListPriceSuggestions(currentUser.BusinessID, branchID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list product price suggestions")
	}
	return &ProductPriceSuggestionListResponse{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: int(math.Ceil(float64(total) / float64(query.Limit)))}}, nil
}

func (s *Service) ApplyPriceSuggestion(currentUser *utils.AuthContext, id string, req ApplyPriceSuggestionRequest, ipAddress, userAgent string) (*ProductPriceSuggestionResponse, error) {
	var result ProductPriceSuggestionResponse
	err := s.db.Transaction(func(tx *gorm.DB) error {
		suggestion, err := s.repo.FindPriceSuggestionForUpdate(tx, currentUser.BusinessID, id)
		if err != nil {
			return notFoundOrInternal(err, "price suggestion not found")
		}
		if !currentUser.CanAccessBranch(suggestion.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if suggestion.Status != "pending" {
			return apperrors.BadRequest("only pending price suggestions can be applied", nil)
		}
		price := suggestion.SuggestedSalePrice
		if req.SalePrice != nil {
			price = *req.SalePrice
		}
		if price < 0 {
			return apperrors.BadRequest("sale_price must be >= 0", nil)
		}
		now := time.Now().UTC()
		if err := s.repo.UpdatePricingTarget(tx, suggestion.BusinessID, suggestion.BranchID, suggestion.ProductID, suggestion.ProductVariantID, map[string]interface{}{"sale_price": roundMoney(price), "suggested_sale_price": roundMoney(suggestion.SuggestedSalePrice), "updated_at": now}); err != nil {
			return err
		}
		if err := s.repo.UpdatePriceSuggestion(tx, suggestion.ID, currentUser.BusinessID, map[string]interface{}{"status": "applied", "applied_at": now, "updated_at": now}); err != nil {
			return err
		}
		if err := s.writeAudit(tx, currentUser, "product_price_suggestion.applied", suggestion.ID, "Product price suggestion applied.", ipAddress, userAgent); err != nil {
			return err
		}
		response, err := s.repo.PriceSuggestionResponse(tx, currentUser.BusinessID, suggestion.ID)
		if err != nil {
			return err
		}
		result = response
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *Service) DismissPriceSuggestion(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) (*ProductPriceSuggestionResponse, error) {
	var result ProductPriceSuggestionResponse
	err := s.db.Transaction(func(tx *gorm.DB) error {
		suggestion, err := s.repo.FindPriceSuggestionForUpdate(tx, currentUser.BusinessID, id)
		if err != nil {
			return notFoundOrInternal(err, "price suggestion not found")
		}
		if !currentUser.CanAccessBranch(suggestion.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if suggestion.Status != "pending" {
			return apperrors.BadRequest("only pending price suggestions can be dismissed", nil)
		}
		now := time.Now().UTC()
		if err := s.repo.UpdatePriceSuggestion(tx, suggestion.ID, currentUser.BusinessID, map[string]interface{}{"status": "dismissed", "dismissed_at": now, "updated_at": now}); err != nil {
			return err
		}
		if err := s.writeAudit(tx, currentUser, "product_price_suggestion.dismissed", suggestion.ID, "Product price suggestion dismissed.", ipAddress, userAgent); err != nil {
			return err
		}
		response, err := s.repo.PriceSuggestionResponse(tx, currentUser.BusinessID, suggestion.ID)
		if err != nil {
			return err
		}
		result = response
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *Service) BulkApplyPriceSuggestions(currentUser *utils.AuthContext, req BulkApplyPriceSuggestionsRequest, ipAddress, userAgent string) ([]ProductPriceSuggestionResponse, error) {
	result := make([]ProductPriceSuggestionResponse, 0, len(req.IDs))
	for _, id := range req.IDs {
		applied, err := s.ApplyPriceSuggestion(currentUser, id, ApplyPriceSuggestionRequest{}, ipAddress, userAgent)
		if err != nil {
			return nil, err
		}
		result = append(result, *applied)
	}
	return result, nil
}

func notFoundOrInternal(err error, message string) error {
	if err == gorm.ErrRecordNotFound {
		return apperrors.NotFound(message)
	}
	return apperrors.Internal("failed to load product price suggestion")
}
