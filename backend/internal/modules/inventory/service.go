package inventory

import (
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

func (s *Service) ListInventory(currentUser *utils.AuthContext, query InventoryListQuery) (*PaginatedInventoryResponse, error) {
	normalizeInventoryListQuery(&query)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		query.BranchID = branchID
	} else {
		query.BranchID = ""
	}
	if query.ItemType != "" && !validItemType(query.ItemType) {
		return nil, apperrors.BadRequest("invalid item_type", nil)
	}
	items, total, err := s.repo.ListInventoryItems(currentUser.BusinessID, query)
	if err != nil {
		return nil, err
	}
	responses, err := s.repo.LoadInventoryResponses(currentUser.BusinessID, items)
	if err != nil {
		return nil, err
	}
	return &PaginatedInventoryResponse{
		Items: responses,
		Pagination: Pagination{
			Page:       query.Page,
			Limit:      query.Limit,
			Total:      total,
			TotalPages: totalPages(total, query.Limit),
		},
	}, nil
}

func (s *Service) GetInventoryItem(currentUser *utils.AuthContext, id string) (*InventoryItemResponse, error) {
	item, err := s.repo.FindInventoryItem(id, currentUser.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "inventory item not found")
	}
	if !currentUser.CanAccessBranch(item.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	response, err := s.repo.LoadInventoryResponse(currentUser.BusinessID, *item)
	return &response, err
}

func (s *Service) CreateOpeningStock(currentUser *utils.AuthContext, req OpeningStockRequest, ipAddress, userAgent string) (*InventoryItemResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return nil, err
	}
	req.BranchID = branchID
	if err := s.validateOpeningStock(currentUser.BusinessID, req); err != nil {
		return nil, err
	}

	var response *InventoryItemResponse
	err = s.db.Transaction(func(tx *gorm.DB) error {
		itemID := itemIDForRequest(req)
		item, err := s.repo.FindExistingItem(tx, currentUser.BusinessID, req.BranchID, req.ItemType, itemID)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if errors.Is(err, gorm.ErrRecordNotFound) {
			item = &InventoryItem{
				ID:                utils.NewUUID(),
				BusinessID:        currentUser.BusinessID,
				BranchID:          req.BranchID,
				ProductID:         nullableString(req.ProductID),
				IngredientID:      nullableString(req.IngredientID),
				PackagingItemID:   nullableString(req.PackagingItemID),
				ItemType:          req.ItemType,
				CurrentQuantity:   0,
				ReservedQuantity:  0,
				AvailableQuantity: 0,
				ReorderLevel:      req.ReorderLevel,
				UnitID:            req.UnitID,
				IsExpiryTracked:   req.IsExpiryTracked,
				Status:            "active",
			}
			if err := s.repo.CreateInventoryItem(tx, item); err != nil {
				return err
			}
		} else {
			if err := s.repo.UpdateInventoryItem(tx, item.ID, currentUser.BusinessID, map[string]interface{}{
				"reorder_level":     req.ReorderLevel,
				"unit_id":           req.UnitID,
				"is_expiry_tracked": req.IsExpiryTracked,
				"updated_at":        time.Now().UTC(),
			}); err != nil {
				return err
			}
			item.ReorderLevel = req.ReorderLevel
			item.UnitID = req.UnitID
			item.IsExpiryTracked = req.IsExpiryTracked
		}

		movement, err := s.ApplyMovement(tx, ApplyStockMovementInput{
			BusinessID:      currentUser.BusinessID,
			InventoryItemID: item.ID,
			MovementType:    "opening_stock",
			Quantity:        req.Quantity,
			ReferenceType:   "opening_stock",
			Reason:          req.Reason,
			CreatedByUserID: currentUser.UserID,
		})
		if err != nil {
			return err
		}
		item.CurrentQuantity = movement.AfterQuantity
		item.AvailableQuantity = movement.AfterQuantity - item.ReservedQuantity
		if req.ExpiryDate != "" {
			expiryDate, err := parseDate(req.ExpiryDate, "expiry_date")
			if err != nil {
				return err
			}
			batch := ExpiryBatch{
				ID:              utils.NewUUID(),
				BusinessID:      currentUser.BusinessID,
				BranchID:        req.BranchID,
				InventoryItemID: item.ID,
				Quantity:        req.Quantity,
				ExpiryDate:      expiryDate,
				ReceivedDate:    time.Now().UTC(),
				Status:          "active",
			}
			if err := s.repo.CreateExpiryBatch(tx, &batch); err != nil {
				return err
			}
		}
		if err := s.audit(tx, currentUser, "inventory.opening_stock_created", item.ID, "Opening stock created", ipAddress, userAgent); err != nil {
			return err
		}
		loaded, err := s.repo.LoadInventoryResponse(currentUser.BusinessID, *item)
		if err != nil {
			return err
		}
		response = &loaded
		return nil
	})
	return response, err
}

