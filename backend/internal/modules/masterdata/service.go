package masterdata

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

type simpleCategoryConfig struct {
	Table       string
	EntityType  string
	EventPrefix string
}

func NewService(db *gorm.DB, repo *Repository, auditRepo *audit.Repository) *Service {
	return &Service{db: db, repo: repo, auditRepo: auditRepo}
}

func (s *Service) CopyCategories(currentUser *utils.AuthContext, req CopyCategoriesRequest, ipAddress, userAgent string) (*CopyCategoriesResponse, error) {
	targetBranchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	sourceBranchID := strings.TrimSpace(req.SourceBranchID)
	if sourceBranchID == targetBranchID {
		return nil, apperrors.BadRequest("source branch cannot be the current branch", nil)
	}
	if !currentUser.CanAccessBranch(sourceBranchID) {
		return nil, apperrors.Forbidden("source branch access denied")
	}
	if !currentUser.CanAccessBranch(targetBranchID) {
		return nil, apperrors.Forbidden("target branch access denied")
	}
	if !hasPermission(currentUser, categoryManagePermission(req.CategoryType), "master_data.manage") {
		return nil, apperrors.Forbidden("missing required permission")
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.FindActiveBranchTx(tx, sourceBranchID, currentUser.BusinessID); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.BadRequest("invalid source_branch_id", nil)
		}
		return nil, apperrors.Internal("failed to validate source branch")
	}
	if err := s.repo.FindActiveBranchTx(tx, targetBranchID, currentUser.BusinessID); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.BadRequest("invalid current branch", nil)
		}
		return nil, apperrors.Internal("failed to validate current branch")
	}

	var result *CopyCategoriesResponse
	switch req.CategoryType {
	case "product_categories":
		result, err = s.copyProductCategoriesTx(tx, currentUser.BusinessID, sourceBranchID, targetBranchID)
	case "ingredient_categories":
		result, err = s.copySimpleCategoriesTx(tx, ingredientConfig(), currentUser.BusinessID, sourceBranchID, targetBranchID)
	case "packaging_categories":
		result, err = s.copySimpleCategoriesTx(tx, packagingConfig(), currentUser.BusinessID, sourceBranchID, targetBranchID)
	case "supplier_categories":
		result, err = s.copySimpleCategoriesTx(tx, supplierConfig(), currentUser.BusinessID, sourceBranchID, targetBranchID)
	default:
		tx.Rollback()
		return nil, apperrors.BadRequest("invalid category_type", nil)
	}
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	result.CategoryType = req.CategoryType
	result.SourceBranchID = sourceBranchID
	result.TargetBranchID = targetBranchID
	result.CreatedCount = len(result.CreatedCategoryIDs)
	result.SkippedCount = len(result.SkippedCategories)

	if err := s.writeAudit(tx, currentUser, "master_data.categories_copied", "master_data_category_copy", targetBranchID, "Categories copied between branches.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit category copy")
	}
	return result, nil
}

func (s *Service) ListUnitCategories() ([]UnitCategoryResponse, error) {
	categories, err := s.repo.ListUnitCategories()
	if err != nil {
		return nil, apperrors.Internal("failed to list unit categories")
	}
	response := make([]UnitCategoryResponse, 0, len(categories))
	for _, category := range categories {
		response = append(response, toUnitCategoryResponse(category))
	}
	return response, nil
}

func (s *Service) ListUnits(currentUser *utils.AuthContext) ([]UnitResponse, error) {
	units, err := s.repo.ListUnits(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to list units")
	}
	response := make([]UnitResponse, 0, len(units))
	for _, unit := range units {
		response = append(response, toUnitResponse(unit))
	}
	return response, nil
}

func (s *Service) GetUnit(currentUser *utils.AuthContext, id string) (*UnitResponse, error) {
	unit, err := s.repo.FindUnit(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("unit not found")
		}
		return nil, apperrors.Internal("failed to fetch unit")
	}
	response := toUnitResponse(*unit)
	return &response, nil
}

func (s *Service) CreateUnit(currentUser *utils.AuthContext, req CreateUnitRequest, ipAddress, userAgent string) (*UnitResponse, error) {
	name := strings.TrimSpace(req.UnitName)
	symbol := strings.TrimSpace(req.Symbol)
	if name == "" || symbol == "" {
		return nil, apperrors.BadRequest("unit_name and symbol are required", nil)
	}
	if _, err := s.repo.FindUnitCategory(req.UnitCategoryID); err != nil {
		return nil, apperrors.BadRequest("invalid unit_category_id", nil)
	}
	factor := req.ConversionFactor
	if factor == 0 {
		factor = 1
	}
	if factor <= 0 {
		return nil, apperrors.BadRequest("conversion_factor must be positive", nil)
	}
	precision := req.DecimalPrecision
	if precision < 0 {
		return nil, apperrors.BadRequest("decimal_precision cannot be negative", nil)
	}
	if req.BaseUnitID != nil {
		if *req.BaseUnitID == "" {
			return nil, apperrors.BadRequest("base_unit_id must be a valid UUID", nil)
		}
		baseUnit, err := s.repo.FindUnit(*req.BaseUnitID, currentUser.BusinessID)
		if err != nil {
			return nil, apperrors.BadRequest("invalid base_unit_id", nil)
		}
		if baseUnit.UnitCategoryID != req.UnitCategoryID {
			return nil, apperrors.BadRequest("base unit must be in the same unit category", nil)
		}
	}
	exists, err := s.repo.UnitNameOrSymbolExists(currentUser.BusinessID, name, symbol, "")
	if err != nil {
		return nil, apperrors.Internal("failed to validate unit")
	}
	if exists {
		return nil, apperrors.Conflict("unit name or symbol already exists", nil)
	}

	businessID := currentUser.BusinessID
	unit := &Unit{
		ID:               utils.NewUUID(),
		BusinessID:       &businessID,
		UnitCategoryID:   req.UnitCategoryID,
		UnitName:         name,
		Symbol:           symbol,
		BaseUnitID:       req.BaseUnitID,
		ConversionFactor: factor,
		DecimalPrecision: precision,
		IsSystemDefault:  false,
		Status:           "active",
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.CreateUnit(tx, unit); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create unit")
	}
	if err := s.writeAudit(tx, currentUser, "unit.created", "unit", unit.ID, "Unit created.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit unit creation")
	}
	return s.GetUnit(currentUser, unit.ID)
}

