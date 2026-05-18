package manufacturing

import (
	"errors"
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
	db               *gorm.DB
	repo             *Repository
	inventoryRepo    *inventory.Repository
	inventoryService *inventory.Service
	auditRepo        *audit.Repository
}

func NewService(db *gorm.DB, repo *Repository, inventoryRepo *inventory.Repository, inventoryService *inventory.Service, auditRepo *audit.Repository) *Service {
	return &Service{db: db, repo: repo, inventoryRepo: inventoryRepo, inventoryService: inventoryService, auditRepo: auditRepo}
}

func (s *Service) ListBatches(currentUser *utils.AuthContext, query BatchListQuery) (*PaginatedBatchResponse, error) {
	normalizeQuery(&query)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		query.BranchID = branchID
	} else {
		query.BranchID = ""
	}
	if err := validateListQuery(query); err != nil {
		return nil, err
	}
	batches, total, err := s.repo.ListBatches(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list production batches")
	}
	items := make([]ProductionBatchResponse, 0, len(batches))
	for _, batch := range batches {
		items = append(items, s.batchResponse(currentUser.BusinessID, batch, false))
	}
	return &PaginatedBatchResponse{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) CreateBatch(currentUser *utils.AuthContext, req CreateBatchRequest, ipAddress, userAgent string) (*ProductionBatchResponse, error) {
	var batchID string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		batch, ingredients, packaging, err := s.buildBatch(tx, currentUser, req)
		if err != nil {
			return err
		}
		number, err := s.repo.NextNumber(tx, currentUser.BusinessID)
		if err != nil {
			return err
		}
		batch.ProductionBatchNumber = number
		if err := s.repo.CreateBatch(tx, batch, ingredients, packaging); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "production_batch.created", batch.ID, "Production batch created", ipAddress, userAgent); err != nil {
			return err
		}
		batchID = batch.ID
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetBatch(currentUser, batchID)
}

func (s *Service) GetBatch(currentUser *utils.AuthContext, id string) (*ProductionBatchResponse, error) {
	batch, err := s.repo.FindBatch(id, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "production batch not found")
	}
	if !currentUser.CanAccessBranch(batch.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	dto := s.batchResponse(currentUser.BusinessID, *batch, true)
	return &dto, nil
}

func (s *Service) UpdateBatch(currentUser *utils.AuthContext, id string, req UpdateBatchRequest, ipAddress, userAgent string) (*ProductionBatchResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		batch, err := s.repo.FindBatchForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "production batch not found")
		}
		if !currentUser.CanAccessBranch(batch.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		updates := map[string]interface{}{"updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
		if strings.TrimSpace(req.Notes) != "" {
			updates["notes"] = strings.TrimSpace(req.Notes)
		}
		if batch.Status == "completed" || batch.Status == "cancelled" {
			if len(updates) <= 2 {
				return apperrors.BadRequest("completed or cancelled batches can only update notes", nil)
			}
			if err := s.repo.UpdateBatch(tx, id, currentUser.BusinessID, updates); err != nil {
				return err
			}
			return s.audit(tx, currentUser, "production_batch.updated", id, "Production batch updated", ipAddress, userAgent)
		}
		if strings.TrimSpace(req.ProductionDate) != "" {
			date, err := parseDate(req.ProductionDate, "production_date")
			if err != nil {
				return err
			}
			updates["production_date"] = date
		}
		if err := s.repo.UpdateBatch(tx, id, currentUser.BusinessID, updates); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "production_batch.updated", id, "Production batch updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetBatch(currentUser, id)
}

func (s *Service) StartBatch(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*ProductionBatchResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		batch, err := s.repo.FindBatchForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "production batch not found")
		}
		if !currentUser.CanAccessBranch(batch.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if batch.Status != "draft" && batch.Status != "planned" {
			return apperrors.BadRequest("only draft or planned batches can be started", nil)
		}
		now := time.Now().UTC()
		if err := s.repo.UpdateBatch(tx, id, currentUser.BusinessID, map[string]interface{}{"status": "in_progress", "started_at": now, "updated_by_user_id": currentUser.UserID, "updated_at": now}); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "production_batch.started", id, "Production batch started", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetBatch(currentUser, id)
}

func (s *Service) UpdateIngredient(currentUser *utils.AuthContext, batchID, lineID string, req UpdateIngredientRequest, ipAddress, userAgent string) (*ProductionIngredientResponse, error) {
	if req.ActualQuantity <= 0 {
		return nil, apperrors.BadRequest("actual_quantity must be greater than zero", nil)
	}
	if req.WastageQuantity < 0 {
		return nil, apperrors.BadRequest("wastage_quantity must be non-negative", nil)
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		batch, err := s.repo.FindBatchForUpdate(tx, batchID, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "production batch not found")
		}
		if !currentUser.CanAccessBranch(batch.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if !batchCanEditConsumption(batch.Status) {
			return apperrors.BadRequest("consumption lines cannot be edited for this batch status", nil)
		}
		lines, err := s.repo.Ingredients(batchID, currentUser.BusinessID)
		if err != nil {
			return err
		}
		for _, line := range lines {
			if line.ID == lineID {
				total := roundMoney(req.ActualQuantity * line.UnitCostSnapshot)
				if err := s.repo.UpdateIngredient(tx, lineID, batchID, currentUser.BusinessID, map[string]interface{}{"actual_quantity": req.ActualQuantity, "wastage_quantity": req.WastageQuantity, "total_cost": total, "updated_at": time.Now().UTC()}); err != nil {
					return err
				}
				if err := s.recalculateBatchCosts(tx, currentUser.BusinessID, batchID); err != nil {
					return err
				}
				return s.audit(tx, currentUser, "production_ingredient.updated", lineID, "Production ingredient updated", ipAddress, userAgent)
			}
		}
		return apperrors.NotFound("production ingredient line not found")
	})
	if err != nil {
		return nil, err
	}
	lines, err := s.ListIngredients(currentUser, batchID)
	if err != nil {
		return nil, err
	}
	for _, line := range lines {
		if line.ID == lineID {
			return &line, nil
		}
	}
	return nil, apperrors.NotFound("production ingredient line not found")
}