func (s *Service) AdjustStock(currentUser *utils.AuthContext, id string, req AdjustStockRequest, ipAddress, userAgent string) (*InventoryItemResponse, error) {
	if req.Quantity <= 0 {
		return nil, apperrors.BadRequest("quantity must be greater than zero", nil)
	}
	if req.AdjustmentType != "increase" && req.AdjustmentType != "decrease" {
		return nil, apperrors.BadRequest("adjustment_type must be increase or decrease", nil)
	}
	if strings.TrimSpace(req.Reason) == "" {
		return nil, apperrors.BadRequest("reason is required", nil)
	}

	var response *InventoryItemResponse
	err := s.db.Transaction(func(tx *gorm.DB) error {
		item, err := s.repo.FindInventoryItemForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return mapNotFound(err, "inventory item not found")
		}
		if !currentUser.CanAccessBranch(item.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		movementType := "adjustment_in"
		if req.AdjustmentType == "decrease" {
			movementType = "adjustment_out"
		}
		adjustment := InventoryAdjustment{
			ID:              utils.NewUUID(),
			BusinessID:      currentUser.BusinessID,
			BranchID:        item.BranchID,
			InventoryItemID: item.ID,
			AdjustmentType:  req.AdjustmentType,
			Quantity:        req.Quantity,
			Reason:          req.Reason,
			CreatedByUserID: currentUser.UserID,
		}
		if err := s.repo.CreateAdjustment(tx, &adjustment); err != nil {
			return err
		}
		movement, err := s.ApplyMovement(tx, ApplyStockMovementInput{
			BusinessID:      currentUser.BusinessID,
			InventoryItemID: item.ID,
			MovementType:    movementType,
			Quantity:        req.Quantity,
			ReferenceType:   "inventory_adjustment",
			ReferenceID:     &adjustment.ID,
			ReferenceNumber: adjustment.ID,
			Reason:          req.Reason,
			CreatedByUserID: currentUser.UserID,
		})
		if err != nil {
			return err
		}
		item.CurrentQuantity = movement.AfterQuantity
		item.AvailableQuantity = movement.AfterQuantity - item.ReservedQuantity
		if err := s.audit(tx, currentUser, "inventory.adjusted", item.ID, "Inventory adjusted", ipAddress, userAgent); err != nil {
			return err
		}
		loaded, err := s.repo.LoadInventoryResponse(currentUser.BusinessID, *item)
		if err != nil {
			return err
		}
		response = &loaded
		return nil
	})
	return response, err
}