func (s *Service) UpdateUnit(currentUser *utils.AuthContext, id string, req UpdateUnitRequest, ipAddress, userAgent string) (*UnitResponse, error) {
	unit, err := s.repo.FindUnit(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("unit not found")
		}
		return nil, apperrors.Internal("failed to fetch unit")
	}
	if unit.BusinessID == nil || unit.IsSystemDefault {
		return nil, apperrors.Forbidden("system units cannot be modified")
	}

	updates := map[string]interface{}{}
	categoryID := unit.UnitCategoryID
	if req.UnitCategoryID != "" {
		if _, err := s.repo.FindUnitCategory(req.UnitCategoryID); err != nil {
			return nil, apperrors.BadRequest("invalid unit_category_id", nil)
		}
		categoryID = req.UnitCategoryID
		updates["unit_category_id"] = req.UnitCategoryID
	}
	if req.UnitName != "" {
		updates["unit_name"] = strings.TrimSpace(req.UnitName)
	}
	if req.Symbol != "" {
		updates["symbol"] = strings.TrimSpace(req.Symbol)
	}
	if req.ConversionFactor != nil {
		if *req.ConversionFactor <= 0 {
			return nil, apperrors.BadRequest("conversion_factor must be positive", nil)
		}
		updates["conversion_factor"] = *req.ConversionFactor
	}
	if req.DecimalPrecision != nil {
		if *req.DecimalPrecision < 0 {
			return nil, apperrors.BadRequest("decimal_precision cannot be negative", nil)
		}
		updates["decimal_precision"] = *req.DecimalPrecision
	}
	if req.BaseUnitID != nil {
		if *req.BaseUnitID == id {
			return nil, apperrors.BadRequest("base_unit_id cannot reference itself", nil)
		}
		baseUnit, err := s.repo.FindUnit(*req.BaseUnitID, currentUser.BusinessID)
		if err != nil {
			return nil, apperrors.BadRequest("invalid base_unit_id", nil)
		}
		if baseUnit.BaseUnitID != nil && *baseUnit.BaseUnitID == id {
			return nil, apperrors.BadRequest("circular unit conversion reference is not allowed", nil)
		}
		if baseUnit.UnitCategoryID != categoryID {
			return nil, apperrors.BadRequest("base unit must be in the same unit category", nil)
		}
		if circular, err := s.wouldCreateCircularUnitReference(currentUser.BusinessID, id, *req.BaseUnitID); err != nil {
			return nil, apperrors.Internal("failed to validate unit conversion")
		} else if circular {
			return nil, apperrors.BadRequest("circular unit conversion reference is not allowed", nil)
		}
		updates["base_unit_id"] = *req.BaseUnitID
	}

	name := unit.UnitName
	symbol := unit.Symbol
	if value, ok := updates["unit_name"].(string); ok {
		name = value
	}
	if value, ok := updates["symbol"].(string); ok {
		symbol = value
	}
	exists, err := s.repo.UnitNameOrSymbolExists(currentUser.BusinessID, name, symbol, id)
	if err != nil {
		return nil, apperrors.Internal("failed to validate unit")
	}
	if exists {
		return nil, apperrors.Conflict("unit name or symbol already exists", nil)
	}

	if len(updates) == 0 {
		response := toUnitResponse(*unit)
		return &response, nil
	}
	updates["updated_at"] = time.Now().UTC()
	if err := s.updateWithAudit(currentUser, "unit.updated", "unit", id, "Unit updated.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.UpdateUnit(tx, id, currentUser.BusinessID, updates)
	}); err != nil {
		return nil, err
	}
	return s.GetUnit(currentUser, id)
}

func (s *Service) UpdateUnitStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*UnitResponse, error) {
	unit, err := s.repo.FindUnit(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("unit not found")
		}
		return nil, apperrors.Internal("failed to fetch unit")
	}
	if unit.BusinessID == nil || unit.IsSystemDefault {
		return nil, apperrors.Forbidden("system units cannot be deactivated")
	}
	if err := s.updateWithAudit(currentUser, "unit.status_changed", "unit", id, "Unit status changed.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.UpdateUnit(tx, id, currentUser.BusinessID, map[string]interface{}{"status": req.Status, "updated_at": time.Now().UTC()})
	}); err != nil {
		return nil, err
	}
	return s.GetUnit(currentUser, id)
}