func (s *Service) UpdatePackaging(currentUser *utils.AuthContext, batchID, lineID string, req UpdatePackagingRequest, ipAddress, userAgent string) (*ProductionPackagingResponse, error) {
	if req.ActualQuantity < 0 {
		return nil, apperrors.BadRequest("actual_quantity must be non-negative", nil)
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		batch, err := s.repo.FindBatchForUpdate(tx, batchID, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "production batch not found")
		}
		if !currentUser.CanAccessBranch(batch.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if !batchCanEditConsumption(batch.Status) {
			return apperrors.BadRequest("consumption lines cannot be edited for this batch status", nil)
		}
		lines, err := s.repo.Packaging(batchID, currentUser.BusinessID)
		if err != nil {
			return err
		}
		for _, line := range lines {
			if line.ID == lineID {
				if !line.IsOptional && req.ActualQuantity <= 0 {
					return apperrors.BadRequest("actual_quantity must be greater than zero for required packaging", nil)
				}
				total := roundMoney(req.ActualQuantity * line.UnitCostSnapshot)
				if err := s.repo.UpdatePackaging(tx, lineID, batchID, currentUser.BusinessID, map[string]interface{}{"actual_quantity": req.ActualQuantity, "total_cost": total, "updated_at": time.Now().UTC()}); err != nil {
					return err
				}
				if err := s.recalculateBatchCosts(tx, currentUser.BusinessID, batchID); err != nil {
					return err
				}
				return s.audit(tx, currentUser, "production_packaging.updated", lineID, "Production packaging updated", ipAddress, userAgent)
			}
		}
		return apperrors.NotFound("production packaging line not found")
	})
	if err != nil {
		return nil, err
	}
	lines, err := s.ListPackaging(currentUser, batchID)
	if err != nil {
		return nil, err
	}
	for _, line := range lines {
		if line.ID == lineID {
			return &line, nil
		}
	}
	return nil, apperrors.NotFound("production packaging line not found")
}

func (s *Service) ProduceBatch(currentUser *utils.AuthContext, id string, req ProduceBatchRequest, ipAddress, userAgent string) (*ProductionBatchResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		batch, err := s.repo.FindBatchForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "production batch not found")
		}
		if !currentUser.CanAccessBranch(batch.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if batch.Status != "planned" && batch.Status != "in_progress" {
			return apperrors.BadRequest("only planned or in_progress batches can record production output", nil)
		}
		producedQuantity := req.QuantityValue()
		if producedQuantity <= 0 {
			producedQuantity = batch.PlannedQuantity
		}
		if producedQuantity <= 0 {
			return apperrors.BadRequest("produced_quantity must be greater than zero", nil)
		}

		updates := map[string]interface{}{
			"produced_quantity":  producedQuantity,
			"updated_by_user_id": currentUser.UserID,
			"updated_at":         time.Now().UTC(),
		}
		if strings.TrimSpace(req.Notes) != "" {
			updates["notes"] = strings.TrimSpace(req.Notes)
		}
		if err := s.repo.UpdateBatch(tx, id, currentUser.BusinessID, updates); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "production_batch.output_recorded", id, "Production output recorded", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetBatch(currentUser, id)
}

func (s *Service) RecordWastage(currentUser *utils.AuthContext, id string, req WastageBatchRequest, ipAddress, userAgent string) (*ProductionBatchResponse, error) {
	wastageQuantity := req.QuantityValue()
	if wastageQuantity < 0 {
		return nil, apperrors.BadRequest("wastage_quantity must be non-negative", nil)
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		batch, err := s.repo.FindBatchForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "production batch not found")
		}
		if !currentUser.CanAccessBranch(batch.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if batch.Status != "planned" && batch.Status != "in_progress" {
			return apperrors.BadRequest("only planned or in_progress batches can record wastage", nil)
		}

		if err := s.repo.UpdateBatch(tx, id, currentUser.BusinessID, map[string]interface{}{
			"wastage_quantity":   wastageQuantity,
			"wastage_reason":     strings.TrimSpace(req.ReasonValue()),
			"updated_by_user_id": currentUser.UserID,
			"updated_at":         time.Now().UTC(),
		}); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "production_batch.wastage_recorded", id, "Production wastage recorded", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetBatch(currentUser, id)
}