func (s *Service) ListMovements(currentUser *utils.AuthContext, inventoryItemID string, query MovementListQuery) (*PaginatedMovementResponse, error) {
	normalizeMovementListQuery(&query)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		query.BranchID = branchID
	} else {
		query.BranchID = ""
	}
	if err := validateMovementQuery(query); err != nil {
		return nil, err
	}
	if inventoryItemID != "" {
		item, err := s.repo.FindInventoryItem(inventoryItemID, currentUser.BusinessID)
		if err != nil {
			return nil, mapNotFound(err, "inventory item not found")
		}
		if !currentUser.CanAccessBranch(item.BranchID) {
			return nil, apperrors.Forbidden("branch access denied")
		}
	}
	movements, total, err := s.repo.ListMovements(currentUser.BusinessID, inventoryItemID, query)
	if err != nil {
		return nil, err
	}
	responses, err := s.repo.LoadMovementResponses(movements)
	if err != nil {
		return nil, err
	}
	return &PaginatedMovementResponse{
		Items: responses,
		Pagination: Pagination{
			Page:       query.Page,
			Limit:      query.Limit,
			Total:      total,
			TotalPages: totalPages(total, query.Limit),
		},
	}, nil
}

func (s *Service) GetStockMovement(currentUser *utils.AuthContext, id string) (*StockMovementDetailResponse, error) {
	movement, err := s.repo.FindStockMovement(id, currentUser.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "stock movement not found")
	}
	if !currentUser.CanAccessBranch(movement.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	movementResponse, err := s.repo.LoadMovementResponse(*movement)
	if err != nil {
		return nil, err
	}
	item, err := s.repo.FindInventoryItem(movement.InventoryItemID, currentUser.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "inventory item not found")
	}
	itemResponse, err := s.repo.LoadInventoryResponse(currentUser.BusinessID, *item)
	if err != nil {
		return nil, err
	}
	var reversal *StockMovementResponse
	if movement.ReversedByMovementID != nil {
		reversalMovement, err := s.repo.FindStockMovement(*movement.ReversedByMovementID, currentUser.BusinessID)
		if err == nil {
			dto, err := s.repo.LoadMovementResponse(*reversalMovement)
			if err == nil {
				reversal = &dto
			}
		}
	}
	var original *StockMovementResponse
	if movement.ReversedMovementID != nil {
		originalMovement, err := s.repo.FindStockMovement(*movement.ReversedMovementID, currentUser.BusinessID)
		if err == nil {
			dto, err := s.repo.LoadMovementResponse(*originalMovement)
			if err == nil {
				original = &dto
			}
		}
	}
	return &StockMovementDetailResponse{
		Movement:           movementResponse,
		InventoryItem:      itemResponse,
		Reference:          map[string]interface{}{"type": movement.ReferenceType, "id": movement.ReferenceID, "number": movement.ReferenceNumber},
		Reversal:           reversal,
		OriginalReversalOf: original,
	}, nil
}