func (s *Service) DeleteUnit(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) error {
	unit, err := s.repo.FindUnit(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("unit not found")
		}
		return apperrors.Internal("failed to fetch unit")
	}
	if unit.BusinessID == nil || unit.IsSystemDefault {
		return apperrors.Forbidden("system units cannot be deleted")
	}
	return s.updateWithAudit(currentUser, "unit.deleted", "unit", id, "Unit deactivated.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.UpdateUnit(tx, id, currentUser.BusinessID, map[string]interface{}{"status": "inactive", "updated_at": time.Now().UTC()})
	})
}

func (s *Service) ListOrderStatuses(currentUser *utils.AuthContext) ([]OrderStatusResponse, error) {
	statuses, err := s.repo.ListOrderStatuses(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to list order statuses")
	}
	response := make([]OrderStatusResponse, 0, len(statuses))
	for _, status := range statuses {
		response = append(response, toOrderStatusResponse(status))
	}
	return response, nil
}

func (s *Service) CreateOrderStatus(currentUser *utils.AuthContext, req CreateOrderStatusRequest, ipAddress, userAgent string) (*OrderStatusResponse, error) {
	name := strings.TrimSpace(req.StatusName)
	if name == "" {
		return nil, apperrors.BadRequest("status_name is required", nil)
	}
	key := normalizeCode(req.StatusKey, name)
	if exists, err := s.repo.OrderStatusKeyExists(currentUser.BusinessID, key, ""); err != nil {
		return nil, apperrors.Internal("failed to validate order status")
	} else if exists {
		return nil, apperrors.Conflict("order status key already exists", nil)
	}
	businessID := currentUser.BusinessID
	status := &OrderStatus{
		ID:              utils.NewUUID(),
		BusinessID:      &businessID,
		StatusName:      name,
		StatusKey:       key,
		SortOrder:       req.SortOrder,
		Color:           strings.TrimSpace(req.Color),
		IsSystemDefault: false,
		IsFinalStatus:   req.IsFinalStatus,
		Status:          "active",
	}
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.CreateOrderStatus(tx, status); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create order status")
	}
	if err := s.writeAudit(tx, currentUser, "order_status.created", "order_status", status.ID, "Order status created.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit order status creation")
	}
	return s.GetOrderStatus(currentUser, status.ID)
}

func (s *Service) GetOrderStatus(currentUser *utils.AuthContext, id string) (*OrderStatusResponse, error) {
	status, err := s.repo.FindOrderStatus(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("order status not found")
		}
		return nil, apperrors.Internal("failed to fetch order status")
	}
	response := toOrderStatusResponse(*status)
	return &response, nil
}

func (s *Service) UpdateOrderStatus(currentUser *utils.AuthContext, id string, req UpdateOrderStatusRequest, ipAddress, userAgent string) (*OrderStatusResponse, error) {
	status, err := s.repo.FindOrderStatus(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("order status not found")
		}
		return nil, apperrors.Internal("failed to fetch order status")
	}
	if status.BusinessID == nil || status.IsSystemDefault {
		return nil, apperrors.Forbidden("system order statuses cannot be modified")
	}
	updates := map[string]interface{}{}
	if req.StatusName != "" {
		updates["status_name"] = strings.TrimSpace(req.StatusName)
	}
	if req.StatusKey != "" {
		key := normalizeCode(req.StatusKey)
		if exists, err := s.repo.OrderStatusKeyExists(currentUser.BusinessID, key, id); err != nil {
			return nil, apperrors.Internal("failed to validate order status")
		} else if exists {
			return nil, apperrors.Conflict("order status key already exists", nil)
		}
		updates["status_key"] = key
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}
	if req.Color != "" {
		updates["color"] = strings.TrimSpace(req.Color)
	}
	if req.IsFinalStatus != nil {
		updates["is_final_status"] = *req.IsFinalStatus
	}
	if len(updates) == 0 {
		return s.GetOrderStatus(currentUser, id)
	}
	updates["updated_at"] = time.Now().UTC()
	if err := s.updateWithAudit(currentUser, "order_status.updated", "order_status", id, "Order status updated.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.UpdateOrderStatus(tx, id, currentUser.BusinessID, updates)
	}); err != nil {
		return nil, err
	}
	return s.GetOrderStatus(currentUser, id)
}

func (s *Service) UpdateOrderStatusStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*OrderStatusResponse, error) {
	status, err := s.repo.FindOrderStatus(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("order status not found")
		}
		return nil, apperrors.Internal("failed to fetch order status")
	}
	if status.BusinessID == nil || status.IsSystemDefault {
		return nil, apperrors.Forbidden("system order statuses cannot be deactivated")
	}
	if err := s.updateWithAudit(currentUser, "order_status.status_changed", "order_status", id, "Order status state changed.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.UpdateOrderStatus(tx, id, currentUser.BusinessID, map[string]interface{}{"status": req.Status, "updated_at": time.Now().UTC()})
	}); err != nil {
		return nil, err
	}
	return s.GetOrderStatus(currentUser, id)
}