func (s *Service) GetOutputs(currentUser *utils.AuthContext, id string) (*ProductionOutputsResponse, error) {
	batch, err := s.repo.FindBatch(id, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "production batch not found")
	}
	if !currentUser.CanAccessBranch(batch.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}

	_, _, productName, productVariantName, _ := s.repo.NameLookups(currentUser.BusinessID, *batch)
	result := &ProductionOutputsResponse{
		BatchID:            batch.ID,
		Status:             batch.Status,
		ProductID:          batch.ProductID,
		ProductName:        productName,
		ProductVariantID:   batch.ProductVariantID,
		ProductVariantName: productVariantName,
		PlannedQuantity:    roundQuantity(batch.PlannedQuantity),
		ProducedQuantity:   roundQuantity(batch.ProducedQuantity),
		YieldUnitID:        batch.YieldUnitID,
		YieldUnitSymbol:    s.repo.UnitSymbol(batch.YieldUnitID),
	}

	output, err := s.repo.Output(batch.ID, currentUser.BusinessID)
	if err != nil {
		return nil, err
	}
	if output != nil {
		dto := s.outputResponse(*output)
		result.Output = &dto
	}
	return result, nil
}

func (s *Service) GetWastage(currentUser *utils.AuthContext, id string) (*ProductionWastageResponse, error) {
	batch, err := s.repo.FindBatch(id, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "production batch not found")
	}
	if !currentUser.CanAccessBranch(batch.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}

	ingredients, err := s.repo.Ingredients(id, currentUser.BusinessID)
	if err != nil {
		return nil, err
	}
	details := make([]ProductionIngredientResponse, 0)
	total := 0.0
	for _, ingredient := range ingredients {
		if ingredient.WastageQuantity <= 0 {
			continue
		}
		total += ingredient.WastageQuantity
		details = append(details, s.ingredientResponses([]ProductionIngredientConsumption{ingredient})[0])
	}

	return &ProductionWastageResponse{
		BatchID:                  batch.ID,
		Status:                   batch.Status,
		WastageQuantity:          roundQuantity(batch.WastageQuantity),
		WastageReason:            batch.WastageReason,
		IngredientWastageTotal:   roundQuantity(total),
		IngredientWastageDetails: details,
	}, nil
}