func (s *Service) ManualStockMovement(currentUser *utils.AuthContext, req ManualStockMovementRequest, ipAddress, userAgent string) (*StockMovementResponse, error) {
	if err := validateUUID(req.InventoryItemID, "inventory_item_id"); err != nil {
		return nil, err
	}
	if !allowedManualMovementType(req.MovementType) {
		return nil, apperrors.BadRequest("movement_type is not allowed for manual creation", nil)
	}
	if req.Quantity <= 0 {
		return nil, apperrors.BadRequest("quantity must be greater than zero", nil)
	}
	if strings.TrimSpace(req.Reason) == "" {
		return nil, apperrors.BadRequest("reason is required", nil)
	}
	var response *StockMovementResponse
	err := s.db.Transaction(func(tx *gorm.DB) error {
		item, err := s.repo.FindInventoryItem(req.InventoryItemID, currentUser.BusinessID)
		if err != nil {
			return mapNotFound(err, "inventory item not found")
		}
		if !currentUser.CanAccessBranch(item.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		movement, err := s.ApplyMovement(tx, ApplyStockMovementInput{
			BusinessID:      currentUser.BusinessID,
			InventoryItemID: req.InventoryItemID,
			MovementType:    req.MovementType,
			Quantity:        req.Quantity,
			ReferenceType:   "manual_adjustment",
			Reason:          req.Reason,
			Notes:           req.Notes,
			CreatedByUserID: currentUser.UserID,
		})
		if err != nil {
			return err
		}
		if err := s.auditStockMovement(tx, currentUser, "stock_movement.manual_created", movement.ID, "Manual stock movement created", ipAddress, userAgent); err != nil {
			return err
		}
		dto, err := s.repo.LoadMovementResponse(*movement)
		if err != nil {
			return err
		}
		response = &dto
		return nil
	})
	return response, err
}

func (s *Service) ReverseStockMovement(currentUser *utils.AuthContext, id string, req ReverseStockMovementRequest, ipAddress, userAgent string) (*StockMovementResponse, error) {
	if strings.TrimSpace(req.Reason) == "" {
		return nil, apperrors.BadRequest("reason is required", nil)
	}
	var response *StockMovementResponse
	err := s.db.Transaction(func(tx *gorm.DB) error {
		original, err := s.repo.FindStockMovementForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return mapNotFound(err, "stock movement not found")
		}
		if !currentUser.CanAccessBranch(original.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if original.IsReversal {
			return apperrors.BadRequest("reversal movements cannot be reversed", nil)
		}
		if original.IsReversed {
			return apperrors.BadRequest("stock movement is already reversed", nil)
		}
		if !allowedReversalMovementType(original.MovementType) {
			return apperrors.BadRequest("this movement type cannot be reversed yet", nil)
		}
		reversalType, err := reversalMovementType(original.MovementType)
		if err != nil {
			return err
		}
		movement, err := s.ApplyMovement(tx, ApplyStockMovementInput{
			BusinessID:         currentUser.BusinessID,
			InventoryItemID:    original.InventoryItemID,
			MovementType:       reversalType,
			Quantity:           original.Quantity,
			ReferenceType:      "movement_reversal",
			ReferenceID:        &original.ID,
			ReferenceNumber:    original.ReferenceNumber,
			Reason:             req.Reason,
			Notes:              "Reversal of stock movement " + original.ID,
			IsReversal:         true,
			ReversedMovementID: &original.ID,
			CreatedByUserID:    currentUser.UserID,
		})
		if err != nil {
			return err
		}
		if err := s.repo.MarkMovementReversed(tx, original.ID, currentUser.BusinessID, movement.ID); err != nil {
			return err
		}
		if err := s.auditStockMovement(tx, currentUser, "stock_movement.reversed", original.ID, "Stock movement reversed", ipAddress, userAgent); err != nil {
			return err
		}
		dto, err := s.repo.LoadMovementResponse(*movement)
		if err != nil {
			return err
		}
		response = &dto
		return nil
	})
	return response, err
}

func (s *Service) StockMovementSummary(currentUser *utils.AuthContext, query MovementListQuery, ipAddress, userAgent string) (*StockMovementSummaryResponse, error) {
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		query.BranchID = branchID
	} else {
		query.BranchID = ""
	}
	if err := validateMovementQuery(query); err != nil {
		return nil, err
	}
	result, err := s.repo.MovementSummary(currentUser.BusinessID, query)
	if err != nil {
		return nil, err
	}
	_ = s.auditStockMovement(s.db, currentUser, "stock_movement.summary_viewed", currentUser.BusinessID, "Stock movement summary viewed", ipAddress, userAgent)
	return result, nil
}

func (s *Service) InventoryLedgerAudit(currentUser *utils.AuthContext, inventoryItemID, ipAddress, userAgent string) (*InventoryLedgerAuditResponse, error) {
	item, err := s.repo.FindInventoryItem(inventoryItemID, currentUser.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "inventory item not found")
	}
	if !currentUser.CanAccessBranch(item.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	result, err := s.repo.LedgerAudit(currentUser.BusinessID, inventoryItemID)
	if err != nil {
		return nil, err
	}
	_ = s.auditStockMovement(s.db, currentUser, "stock_movement.audit_checked", inventoryItemID, "Inventory ledger audit checked", ipAddress, userAgent)
	return result, nil
}

