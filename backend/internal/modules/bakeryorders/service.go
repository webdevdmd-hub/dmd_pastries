package bakeryorders

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/manufacturing"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db                   *gorm.DB
	repo                 *Repository
	auditRepo            *audit.Repository
	manufacturingService *manufacturing.Service
}

func NewService(db *gorm.DB, repo *Repository, auditRepo *audit.Repository, manufacturingService ...*manufacturing.Service) *Service {
	service := &Service{db: db, repo: repo, auditRepo: auditRepo}
	if len(manufacturingService) > 0 {
		service.manufacturingService = manufacturingService[0]
	}
	return service
}

func (s *Service) ListOrders(currentUser *utils.AuthContext, query OrderListQuery) (*PaginatedOrdersResponse, error) {
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
	orders, total, err := s.repo.ListOrders(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list bakery orders")
	}
	items := make([]BakeryOrderResponse, 0, len(orders))
	for _, order := range orders {
		items = append(items, s.orderResponse(currentUser.BusinessID, order, false))
	}
	return &PaginatedOrdersResponse{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) CreateOrder(currentUser *utils.AuthContext, req CreateOrderRequest, ipAddress, userAgent string) (*BakeryOrderResponse, error) {
	var orderID string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, items, err := s.buildOrder(tx, currentUser, req)
		if err != nil {
			return err
		}
		number, err := s.repo.NextOrderNumber(tx, currentUser.BusinessID)
		if err != nil {
			return err
		}
		order.OrderNumber = number
		if err := s.repo.CreateOrder(tx, order, items); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "bakery_order.created", order.ID, "Bakery order created", ipAddress, userAgent); err != nil {
			return err
		}
		orderID = order.ID
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, orderID)
}

func (s *Service) GetOrder(currentUser *utils.AuthContext, id string) (*BakeryOrderResponse, error) {
	order, err := s.repo.FindOrder(id, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "bakery order not found")
	}
	if !currentUser.CanAccessBranch(order.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	dto := s.orderResponse(currentUser.BusinessID, *order, true)
	return &dto, nil
}

func (s *Service) UpdateOrder(currentUser *utils.AuthContext, id string, req UpdateOrderRequest, ipAddress, userAgent string) (*BakeryOrderResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "bakery order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if order.OrderStatus == "cancelled" || order.OrderStatus == "completed" {
			return apperrors.BadRequest("completed or cancelled orders cannot be edited", nil)
		}
		updates := map[string]interface{}{"updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
		if req.CustomerID != nil {
			customerID := strings.TrimSpace(*req.CustomerID)
			if customerID == "" {
				updates["customer_id"] = nil
			} else {
				customer, err := s.validCustomer(tx, currentUser.BusinessID, order.BranchID, customerID)
				if err != nil {
					return err
				}
				updates["customer_id"] = customer.ID
				updates["customer_name_snapshot"] = customer.FullName
				updates["customer_phone_snapshot"] = customer.Phone
			}
		}
		if req.CustomerName != nil {
			updates["customer_name_snapshot"] = strings.TrimSpace(*req.CustomerName)
		}
		if req.CustomerPhone != nil {
			updates["customer_phone_snapshot"] = strings.TrimSpace(*req.CustomerPhone)
		}
		if req.OrderType != nil {
			value := strings.TrimSpace(*req.OrderType)
			if !validOrderType(value) {
				return apperrors.BadRequest("order_type must be pickup or delivery", nil)
			}
			updates["order_type"] = value
		}
		if req.EventDate != nil {
			date, err := parseDate(*req.EventDate, "event_date")
			if err != nil {
				return err
			}
			updates["event_date"] = date
		}
		setStringUpdate(updates, "pickup_time", req.PickupTime)
		setStringUpdate(updates, "delivery_time", req.DeliveryTime)
		setStringUpdate(updates, "delivery_address", req.DeliveryAddr)
		setStringUpdate(updates, "notes", req.Notes)
		if len(updates) == 2 {
			return apperrors.BadRequest("no fields to update", nil)
		}
		if err := s.repo.UpdateOrder(tx, id, currentUser.BusinessID, updates); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "bakery_order.updated", id, "Bakery order updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, id)
}

func (s *Service) UpdateStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*BakeryOrderResponse, error) {
	status := strings.TrimSpace(req.Status)
	if !validOrderStatus(status) {
		return nil, apperrors.BadRequest("invalid order status", nil)
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "bakery order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if !allowedStatusTransition(order.OrderStatus, status) {
			return apperrors.BadRequest("invalid order status transition", map[string]string{"from": order.OrderStatus, "to": status})
		}
		if err := s.repo.UpdateOrder(tx, id, currentUser.BusinessID, map[string]interface{}{"order_status": status, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "bakery_order.status_updated", id, "Bakery order status updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, id)
}

func (s *Service) DeleteOrder(currentUser *utils.AuthContext, id, ipAddress, userAgent string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "bakery order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if order.OrderStatus == "completed" {
			return apperrors.BadRequest("completed orders cannot be deleted; cancel them instead", nil)
		}
		if err := s.repo.UpdateOrder(tx, id, currentUser.BusinessID, map[string]interface{}{"deleted_at": gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "bakery_order.deleted", id, "Bakery order deleted", ipAddress, userAgent)
	})
}