func (s *Service) CompleteBatch(currentUser *utils.AuthContext, id string, req CompleteBatchRequest, ipAddress, userAgent string) (*ProductionBatchResponse, error) {
	if req.WastageQuantity < 0 {
		return nil, apperrors.BadRequest("wastage_quantity must be non-negative", nil)
	}
	var expiryDate *time.Time
	if strings.TrimSpace(req.ExpiryDate) != "" {
		parsed, err := parseDate(req.ExpiryDate, "expiry_date")
		if err != nil {
			return nil, err
		}
		expiryDate = &parsed
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		batch, err := s.repo.FindBatchForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "production batch not found")
		}
		if !currentUser.CanAccessBranch(batch.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if batch.Status != "planned" && batch.Status != "in_progress" {
			return apperrors.BadRequest("only planned or in_progress batches can be completed", nil)
		}
		producedQuantity := req.ProducedQuantity
		if producedQuantity <= 0 {
			producedQuantity = batch.ProducedQuantity
		}
		if producedQuantity <= 0 {
			producedQuantity = batch.PlannedQuantity
		}
		if producedQuantity <= 0 {
			return apperrors.BadRequest("produced_quantity must be greater than zero", nil)
		}
		wastageQuantity := req.WastageQuantity
		if wastageQuantity == 0 && batch.WastageQuantity > 0 {
			wastageQuantity = batch.WastageQuantity
		}
		wastageReason := strings.TrimSpace(req.WastageReason)
		if wastageReason == "" {
			wastageReason = batch.WastageReason
		}
		notes := strings.TrimSpace(req.Notes)
		if notes == "" {
			notes = batch.Notes
		}
		ingredients, err := s.repo.Ingredients(id, currentUser.BusinessID)
		if err != nil {
			return err
		}
		packaging, err := s.repo.Packaging(id, currentUser.BusinessID)
		if err != nil {
			return err
		}
		for _, line := range ingredients {
			if line.ActualQuantity <= 0 {
				return apperrors.BadRequest("all ingredient actual quantities must be greater than zero", map[string]string{"line_id": line.ID})
			}
			movement, err := s.inventoryService.ApplyMovement(tx, inventory.ApplyStockMovementInput{BusinessID: currentUser.BusinessID, InventoryItemID: line.InventoryItemID, MovementType: "production_out", Quantity: line.ActualQuantity, ReferenceType: "production_batch", ReferenceID: &batch.ID, ReferenceNumber: batch.ProductionBatchNumber, Reason: "Production ingredient consumed", CreatedByUserID: currentUser.UserID})
			if err != nil {
				return err
			}
			if err := s.repo.UpdateIngredient(tx, line.ID, id, currentUser.BusinessID, map[string]interface{}{"stock_movement_id": movement.ID, "updated_at": time.Now().UTC()}); err != nil {
				return err
			}
		}
		for _, line := range packaging {
			if line.ActualQuantity <= 0 {
				if line.IsOptional {
					continue
				}
				return apperrors.BadRequest("required packaging actual quantities must be greater than zero", map[string]string{"line_id": line.ID})
			}
			inventoryItem, err := s.inventoryRepo.FindExistingItem(tx, currentUser.BusinessID, batch.BranchID, "packaging", &line.PackagingItemID)
			if err != nil {
				return notFound(err, "packaging inventory item not found")
			}
			if inventoryItem.UnitID != line.UnitID {
				return apperrors.BadRequest("unit conversion is not available yet; packaging unit must match inventory unit", nil)
			}
			movement, err := s.inventoryService.ApplyMovement(tx, inventory.ApplyStockMovementInput{BusinessID: currentUser.BusinessID, InventoryItemID: inventoryItem.ID, MovementType: "production_out", Quantity: line.ActualQuantity, ReferenceType: "production_batch", ReferenceID: &batch.ID, ReferenceNumber: batch.ProductionBatchNumber, Reason: "Production packaging consumed", CreatedByUserID: currentUser.UserID})
			if err != nil {
				return err
			}
			if err := s.repo.UpdatePackaging(tx, line.ID, id, currentUser.BusinessID, map[string]interface{}{"stock_movement_id": movement.ID, "updated_at": time.Now().UTC()}); err != nil {
				return err
			}
		}
		outputItem, err := s.findOrCreateProductInventoryItem(tx, currentUser.BusinessID, batch.BranchID, batch.ProductID, batch.ProductVariantID, batch.YieldUnitID)
		if err != nil {
			return err
		}
		movement, err := s.inventoryService.ApplyMovement(tx, inventory.ApplyStockMovementInput{BusinessID: currentUser.BusinessID, InventoryItemID: outputItem.ID, MovementType: "production_in", Quantity: producedQuantity, ReferenceType: "production_batch", ReferenceID: &batch.ID, ReferenceNumber: batch.ProductionBatchNumber, Reason: "Production finished goods received", CreatedByUserID: currentUser.UserID})
		if err != nil {
			return err
		}
		output := &ProductionOutput{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, ProductionBatchID: batch.ID, ProductID: batch.ProductID, ProductVariantID: batch.ProductVariantID, InventoryItemID: outputItem.ID, ProducedQuantity: producedQuantity, UnitID: batch.YieldUnitID, BatchNumber: strings.TrimSpace(req.BatchNumber), ExpiryDate: expiryDate, StockMovementID: &movement.ID}
		if err := s.repo.CreateOutput(tx, output); err != nil {
			return err
		}
		if expiryDate != nil {
			expiry := &inventory.ExpiryBatch{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, BranchID: batch.BranchID, InventoryItemID: outputItem.ID, BatchNumber: strings.TrimSpace(req.BatchNumber), Quantity: producedQuantity, ExpiryDate: *expiryDate, ReceivedDate: time.Now().UTC(), Status: "active"}
			if err := s.inventoryRepo.CreateExpiryBatch(tx, expiry); err != nil {
				return err
			}
		}
		if err := s.recalculateBatchCosts(tx, currentUser.BusinessID, id); err != nil {
			return err
		}
		ingredientCost, packagingCost, err := s.costTotals(id, currentUser.BusinessID)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		total := roundMoney(ingredientCost + packagingCost)
		if err := s.repo.UpdateBatch(tx, id, currentUser.BusinessID, map[string]interface{}{"status": "completed", "produced_quantity": producedQuantity, "completed_at": now, "completed_by_user_id": currentUser.UserID, "ingredient_cost": ingredientCost, "packaging_cost": packagingCost, "total_production_cost": total, "cost_per_unit": roundQuantity(total / producedQuantity), "wastage_quantity": wastageQuantity, "wastage_reason": wastageReason, "notes": notes, "updated_by_user_id": currentUser.UserID, "updated_at": now}); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "production_batch.completed", id, "Production batch completed", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetBatch(currentUser, id)
}

func (s *Service) CancelBatch(currentUser *utils.AuthContext, id string, req CancelBatchRequest, ipAddress, userAgent string) (*ProductionBatchResponse, error) {
	if strings.TrimSpace(req.Reason) == "" {
		return nil, apperrors.BadRequest("reason is required", nil)
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		batch, err := s.repo.FindBatchForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "production batch not found")
		}
		if !currentUser.CanAccessBranch(batch.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if batch.Status == "completed" {
			return apperrors.BadRequest("completed batches cannot be cancelled", nil)
		}
		if batch.Status == "cancelled" {
			return apperrors.BadRequest("batch is already cancelled", nil)
		}
		now := time.Now().UTC()
		if err := s.repo.UpdateBatch(tx, id, currentUser.BusinessID, map[string]interface{}{"status": "cancelled", "cancelled_at": now, "notes": strings.TrimSpace(req.Reason), "updated_by_user_id": currentUser.UserID, "updated_at": now}); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "production_batch.cancelled", id, "Production batch cancelled", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetBatch(currentUser, id)
}

func (s *Service) DeleteBatch(currentUser *utils.AuthContext, id, ipAddress, userAgent string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		batch, err := s.repo.FindBatchForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "production batch not found")
		}
		if !currentUser.CanAccessBranch(batch.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if batch.Status == "completed" {
			return apperrors.BadRequest("completed batches cannot be deleted because stock movements already exist", nil)
		}
		if err := s.repo.DeleteBatch(tx, id, currentUser.BusinessID); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "production_batch.deleted", id, "Production batch deleted", ipAddress, userAgent)
	})
}