func (s *Service) LowStock(currentUser *utils.AuthContext, branchID, itemType string) ([]InventoryItemResponse, error) {
	resolvedBranchID, allBranches, err := currentUser.ResolveBranchScope(branchID, "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		branchID = resolvedBranchID
	} else {
		branchID = ""
	}
	query := InventoryListQuery{BranchID: branchID, ItemType: itemType, LowStockOnly: true, Page: 1, Limit: 100, SortBy: "available_quantity", SortOrder: "asc"}
	result, err := s.ListInventory(currentUser, query)
	if err != nil {
		return nil, err
	}
	return result.Items, nil
}

func (s *Service) ExpiryAlerts(currentUser *utils.AuthContext, branchID string, days int) ([]ExpiryBatchResponse, error) {
	if days <= 0 || days > 365 {
		days = 7
	}
	resolvedBranchID, allBranches, err := currentUser.ResolveBranchScope(branchID, "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		branchID = resolvedBranchID
	} else {
		branchID = ""
	}
	batches, err := s.repo.ExpiryAlerts(currentUser.BusinessID, branchID, days)
	if err != nil {
		return nil, err
	}
	return toExpiryBatchResponses(batches), nil
}

func (s *Service) ListExpiryBatches(currentUser *utils.AuthContext, inventoryItemID string) ([]ExpiryBatchResponse, error) {
	item, err := s.repo.FindInventoryItem(inventoryItemID, currentUser.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "inventory item not found")
	}
	if !currentUser.CanAccessBranch(item.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	batches, err := s.repo.ListExpiryBatches(currentUser.BusinessID, inventoryItemID)
	return toExpiryBatchResponses(batches), err
}

func (s *Service) CreateExpiryBatch(currentUser *utils.AuthContext, inventoryItemID string, req ExpiryBatchRequest, ipAddress, userAgent string) (*ExpiryBatchResponse, error) {
	if req.Quantity <= 0 {
		return nil, apperrors.BadRequest("quantity must be greater than zero", nil)
	}
	receivedDate, err := parseDate(req.ReceivedDate, "received_date")
	if err != nil {
		return nil, err
	}
	expiryDate, err := parseDate(req.ExpiryDate, "expiry_date")
	if err != nil {
		return nil, err
	}
	if expiryDate.Before(receivedDate) {
		return nil, apperrors.BadRequest("expiry_date must be on or after received_date", nil)
	}

	var response *ExpiryBatchResponse
	err = s.db.Transaction(func(tx *gorm.DB) error {
		item, err := s.repo.FindInventoryItem(inventoryItemID, currentUser.BusinessID)
		if err != nil {
			return mapNotFound(err, "inventory item not found")
		}
		if !currentUser.CanAccessBranch(item.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if !item.IsExpiryTracked {
			return apperrors.BadRequest("inventory item is not expiry tracked", nil)
		}
		batch := ExpiryBatch{
			ID:              utils.NewUUID(),
			BusinessID:      currentUser.BusinessID,
			BranchID:        item.BranchID,
			InventoryItemID: item.ID,
			BatchNumber:     strings.TrimSpace(req.BatchNumber),
			Quantity:        req.Quantity,
			ReceivedDate:    receivedDate,
			ExpiryDate:      expiryDate,
			Status:          "active",
		}
		if err := s.repo.CreateExpiryBatch(tx, &batch); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "inventory.expiry_batch_created", batch.ID, "Expiry batch created", ipAddress, userAgent); err != nil {
			return err
		}
		dto := toExpiryBatchResponse(batch)
		response = &dto
		return nil
	})
	return response, err
}