func (s *Service) AddItem(currentUser *utils.AuthContext, orderID string, req OrderItemRequest, ipAddress, userAgent string) (*BakeryOrderResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, orderID, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "bakery order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if !orderCanEdit(order.OrderStatus) {
			return apperrors.BadRequest("items cannot be changed for this order status", nil)
		}
		item, err := s.buildOrderItem(tx, currentUser.BusinessID, order.BranchID, orderID, req)
		if err != nil {
			return err
		}
		if err := s.repo.CreateItem(tx, item); err != nil {
			return err
		}
		if err := s.recalculateOrderTotals(tx, currentUser.BusinessID, orderID); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "bakery_order.updated", orderID, "Bakery order item added", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, orderID)
}

func (s *Service) UpdateItem(currentUser *utils.AuthContext, orderID, itemID string, req OrderItemRequest, ipAddress, userAgent string) (*BakeryOrderResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, orderID, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "bakery order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if !orderCanEdit(order.OrderStatus) {
			return apperrors.BadRequest("items cannot be changed for this order status", nil)
		}
		if _, err := s.repo.FindItemForUpdate(tx, currentUser.BusinessID, orderID, itemID); err != nil {
			return notFound(err, "bakery order item not found")
		}
		item, err := s.buildOrderItem(tx, currentUser.BusinessID, order.BranchID, orderID, req)
		if err != nil {
			return err
		}
		updates := map[string]interface{}{"product_id": item.ProductID, "product_variant_id": item.ProductVariantID, "product_name_snapshot": item.ProductNameSnapshot, "product_variant_name_snapshot": item.ProductVariantNameSnapshot, "item_name_snapshot": item.ItemNameSnapshot, "item_source": item.ItemSource, "quantity": item.Quantity, "unit_id": item.UnitID, "weight": item.Weight, "flavor": item.Flavor, "design_notes": item.DesignNotes, "message_text": item.MessageText, "customizations_json": item.CustomizationsJSON, "unit_price": item.UnitPrice, "discount_amount": item.DiscountAmount, "tax_rate_id": item.TaxRateID, "tax_amount": item.TaxAmount, "line_total": item.LineTotal, "updated_at": time.Now().UTC()}
		if err := s.repo.UpdateItem(tx, itemID, orderID, currentUser.BusinessID, updates); err != nil {
			return err
		}
		if err := s.recalculateOrderTotals(tx, currentUser.BusinessID, orderID); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "bakery_order.updated", orderID, "Bakery order item updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, orderID)
}

func (s *Service) DeleteItem(currentUser *utils.AuthContext, orderID, itemID, ipAddress, userAgent string) (*BakeryOrderResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, orderID, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "bakery order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if !orderCanEdit(order.OrderStatus) {
			return apperrors.BadRequest("items cannot be changed for this order status", nil)
		}
		if err := s.repo.DeleteItem(tx, itemID, orderID, currentUser.BusinessID); err != nil {
			return notFound(err, "bakery order item not found")
		}
		if err := s.recalculateOrderTotals(tx, currentUser.BusinessID, orderID); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "bakery_order.updated", orderID, "Bakery order item deleted", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, orderID)
}

func (s *Service) ListPayments(currentUser *utils.AuthContext, orderID string) ([]BakeryOrderPaymentResponse, error) {
	order, err := s.repo.FindOrder(orderID, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "bakery order not found")
	}
	if !currentUser.CanAccessBranch(order.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	return s.repo.Payments(currentUser.BusinessID, orderID)
}