func (s *Service) ListPaymentStatuses(currentUser *utils.AuthContext) ([]PaymentStatusResponse, error) {
	statuses, err := s.repo.ListPaymentStatuses(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to list payment statuses")
	}
	response := make([]PaymentStatusResponse, 0, len(statuses))
	for _, status := range statuses {
		response = append(response, toPaymentStatusResponse(status))
	}
	return response, nil
}

func (s *Service) CreatePaymentStatus(currentUser *utils.AuthContext, req CreatePaymentStatusRequest, ipAddress, userAgent string) (*PaymentStatusResponse, error) {
	name := strings.TrimSpace(req.StatusName)
	if name == "" {
		return nil, apperrors.BadRequest("status_name is required", nil)
	}
	key := normalizeCode(req.StatusKey, name)
	if exists, err := s.repo.PaymentStatusKeyExists(currentUser.BusinessID, key, ""); err != nil {
		return nil, apperrors.Internal("failed to validate payment status")
	} else if exists {
		return nil, apperrors.Conflict("payment status key already exists", nil)
	}
	businessID := currentUser.BusinessID
	status := &PaymentStatus{
		ID:              utils.NewUUID(),
		BusinessID:      &businessID,
		StatusName:      name,
		StatusKey:       key,
		Color:           strings.TrimSpace(req.Color),
		IsSystemDefault: false,
		Status:          "active",
	}
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.CreatePaymentStatus(tx, status); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create payment status")
	}
	if err := s.writeAudit(tx, currentUser, "payment_status.created", "payment_status", status.ID, "Payment status created.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit payment status creation")
	}
	return s.GetPaymentStatus(currentUser, status.ID)
}

func (s *Service) GetPaymentStatus(currentUser *utils.AuthContext, id string) (*PaymentStatusResponse, error) {
	status, err := s.repo.FindPaymentStatus(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("payment status not found")
		}
		return nil, apperrors.Internal("failed to fetch payment status")
	}
	response := toPaymentStatusResponse(*status)
	return &response, nil
}

func (s *Service) UpdatePaymentStatus(currentUser *utils.AuthContext, id string, req UpdatePaymentStatusRequest, ipAddress, userAgent string) (*PaymentStatusResponse, error) {
	status, err := s.repo.FindPaymentStatus(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("payment status not found")
		}
		return nil, apperrors.Internal("failed to fetch payment status")
	}
	if status.BusinessID == nil || status.IsSystemDefault {
		return nil, apperrors.Forbidden("system payment statuses cannot be modified")
	}
	updates := map[string]interface{}{}
	if req.StatusName != "" {
		updates["status_name"] = strings.TrimSpace(req.StatusName)
	}
	if req.StatusKey != "" {
		key := normalizeCode(req.StatusKey)
		if exists, err := s.repo.PaymentStatusKeyExists(currentUser.BusinessID, key, id); err != nil {
			return nil, apperrors.Internal("failed to validate payment status")
		} else if exists {
			return nil, apperrors.Conflict("payment status key already exists", nil)
		}
		updates["status_key"] = key
	}
	if req.Color != "" {
		updates["color"] = strings.TrimSpace(req.Color)
	}
	if len(updates) == 0 {
		return s.GetPaymentStatus(currentUser, id)
	}
	updates["updated_at"] = time.Now().UTC()
	if err := s.updateWithAudit(currentUser, "payment_status.updated", "payment_status", id, "Payment status updated.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.UpdatePaymentStatus(tx, id, currentUser.BusinessID, updates)
	}); err != nil {
		return nil, err
	}
	return s.GetPaymentStatus(currentUser, id)
}

func (s *Service) UpdatePaymentStatusStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*PaymentStatusResponse, error) {
	status, err := s.repo.FindPaymentStatus(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("payment status not found")
		}
		return nil, apperrors.Internal("failed to fetch payment status")
	}
	if status.BusinessID == nil || status.IsSystemDefault {
		return nil, apperrors.Forbidden("system payment statuses cannot be deactivated")
	}
	if err := s.updateWithAudit(currentUser, "payment_status.status_changed", "payment_status", id, "Payment status state changed.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.UpdatePaymentStatus(tx, id, currentUser.BusinessID, map[string]interface{}{"status": req.Status, "updated_at": time.Now().UTC()})
	}); err != nil {
		return nil, err
	}
	return s.GetPaymentStatus(currentUser, id)
}

func (s *Service) wouldCreateCircularUnitReference(businessID, unitID, baseUnitID string) (bool, error) {
	seen := map[string]bool{unitID: true}
	nextID := baseUnitID
	for i := 0; i < 50; i++ {
		if seen[nextID] {
			return true, nil
		}
		seen[nextID] = true
		unit, err := s.repo.FindUnit(nextID, businessID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return false, nil
			}
			return false, err
		}
		if unit.BaseUnitID == nil {
			return false, nil
		}
		nextID = *unit.BaseUnitID
	}
	return true, nil
}

func (s *Service) ListProductCategories(currentUser *utils.AuthContext) ([]ProductCategoryResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	categories, err := s.repo.ListProductCategories(currentUser.BusinessID, branchID)
	if err != nil {
		return nil, apperrors.Internal("failed to list product categories")
	}
	response := make([]ProductCategoryResponse, 0, len(categories))
	for _, category := range categories {
		response = append(response, toProductCategoryResponse(category))
	}
	return response, nil
}