func (s *Service) UpdateExpiryBatch(currentUser *utils.AuthContext, batchID string, req UpdateExpiryBatchRequest, ipAddress, userAgent string) (*ExpiryBatchResponse, error) {
	batch, err := s.repo.FindExpiryBatch(batchID, currentUser.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "expiry batch not found")
	}
	if !currentUser.CanAccessBranch(batch.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	updates := map[string]interface{}{"updated_at": time.Now().UTC()}
	if req.BatchNumber != nil {
		updates["batch_number"] = strings.TrimSpace(*req.BatchNumber)
	}
	if req.Quantity != nil {
		if *req.Quantity <= 0 {
			return nil, apperrors.BadRequest("quantity must be greater than zero", nil)
		}
		updates["quantity"] = *req.Quantity
		batch.Quantity = *req.Quantity
	}
	if req.ReceivedDate != nil {
		receivedDate, err := parseDate(*req.ReceivedDate, "received_date")
		if err != nil {
			return nil, err
		}
		updates["received_date"] = receivedDate
		batch.ReceivedDate = receivedDate
	}
	if req.ExpiryDate != nil {
		expiryDate, err := parseDate(*req.ExpiryDate, "expiry_date")
		if err != nil {
			return nil, err
		}
		updates["expiry_date"] = expiryDate
		batch.ExpiryDate = expiryDate
	}
	if batch.ExpiryDate.Before(batch.ReceivedDate) {
		return nil, apperrors.BadRequest("expiry_date must be on or after received_date", nil)
	}
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.UpdateExpiryBatch(tx, batchID, currentUser.BusinessID, updates); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "inventory.expiry_batch_updated", batchID, "Expiry batch updated", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	updated, err := s.repo.FindExpiryBatch(batchID, currentUser.BusinessID)
	if err != nil {
		return nil, err
	}
	dto := toExpiryBatchResponse(*updated)
	return &dto, nil
}