func (s *Service) AddPayment(currentUser *utils.AuthContext, orderID string, req AddPaymentRequest, ipAddress, userAgent string) (*BakeryOrderResponse, error) {
	if err := validateUUID(req.PaymentMethodID, "payment_method_id"); err != nil {
		return nil, err
	}
	if req.Amount <= 0 {
		return nil, apperrors.BadRequest("amount must be greater than zero", nil)
	}
	if !validPaymentType(req.PaymentType) {
		return nil, apperrors.BadRequest("payment_type must be deposit, balance, or full", nil)
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, orderID, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "bakery order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if order.OrderStatus == "cancelled" {
			return apperrors.BadRequest("cannot add payment to cancelled order", nil)
		}
		method, err := s.repo.PaymentMethod(tx, currentUser.BusinessID, req.PaymentMethodID)
		if err != nil {
			return notFound(err, "payment method not found")
		}
		if method.RequiresReference && strings.TrimSpace(req.ReferenceNumber) == "" {
			return apperrors.BadRequest("reference_number is required for this payment method", nil)
		}
		if req.Amount > order.BalanceAmount {
			return apperrors.BadRequest("payment amount cannot exceed order balance", map[string]float64{"balance_amount": roundMoney(order.BalanceAmount)})
		}
		now := time.Now().UTC()
		payment := &BakeryOrderPayment{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, BakeryOrderID: orderID, PaymentMethodID: method.ID, PaymentMethodNameSnapshot: method.MethodName, Amount: roundMoney(req.Amount), ReferenceNumber: strings.TrimSpace(req.ReferenceNumber), PaymentType: req.PaymentType, PaidByUserID: currentUser.UserID, PaidAt: now}
		if err := s.repo.CreatePayment(tx, payment); err != nil {
			return err
		}
		paid := roundMoney(order.PaidAmount + payment.Amount)
		if paid > order.TotalAmount {
			paid = order.TotalAmount
		}
		balance := roundMoney(order.TotalAmount - paid)
		if err := s.repo.UpdateOrder(tx, orderID, currentUser.BusinessID, map[string]interface{}{"paid_amount": paid, "balance_amount": balance, "payment_status": paymentStatus(order.TotalAmount, paid), "updated_by_user_id": currentUser.UserID, "updated_at": now}); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "bakery_order.payment_added", orderID, "Bakery order payment added", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, orderID)
}

func (s *Service) AssignProduction(currentUser *utils.AuthContext, orderID string, req AssignProductionRequest, ipAddress, userAgent string) (*BakeryOrderResponse, error) {
	if err := validateUUID(req.ProductionBatchID, "production_batch_id"); err != nil {
		return nil, err
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, orderID, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "bakery order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if err := s.repo.ProductionBatch(tx, currentUser.BusinessID, order.BranchID, req.ProductionBatchID); err != nil {
			return notFound(err, "production batch not found")
		}
		batchID := strings.TrimSpace(req.ProductionBatchID)
		production := &BakeryOrderProduction{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, BakeryOrderID: orderID, ProductionBatchID: &batchID, Status: "assigned"}
		if err := s.repo.UpsertProduction(tx, production); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "bakery_order.production_assigned", orderID, "Bakery order production assigned", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, orderID)
}