func (s *Service) ListIngredients(currentUser *utils.AuthContext, batchID string) ([]ProductionIngredientResponse, error) {
	batch, err := s.repo.FindBatch(batchID, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "production batch not found")
	}
	if !currentUser.CanAccessBranch(batch.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	lines, err := s.repo.Ingredients(batchID, currentUser.BusinessID)
	return s.ingredientResponses(lines), err
}

func (s *Service) ListPackaging(currentUser *utils.AuthContext, batchID string) ([]ProductionPackagingResponse, error) {
	batch, err := s.repo.FindBatch(batchID, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "production batch not found")
	}
	if !currentUser.CanAccessBranch(batch.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	lines, err := s.repo.Packaging(batchID, currentUser.BusinessID)
	return s.packagingResponses(lines), err
}

func (s *Service) Summary(currentUser *utils.AuthContext, query BatchListQuery) (*ManufacturingSummaryResponse, error) {
	normalizeQuery(&query)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		query.BranchID = branchID
	} else {
		query.BranchID = ""
	}
	return s.repo.Summary(currentUser.BusinessID, query)
}

func (s *Service) ProductHistory(currentUser *utils.AuthContext, productID string) (*ProductHistoryResponse, error) {
	if err := validateUUID(productID, "product_id"); err != nil {
		return nil, err
	}
	branchID, allBranches, err := currentUser.ResolveBranchScope("", "")
	if err != nil {
		return nil, err
	}
	if allBranches {
		branchID, err = currentUser.ResolveOperationalBranch("")
		if err != nil {
			return nil, err
		}
	}
	product, err := s.repo.Product(s.db, currentUser.BusinessID, branchID, productID)
	if err != nil {
		return nil, notFound(err, "product not found")
	}
	result, err := s.ListBatches(currentUser, BatchListQuery{ProductID: productID, Page: 1, Limit: 100, SortBy: "production_date", SortOrder: "desc"})
	if err != nil {
		return nil, err
	}
	response := &ProductHistoryResponse{ProductID: product.ID, ProductName: product.ProductName, ProductionBatches: result.Items}
	for _, batch := range result.Items {
		if batch.Status == "completed" {
			response.TotalProduced += batch.ProducedQuantity
			response.TotalCost += batch.TotalProductionCost
		}
	}
	response.TotalProduced = roundQuantity(response.TotalProduced)
	response.TotalCost = roundMoney(response.TotalCost)
	return response, nil
}

func (s *Service) buildBatch(tx *gorm.DB, currentUser *utils.AuthContext, req CreateBatchRequest) (*ProductionBatch, []ProductionIngredientConsumption, []ProductionPackagingConsumption, error) {
	branchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return nil, nil, nil, err
	}
	req.BranchID = branchID
	if err := validateUUID(req.BranchID, "branch_id"); err != nil {
		return nil, nil, nil, err
	}
	if err := s.repo.ValidateBranch(tx, currentUser.BusinessID, req.BranchID); err != nil {
		return nil, nil, nil, notFound(err, "branch not found")
	}
	if req.PlannedQuantity <= 0 {
		return nil, nil, nil, apperrors.BadRequest("planned_quantity must be greater than zero", nil)
	}
	productionDate, err := parseOptionalDate(req.ProductionDate, time.Now().UTC(), "production_date")
	if err != nil {
		return nil, nil, nil, err
	}
	recipe, err := s.repo.ActiveRecipe(tx, currentUser.BusinessID, req.BranchID, req.RecipeID)
	if err != nil {
		return nil, nil, nil, notFound(err, "active recipe not found")
	}
	ratio := req.PlannedQuantity / recipe.BatchYieldQuantity
	batchID := utils.NewUUID()
	ingredients, err := s.buildIngredientLines(tx, currentUser.BusinessID, batchID, req.BranchID, recipe.ID, ratio)
	if err != nil {
		return nil, nil, nil, err
	}
	packaging, err := s.buildPackagingLines(tx, currentUser.BusinessID, batchID, req.BranchID, recipe.ID, ratio)
	if err != nil {
		return nil, nil, nil, err
	}
	ingredientCost, packagingCost := sumIngredientCost(ingredients), sumPackagingCost(packaging)
	total := roundMoney(ingredientCost + packagingCost)
	batch := &ProductionBatch{ID: batchID, BusinessID: currentUser.BusinessID, BranchID: req.BranchID, RecipeID: recipe.ID, ProductID: recipe.ProductID, ProductVariantID: recipe.ProductVariantID, PlannedQuantity: req.PlannedQuantity, ProducedQuantity: 0, YieldUnitID: recipe.BatchYieldUnitID, Status: "planned", ProductionDate: productionDate, IngredientCost: ingredientCost, PackagingCost: packagingCost, TotalProductionCost: total, CostPerUnit: roundQuantity(total / req.PlannedQuantity), Notes: strings.TrimSpace(req.Notes), CreatedByUserID: currentUser.UserID, UpdatedByUserID: currentUser.UserID}
	return batch, ingredients, packaging, nil
}

