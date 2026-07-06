package inventory

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/inventory/expirystate"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db                *gorm.DB
	repo              *Repository
	auditRepo         *audit.Repository
	accountingService *accounting.Service
}

func NewService(db *gorm.DB, repo *Repository, auditRepo *audit.Repository, accountingService ...*accounting.Service) *Service {
	service := &Service{db: db, repo: repo, auditRepo: auditRepo}
	if len(accountingService) > 0 {
		service.accountingService = accountingService[0]
	}
	return service
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
	if query.IncludeUninitialized {
		responses, total, err := s.repo.ListInventoryWithUninitializedResponses(currentUser.BusinessID, query)
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

func (s *Service) ListStockLocations(currentUser *utils.AuthContext, query StockLocationListQuery) (*PaginatedStockLocationResponse, error) {
	normalizeStockLocationListQuery(&query)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		query.BranchID = branchID
	} else {
		query.BranchID = ""
	}
	if query.Status != "" && query.Status != "active" && query.Status != "inactive" {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	if query.LocationType != "" && !validStockLocationType(query.LocationType) {
		return nil, apperrors.BadRequest("invalid location_type", nil)
	}
	locations, total, err := s.repo.ListStockLocations(currentUser.BusinessID, query)
	if err != nil {
		return nil, err
	}
	return &PaginatedStockLocationResponse{
		Items: s.repo.LoadStockLocationResponses(locations),
		Pagination: Pagination{
			Page:       query.Page,
			Limit:      query.Limit,
			Total:      total,
			TotalPages: totalPages(total, query.Limit),
		},
	}, nil
}

func (s *Service) GetStockLocation(currentUser *utils.AuthContext, id string) (*StockLocationResponse, error) {
	location, err := s.repo.FindStockLocation(id, currentUser.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "stock location not found")
	}
	if !currentUser.CanAccessBranch(location.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	dto := s.repo.LoadStockLocationResponse(*location)
	return &dto, nil
}

func (s *Service) CreateStockLocation(currentUser *utils.AuthContext, req StockLocationRequest, ipAddress, userAgent string) (*StockLocationResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return nil, err
	}
	if err := s.validateStockLocationRequest(currentUser.BusinessID, branchID, req); err != nil {
		return nil, err
	}
	code := strings.ToUpper(strings.TrimSpace(req.LocationCode))
	exists, err := s.repo.StockLocationCodeExists(currentUser.BusinessID, branchID, code, "")
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, apperrors.Conflict("stock location code already exists", nil)
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "active"
	}
	location := StockLocation{
		ID:              utils.NewUUID(),
		BusinessID:      currentUser.BusinessID,
		BranchID:        branchID,
		LocationName:    strings.TrimSpace(req.LocationName),
		LocationCode:    code,
		LocationType:    strings.TrimSpace(req.LocationType),
		Description:     strings.TrimSpace(req.Description),
		IsDefault:       req.IsDefault,
		Status:          status,
		CreatedByUserID: currentUser.UserID,
	}
	var response *StockLocationResponse
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if req.IsDefault {
			if err := s.repo.UnsetDefaultStockLocations(tx, currentUser.BusinessID, branchID); err != nil {
				return err
			}
		}
		if err := s.repo.CreateStockLocation(tx, &location); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "stock_location.created", location.ID, "Stock location created", ipAddress, userAgent); err != nil {
			return err
		}
		dto := s.repo.LoadStockLocationResponse(location)
		response = &dto
		return nil
	})
	return response, err
}

func (s *Service) UpdateStockLocation(currentUser *utils.AuthContext, id string, req UpdateStockLocationRequest, ipAddress, userAgent string) (*StockLocationResponse, error) {
	location, err := s.repo.FindStockLocation(id, currentUser.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "stock location not found")
	}
	if !currentUser.CanAccessBranch(location.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	updates := map[string]interface{}{"updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
	if req.LocationName != nil {
		name := strings.TrimSpace(*req.LocationName)
		if name == "" {
			return nil, apperrors.BadRequest("location_name is required", nil)
		}
		updates["location_name"] = name
	}
	if req.LocationCode != nil {
		code := strings.ToUpper(strings.TrimSpace(*req.LocationCode))
		if code == "" {
			return nil, apperrors.BadRequest("location_code is required", nil)
		}
		exists, err := s.repo.StockLocationCodeExists(currentUser.BusinessID, location.BranchID, code, id)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, apperrors.Conflict("stock location code already exists", nil)
		}
		updates["location_code"] = code
	}
	if req.LocationType != nil {
		locationType := strings.TrimSpace(*req.LocationType)
		if locationType != "" && !validStockLocationType(locationType) {
			return nil, apperrors.BadRequest("invalid location_type", nil)
		}
		updates["location_type"] = locationType
	}
	if req.Description != nil {
		updates["description"] = strings.TrimSpace(*req.Description)
	}
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.UpdateStockLocation(tx, id, currentUser.BusinessID, updates); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "stock_location.updated", id, "Stock location updated", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	updated, err := s.repo.FindStockLocation(id, currentUser.BusinessID)
	if err != nil {
		return nil, err
	}
	dto := s.repo.LoadStockLocationResponse(*updated)
	return &dto, nil
}