func (s *Service) GetProductCategory(currentUser *utils.AuthContext, id string) (*ProductCategoryResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	category, err := s.repo.FindProductCategory(id, currentUser.BusinessID, branchID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("product category not found")
		}
		return nil, apperrors.Internal("failed to fetch product category")
	}
	response := toProductCategoryResponse(*category)
	return &response, nil
}

func (s *Service) CreateProductCategory(currentUser *utils.AuthContext, req CreateProductCategoryRequest, ipAddress, userAgent string) (*ProductCategoryResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.CategoryName)
	if name == "" {
		return nil, apperrors.BadRequest("category_name is required", nil)
	}
	parentID := ""
	if req.ParentCategoryID != nil {
		parentID = *req.ParentCategoryID
		if _, err := s.repo.FindProductCategory(parentID, currentUser.BusinessID, branchID); err != nil {
			return nil, apperrors.BadRequest("invalid parent_category_id", nil)
		}
	}
	exists, err := s.repo.ProductNameExists(currentUser.BusinessID, branchID, parentID, name, "")
	if err != nil {
		return nil, apperrors.Internal("failed to validate category name")
	}
	if exists {
		return nil, apperrors.Conflict("category name already exists at this level", nil)
	}
	code := normalizeCode(req.CategoryCode, name)
	codeExists, err := s.repo.ProductCodeExists(currentUser.BusinessID, branchID, code, "")
	if err != nil {
		return nil, apperrors.Internal("failed to validate category code")
	}
	if codeExists {
		return nil, apperrors.Conflict("category code already exists", nil)
	}

	category := &ProductCategory{
		ID:               utils.NewUUID(),
		BusinessID:       currentUser.BusinessID,
		BranchID:         branchID,
		ParentCategoryID: req.ParentCategoryID,
		CategoryName:     name,
		CategoryCode:     code,
		Description:      strings.TrimSpace(req.Description),
		ImageFileID:      strings.TrimSpace(req.ImageFileID),
		SortOrder:        req.SortOrder,
		Status:           "active",
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.CreateProductCategory(tx, category); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create product category")
	}
	if err := s.writeAudit(tx, currentUser, "product_category.created", "product_category", category.ID, "Product category created.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit product category creation")
	}
	response := toProductCategoryResponse(*category)
	return &response, nil
}

func (s *Service) UpdateProductCategory(currentUser *utils.AuthContext, id string, req UpdateProductCategoryRequest, ipAddress, userAgent string) (*ProductCategoryResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	category, err := s.repo.FindProductCategory(id, currentUser.BusinessID, branchID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("product category not found")
		}
		return nil, apperrors.Internal("failed to fetch product category")
	}
	updates := map[string]interface{}{}
	parentID := ""
	if category.ParentCategoryID != nil {
		parentID = *category.ParentCategoryID
	}
	if req.ParentCategoryID != nil {
		if *req.ParentCategoryID == id {
			return nil, apperrors.BadRequest("parent_category_id cannot reference itself", nil)
		}
		if _, err := s.repo.FindProductCategory(*req.ParentCategoryID, currentUser.BusinessID, branchID); err != nil {
			return nil, apperrors.BadRequest("invalid parent_category_id", nil)
		}
		parentID = *req.ParentCategoryID
		updates["parent_category_id"] = *req.ParentCategoryID
	}
	if req.CategoryName != "" {
		name := strings.TrimSpace(req.CategoryName)
		exists, err := s.repo.ProductNameExists(currentUser.BusinessID, branchID, parentID, name, id)
		if err != nil {
			return nil, apperrors.Internal("failed to validate category name")
		}
		if exists {
			return nil, apperrors.Conflict("category name already exists at this level", nil)
		}
		updates["category_name"] = name
	}
	if req.CategoryCode != "" {
		code := normalizeCode(req.CategoryCode)
		exists, err := s.repo.ProductCodeExists(currentUser.BusinessID, branchID, code, id)
		if err != nil {
			return nil, apperrors.Internal("failed to validate category code")
		}
		if exists {
			return nil, apperrors.Conflict("category code already exists", nil)
		}
		updates["category_code"] = code
	}
	if req.Description != "" {
		updates["description"] = strings.TrimSpace(req.Description)
	}
	if req.ImageFileID != "" {
		updates["image_file_id"] = strings.TrimSpace(req.ImageFileID)
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}
	if len(updates) == 0 {
		response := toProductCategoryResponse(*category)
		return &response, nil
	}
	updates["updated_at"] = time.Now().UTC()
	if err := s.updateWithAudit(currentUser, "product_category.updated", "product_category", id, "Product category updated.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.UpdateProductCategory(tx, id, currentUser.BusinessID, branchID, updates)
	}); err != nil {
		return nil, err
	}
	return s.GetProductCategory(currentUser, id)
}

func (s *Service) UpdateProductCategoryStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*ProductCategoryResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if err := s.updateWithAudit(currentUser, "product_category.status_changed", "product_category", id, "Product category status changed.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.UpdateProductCategory(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{"status": req.Status, "updated_at": time.Now().UTC()})
	}); err != nil {
		return nil, err
	}
	return s.GetProductCategory(currentUser, id)
}