func (s *Service) buildIngredientLines(tx *gorm.DB, businessID, batchID, branchID, recipeID string, ratio float64) ([]ProductionIngredientConsumption, error) {
	recipeLines, err := s.repo.RecipeIngredients(tx, businessID, branchID, recipeID)
	if err != nil {
		return nil, err
	}
	lines := make([]ProductionIngredientConsumption, 0, len(recipeLines))
	for _, recipeLine := range recipeLines {
		item, err := s.resolveRecipeIngredientInventoryItem(tx, businessID, branchID, recipeLine)
		if err != nil {
			return nil, err
		}
		if item.UnitID != recipeLine.UnitID {
			return nil, apperrors.BadRequest("unit conversion is not available yet; recipe ingredient unit must match inventory unit", nil)
		}
		planned := roundQuantity(recipeLine.QuantityRequired * ratio)
		actual := planned
		lines = append(lines, ProductionIngredientConsumption{ID: utils.NewUUID(), BusinessID: businessID, ProductionBatchID: batchID, InventoryItemID: item.ID, RecipeIngredientID: recipeLine.ID, ItemNameSnapshot: recipeLine.ItemNameSnapshot, PlannedQuantity: planned, ActualQuantity: actual, UnitID: recipeLine.UnitID, UnitCostSnapshot: recipeLine.UnitCostSnapshot, TotalCost: roundMoney(actual * recipeLine.UnitCostSnapshot), WastageQuantity: roundQuantity(recipeLine.QuantityRequired * ratio * recipeLine.WastagePercentage / 100)})
	}
	return lines, nil
}