func (s *Service) UpdateExpiryBatchStatus(currentUser *utils.AuthContext, batchID string, req UpdateExpiryBatchStatusRequest, ipAddress, userAgent string) (*ExpiryBatchResponse, error) {
	if req.Status != "active" && req.Status != "expired" && req.Status != "depleted" {
		return nil, apperrors.BadRequest("invalid expiry batch status", nil)
	}
	batch, err := s.repo.FindExpiryBatch(batchID, currentUser.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "expiry batch not found")
	}
	if !currentUser.CanAccessBranch(batch.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.UpdateExpiryBatch(tx, batchID, currentUser.BusinessID, map[string]interface{}{"status": req.Status, "updated_at": time.Now().UTC()}); err != nil {
			return mapNotFound(err, "expiry batch not found")
		}
		return s.audit(tx, currentUser, "inventory.status_updated", batchID, "Expiry batch status updated", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	updated, err := s.repo.FindExpiryBatch(batchID, currentUser.BusinessID)
	if err != nil {
		return nil, err
	}
	dto := toExpiryBatchResponse(*updated)
	return &dto, nil
}

func (s *Service) DeductOnSale(saleID string) error {
	// TODO: Wire this from POS checkout after inventory deduction rules are finalized.
	// Expected behavior: load sale items, find stock-tracked products by branch, reduce stock,
	// and create sale_out stock movements inside the same checkout transaction.
	return nil
}

func (s *Service) validateOpeningStock(businessID string, req OpeningStockRequest) error {
	if !validItemType(req.ItemType) {
		return apperrors.BadRequest("invalid item_type", nil)
	}
	if req.Quantity < 0 {
		return apperrors.BadRequest("quantity must be greater than or equal to zero", nil)
	}
	if req.Quantity == 0 {
		return apperrors.BadRequest("quantity must be greater than zero for opening stock movement", nil)
	}
	if req.ReorderLevel < 0 {
		return apperrors.BadRequest("reorder_level must be greater than or equal to zero", nil)
	}
	if err := validateUUID(req.BranchID, "branch_id"); err != nil {
		return err
	}
	if err := validateUUID(req.UnitID, "unit_id"); err != nil {
		return err
	}
	if err := s.repo.ValidateBranch(businessID, req.BranchID); err != nil {
		return mapNotFound(err, "branch not found")
	}
	if err := s.repo.ValidateUnit(businessID, req.UnitID); err != nil {
		return mapNotFound(err, "unit not found")
	}
	switch req.ItemType {
	case "product":
		if err := validateUUID(req.ProductID, "product_id"); err != nil {
			return err
		}
		if err := s.repo.ValidateProduct(businessID, req.ProductID); err != nil {
			return mapNotFound(err, "product not found")
		}
	case "ingredient":
		if err := validateUUID(req.IngredientID, "ingredient_id"); err != nil {
			return err
		}
		if err := s.repo.ValidateIngredient(businessID, req.IngredientID); err != nil {
			return mapNotFound(err, "ingredient not found")
		}
	case "packaging":
		if err := validateUUID(req.PackagingItemID, "packaging_item_id"); err != nil {
			return err
		}
	}
	if req.ExpiryDate != "" && !req.IsExpiryTracked {
		return apperrors.BadRequest("is_expiry_tracked must be true when expiry_date is provided", nil)
	}
	return nil
}

func (s *Service) ApplyMovement(tx *gorm.DB, input ApplyStockMovementInput) (*StockMovement, error) {
	if input.Quantity <= 0 {
		return nil, apperrors.BadRequest("quantity must be greater than zero", nil)
	}
	direction, err := movementDirection(input.MovementType)
	if err != nil {
		return nil, err
	}
	item, err := s.repo.FindInventoryItemForUpdate(tx, input.InventoryItemID, input.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "inventory item not found")
	}
	before := item.CurrentQuantity
	after := before
	switch direction {
	case "in":
		after = before + input.Quantity
	case "out":
		after = before - input.Quantity
	case "neutral":
		after = before
	}
	if after < 0 {
		return nil, apperrors.BadRequest("stock cannot go below zero", nil)
	}
	available := after - item.ReservedQuantity
	if available < 0 {
		return nil, apperrors.BadRequest("available stock cannot go below zero", nil)
	}
	if err := s.repo.UpdateInventoryItem(tx, item.ID, input.BusinessID, map[string]interface{}{
		"current_quantity":   after,
		"available_quantity": available,
		"updated_at":         time.Now().UTC(),
	}); err != nil {
		return nil, err
	}
	movement := &StockMovement{
		ID:                 utils.NewUUID(),
		BusinessID:         item.BusinessID,
		BranchID:           item.BranchID,
		InventoryItemID:    item.ID,
		ItemType:           item.ItemType,
		MovementType:       input.MovementType,
		MovementDirection:  direction,
		Quantity:           input.Quantity,
		BeforeQuantity:     before,
		AfterQuantity:      after,
		UnitID:             item.UnitID,
		ReferenceType:      strings.TrimSpace(input.ReferenceType),
		ReferenceID:        input.ReferenceID,
		ReferenceNumber:    strings.TrimSpace(input.ReferenceNumber),
		Reason:             strings.TrimSpace(input.Reason),
		Notes:              strings.TrimSpace(input.Notes),
		IsReversal:         input.IsReversal,
		ReversedMovementID: input.ReversedMovementID,
		CreatedByUserID:    input.CreatedByUserID,
	}
	if err := s.repo.CreateStockMovement(tx, movement); err != nil {
		return nil, err
	}
	return movement, nil
}

func (s *Service) audit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	return s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "inventory",
		EntityID:    entityID,
		Summary:     summary,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	})
}

func (s *Service) auditStockMovement(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	return s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "stock_movements",
		EntityID:    entityID,
		Summary:     summary,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	})
}