func (s *Service) DeleteProductCategory(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	return s.updateWithAudit(currentUser, "product_category.deleted", "product_category", id, "Product category deactivated.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.UpdateProductCategory(tx, id, currentUser.BusinessID, branchID, map[string]interface{}{"status": "inactive", "updated_at": time.Now().UTC()})
	})
}

func (s *Service) ListSimpleCategories(currentUser *utils.AuthContext, cfg simpleCategoryConfig) ([]SimpleCategoryResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	return s.repo.ListSimpleCategories(cfg.Table, currentUser.BusinessID, branchID)
}

func (s *Service) GetSimpleCategory(currentUser *utils.AuthContext, cfg simpleCategoryConfig, id string) (*SimpleCategoryResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	category, err := s.repo.FindSimpleCategory(cfg.Table, id, currentUser.BusinessID, branchID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("category not found")
		}
		return nil, apperrors.Internal("failed to fetch category")
	}
	return category, nil
}

func (s *Service) CreateSimpleCategory(currentUser *utils.AuthContext, cfg simpleCategoryConfig, req CreateSimpleCategoryRequest, ipAddress, userAgent string) (*SimpleCategoryResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.CategoryName)
	if name == "" {
		return nil, apperrors.BadRequest("category_name is required", nil)
	}
	exists, err := s.repo.SimpleNameExists(cfg.Table, currentUser.BusinessID, branchID, name, "")
	if err != nil {
		return nil, apperrors.Internal("failed to validate category name")
	}
	if exists {
		return nil, apperrors.Conflict("category name already exists", nil)
	}

	category := map[string]interface{}{
		"id":            utils.NewUUID(),
		"business_id":   currentUser.BusinessID,
		"branch_id":     branchID,
		"category_name": name,
		"description":   strings.TrimSpace(req.Description),
		"status":        "active",
		"created_at":    time.Now().UTC(),
		"updated_at":    time.Now().UTC(),
	}
	id := category["id"].(string)
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.CreateSimpleCategory(tx, cfg.Table, &category); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create category")
	}
	if err := s.writeAudit(tx, currentUser, cfg.EventPrefix+".created", cfg.EntityType, id, "Category created.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit category creation")
	}
	return s.GetSimpleCategory(currentUser, cfg, id)
}

func (s *Service) UpdateSimpleCategory(currentUser *utils.AuthContext, cfg simpleCategoryConfig, id string, req UpdateSimpleCategoryRequest, ipAddress, userAgent string) (*SimpleCategoryResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	updates := map[string]interface{}{}
	if req.CategoryName != "" {
		name := strings.TrimSpace(req.CategoryName)
		exists, err := s.repo.SimpleNameExists(cfg.Table, currentUser.BusinessID, branchID, name, id)
		if err != nil {
			return nil, apperrors.Internal("failed to validate category name")
		}
		if exists {
			return nil, apperrors.Conflict("category name already exists", nil)
		}
		updates["category_name"] = name
	}
	if req.Description != "" {
		updates["description"] = strings.TrimSpace(req.Description)
	}
	if len(updates) == 0 {
		return s.GetSimpleCategory(currentUser, cfg, id)
	}
	updates["updated_at"] = time.Now().UTC()
	if err := s.updateWithAudit(currentUser, cfg.EventPrefix+".updated", cfg.EntityType, id, "Category updated.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.UpdateSimpleCategory(tx, cfg.Table, id, currentUser.BusinessID, branchID, updates)
	}); err != nil {
		return nil, err
	}
	return s.GetSimpleCategory(currentUser, cfg, id)
}

func (s *Service) UpdateSimpleCategoryStatus(currentUser *utils.AuthContext, cfg simpleCategoryConfig, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*SimpleCategoryResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	if err := s.updateWithAudit(currentUser, cfg.EventPrefix+".status_changed", cfg.EntityType, id, "Category status changed.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.UpdateSimpleCategory(tx, cfg.Table, id, currentUser.BusinessID, branchID, map[string]interface{}{"status": req.Status, "updated_at": time.Now().UTC()})
	}); err != nil {
		return nil, err
	}
	return s.GetSimpleCategory(currentUser, cfg, id)
}

func (s *Service) DeleteSimpleCategory(currentUser *utils.AuthContext, cfg simpleCategoryConfig, id string, ipAddress, userAgent string) error {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return err
	}
	return s.updateWithAudit(currentUser, cfg.EventPrefix+".deleted", cfg.EntityType, id, "Category deactivated.", ipAddress, userAgent, func(tx *gorm.DB) error {
		return s.repo.UpdateSimpleCategory(tx, cfg.Table, id, currentUser.BusinessID, branchID, map[string]interface{}{"status": "inactive", "updated_at": time.Now().UTC()})
	})
}