func (s *Service) CreateProductionFromItem(currentUser *utils.AuthContext, orderID, itemID string, req CreateProductionFromItemRequest, ipAddress, userAgent string) (*BakeryOrderResponse, error) {
	if s.manufacturingService == nil {
		return nil, apperrors.Internal("manufacturing service is not configured")
	}
	if req.PlannedQuantity < 0 {
		return nil, apperrors.BadRequest("planned_quantity must be greater than zero when provided", nil)
	}
	var order *BakeryOrder
	var item *BakeryOrderItem
	var recipeID string
	var plannedQuantity float64
	var productionDate string
	var notes string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		lockedOrder, err := s.repo.FindOrderForUpdate(tx, orderID, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "bakery order not found")
		}
		if !currentUser.CanAccessBranch(lockedOrder.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if !orderCanCreateProduction(lockedOrder.OrderStatus) {
			return apperrors.BadRequest("production cannot be created for this order status", map[string]string{"order_status": lockedOrder.OrderStatus})
		}
		lockedItem, err := s.repo.FindItemForUpdate(tx, currentUser.BusinessID, orderID, itemID)
		if err != nil {
			return notFound(err, "bakery order item not found")
		}
		resolvedRecipe, err := s.resolveProductionRecipe(tx, currentUser.BusinessID, lockedOrder.BranchID, lockedItem, req.RecipeID)
		if err != nil {
			return err
		}
		order = lockedOrder
		item = lockedItem
		recipeID = resolvedRecipe.ID
		plannedQuantity = req.PlannedQuantity
		if plannedQuantity <= 0 {
			plannedQuantity = lockedItem.Quantity
		}
		productionDate = strings.TrimSpace(req.ProductionDate)
		if productionDate == "" {
			productionDate = lockedOrder.EventDate.Format("2006-01-02")
		}
		notes = strings.TrimSpace(req.Notes)
		if notes == "" {
			notes = "Bakery order " + lockedOrder.OrderNumber + " item " + lockedItem.ItemNameSnapshot
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	batch, err := s.manufacturingService.CreateBatch(currentUser, manufacturing.CreateBatchRequest{
		BranchID:        order.BranchID,
		RecipeID:        recipeID,
		PlannedQuantity: plannedQuantity,
		ProductionDate:  productionDate,
		Notes:           notes,
	}, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		batchID := batch.ID
		production := &BakeryOrderProduction{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, BakeryOrderID: orderID, BakeryOrderItemID: &item.ID, ProductionBatchID: &batchID, Status: "assigned"}
		if err := s.repo.UpsertProduction(tx, production); err != nil {
			return err
		}
		updates := map[string]interface{}{"updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
		if order.OrderStatus == "confirmed" {
			updates["order_status"] = "in_production"
		}
		if len(updates) > 2 {
			if err := s.repo.UpdateOrder(tx, orderID, currentUser.BusinessID, updates); err != nil {
				return err
			}
		}
		return s.audit(tx, currentUser, "bakery_order.production_batch_created", orderID, "Production batch created from bakery order item", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, orderID)
}

func (s *Service) UpdateProductionStatus(currentUser *utils.AuthContext, orderID string, req UpdateProductionStatusRequest, ipAddress, userAgent string) (*BakeryOrderResponse, error) {
	status := strings.TrimSpace(req.Status)
	if !validProductionStatus(status) {
		return nil, apperrors.BadRequest("invalid production status", nil)
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, orderID, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "bakery order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		production := &BakeryOrderProduction{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, BakeryOrderID: orderID, Status: status}
		if err := s.repo.UpsertProduction(tx, production); err != nil {
			return err
		}
		updates := map[string]interface{}{"updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
		if status == "in_progress" {
			updates["order_status"] = "in_production"
		}
		if status == "completed" {
			updates["order_status"] = "ready"
		}
		if len(updates) > 2 {
			if err := s.repo.UpdateOrder(tx, orderID, currentUser.BusinessID, updates); err != nil {
				return err
			}
		}
		return s.audit(tx, currentUser, "bakery_order.production_assigned", orderID, "Bakery order production status updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, orderID)
}

func (s *Service) ListPackaging(currentUser *utils.AuthContext, orderID string) ([]BakeryOrderPackagingResponse, error) {
	order, err := s.repo.FindOrder(orderID, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "bakery order not found")
	}
	if !currentUser.CanAccessBranch(order.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	return s.repo.Packaging(currentUser.BusinessID, orderID)
}

func (s *Service) AddPackaging(currentUser *utils.AuthContext, orderID string, req AddPackagingRequest, ipAddress, userAgent string) (*BakeryOrderResponse, error) {
	if err := validateUUID(req.PackagingItemID, "packaging_item_id"); err != nil {
		return nil, err
	}
	if err := validateUUID(req.UnitID, "unit_id"); err != nil {
		return nil, err
	}
	if req.QuantityRequired <= 0 {
		return nil, apperrors.BadRequest("quantity_required must be greater than zero", nil)
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, orderID, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "bakery order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		item, err := s.repo.PackagingItem(tx, currentUser.BusinessID, order.BranchID, req.PackagingItemID)
		if err != nil {
			return notFound(err, "packaging item not found")
		}
		if item.Status != "active" {
			return apperrors.BadRequest("packaging item is not active", nil)
		}
		if req.UnitID != item.UnitID {
			return apperrors.BadRequest("unit conversion is not available yet; packaging unit must match packaging item unit", nil)
		}
		packaging := &BakeryOrderPackaging{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, BakeryOrderID: orderID, PackagingItemID: item.ID, PackagingNameSnapshot: item.PackagingName, QuantityRequired: roundQuantity(req.QuantityRequired), UnitID: req.UnitID}
		if err := s.repo.CreatePackaging(tx, packaging); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "bakery_order.packaging_assigned", orderID, "Bakery order packaging assigned", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, orderID)
}

func (s *Service) Summary(currentUser *utils.AuthContext) (*SummaryResponse, error) {
	branchID, allBranches, err := currentUser.ResolveBranchScope("", "")
	if err != nil {
		return nil, err
	}
	if allBranches {
		return s.repo.Summary(currentUser.BusinessID)
	}
	return s.repo.SummaryByBranch(currentUser.BusinessID, branchID)
}

func (s *Service) buildOrder(tx *gorm.DB, currentUser *utils.AuthContext, req CreateOrderRequest) (*BakeryOrder, []BakeryOrderItem, error) {
	branchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return nil, nil, err
	}
	req.BranchID = branchID
	if err := validateUUID(req.BranchID, "branch_id"); err != nil {
		return nil, nil, err
	}
	if err := s.repo.ValidateBranch(tx, currentUser.BusinessID, req.BranchID); err != nil {
		return nil, nil, notFound(err, "branch not found")
	}
	orderType := strings.TrimSpace(req.OrderType)
	if !validOrderType(orderType) {
		return nil, nil, apperrors.BadRequest("order_type must be pickup or delivery", nil)
	}
	eventDate, err := parseDate(req.EventDate, "event_date")
	if err != nil {
		return nil, nil, err
	}
	if len(req.Items) == 0 {
		return nil, nil, apperrors.BadRequest("items are required", nil)
	}
	customerName := strings.TrimSpace(req.CustomerName)
	customerPhone := strings.TrimSpace(req.CustomerPhone)
	var customerID *string
	if strings.TrimSpace(req.CustomerID) != "" {
		customer, err := s.validCustomer(tx, currentUser.BusinessID, req.BranchID, req.CustomerID)
		if err != nil {
			return nil, nil, err
		}
		customerID = &customer.ID
		customerName = customer.FullName
		customerPhone = customer.Phone
	}
	orderID := utils.NewUUID()
	items := make([]BakeryOrderItem, 0, len(req.Items))
	for _, itemReq := range req.Items {
		item, err := s.buildOrderItem(tx, currentUser.BusinessID, req.BranchID, orderID, itemReq)
		if err != nil {
			return nil, nil, err
		}
		items = append(items, *item)
	}
	subtotal, discount, tax, total := orderTotals(items)
	order := &BakeryOrder{ID: orderID, BusinessID: currentUser.BusinessID, BranchID: req.BranchID, CustomerID: customerID, CustomerNameSnapshot: customerName, CustomerPhoneSnapshot: customerPhone, OrderType: orderType, OrderDate: dateOnly(time.Now().UTC()), EventDate: eventDate, PickupTime: strings.TrimSpace(req.PickupTime), DeliveryTime: strings.TrimSpace(req.DeliveryTime), DeliveryAddress: strings.TrimSpace(req.DeliveryAddr), SubtotalAmount: subtotal, DiscountAmount: discount, TaxAmount: tax, TotalAmount: total, PaidAmount: 0, BalanceAmount: total, PaymentStatus: "unpaid", OrderStatus: "new", Notes: strings.TrimSpace(req.Notes), CreatedByUserID: currentUser.UserID, UpdatedByUserID: currentUser.UserID}
	return order, items, nil
}

func (s *Service) buildOrderItem(tx *gorm.DB, businessID, branchID, orderID string, req OrderItemRequest) (*BakeryOrderItem, error) {
	if err := validateUUID(req.UnitID, "unit_id"); err != nil {
		return nil, err
	}
	if req.Quantity <= 0 {
		return nil, apperrors.BadRequest("quantity must be greater than zero", nil)
	}
	if req.UnitPrice < 0 {
		return nil, apperrors.BadRequest("unit_price must be non-negative", nil)
	}
	if req.DiscountAmount < 0 {
		return nil, apperrors.BadRequest("discount_amount must be non-negative", nil)
	}
	if err := s.repo.ValidateUnit(tx, businessID, req.UnitID); err != nil {
		return nil, notFound(err, "unit not found")
	}
	weight, err := parseOptionalWeight(req.Weight)
	if err != nil {
		return nil, err
	}
	productIDValue := strings.TrimSpace(req.ProductID)
	var productID *string
	var productVariantID *string
	productName := ""
	variantName := ""
	itemName := ""
	itemSource := "catalog"
	unitPrice := req.UnitPrice
	var taxRateID *string
	var tax *taxRow

	if productIDValue == "" {
		if strings.TrimSpace(req.ProductVariantID) != "" {
			return nil, apperrors.BadRequest("product_variant_id is only allowed for catalog items", nil)
		}
		itemSource = "custom"
		itemName = strings.TrimSpace(req.ItemName)
		if itemName == "" {
			return nil, apperrors.BadRequest("item_name is required for custom bakery order items", nil)
		}
		productName = itemName
	} else {
		if err := validateUUID(productIDValue, "product_id"); err != nil {
			return nil, err
		}
		product, err := s.repo.Product(tx, businessID, branchID, productIDValue)
		if err != nil {
			return nil, notFound(err, "product not found")
		}
		if product.Status != "active" {
			return nil, apperrors.BadRequest("product is not active", nil)
		}
		productID = &product.ID
		productName = product.ProductName
		itemName = product.ProductName
		if unitPrice <= 0 {
			unitPrice = product.SalePrice
		}
		if strings.TrimSpace(req.ProductVariantID) != "" {
			if err := validateUUID(req.ProductVariantID, "product_variant_id"); err != nil {
				return nil, err
			}
			variant, err := s.repo.ProductVariant(tx, businessID, branchID, product.ID, req.ProductVariantID)
			if err != nil {
				return nil, notFound(err, "product variant not found")
			}
			if variant.Status != "active" {
				return nil, apperrors.BadRequest("product variant is not active", nil)
			}
			productVariantID = &variant.ID
			variantName = variant.VariantName
			itemName = strings.TrimSpace(product.ProductName + " - " + variant.VariantName)
			if req.UnitPrice <= 0 {
				unitPrice = variant.SalePrice
				if unitPrice <= 0 {
					unitPrice = product.SalePrice
				}
			}
		}
		tax, err = s.repo.TaxRate(tx, businessID, product.TaxRateID)
		if err != nil {
			return nil, notFound(err, "tax rate not found")
		}
	}
	subtotal := roundMoney(req.Quantity * unitPrice)
	if req.DiscountAmount > subtotal {
		return nil, apperrors.BadRequest("discount_amount cannot exceed line subtotal", nil)
	}
	taxable := roundMoney(subtotal - req.DiscountAmount)
	taxAmount := 0.0
	lineTotal := taxable
	if tax != nil {
		taxRateID = &tax.ID
		if tax.IsInclusive {
			taxAmount = roundMoney(taxable - (taxable / (1 + tax.RatePercentage/100)))
			lineTotal = taxable
		} else {
			taxAmount = roundMoney(taxable * tax.RatePercentage / 100)
			lineTotal = roundMoney(taxable + taxAmount)
		}
	}
	customizations, err := normalizeJSON(req.CustomizationsJSON)
	if err != nil {
		return nil, err
	}
	return &BakeryOrderItem{ID: utils.NewUUID(), BusinessID: businessID, BakeryOrderID: orderID, ProductID: productID, ProductVariantID: productVariantID, ProductNameSnapshot: productName, ProductVariantNameSnapshot: variantName, ItemNameSnapshot: itemName, ItemSource: itemSource, Quantity: roundQuantity(req.Quantity), UnitID: req.UnitID, Weight: weight, Flavor: strings.TrimSpace(req.Flavor), DesignNotes: strings.TrimSpace(req.DesignNotes), MessageText: strings.TrimSpace(req.MessageText), CustomizationsJSON: customizations, UnitPrice: roundMoney(unitPrice), DiscountAmount: roundMoney(req.DiscountAmount), TaxRateID: taxRateID, TaxAmount: taxAmount, LineTotal: lineTotal}, nil
}

func (s *Service) resolveProductionRecipe(tx *gorm.DB, businessID, branchID string, item *BakeryOrderItem, requestedRecipeID string) (*recipeProductionRow, error) {
	recipeID := strings.TrimSpace(requestedRecipeID)
	if item.ItemSource == "custom" {
		if recipeID == "" {
			return nil, apperrors.BadRequest("recipe_id is required for custom bakery order items", nil)
		}
		return s.activeRecipeByID(tx, businessID, branchID, recipeID)
	}
	if item.ProductID == nil {
		return nil, apperrors.BadRequest("catalog bakery order item is missing product_id", nil)
	}
	if recipeID == "" {
		recipe, err := s.repo.ActiveRecipeForItem(tx, businessID, branchID, *item.ProductID, item.ProductVariantID)
		if err != nil {
			return nil, notFound(err, "active recipe not found for bakery order item")
		}
		return recipe, nil
	}
	recipe, err := s.activeRecipeByID(tx, businessID, branchID, recipeID)
	if err != nil {
		return nil, err
	}
	if recipe.ProductID != *item.ProductID {
		return nil, apperrors.BadRequest("recipe product does not match bakery order item product", nil)
	}
	if !sameOptionalID(recipe.ProductVariantID, item.ProductVariantID) {
		return nil, apperrors.BadRequest("recipe variant does not match bakery order item variant", nil)
	}
	return recipe, nil
}

func (s *Service) activeRecipeByID(tx *gorm.DB, businessID, branchID, recipeID string) (*recipeProductionRow, error) {
	if err := validateUUID(recipeID, "recipe_id"); err != nil {
		return nil, err
	}
	recipe, err := s.repo.RecipeForProduction(tx, businessID, branchID, recipeID)
	if err != nil {
		return nil, notFound(err, "active recipe not found")
	}
	if !recipe.IsActive || recipe.Status != "active" {
		return nil, apperrors.BadRequest("recipe must be active before creating production", nil)
	}
	return recipe, nil
}

func (s *Service) validCustomer(tx *gorm.DB, businessID, branchID, customerID string) (*customerRow, error) {
	if err := validateUUID(customerID, "customer_id"); err != nil {
		return nil, err
	}
	customer, err := s.repo.Customer(tx, businessID, branchID, customerID)
	if err != nil {
		return nil, notFound(err, "customer not found")
	}
	if customer.Status != "active" {
		return nil, apperrors.BadRequest("customer must be active", nil)
	}
	return customer, nil
}

func (s *Service) recalculateOrderTotals(tx *gorm.DB, businessID, orderID string) error {
	order, err := s.repo.FindOrderForUpdate(tx, orderID, businessID)
	if err != nil {
		return err
	}
	items, err := s.repo.Items(businessID, orderID)
	if err != nil {
		return err
	}
	subtotal, discount, tax, total := orderTotals(items)
	if order.PaidAmount > total {
		return apperrors.BadRequest("order total cannot be lower than already paid amount", map[string]float64{"paid_amount": order.PaidAmount, "new_total": total})
	}
	return s.repo.UpdateOrder(tx, orderID, businessID, map[string]interface{}{"subtotal_amount": subtotal, "discount_amount": discount, "tax_amount": tax, "total_amount": total, "balance_amount": roundMoney(total - order.PaidAmount), "payment_status": paymentStatus(total, order.PaidAmount), "updated_at": time.Now().UTC()})
}

func (s *Service) orderResponse(businessID string, order BakeryOrder, includeDetails bool) BakeryOrderResponse {
	response := BakeryOrderResponse{ID: order.ID, BusinessID: order.BusinessID, BranchID: order.BranchID, BranchName: s.repo.BranchName(businessID, order.BranchID), OrderNumber: order.OrderNumber, CustomerID: order.CustomerID, CustomerNameSnapshot: order.CustomerNameSnapshot, CustomerPhoneSnapshot: order.CustomerPhoneSnapshot, OrderType: order.OrderType, OrderDate: order.OrderDate, EventDate: order.EventDate, PickupTime: order.PickupTime, DeliveryTime: order.DeliveryTime, DeliveryAddress: order.DeliveryAddress, SubtotalAmount: roundMoney(order.SubtotalAmount), DiscountAmount: roundMoney(order.DiscountAmount), TaxAmount: roundMoney(order.TaxAmount), TotalAmount: roundMoney(order.TotalAmount), PaidAmount: roundMoney(order.PaidAmount), BalanceAmount: roundMoney(order.BalanceAmount), PaymentStatus: order.PaymentStatus, OrderStatus: order.OrderStatus, Notes: order.Notes, CreatedByUserID: order.CreatedByUserID, CreatedByUserName: s.repo.UserName(order.CreatedByUserID), CreatedAt: order.CreatedAt, UpdatedAt: order.UpdatedAt}
	if includeDetails {
		items, _ := s.repo.Items(businessID, order.ID)
		response.Items = s.itemResponses(businessID, items)
		response.Payments, _ = s.repo.Payments(businessID, order.ID)
		if production, err := s.repo.Production(businessID, order.ID); err == nil && production != nil {
			response.Production = production
		}
		response.Productions, _ = s.repo.Productions(businessID, order.ID)
		response.Packaging, _ = s.repo.Packaging(businessID, order.ID)
	}
	return response
}

func (s *Service) itemResponses(businessID string, items []BakeryOrderItem) []BakeryOrderItemResponse {
	result := make([]BakeryOrderItemResponse, 0, len(items))
	for _, item := range items {
		customizations := ""
		if item.CustomizationsJSON != nil {
			customizations = *item.CustomizationsJSON
		}
		weight := ""
		if item.Weight != nil {
			weight = strconv.FormatFloat(roundQuantity(*item.Weight), 'f', -1, 64)
		}
		result = append(result, BakeryOrderItemResponse{ID: item.ID, BakeryOrderID: item.BakeryOrderID, ProductID: item.ProductID, ProductVariantID: item.ProductVariantID, ProductNameSnapshot: item.ProductNameSnapshot, ProductVariantNameSnapshot: item.ProductVariantNameSnapshot, ItemNameSnapshot: item.ItemNameSnapshot, ItemSource: item.ItemSource, Quantity: roundQuantity(item.Quantity), UnitID: item.UnitID, UnitSymbol: s.repo.UnitSymbol(item.UnitID), Weight: weight, Flavor: item.Flavor, DesignNotes: item.DesignNotes, MessageText: item.MessageText, CustomizationsJSON: customizations, UnitPrice: roundMoney(item.UnitPrice), DiscountAmount: roundMoney(item.DiscountAmount), TaxRateID: item.TaxRateID, TaxRateName: s.repo.TaxName(businessID, item.TaxRateID), TaxAmount: roundMoney(item.TaxAmount), LineTotal: roundMoney(item.LineTotal), CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt})
	}
	return result
}

func (s *Service) audit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	return s.auditRepo.CreateActivity(tx, audit.ActivityInput{BusinessID: currentUser.BusinessID, ActorUserID: currentUser.UserID, EventType: eventType, EntityType: "bakery_order", EntityID: entityID, Summary: summary, IPAddress: ipAddress, UserAgent: userAgent})
}

func orderTotals(items []BakeryOrderItem) (float64, float64, float64, float64) {
	subtotal, discount, tax, total := 0.0, 0.0, 0.0, 0.0
	for _, item := range items {
		subtotal += item.Quantity * item.UnitPrice
		discount += item.DiscountAmount
		tax += item.TaxAmount
		total += item.LineTotal
	}
	return roundMoney(subtotal), roundMoney(discount), roundMoney(tax), roundMoney(total)
}

func normalizeQuery(query *OrderListQuery) {
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

func validateListQuery(query OrderListQuery) error {
	for field, value := range map[string]string{"branch_id": query.BranchID, "customer_id": query.CustomerID} {
		if strings.TrimSpace(value) != "" {
			if err := validateUUID(value, field); err != nil {
				return err
			}
		}
	}
	if query.OrderType != "" && !validOrderType(query.OrderType) {
		return apperrors.BadRequest("invalid order_type", nil)
	}
	if query.OrderStatus != "" && !validOrderStatus(query.OrderStatus) {
		return apperrors.BadRequest("invalid order_status", nil)
	}
	if query.PaymentStatus != "" && !validPaymentStatus(query.PaymentStatus) {
		return apperrors.BadRequest("invalid payment_status", nil)
	}
	return nil
}

func parseDate(value, field string) (time.Time, error) {
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, apperrors.BadRequest(field+" must use YYYY-MM-DD format", nil)
	}
	return parsed, nil
}

func validateUUID(value, field string) error {
	if _, err := uuid.Parse(strings.TrimSpace(value)); err != nil {
		return apperrors.BadRequest(field+" must be a valid UUID", nil)
	}
	return nil
}

func setStringUpdate(updates map[string]interface{}, column string, value *string) {
	if value != nil {
		updates[column] = strings.TrimSpace(*value)
	}
}

func normalizeJSON(raw json.RawMessage) (*string, error) {
	if len(raw) == 0 || strings.TrimSpace(string(raw)) == "null" {
		return nil, nil
	}
	trimmed := strings.TrimSpace(string(raw))
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		trimmed = strings.TrimSpace(asString)
		if trimmed == "" {
			return nil, nil
		}
	}
	var decoded interface{}
	if err := json.Unmarshal([]byte(trimmed), &decoded); err != nil {
		return nil, apperrors.BadRequest("customizations_json must be valid JSON", nil)
	}
	return &trimmed, nil
}

func parseOptionalWeight(raw json.RawMessage) (*float64, error) {
	if len(raw) == 0 || strings.TrimSpace(string(raw)) == "null" {
		return nil, nil
	}
	var number float64
	if err := json.Unmarshal(raw, &number); err == nil {
		if number <= 0 {
			return nil, apperrors.BadRequest("weight must be greater than zero when provided", nil)
		}
		rounded := roundQuantity(number)
		return &rounded, nil
	}
	var text string
	if err := json.Unmarshal(raw, &text); err != nil {
		return nil, apperrors.BadRequest("weight must be a number or numeric string", nil)
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, nil
	}
	value, err := strconv.ParseFloat(extractNumericPrefix(text), 64)
	if err != nil || value <= 0 {
		return nil, apperrors.BadRequest("weight must contain a positive number", nil)
	}
	rounded := roundQuantity(value)
	return &rounded, nil
}

func extractNumericPrefix(value string) string {
	builder := strings.Builder{}
	seenDigit := false
	seenDot := false
	for _, r := range value {
		if r >= '0' && r <= '9' {
			seenDigit = true
			builder.WriteRune(r)
			continue
		}
		if r == '.' && !seenDot {
			seenDot = true
			builder.WriteRune(r)
			continue
		}
		if (r == '-' || r == '+') && builder.Len() == 0 {
			builder.WriteRune(r)
			continue
		}
		if seenDigit {
			break
		}
	}
	return builder.String()
}

func paymentStatus(total, paid float64) string {
	if paid <= 0 {
		return "unpaid"
	}
	if paid < total {
		return "partial"
	}
	return "paid"
}

func dateOnly(t time.Time) time.Time {
	parsed, _ := time.Parse("2006-01-02", t.Format("2006-01-02"))
	return parsed
}

func validOrderType(value string) bool {
	return value == "pickup" || value == "delivery"
}

func validOrderStatus(value string) bool {
	switch value {
	case "new", "confirmed", "in_production", "ready", "delivered", "completed", "cancelled":
		return true
	default:
		return false
	}
}

func validPaymentStatus(value string) bool {
	switch value {
	case "unpaid", "partial", "paid", "refunded":
		return true
	default:
		return false
	}
}

func validPaymentType(value string) bool {
	return value == "deposit" || value == "balance" || value == "full"
}

func validProductionStatus(value string) bool {
	return value == "pending" || value == "assigned" || value == "in_progress" || value == "completed"
}

func allowedStatusTransition(from, to string) bool {
	if from == to || to == "cancelled" {
		return true
	}
	allowed := map[string]string{"new": "confirmed", "confirmed": "in_production", "in_production": "ready", "ready": "delivered", "delivered": "completed"}
	return allowed[from] == to
}

func orderCanEdit(status string) bool {
	return status == "new" || status == "confirmed"
}

func orderCanCreateProduction(status string) bool {
	return status == "new" || status == "confirmed" || status == "in_production"
}

func sameOptionalID(left, right *string) bool {
	if left == nil && right == nil {
		return true
	}
	if left == nil || right == nil {
		return false
	}
	return *left == *right
}

func notFound(err error, message string) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apperrors.NotFound(message)
	}
	return err
}