func (s *Service) UpdateStockLocationStatus(currentUser *utils.AuthContext, id string, req UpdateStockLocationStatusRequest, ipAddress, userAgent string) (*StockLocationResponse, error) {
	if req.Status != "active" && req.Status != "inactive" {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	location, err := s.repo.FindStockLocation(id, currentUser.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "stock location not found")
	}
	if !currentUser.CanAccessBranch(location.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	if req.Status == "inactive" {
		hasStock, err := s.repo.StockLocationHasStock(s.db, currentUser.BusinessID, id)
		if err != nil {
			return nil, err
		}
		if hasStock {
			return nil, apperrors.BadRequest("cannot deactivate location with stock", nil)
		}
	}
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.UpdateStockLocation(tx, id, currentUser.BusinessID, map[string]interface{}{"status": req.Status, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "stock_location.status_updated", id, "Stock location status updated", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	updated, err := s.repo.FindStockLocation(id, currentUser.BusinessID)
	if err != nil {
		return nil, err
	}
	dto := s.repo.LoadStockLocationResponse(*updated)
	return &dto, nil
}

func (s *Service) SetDefaultStockLocation(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*StockLocationResponse, error) {
	location, err := s.repo.FindStockLocation(id, currentUser.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "stock location not found")
	}
	if !currentUser.CanAccessBranch(location.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	if location.Status != "active" {
		return nil, apperrors.BadRequest("cannot set inactive location as default", nil)
	}
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.UnsetDefaultStockLocations(tx, currentUser.BusinessID, location.BranchID); err != nil {
			return err
		}
		if err := s.repo.UpdateStockLocation(tx, id, currentUser.BusinessID, map[string]interface{}{"is_default": true, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "stock_location.default_updated", id, "Default stock location updated", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	updated, err := s.repo.FindStockLocation(id, currentUser.BusinessID)
	if err != nil {
		return nil, err
	}
	dto := s.repo.LoadStockLocationResponse(*updated)
	return &dto, nil
}

func (s *Service) DeleteStockLocation(currentUser *utils.AuthContext, id, ipAddress, userAgent string) error {
	location, err := s.repo.FindStockLocation(id, currentUser.BusinessID)
	if err != nil {
		return mapNotFound(err, "stock location not found")
	}
	if !currentUser.CanAccessBranch(location.BranchID) {
		return apperrors.Forbidden("branch access denied")
	}
	if location.IsDefault {
		return apperrors.BadRequest("cannot delete default location", nil)
	}
	hasStock, err := s.repo.StockLocationHasStock(s.db, currentUser.BusinessID, id)
	if err != nil {
		return err
	}
	if hasStock {
		return apperrors.BadRequest("cannot delete location with stock", nil)
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.DeleteStockLocation(tx, id, currentUser.BusinessID); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "stock_location.deleted", id, "Stock location deleted", ipAddress, userAgent)
	})
}

func (s *Service) ListLocationBalances(currentUser *utils.AuthContext, query LocationBalanceListQuery) (*PaginatedLocationBalanceResponse, error) {
	normalizeLocationBalanceListQuery(&query)
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
	if err := validateOptionalUUID(query.StockLocationID, "stock_location_id"); err != nil {
		return nil, err
	}
	items, total, err := s.repo.ListLocationBalances(currentUser.BusinessID, query)
	if err != nil {
		return nil, err
	}
	return &PaginatedLocationBalanceResponse{
		Items: items,
		Pagination: Pagination{
			Page:       query.Page,
			Limit:      query.Limit,
			Total:      total,
			TotalPages: totalPages(total, query.Limit),
		},
	}, nil
}

func (s *Service) GetInventoryItemLocationBalances(currentUser *utils.AuthContext, inventoryItemID string) (*InventoryItemLocationBreakdownResponse, error) {
	item, err := s.repo.FindInventoryItem(inventoryItemID, currentUser.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "inventory item not found")
	}
	if !currentUser.CanAccessBranch(item.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	var branchName string
	_ = s.db.Table("branches").Select("branch_name").Where("id = ? AND business_id = ?", item.BranchID, currentUser.BusinessID).Scan(&branchName).Error
	itemName, _, _, _ := s.repo.loadItemIdentity(currentUser.BusinessID, *item)
	locations, err := s.repo.ItemLocationBreakdown(currentUser.BusinessID, inventoryItemID)
	if err != nil {
		return nil, err
	}
	return &InventoryItemLocationBreakdownResponse{
		InventoryItemID:     item.ID,
		ItemName:            itemName,
		ItemType:            item.ItemType,
		BranchID:            item.BranchID,
		BranchName:          branchName,
		BranchTotalQuantity: roundQuantity(item.CurrentQuantity),
		Locations:           locations,
	}, nil
}

func (s *Service) ListStockTransfers(currentUser *utils.AuthContext, query StockTransferListQuery) (*PaginatedStockTransferResponse, error) {
	normalizeStockTransferListQuery(&query)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		query.BranchID = branchID
	} else {
		query.BranchID = ""
	}
	if err := validateOptionalUUID(query.InventoryItemID, "inventory_item_id"); err != nil {
		return nil, err
	}
	if query.Status != "" && query.Status != "draft" && query.Status != "completed" && query.Status != "cancelled" {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	transfers, total, err := s.repo.ListStockTransfers(currentUser.BusinessID, query)
	if err != nil {
		return nil, err
	}
	items, err := s.repo.LoadStockTransferResponses(transfers)
	if err != nil {
		return nil, err
	}
	return &PaginatedStockTransferResponse{
		Items: items,
		Pagination: Pagination{
			Page:       query.Page,
			Limit:      query.Limit,
			Total:      total,
			TotalPages: totalPages(total, query.Limit),
		},
	}, nil
}

func (s *Service) GetStockTransfer(currentUser *utils.AuthContext, id string) (*StockTransferResponse, error) {
	transfer, err := s.repo.FindStockTransfer(id, currentUser.BusinessID)
	if err != nil {
		return nil, mapNotFound(err, "stock transfer not found")
	}
	if !currentUser.CanAccessBranch(transfer.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	dto, err := s.repo.LoadStockTransferResponse(*transfer)
	return &dto, err
}

func (s *Service) CreateStockTransfer(currentUser *utils.AuthContext, req StockTransferRequest, ipAddress, userAgent string) (*StockTransferResponse, error) {
	if err := s.validateStockTransferRequest(currentUser, req); err != nil {
		return nil, err
	}
	var response *StockTransferResponse
	err := s.db.Transaction(func(tx *gorm.DB) error {
		item, err := s.repo.FindInventoryItem(req.InventoryItemID, currentUser.BusinessID)
		if err != nil {
			return mapNotFound(err, "inventory item not found")
		}
		number, err := s.repo.NextStockTransferNumber(tx, currentUser.BusinessID)
		if err != nil {
			return err
		}
		transfer := StockTransfer{
			ID:                  utils.NewUUID(),
			BusinessID:          currentUser.BusinessID,
			BranchID:            item.BranchID,
			TransferNumber:      number,
			InventoryItemID:     item.ID,
			FromStockLocationID: req.FromStockLocationID,
			ToStockLocationID:   req.ToStockLocationID,
			Quantity:            req.Quantity,
			UnitID:              item.UnitID,
			Reason:              strings.TrimSpace(req.Reason),
			Notes:               strings.TrimSpace(req.Notes),
			Status:              "draft",
			CreatedByUserID:     currentUser.UserID,
		}
		if err := s.repo.CreateStockTransfer(tx, &transfer); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "stock_transfer.created", transfer.ID, "Stock transfer created", ipAddress, userAgent); err != nil {
			return err
		}
		dto, err := s.repo.LoadStockTransferResponse(transfer)
		if err != nil {
			return err
		}
		response = &dto
		return nil
	})
	return response, err
}

func (s *Service) CompleteStockTransfer(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*StockTransferResponse, error) {
	var response *StockTransferResponse
	err := s.db.Transaction(func(tx *gorm.DB) error {
		transfer, err := s.repo.FindStockTransferForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return mapNotFound(err, "stock transfer not found")
		}
		if !currentUser.CanAccessBranch(transfer.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if transfer.Status != "draft" {
			return apperrors.BadRequest("only draft transfers can be completed", nil)
		}
		source, err := s.repo.FindLocationBalanceForUpdate(tx, currentUser.BusinessID, transfer.InventoryItemID, transfer.FromStockLocationID)
		if err != nil {
			return mapNotFound(err, "source location has no stock balance")
		}
		if source.AvailableQuantity < transfer.Quantity {
			return apperrors.BadRequest("source location has insufficient available stock", nil)
		}
		target, err := s.repo.FindLocationBalanceForUpdate(tx, currentUser.BusinessID, transfer.InventoryItemID, transfer.ToStockLocationID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			target = &InventoryLocationBalance{
				ID:                utils.NewUUID(),
				BusinessID:        currentUser.BusinessID,
				BranchID:          transfer.BranchID,
				InventoryItemID:   transfer.InventoryItemID,
				StockLocationID:   transfer.ToStockLocationID,
				CurrentQuantity:   0,
				ReservedQuantity:  0,
				AvailableQuantity: 0,
			}
			if err := s.repo.CreateLocationBalance(tx, target); err != nil {
				return err
			}
		} else if err != nil {
			return err
		}
		source.CurrentQuantity = roundQuantity(source.CurrentQuantity - transfer.Quantity)
		source.AvailableQuantity = roundQuantity(source.CurrentQuantity - source.ReservedQuantity)
		target.CurrentQuantity = roundQuantity(target.CurrentQuantity + transfer.Quantity)
		target.AvailableQuantity = roundQuantity(target.CurrentQuantity - target.ReservedQuantity)
		if err := s.repo.UpdateLocationBalance(tx, source); err != nil {
			return err
		}
		if err := s.repo.UpdateLocationBalance(tx, target); err != nil {
			return err
		}
		now := time.Now().UTC()
		if err := s.repo.UpdateStockTransfer(tx, transfer.ID, currentUser.BusinessID, map[string]interface{}{"status": "completed", "completed_by_user_id": currentUser.UserID, "completed_at": now, "updated_at": now}); err != nil {
			return err
		}
		item, err := s.repo.FindInventoryItem(transfer.InventoryItemID, currentUser.BusinessID)
		if err != nil {
			return err
		}
		fromID, toID := transfer.FromStockLocationID, transfer.ToStockLocationID
		movement := StockMovement{
			ID:                  utils.NewUUID(),
			BusinessID:          transfer.BusinessID,
			BranchID:            transfer.BranchID,
			InventoryItemID:     transfer.InventoryItemID,
			FromStockLocationID: &fromID,
			ToStockLocationID:   &toID,
			ItemType:            item.ItemType,
			MovementType:        "transfer",
			MovementDirection:   "transfer",
			Quantity:            transfer.Quantity,
			BeforeQuantity:      item.CurrentQuantity,
			AfterQuantity:       item.CurrentQuantity,
			UnitID:              transfer.UnitID,
			ReferenceType:       "stock_transfer",
			ReferenceID:         &transfer.ID,
			ReferenceNumber:     transfer.TransferNumber,
			Reason:              transfer.Reason,
			Notes:               transfer.Notes,
			CreatedByUserID:     currentUser.UserID,
		}
		if err := s.repo.CreateStockMovement(tx, &movement); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "stock_transfer.completed", transfer.ID, "Stock transfer completed", ipAddress, userAgent); err != nil {
			return err
		}
		updated, err := s.repo.FindStockTransfer(transfer.ID, currentUser.BusinessID)
		if err != nil {
			return err
		}
		dto, err := s.repo.LoadStockTransferResponse(*updated)
		if err != nil {
			return err
		}
		response = &dto
		return nil
	})
	return response, err
}

func (s *Service) CancelStockTransfer(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*StockTransferResponse, error) {
	var response *StockTransferResponse
	err := s.db.Transaction(func(tx *gorm.DB) error {
		transfer, err := s.repo.FindStockTransferForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return mapNotFound(err, "stock transfer not found")
		}
		if !currentUser.CanAccessBranch(transfer.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if transfer.Status != "draft" {
			return apperrors.BadRequest("only draft transfers can be cancelled", nil)
		}
		now := time.Now().UTC()
		if err := s.repo.UpdateStockTransfer(tx, transfer.ID, currentUser.BusinessID, map[string]interface{}{"status": "cancelled", "cancelled_at": now, "updated_at": now}); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "stock_transfer.cancelled", transfer.ID, "Stock transfer cancelled", ipAddress, userAgent); err != nil {
			return err
		}
		updated, err := s.repo.FindStockTransfer(transfer.ID, currentUser.BusinessID)
		if err != nil {
			return err
		}
		dto, err := s.repo.LoadStockTransferResponse(*updated)
		if err != nil {
			return err
		}
		response = &dto
		return nil
	})
	return response, err
}

func (s *Service) CreateOpeningStock(currentUser *utils.AuthContext, req OpeningStockRequest, ipAddress, userAgent string) (*InventoryItemResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return nil, err
	}
	req.BranchID = branchID
	req.ItemType = normalizeOpeningStockItemType(req)
	if err := s.validateOpeningStock(currentUser.BusinessID, req); err != nil {
		return nil, err
	}

	var response *InventoryItemResponse
	err = s.db.Transaction(func(tx *gorm.DB) error {
		itemID := itemIDForRequest(req)
		item, err := s.repo.FindExistingItem(tx, currentUser.BusinessID, req.BranchID, req.ItemType, itemID, variantIDForRequest(req))
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if errors.Is(err, gorm.ErrRecordNotFound) {
			item = &InventoryItem{
				ID:                utils.NewUUID(),
				BusinessID:        currentUser.BusinessID,
				BranchID:          req.BranchID,
				ProductID:         nullableString(req.ProductID),
				ProductVariantID:  nullableString(req.ProductVariantID),
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
			StockLocationID: nullableString(req.StockLocationID),
			MovementType:    "opening_stock",
			Quantity:        req.Quantity,
			UnitCost:        req.UnitCost,
			ReferenceType:   "opening_stock",
			Reason:          req.Reason,
			CreatedByUserID: currentUser.UserID,
		})
		if err != nil {
			return err
		}
		if s.accountingService != nil {
			if _, err := s.accountingService.PostInventoryMovementJournal(tx, currentUser, movement.ID); err != nil {
				return err
			}
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
		if s.accountingService != nil {
			if _, err := s.accountingService.PostInventoryMovementJournal(tx, currentUser, movement.ID); err != nil {
				return err
			}
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
			UnitCost:        req.UnitCost,
			ReferenceType:   "manual_adjustment",
			Reason:          req.Reason,
			Notes:           req.Notes,
			CreatedByUserID: currentUser.UserID,
		})
		if err != nil {
			return err
		}
		if s.accountingService != nil {
			if _, err := s.accountingService.PostInventoryMovementJournal(tx, currentUser, movement.ID); err != nil {
				return err
			}
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
		if s.accountingService != nil {
			if _, err := s.accountingService.PostInventoryMovementJournal(tx, currentUser, movement.ID); err != nil {
				return err
			}
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

func (s *Service) ExpiryAlerts(currentUser *utils.AuthContext, query ExpiryAlertQuery) ([]ExpiryBatchResponse, error) {
	if query.Days <= 0 || query.Days > 365 {
		query.Days = 7
	}
	itemType := normalizeAllFilter(query.ItemType)
	if itemType != "" && itemType != "product" && itemType != "product_variant" && itemType != "ingredient" && itemType != "packaging" {
		return nil, apperrors.BadRequest("invalid item_type", nil)
	}
	productType := normalizeAllFilter(query.ProductType)
	status := normalizeAllFilter(query.Status)
	if status != "" && status != "active" && status != "expired" && status != "depleted" {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	expiryState := normalizeAllFilter(query.ExpiryState)
	if !expirystate.IsValidFilter(expiryState) {
		return nil, apperrors.BadRequest("invalid expiry_state", nil)
	}
	resolvedBranchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	branchID := ""
	if !allBranches {
		branchID = resolvedBranchID
	}
	timezone := strings.TrimSpace(query.Timezone)
	if timezone == "" {
		timezone, err = s.repo.BusinessTimezone(currentUser.BusinessID)
		if err != nil {
			return nil, apperrors.Internal("failed to resolve business timezone")
		}
	}
	location, _, err := expirystate.ResolveTimezone(timezone)
	if err != nil {
		return nil, apperrors.BadRequest("invalid timezone", map[string]string{"timezone": timezone})
	}
	today := expirystate.LocalDate(time.Now(), location)
	batches, err := s.repo.ExpiryAlerts(currentUser.BusinessID, branchID, itemType, productType, status, today, query.Days)
	if err != nil {
		return nil, err
	}
	return toExpiryAlertResponses(batches, today, expiryState), nil
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
	if !validOpeningStockItemType(req.ItemType) {
		return apperrors.BadRequest("invalid item_type", nil)
	}
	if req.Quantity < 0 {
		return apperrors.BadRequest("quantity must be greater than or equal to zero", nil)
	}
	if req.Quantity == 0 {
		return apperrors.BadRequest("quantity must be greater than zero for opening stock movement", nil)
	}
	if req.UnitCost <= 0 {
		return apperrors.BadRequest("unit_cost must be greater than zero for opening stock valuation", nil)
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
	if req.StockLocationID != "" {
		if err := validateUUID(req.StockLocationID, "stock_location_id"); err != nil {
			return err
		}
		location, err := s.repo.FindStockLocation(req.StockLocationID, businessID)
		if err != nil {
			return mapNotFound(err, "stock location not found")
		}
		if location.BranchID != req.BranchID || location.Status != "active" {
			return apperrors.BadRequest("stock location must be active and belong to the selected branch", nil)
		}
	}
	switch req.ItemType {
	case "product":
		if err := validateUUID(req.ProductID, "product_id"); err != nil {
			return err
		}
		if err := s.repo.ValidateStockTrackedProduct(businessID, req.BranchID, req.ProductID); err != nil {
			return mapNotFound(err, "product not found")
		}
	case "product_variant":
		if err := validateUUID(req.ProductID, "product_id"); err != nil {
			return err
		}
		if err := validateUUID(req.ProductVariantID, "product_variant_id"); err != nil {
			return err
		}
		if err := s.repo.ValidateProductVariant(businessID, req.BranchID, req.ProductID, req.ProductVariantID); err != nil {
			return mapNotFound(err, "product variant not found")
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
	stockLocationID, err := s.resolveMovementStockLocation(tx, item, input.StockLocationID, input.CreatedByUserID)
	if err != nil {
		return nil, err
	}
	before := item.CurrentQuantity
	beforeValue := item.InventoryValue
	beforeAverageCost := item.AverageUnitCost
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
	unitCostSnapshot, totalCost, averageUnitCost, inventoryValue := calculateValuation(direction, before, beforeValue, beforeAverageCost, input.Quantity, input.UnitCost)
	if err := s.repo.UpdateInventoryItem(tx, item.ID, input.BusinessID, map[string]interface{}{
		"current_quantity":   after,
		"available_quantity": available,
		"average_unit_cost":  averageUnitCost,
		"inventory_value":    inventoryValue,
		"updated_at":         time.Now().UTC(),
	}); err != nil {
		return nil, err
	}
	if err := s.applyLocationMovement(tx, item, stockLocationID, direction, input.Quantity); err != nil {
		return nil, err
	}
	movement := &StockMovement{
		ID:                  utils.NewUUID(),
		BusinessID:          item.BusinessID,
		BranchID:            item.BranchID,
		InventoryItemID:     item.ID,
		StockLocationID:     stockLocationID,
		FromStockLocationID: input.FromStockLocationID,
		ToStockLocationID:   input.ToStockLocationID,
		ItemType:            item.ItemType,
		MovementType:        input.MovementType,
		MovementDirection:   direction,
		Quantity:            input.Quantity,
		BeforeQuantity:      before,
		AfterQuantity:       after,
		UnitCostSnapshot:    unitCostSnapshot,
		TotalCost:           totalCost,
		ValuationMethod:     "weighted_average",
		UnitID:              item.UnitID,
		ReferenceType:       strings.TrimSpace(input.ReferenceType),
		ReferenceID:         input.ReferenceID,
		ReferenceNumber:     strings.TrimSpace(input.ReferenceNumber),
		Reason:              strings.TrimSpace(input.Reason),
		Notes:               strings.TrimSpace(input.Notes),
		IsReversal:          input.IsReversal,
		ReversedMovementID:  input.ReversedMovementID,
		CreatedByUserID:     input.CreatedByUserID,
	}
	if err := s.repo.CreateStockMovement(tx, movement); err != nil {
		return nil, err
	}
	return movement, nil
}

func (s *Service) resolveMovementStockLocation(tx *gorm.DB, item *InventoryItem, requestedLocationID *string, createdByUserID string) (*string, error) {
	if requestedLocationID != nil && strings.TrimSpace(*requestedLocationID) != "" {
		location, err := s.repo.FindStockLocation(strings.TrimSpace(*requestedLocationID), item.BusinessID)
		if err != nil {
			return nil, mapNotFound(err, "stock location not found")
		}
		if location.BranchID != item.BranchID || location.Status != "active" {
			return nil, apperrors.BadRequest("stock location must be active and belong to the inventory item branch", nil)
		}
		locationID := location.ID
		return &locationID, nil
	}
	location, err := s.repo.EnsureDefaultStockLocation(tx, item.BusinessID, item.BranchID, createdByUserID)
	if err != nil {
		return nil, apperrors.Internal("failed to create default stock location for branch")
	}
	locationID := location.ID
	return &locationID, nil
}

func (s *Service) applyLocationMovement(tx *gorm.DB, item *InventoryItem, stockLocationID *string, direction string, quantity float64) error {
	if stockLocationID == nil || direction == "neutral" || direction == "transfer" {
		return nil
	}
	balance, err := s.repo.FindLocationBalanceForUpdate(tx, item.BusinessID, item.ID, *stockLocationID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if direction == "out" {
			return apperrors.BadRequest("stock location has insufficient available stock", nil)
		}
		balance = &InventoryLocationBalance{
			ID:                utils.NewUUID(),
			BusinessID:        item.BusinessID,
			BranchID:          item.BranchID,
			InventoryItemID:   item.ID,
			StockLocationID:   *stockLocationID,
			CurrentQuantity:   0,
			ReservedQuantity:  0,
			AvailableQuantity: 0,
		}
		if err := s.repo.CreateLocationBalance(tx, balance); err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	switch direction {
	case "in":
		balance.CurrentQuantity = roundQuantity(balance.CurrentQuantity + quantity)
	case "out":
		if balance.AvailableQuantity < quantity {
			return apperrors.BadRequest("stock location has insufficient available stock", nil)
		}
		balance.CurrentQuantity = roundQuantity(balance.CurrentQuantity - quantity)
	}
	balance.AvailableQuantity = roundQuantity(balance.CurrentQuantity - balance.ReservedQuantity)
	if balance.CurrentQuantity < 0 || balance.AvailableQuantity < 0 {
		return apperrors.BadRequest("stock location cannot go below zero", nil)
	}
	return s.repo.UpdateLocationBalance(tx, balance)
}

func (s *Service) audit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	return s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  inventoryAuditEntityType(eventType),
		EntityID:    entityID,
		Summary:     summary,
		Metadata: audit.Metadata(map[string]interface{}{
			"source_module": "inventory",
		}, nil),
		IPAddress: ipAddress,
		UserAgent: userAgent,
	})
}

func (s *Service) auditStockMovement(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	return s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "stock_movement",
		EntityID:    entityID,
		Summary:     summary,
		Metadata: audit.Metadata(map[string]interface{}{
			"source_module": "inventory",
		}, nil),
		IPAddress: ipAddress,
		UserAgent: userAgent,
	})
}

func inventoryAuditEntityType(eventType string) string {
	switch {
	case strings.HasPrefix(eventType, "stock_location."):
		return "stock_location"
	case strings.HasPrefix(eventType, "stock_transfer."):
		return "stock_transfer"
	case strings.HasPrefix(eventType, "stock_movement."):
		return "stock_movement"
	case eventType == "inventory.opening_stock_created", eventType == "inventory.adjusted":
		return "stock_movement"
	default:
		return "inventory"
	}
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

func normalizeStockLocationListQuery(query *StockLocationListQuery) {
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

func normalizeLocationBalanceListQuery(query *LocationBalanceListQuery) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.Limit <= 0 || query.Limit > 100 {
		query.Limit = 20
	}
	if query.SortBy == "" {
		query.SortBy = "location_name"
	}
	if query.SortOrder == "" {
		query.SortOrder = "asc"
	}
}

func normalizeStockTransferListQuery(query *StockTransferListQuery) {
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
	return value == "product" || value == "product_variant" || value == "ingredient" || value == "packaging"
}

func validOpeningStockItemType(value string) bool {
	return value == "product" || value == "product_variant"
}

func validStockLocationType(value string) bool {
	switch value {
	case "kitchen", "store_room", "front_desk", "display_counter", "warehouse", "production_area", "pickup_area", "other":
		return true
	default:
		return false
	}
}

func movementDirection(movementType string) (string, error) {
	switch movementType {
	case "opening_stock", "purchase_in", "adjustment_in", "return_in", "transfer_in", "production_in":
		return "in", nil
	case "sale_out", "adjustment_out", "wastage", "transfer_out", "production_out", "purchase_return_out", "purchase_bill_cancel_out":
		return "out", nil
	case "transfer":
		return "transfer", nil
	case "reversal":
		return "neutral", nil
	default:
		return "", apperrors.BadRequest("invalid movement_type", nil)
	}
}

func calculateValuation(direction string, beforeQuantity, beforeValue, beforeAverageCost, quantity, inputUnitCost float64) (float64, float64, float64, float64) {
	unitCost := inputUnitCost
	if unitCost <= 0 {
		unitCost = beforeAverageCost
	}
	if unitCost < 0 {
		unitCost = 0
	}
	switch direction {
	case "in":
		totalCost := roundMoney(unitCost * quantity)
		afterQuantity := roundQuantity(beforeQuantity + quantity)
		afterValue := roundMoney(beforeValue + totalCost)
		averageCost := 0.0
		if afterQuantity > 0 {
			averageCost = roundQuantity(afterValue / afterQuantity)
		}
		return roundQuantity(unitCost), totalCost, averageCost, afterValue
	case "out":
		totalCost := roundMoney(unitCost * quantity)
		afterQuantity := roundQuantity(beforeQuantity - quantity)
		afterValue := roundMoney(beforeValue - totalCost)
		if afterValue < 0 {
			afterValue = 0
		}
		averageCost := beforeAverageCost
		if afterQuantity <= 0 {
			averageCost = 0
		}
		return roundQuantity(unitCost), totalCost, roundQuantity(averageCost), afterValue
	default:
		return roundQuantity(unitCost), roundMoney(unitCost * quantity), roundQuantity(beforeAverageCost), roundMoney(beforeValue)
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
	if query.MovementDirection != "" && query.MovementDirection != "in" && query.MovementDirection != "out" && query.MovementDirection != "neutral" && query.MovementDirection != "transfer" {
		return apperrors.BadRequest("invalid movement_direction", nil)
	}
	return nil
}

func (s *Service) validateStockLocationRequest(businessID, branchID string, req StockLocationRequest) error {
	if err := validateUUID(branchID, "branch_id"); err != nil {
		return err
	}
	if err := s.repo.ValidateBranch(businessID, branchID); err != nil {
		return mapNotFound(err, "branch not found")
	}
	if strings.TrimSpace(req.LocationName) == "" {
		return apperrors.BadRequest("location_name is required", nil)
	}
	if strings.TrimSpace(req.LocationCode) == "" {
		return apperrors.BadRequest("location_code is required", nil)
	}
	if req.LocationType != "" && !validStockLocationType(strings.TrimSpace(req.LocationType)) {
		return apperrors.BadRequest("invalid location_type", nil)
	}
	if req.Status != "" && req.Status != "active" && req.Status != "inactive" {
		return apperrors.BadRequest("invalid status", nil)
	}
	return nil
}

func (s *Service) validateStockTransferRequest(currentUser *utils.AuthContext, req StockTransferRequest) error {
	if err := validateUUID(req.InventoryItemID, "inventory_item_id"); err != nil {
		return err
	}
	if err := validateUUID(req.FromStockLocationID, "from_stock_location_id"); err != nil {
		return err
	}
	if err := validateUUID(req.ToStockLocationID, "to_stock_location_id"); err != nil {
		return err
	}
	if req.FromStockLocationID == req.ToStockLocationID {
		return apperrors.BadRequest("source and target locations must be different", nil)
	}
	if req.Quantity <= 0 {
		return apperrors.BadRequest("quantity must be greater than zero", nil)
	}
	item, err := s.repo.FindInventoryItem(req.InventoryItemID, currentUser.BusinessID)
	if err != nil {
		return mapNotFound(err, "inventory item not found")
	}
	if !currentUser.CanAccessBranch(item.BranchID) {
		return apperrors.Forbidden("branch access denied")
	}
	if strings.TrimSpace(req.UnitID) != "" && req.UnitID != item.UnitID {
		return apperrors.BadRequest("unit_id must match inventory item unit", nil)
	}
	from, err := s.repo.FindStockLocation(req.FromStockLocationID, currentUser.BusinessID)
	if err != nil {
		return mapNotFound(err, "source stock location not found")
	}
	to, err := s.repo.FindStockLocation(req.ToStockLocationID, currentUser.BusinessID)
	if err != nil {
		return mapNotFound(err, "target stock location not found")
	}
	if from.BranchID != item.BranchID || to.BranchID != item.BranchID {
		return apperrors.BadRequest("stock locations must belong to the inventory item branch", nil)
	}
	if from.Status != "active" || to.Status != "active" {
		return apperrors.BadRequest("stock locations must be active", nil)
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
	if req.ItemType == "product" || req.ItemType == "product_variant" {
		return nullableString(req.ProductID)
	}
	return nil
}

func variantIDForRequest(req OpeningStockRequest) *string {
	if req.ItemType != "product_variant" {
		return nil
	}
	return nullableString(req.ProductVariantID)
}

func normalizeOpeningStockItemType(req OpeningStockRequest) string {
	itemType := strings.TrimSpace(req.ItemType)
	if itemType == "product" && strings.TrimSpace(req.ProductVariantID) != "" {
		return "product_variant"
	}
	return itemType
}

func parseDate(value, field string) (time.Time, error) {
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, apperrors.BadRequest(field+" must use YYYY-MM-DD format", nil)
	}
	return parsed, nil
}

func normalizeAllFilter(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || strings.EqualFold(value, "all") {
		return ""
	}
	return value
}

func mapNotFound(err error, message string) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apperrors.NotFound(message)
	}
	return err
}

func toExpiryBatchResponse(batch ExpiryBatch) ExpiryBatchResponse {
	location, _, _ := expirystate.ResolveTimezone("")
	today := expirystate.LocalDate(time.Now(), location)
	daysRemaining := expirystate.DaysRemaining(batch.ExpiryDate, today)
	expiryState := expirystate.State(daysRemaining)
	return ExpiryBatchResponse{
		ID:               batch.ID,
		BusinessID:       batch.BusinessID,
		BranchID:         batch.BranchID,
		InventoryItemID:  batch.InventoryItemID,
		BatchNumber:      batch.BatchNumber,
		Quantity:         roundQuantity(batch.Quantity),
		ExpiryDate:       batch.ExpiryDate,
		ReceivedDate:     batch.ReceivedDate,
		Status:           batch.Status,
		DaysRemaining:    daysRemaining,
		ExpiryState:      expiryState,
		ExpiryStateLabel: expirystate.Label(expiryState),
		CreatedAt:        batch.CreatedAt,
		UpdatedAt:        batch.UpdatedAt,
	}
}

func toExpiryBatchResponses(batches []ExpiryBatch) []ExpiryBatchResponse {
	responses := make([]ExpiryBatchResponse, 0, len(batches))
	for _, batch := range batches {
		responses = append(responses, toExpiryBatchResponse(batch))
	}
	return responses
}

func toExpiryAlertResponses(batches []expiryBatchAlertRow, today time.Time, stateFilter string) []ExpiryBatchResponse {
	responses := make([]ExpiryBatchResponse, 0, len(batches))
	for _, batch := range batches {
		daysRemaining := expirystate.DaysRemaining(batch.ExpiryDate, today)
		expiryState := expirystate.State(daysRemaining)
		if stateFilter != "" && expiryState != stateFilter {
			continue
		}
		responses = append(responses, ExpiryBatchResponse{
			ID:                      batch.ID,
			BusinessID:              batch.BusinessID,
			BranchID:                batch.BranchID,
			BranchName:              batch.BranchName,
			InventoryItemID:         batch.InventoryItemID,
			ItemType:                batch.ItemType,
			ItemName:                batch.ItemName,
			ItemCode:                batch.ItemCode,
			SKU:                     batch.SKU,
			ProductType:             batch.ProductType,
			CategoryName:            batch.CategoryName,
			UnitSymbol:              batch.UnitSymbol,
			StockLocationName:       batch.StockLocationName,
			SupplierName:            batch.SupplierName,
			PurchaseReferenceNumber: batch.PurchaseReferenceNumber,
			BatchNumber:             batch.BatchNumber,
			Quantity:                roundQuantity(batch.Quantity),
			ExpiryDate:              batch.ExpiryDate,
			ReceivedDate:            batch.ReceivedDate,
			Status:                  batch.Status,
			DaysRemaining:           daysRemaining,
			ExpiryState:             expiryState,
			ExpiryStateLabel:        expirystate.Label(expiryState),
			CreatedAt:               batch.CreatedAt,
			UpdatedAt:               batch.UpdatedAt,
		})
	}
	return responses
}