func (s *Service) Overview(currentUser *utils.AuthContext) (*OverviewResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	unitsCount, err := s.repo.CountActiveUnits(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to count units")
	}
	productCount, err := s.repo.CountActive("product_categories", currentUser.BusinessID, branchID)
	if err != nil {
		return nil, apperrors.Internal("failed to count product categories")
	}
	ingredientCount, err := s.repo.CountActive("ingredient_categories", currentUser.BusinessID, branchID)
	if err != nil {
		return nil, apperrors.Internal("failed to count ingredient categories")
	}
	packagingCount, err := s.repo.CountActive("packaging_categories", currentUser.BusinessID, branchID)
	if err != nil {
		return nil, apperrors.Internal("failed to count packaging categories")
	}
	supplierCount, err := s.repo.CountActive("supplier_categories", currentUser.BusinessID, branchID)
	if err != nil {
		return nil, apperrors.Internal("failed to count supplier categories")
	}
	orderStatusCount, err := s.repo.CountActiveShared("order_statuses", currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to count order statuses")
	}
	paymentStatusCount, err := s.repo.CountActiveShared("payment_statuses", currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to count payment statuses")
	}
	return &OverviewResponse{
		UnitsCount:                unitsCount,
		ProductCategoriesCount:    productCount,
		IngredientCategoriesCount: ingredientCount,
		PackagingCategoriesCount:  packagingCount,
		SupplierCategoriesCount:   supplierCount,
		OrderStatusesCount:        orderStatusCount,
		PaymentStatusesCount:      paymentStatusCount,
	}, nil
}

func (s *Service) copyProductCategoriesTx(tx *gorm.DB, businessID, sourceBranchID, targetBranchID string) (*CopyCategoriesResponse, error) {
	categories, err := s.repo.ListProductCategoriesTx(tx, businessID, sourceBranchID)
	if err != nil {
		return nil, apperrors.Internal("failed to load source product categories")
	}
	result := &CopyCategoriesResponse{
		CreatedCategoryIDs: []string{},
		SkippedCategories:  []SkippedCategoryResponse{},
	}
	if len(categories) == 0 {
		return result, nil
	}

	sourceByID := make(map[string]ProductCategory, len(categories))
	pending := make(map[string]ProductCategory, len(categories))
	idMap := make(map[string]string, len(categories))
	for _, category := range categories {
		sourceByID[category.ID] = category
		pending[category.ID] = category
	}

	for len(pending) > 0 {
		progressed := false
		for id, category := range pending {
			targetParentID := ""
			var targetParentPtr *string
			if category.ParentCategoryID != nil {
				mappedParentID, ok := idMap[*category.ParentCategoryID]
				if !ok {
					if _, parentExists := sourceByID[*category.ParentCategoryID]; parentExists {
						continue
					}
				} else {
					targetParentID = mappedParentID
					targetParentPtr = &mappedParentID
				}
			}

			existingByCode, codeErr := s.repo.FindProductCategoryByCodeTx(tx, businessID, targetBranchID, category.CategoryCode)
			if codeErr != nil && codeErr != gorm.ErrRecordNotFound {
				return nil, apperrors.Internal("failed to validate product category code")
			}
			existingByName, nameErr := s.repo.FindProductCategoryByNameTx(tx, businessID, targetBranchID, targetParentID, category.CategoryName)
			if nameErr != nil && nameErr != gorm.ErrRecordNotFound {
				return nil, apperrors.Internal("failed to validate product category name")
			}

			if existingByCode != nil || existingByName != nil {
				if existingByCode != nil && existingByName != nil && existingByCode.ID != existingByName.ID {
					result.SkippedCategories = append(result.SkippedCategories, SkippedCategoryResponse{CategoryName: category.CategoryName, Reason: "category code and name already exist on different target categories"})
					delete(pending, id)
					progressed = true
					continue
				}
				existing := existingByCode
				if existing == nil {
					existing = existingByName
				}
				idMap[category.ID] = existing.ID
				result.SkippedCategories = append(result.SkippedCategories, SkippedCategoryResponse{CategoryName: category.CategoryName, Reason: "already exists"})
				delete(pending, id)
				progressed = true
				continue
			}

			newCategory := &ProductCategory{
				ID:               utils.NewUUID(),
				BusinessID:       businessID,
				BranchID:         targetBranchID,
				ParentCategoryID: targetParentPtr,
				CategoryName:     category.CategoryName,
				CategoryCode:     category.CategoryCode,
				Description:      category.Description,
				ImageFileID:      category.ImageFileID,
				SortOrder:        category.SortOrder,
				Status:           category.Status,
			}
			if err := s.repo.CreateProductCategory(tx, newCategory); err != nil {
				return nil, apperrors.Internal("failed to copy product category")
			}
			idMap[category.ID] = newCategory.ID
			result.CreatedCategoryIDs = append(result.CreatedCategoryIDs, newCategory.ID)
			delete(pending, id)
			progressed = true
		}
		if !progressed {
			for id, category := range pending {
				result.SkippedCategories = append(result.SkippedCategories, SkippedCategoryResponse{CategoryName: category.CategoryName, Reason: "parent category could not be mapped"})
				delete(pending, id)
			}
		}
	}
	return result, nil
}