func normalizeInventoryListQuery(query *InventoryListQuery) {
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

func normalizeMovementListQuery(query *MovementListQuery) {
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

func validItemType(value string) bool {
	return value == "product" || value == "ingredient" || value == "packaging"
}

func movementDirection(movementType string) (string, error) {
	switch movementType {
	case "opening_stock", "purchase_in", "adjustment_in", "return_in", "transfer_in", "production_in":
		return "in", nil
	case "sale_out", "adjustment_out", "wastage", "transfer_out", "production_out":
		return "out", nil
	case "reversal":
		return "neutral", nil
	default:
		return "", apperrors.BadRequest("invalid movement_type", nil)
	}
}

func allowedManualMovementType(value string) bool {
	return value == "adjustment_in" || value == "adjustment_out" || value == "wastage" || value == "return_in"
}

func allowedReversalMovementType(value string) bool {
	return value == "opening_stock" || value == "adjustment_in" || value == "adjustment_out" || value == "wastage" || value == "return_in"
}

func reversalMovementType(originalType string) (string, error) {
	direction, err := movementDirection(originalType)
	if err != nil {
		return "", err
	}
	if direction == "in" {
		return "adjustment_out", nil
	}
	if direction == "out" {
		return "adjustment_in", nil
	}
	return "", apperrors.BadRequest("neutral movement cannot be reversed", nil)
}

func validateMovementQuery(query MovementListQuery) error {
	if err := validateOptionalUUID(query.BranchID, "branch_id"); err != nil {
		return err
	}
	if err := validateOptionalUUID(query.InventoryItemID, "inventory_item_id"); err != nil {
		return err
	}
	if err := validateOptionalUUID(query.ReferenceID, "reference_id"); err != nil {
		return err
	}
	if err := validateOptionalUUID(query.CreatedByUserID, "created_by_user_id"); err != nil {
		return err
	}
	if query.ItemType != "" && !validItemType(query.ItemType) {
		return apperrors.BadRequest("invalid item_type", nil)
	}
	if query.MovementType != "" {
		if _, err := movementDirection(query.MovementType); err != nil {
			return err
		}
	}
	if query.MovementDirection != "" && query.MovementDirection != "in" && query.MovementDirection != "out" && query.MovementDirection != "neutral" {
		return apperrors.BadRequest("invalid movement_direction", nil)
	}
	return nil
}

func validateUUID(value, field string) error {
	if _, err := uuid.Parse(strings.TrimSpace(value)); err != nil {
		return apperrors.BadRequest(field+" must be a valid UUID", nil)
	}
	return nil
}

func validateOptionalUUID(value, field string) error {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return validateUUID(value, field)
}

func nullableString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func itemIDForRequest(req OpeningStockRequest) *string {
	switch req.ItemType {
	case "product":
		return nullableString(req.ProductID)
	case "ingredient":
		return nullableString(req.IngredientID)
	default:
		return nullableString(req.PackagingItemID)
	}
}

func parseDate(value, field string) (time.Time, error) {
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, apperrors.BadRequest(field+" must use YYYY-MM-DD format", nil)
	}
	return parsed, nil
}

func mapNotFound(err error, message string) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apperrors.NotFound(message)
	}
	return err
}

func toExpiryBatchResponse(batch ExpiryBatch) ExpiryBatchResponse {
	return ExpiryBatchResponse{
		ID:              batch.ID,
		BusinessID:      batch.BusinessID,
		BranchID:        batch.BranchID,
		InventoryItemID: batch.InventoryItemID,
		BatchNumber:     batch.BatchNumber,
		Quantity:        roundQuantity(batch.Quantity),
		ExpiryDate:      batch.ExpiryDate,
		ReceivedDate:    batch.ReceivedDate,
		Status:          batch.Status,
		CreatedAt:       batch.CreatedAt,
		UpdatedAt:       batch.UpdatedAt,
	}
}

func toExpiryBatchResponses(batches []ExpiryBatch) []ExpiryBatchResponse {
	responses := make([]ExpiryBatchResponse, 0, len(batches))
	for _, batch := range batches {
		responses = append(responses, toExpiryBatchResponse(batch))
	}
	return responses
}