func (s *Service) resolveRecipeIngredientInventoryItem(tx *gorm.DB, businessID, branchID string, recipeLine recipeIngredientInfo) (*inventory.InventoryItem, error) {
	if recipeLine.InventoryItemID != nil {
		item, err := s.inventoryRepo.FindInventoryItem(*recipeLine.InventoryItemID, businessID)
		if err != nil {
			return nil, notFound(err, "ingredient inventory item not found")
		}
		if item.BranchID == branchID {
			return item, nil
		}
		branchItem, err := s.inventoryRepo.FindExistingItem(tx, businessID, branchID, item.ItemType, itemIDForInventory(item))
		if err != nil {
			return nil, notFound(err, "branch inventory item not found for recipe ingredient")
		}
		return branchItem, nil
	}
	if recipeLine.IngredientID == nil {
		return nil, apperrors.BadRequest("recipe ingredient must be linked to an ingredient_id or inventory_item_id for manufacturing", map[string]string{"recipe_ingredient_id": recipeLine.ID})
	}
	ingredient, err := s.repo.Ingredient(tx, businessID, branchID, *recipeLine.IngredientID)
	if err != nil {
		return nil, notFound(err, "ingredient not found")
	}
	if ingredient.UnitID != recipeLine.UnitID {
		return nil, apperrors.BadRequest("unit conversion is not available yet; recipe ingredient unit must match ingredient unit", nil)
	}
	item, err := s.inventoryRepo.FindExistingItem(tx, businessID, branchID, "ingredient", recipeLine.IngredientID)
	if err == nil {
		return item, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	inventoryItem := &inventory.InventoryItem{
		ID:                utils.NewUUID(),
		BusinessID:        businessID,
		BranchID:          branchID,
		IngredientID:      recipeLine.IngredientID,
		ItemType:          "ingredient",
		CurrentQuantity:   0,
		ReservedQuantity:  0,
		AvailableQuantity: 0,
		ReorderLevel:      ingredient.ReorderLevel,
		UnitID:            ingredient.UnitID,
		IsExpiryTracked:   ingredient.IsExpiryTracked,
		Status:            "active",
	}
	if err := s.inventoryRepo.CreateInventoryItem(tx, inventoryItem); err != nil {
		return nil, err
	}
	return inventoryItem, nil
}

func (s *Service) buildPackagingLines(tx *gorm.DB, businessID, batchID, branchID, recipeID string, ratio float64) ([]ProductionPackagingConsumption, error) {
	recipeLines, err := s.repo.RecipePackaging(tx, businessID, branchID, recipeID)
	if err != nil {
		return nil, err
	}
	lines := make([]ProductionPackagingConsumption, 0, len(recipeLines))
	for _, recipeLine := range recipeLines {
		planned := roundQuantity(recipeLine.QuantityRequired * ratio)
		actual := planned
		lines = append(lines, ProductionPackagingConsumption{ID: utils.NewUUID(), BusinessID: businessID, ProductionBatchID: batchID, PackagingItemID: recipeLine.PackagingItemID, RecipePackagingID: recipeLine.ID, PackagingNameSnapshot: recipeLine.PackagingNameSnapshot, PlannedQuantity: planned, ActualQuantity: actual, UnitID: recipeLine.UnitID, UnitCostSnapshot: recipeLine.UnitCostSnapshot, TotalCost: roundMoney(actual * recipeLine.UnitCostSnapshot), IsOptional: recipeLine.IsOptional})
	}
	return lines, nil
}

func (s *Service) recalculateBatchCosts(tx *gorm.DB, businessID, batchID string) error {
	ingredientCost, packagingCost, err := s.costTotals(batchID, businessID)
	if err != nil {
		return err
	}
	batch, err := s.repo.FindBatchForUpdate(tx, batchID, businessID)
	if err != nil {
		return err
	}
	total := roundMoney(ingredientCost + packagingCost)
	denominator := batch.PlannedQuantity
	if batch.ProducedQuantity > 0 {
		denominator = batch.ProducedQuantity
	}
	return s.repo.UpdateBatch(tx, batchID, businessID, map[string]interface{}{"ingredient_cost": ingredientCost, "packaging_cost": packagingCost, "total_production_cost": total, "cost_per_unit": roundQuantity(total / denominator), "updated_at": time.Now().UTC()})
}

func (s *Service) costTotals(batchID, businessID string) (float64, float64, error) {
	ingredients, err := s.repo.Ingredients(batchID, businessID)
	if err != nil {
		return 0, 0, err
	}
	packaging, err := s.repo.Packaging(batchID, businessID)
	if err != nil {
		return 0, 0, err
	}
	return sumIngredientCost(ingredients), sumPackagingCost(packaging), nil
}

func (s *Service) findOrCreateProductInventoryItem(tx *gorm.DB, businessID, branchID, productID string, productVariantID *string, unitID string) (*inventory.InventoryItem, error) {
	itemID := productID
	itemType := "product"
	if productVariantID != nil {
		itemType = "product_variant"
	}
	item, err := s.inventoryRepo.FindExistingItem(tx, businessID, branchID, itemType, &itemID, productVariantID)
	if err == nil {
		if item.UnitID != unitID {
			return nil, apperrors.BadRequest("unit conversion is not available yet; output unit must match product inventory unit", nil)
		}
		return item, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	product, err := s.repo.Product(tx, businessID, branchID, productID)
	if err != nil {
		return nil, notFound(err, "product not found")
	}
	if variant, err := s.repo.ProductVariant(tx, businessID, branchID, productID, productVariantID); err != nil {
		return nil, notFound(err, "product variant not found")
	} else if variant != nil && variant.Status != "active" {
		return nil, apperrors.BadRequest("product variant must be active", nil)
	}
	productIDPtr := productID
	item = &inventory.InventoryItem{ID: utils.NewUUID(), BusinessID: businessID, BranchID: branchID, ProductID: &productIDPtr, ProductVariantID: productVariantID, ItemType: itemType, CurrentQuantity: 0, ReservedQuantity: 0, AvailableQuantity: 0, ReorderLevel: 0, UnitID: unitID, IsExpiryTracked: product.IsExpiryTracked, Status: "active"}
	if err := s.inventoryRepo.CreateInventoryItem(tx, item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) batchResponse(businessID string, batch ProductionBatch, includeDetails bool) ProductionBatchResponse {
	branchName, recipeName, productName, productVariantName, createdByName := s.repo.NameLookups(businessID, batch)
	response := ProductionBatchResponse{ID: batch.ID, BusinessID: batch.BusinessID, BranchID: batch.BranchID, BranchName: branchName, RecipeID: batch.RecipeID, RecipeName: recipeName, ProductID: batch.ProductID, ProductName: productName, ProductVariantID: batch.ProductVariantID, ProductVariantName: productVariantName, ProductionBatchNumber: batch.ProductionBatchNumber, PlannedQuantity: roundQuantity(batch.PlannedQuantity), ProducedQuantity: roundQuantity(batch.ProducedQuantity), YieldUnitID: batch.YieldUnitID, YieldUnitSymbol: s.repo.UnitSymbol(batch.YieldUnitID), Status: batch.Status, ProductionDate: batch.ProductionDate, StartedAt: batch.StartedAt, CompletedAt: batch.CompletedAt, CancelledAt: batch.CancelledAt, IngredientCost: roundMoney(batch.IngredientCost), PackagingCost: roundMoney(batch.PackagingCost), TotalProductionCost: roundMoney(batch.TotalProductionCost), CostPerUnit: roundQuantity(batch.CostPerUnit), WastageQuantity: roundQuantity(batch.WastageQuantity), WastageReason: batch.WastageReason, Notes: batch.Notes, CreatedByUserID: batch.CreatedByUserID, CreatedByUserName: createdByName, CompletedByUserID: batch.CompletedByUserID, CreatedAt: batch.CreatedAt, UpdatedAt: batch.UpdatedAt}
	if includeDetails {
		ingredients, _ := s.repo.Ingredients(batch.ID, businessID)
		packaging, _ := s.repo.Packaging(batch.ID, businessID)
		response.Ingredients = s.ingredientResponses(ingredients)
		response.Packaging = s.packagingResponses(packaging)
		for _, line := range response.Ingredients {
			if line.StockMovementID != nil {
				response.StockMovementIDs = append(response.StockMovementIDs, *line.StockMovementID)
			}
		}
		for _, line := range response.Packaging {
			if line.StockMovementID != nil {
				response.StockMovementIDs = append(response.StockMovementIDs, *line.StockMovementID)
			}
		}
		if output, err := s.repo.Output(batch.ID, businessID); err == nil && output != nil {
			dto := s.outputResponse(*output)
			response.Output = &dto
			if output.StockMovementID != nil {
				response.StockMovementIDs = append(response.StockMovementIDs, *output.StockMovementID)
			}
		}
	}
	return response
}

func (s *Service) ingredientResponses(items []ProductionIngredientConsumption) []ProductionIngredientResponse {
	result := make([]ProductionIngredientResponse, 0, len(items))
	for _, item := range items {
		result = append(result, ProductionIngredientResponse{ID: item.ID, InventoryItemID: item.InventoryItemID, RecipeIngredientID: item.RecipeIngredientID, ItemNameSnapshot: item.ItemNameSnapshot, PlannedQuantity: roundQuantity(item.PlannedQuantity), ActualQuantity: roundQuantity(item.ActualQuantity), UnitID: item.UnitID, UnitSymbol: s.repo.UnitSymbol(item.UnitID), UnitCostSnapshot: roundMoney(item.UnitCostSnapshot), TotalCost: roundMoney(item.TotalCost), WastageQuantity: roundQuantity(item.WastageQuantity), StockMovementID: item.StockMovementID, CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt})
	}
	return result
}

func (s *Service) packagingResponses(items []ProductionPackagingConsumption) []ProductionPackagingResponse {
	result := make([]ProductionPackagingResponse, 0, len(items))
	for _, item := range items {
		result = append(result, ProductionPackagingResponse{ID: item.ID, PackagingItemID: item.PackagingItemID, RecipePackagingID: item.RecipePackagingID, PackagingNameSnapshot: item.PackagingNameSnapshot, PlannedQuantity: roundQuantity(item.PlannedQuantity), ActualQuantity: roundQuantity(item.ActualQuantity), UnitID: item.UnitID, UnitSymbol: s.repo.UnitSymbol(item.UnitID), UnitCostSnapshot: roundMoney(item.UnitCostSnapshot), TotalCost: roundMoney(item.TotalCost), IsOptional: item.IsOptional, StockMovementID: item.StockMovementID, CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt})
	}
	return result
}

func (s *Service) outputResponse(output ProductionOutput) ProductionOutputResponse {
	var variantName string
	if output.ProductVariantID != nil {
		_ = s.db.Table("product_variants").Select("variant_name").Where("id = ? AND business_id = ?", *output.ProductVariantID, output.BusinessID).Scan(&variantName).Error
	}
	return ProductionOutputResponse{ID: output.ID, ProductID: output.ProductID, ProductVariantID: output.ProductVariantID, ProductVariantName: variantName, InventoryItemID: output.InventoryItemID, ProducedQuantity: roundQuantity(output.ProducedQuantity), UnitID: output.UnitID, UnitSymbol: s.repo.UnitSymbol(output.UnitID), BatchNumber: output.BatchNumber, ExpiryDate: output.ExpiryDate, StockMovementID: output.StockMovementID, CreatedAt: output.CreatedAt, UpdatedAt: output.UpdatedAt}
}

func (s *Service) audit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	return s.auditRepo.CreateActivity(tx, audit.ActivityInput{BusinessID: currentUser.BusinessID, ActorUserID: currentUser.UserID, EventType: eventType, EntityType: "manufacturing", EntityID: entityID, Summary: summary, IPAddress: ipAddress, UserAgent: userAgent})
}

func normalizeQuery(query *BatchListQuery) {
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

func validateListQuery(query BatchListQuery) error {
	for field, value := range map[string]string{"branch_id": query.BranchID, "product_id": query.ProductID, "recipe_id": query.RecipeID} {
		if strings.TrimSpace(value) != "" {
			if err := validateUUID(value, field); err != nil {
				return err
			}
		}
	}
	if query.Status != "" && !validStatus(query.Status) {
		return apperrors.BadRequest("invalid status", nil)
	}
	return nil
}

func batchCanEditConsumption(status string) bool {
	return status == "draft" || status == "planned" || status == "in_progress"
}

func validStatus(value string) bool {
	return value == "draft" || value == "planned" || value == "in_progress" || value == "completed" || value == "cancelled"
}

func parseDate(value, field string) (time.Time, error) {
	normalized := strings.TrimSpace(value)
	for _, layout := range []string{"2006-01-02", time.RFC3339, "2006-01-02T15:04:05.000Z", "2006-01-02T15:04:05"} {
		parsed, err := time.Parse(layout, normalized)
		if err == nil {
			return dateOnly(parsed), nil
		}
	}
	return time.Time{}, apperrors.BadRequest(field+" must use YYYY-MM-DD format", nil)
}

func parseOptionalDate(value string, fallback time.Time, field string) (time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return dateOnly(fallback), nil
	}
	return parseDate(value, field)
}

func dateOnly(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func validateUUID(value, field string) error {
	if _, err := uuid.Parse(strings.TrimSpace(value)); err != nil {
		return apperrors.BadRequest(field+" must be a valid UUID", nil)
	}
	return nil
}

func itemIDForInventory(item *inventory.InventoryItem) *string {
	if item.ProductID != nil {
		return item.ProductID
	}
	if item.IngredientID != nil {
		return item.IngredientID
	}
	return item.PackagingItemID
}

func sumIngredientCost(items []ProductionIngredientConsumption) float64 {
	total := 0.0
	for _, item := range items {
		total += item.TotalCost
	}
	return roundMoney(total)
}

func sumPackagingCost(items []ProductionPackagingConsumption) float64 {
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