func (s *Service) copySimpleCategoriesTx(tx *gorm.DB, cfg simpleCategoryConfig, businessID, sourceBranchID, targetBranchID string) (*CopyCategoriesResponse, error) {
	categories, err := s.repo.ListSimpleCategoriesTx(tx, cfg.Table, businessID, sourceBranchID)
	if err != nil {
		return nil, apperrors.Internal("failed to load source categories")
	}
	result := &CopyCategoriesResponse{
		CreatedCategoryIDs: []string{},
		SkippedCategories:  []SkippedCategoryResponse{},
	}
	now := time.Now().UTC()
	for _, category := range categories {
		exists, err := s.repo.SimpleNameExistsTx(tx, cfg.Table, businessID, targetBranchID, category.CategoryName)
		if err != nil {
			return nil, apperrors.Internal("failed to validate category name")
		}
		if exists {
			result.SkippedCategories = append(result.SkippedCategories, SkippedCategoryResponse{CategoryName: category.CategoryName, Reason: "already exists"})
			continue
		}
		id := utils.NewUUID()
		newCategory := map[string]interface{}{
			"id":            id,
			"business_id":   businessID,
			"branch_id":     targetBranchID,
			"category_name": category.CategoryName,
			"description":   category.Description,
			"status":        category.Status,
			"created_at":    now,
			"updated_at":    now,
		}
		if err := s.repo.CreateSimpleCategory(tx, cfg.Table, &newCategory); err != nil {
			return nil, apperrors.Internal("failed to copy category")
		}
		result.CreatedCategoryIDs = append(result.CreatedCategoryIDs, id)
	}
	return result, nil
}

func (s *Service) updateWithAudit(currentUser *utils.AuthContext, eventType, entityType, entityID, summary, ipAddress, userAgent string, update func(tx *gorm.DB) error) error {
	tx := s.db.Begin()
	if tx.Error != nil {
		return apperrors.Internal("failed to start transaction")
	}
	if err := update(tx); err != nil {
		tx.Rollback()
		return err
	}
	if err := s.writeAudit(tx, currentUser, eventType, entityType, entityID, summary, ipAddress, userAgent); err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return apperrors.Internal("failed to commit change")
	}
	return nil
}

func (s *Service) writeAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityType, entityID, summary, ipAddress, userAgent string) error {
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  entityType,
		EntityID:    entityID,
		Summary:     summary,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

func toUnitCategoryResponse(category UnitCategory) UnitCategoryResponse {
	return UnitCategoryResponse{
		ID:          category.ID,
		Name:        category.Name,
		Description: category.Description,
		CreatedAt:   category.CreatedAt,
		UpdatedAt:   category.UpdatedAt,
	}
}

func toUnitResponse(unit Unit) UnitResponse {
	return UnitResponse{
		ID:               unit.ID,
		BusinessID:       unit.BusinessID,
		UnitCategoryID:   unit.UnitCategoryID,
		UnitCategory:     toUnitCategoryResponse(unit.UnitCategory),
		UnitName:         unit.UnitName,
		Symbol:           unit.Symbol,
		BaseUnitID:       unit.BaseUnitID,
		ConversionFactor: unit.ConversionFactor,
		DecimalPrecision: unit.DecimalPrecision,
		IsSystemDefault:  unit.IsSystemDefault,
		Status:           unit.Status,
		CreatedAt:        unit.CreatedAt,
		UpdatedAt:        unit.UpdatedAt,
	}
}

func toOrderStatusResponse(status OrderStatus) OrderStatusResponse {
	return OrderStatusResponse{
		ID:              status.ID,
		BusinessID:      status.BusinessID,
		StatusName:      status.StatusName,
		StatusKey:       status.StatusKey,
		SortOrder:       status.SortOrder,
		Color:           status.Color,
		IsSystemDefault: status.IsSystemDefault,
		IsFinalStatus:   status.IsFinalStatus,
		Status:          status.Status,
		CreatedAt:       status.CreatedAt,
		UpdatedAt:       status.UpdatedAt,
	}
}

func toPaymentStatusResponse(status PaymentStatus) PaymentStatusResponse {
	return PaymentStatusResponse{
		ID:              status.ID,
		BusinessID:      status.BusinessID,
		StatusName:      status.StatusName,
		StatusKey:       status.StatusKey,
		Color:           status.Color,
		IsSystemDefault: status.IsSystemDefault,
		Status:          status.Status,
		CreatedAt:       status.CreatedAt,
		UpdatedAt:       status.UpdatedAt,
	}
}

func toProductCategoryResponse(category ProductCategory) ProductCategoryResponse {
	return ProductCategoryResponse{
		ID:               category.ID,
		BusinessID:       category.BusinessID,
		BranchID:         category.BranchID,
		ParentCategoryID: category.ParentCategoryID,
		CategoryName:     category.CategoryName,
		CategoryCode:     category.CategoryCode,
		Description:      category.Description,
		ImageFileID:      category.ImageFileID,
		SortOrder:        category.SortOrder,
		Status:           category.Status,
		CreatedAt:        category.CreatedAt,
		UpdatedAt:        category.UpdatedAt,
	}
}

func normalizeCode(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return strings.ToUpper(strings.ReplaceAll(value, " ", "_"))
		}
	}
	return ""
}

func categoryManagePermission(categoryType string) string {
	switch categoryType {
	case "product_categories":
		return "master_data.product_categories.manage"
	case "ingredient_categories":
		return "master_data.ingredient_categories.manage"
	case "packaging_categories":
		return "master_data.packaging_categories.manage"
	case "supplier_categories":
		return "master_data.supplier_categories.manage"
	default:
		return ""
	}
}

func hasPermission(currentUser *utils.AuthContext, required ...string) bool {
	if currentUser == nil {
		return false
	}
	for _, userPermission := range currentUser.Permissions {
		for _, requiredPermission := range required {
			if requiredPermission != "" && userPermission == requiredPermission {
				return true
			}
		}
	}
	return false
}
