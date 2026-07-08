package purchasing

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/charges"
	"pastries-pos/internal/modules/inventory"
	"pastries-pos/internal/modules/products"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db                *gorm.DB
	repo              *Repository
	inventoryRepo     *inventory.Repository
	inventoryService  *inventory.Service
	auditRepo         *audit.Repository
	accountingService *accounting.Service
	pricingService    *products.Service
}

func NewService(db *gorm.DB, repo *Repository, inventoryRepo *inventory.Repository, inventoryService *inventory.Service, auditRepo *audit.Repository, accountingService ...*accounting.Service) *Service {
	service := &Service{db: db, repo: repo, inventoryRepo: inventoryRepo, inventoryService: inventoryService, auditRepo: auditRepo}
	if len(accountingService) > 0 {
		service.accountingService = accountingService[0]
	}
	return service
}

func (s *Service) SetPricingService(pricingService *products.Service) {
	s.pricingService = pricingService
}

func (s *Service) ListOrders(currentUser *utils.AuthContext, query ListQuery) (*PaginatedResponse[PurchaseOrderResponse], error) {
	normalizeQuery(&query)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if allBranches {
		query.BranchID = ""
	} else {
		query.BranchID = branchID
	}
	orders, total, err := s.repo.ListOrders(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list purchase orders")
	}
	items := make([]PurchaseOrderResponse, 0, len(orders))
	for _, order := range orders {
		items = append(items, s.orderResponse(currentUser.BusinessID, order, false))
	}
	return &PaginatedResponse[PurchaseOrderResponse]{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) CreateOrder(currentUser *utils.AuthContext, req CreatePurchaseOrderRequest, ipAddress, userAgent string) (*PurchaseOrderResponse, error) {
	var orderID string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, items, chargeRows, err := s.buildOrder(tx, currentUser, "", req.BranchID, req.SupplierID, req.OrderDate, req.ExpectedDeliveryDate, req.Items, req.Charges, req.Notes)
		if err != nil {
			return err
		}
		number, err := s.repo.NextNumber(tx, currentUser.BusinessID, "purchase_orders", "purchase_order_number", "PO", "purchase_orders")
		if err != nil {
			return err
		}
		order.PurchaseOrderNumber = number
		if err := s.repo.CreateOrder(tx, order, items); err != nil {
			return err
		}
		if len(chargeRows) > 0 {
			if err := tx.Create(&chargeRows).Error; err != nil {
				return apperrors.Internal("failed to create purchase order charges")
			}
		}
		if err := s.audit(tx, currentUser, "purchase_order.created", order.ID, "Purchase order created", ipAddress, userAgent); err != nil {
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

func (s *Service) GetOrder(currentUser *utils.AuthContext, id string) (*PurchaseOrderResponse, error) {
	order, err := s.repo.FindOrder(id, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "purchase order not found")
	}
	if !currentUser.CanAccessBranch(order.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	dto := s.orderResponse(currentUser.BusinessID, *order, true)
	return &dto, nil
}

func (s *Service) UpdateOrder(currentUser *utils.AuthContext, id string, req UpdatePurchaseOrderRequest, ipAddress, userAgent string) (*PurchaseOrderResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		existing, err := s.repo.FindOrderForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase order not found")
		}
		if !currentUser.CanAccessBranch(existing.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if existing.Status == "partially_received" {
			return s.updatePartiallyReceivedOrder(tx, currentUser, existing, req, ipAddress, userAgent)
		}
		if existing.Status == "received" || existing.Status == "cancelled" {
			return apperrors.BadRequest("received or cancelled purchase orders cannot be edited", nil)
		}
		branchID := first(req.BranchID, existing.BranchID)
		branchID, err = currentUser.ResolveOperationalBranch(branchID)
		if err != nil {
			return err
		}
		supplierID := first(req.SupplierID, existing.SupplierID)
		orderDate := formatDate(existing.OrderDate)
		if strings.TrimSpace(req.OrderDate) != "" {
			orderDate = req.OrderDate
		}
		expectedDate := optionalDateString(existing.ExpectedDeliveryDate)
		if strings.TrimSpace(req.ExpectedDeliveryDate) != "" {
			expectedDate = req.ExpectedDeliveryDate
		}
		var items []PurchaseOrderItem
		if req.Items != nil {
			built, totals, err := s.buildOrderItems(tx, currentUser.BusinessID, branchID, id, req.Items)
			if err != nil {
				return err
			}
			items = built
			existing.SubtotalAmount = totals.Subtotal
			existing.TaxAmount = totals.Tax
			existing.DiscountAmount = totals.Discount
			existing.TotalAmount = totals.Total
		}
		parsedOrderDate, err := parseDate(orderDate, "order_date")
		if err != nil {
			return err
		}
		parsedExpected, err := parseOptionalDate(expectedDate, "expected_delivery_date")
		if err != nil {
			return err
		}
		if err := s.validateHeader(tx, currentUser.BusinessID, branchID, supplierID); err != nil {
			return err
		}
		updates := map[string]interface{}{"branch_id": branchID, "supplier_id": supplierID, "order_date": parsedOrderDate, "expected_delivery_date": parsedExpected, "notes": strings.TrimSpace(req.Notes), "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
		if req.Items != nil {
			updates["subtotal_amount"] = existing.SubtotalAmount
			updates["tax_amount"] = existing.TaxAmount
			updates["discount_amount"] = existing.DiscountAmount
			updates["total_amount"] = existing.TotalAmount
		}
		if err := s.repo.UpdateOrder(tx, id, currentUser.BusinessID, updates, items); err != nil {
			return err
		}
		if req.Charges != nil {
			if _, err := charges.ReplaceCharges(tx, currentUser.BusinessID, branchID, "purchase_order", id, req.Charges); err != nil {
				return err
			}
		}
		if req.Items != nil || req.Charges != nil {
			if err := s.recalculatePurchaseOrderTotals(tx, currentUser.BusinessID, id); err != nil {
				return err
			}
		}
		if err := s.audit(tx, currentUser, "purchase_order.updated", id, "Purchase order updated", ipAddress, userAgent); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, id)
}

func (s *Service) updatePartiallyReceivedOrder(tx *gorm.DB, currentUser *utils.AuthContext, existing *PurchaseOrder, req UpdatePurchaseOrderRequest, ipAddress, userAgent string) error {
	if strings.TrimSpace(req.BranchID) != "" && req.BranchID != existing.BranchID {
		return apperrors.BadRequest("partially received purchase orders cannot change branch", nil)
	}
	if strings.TrimSpace(req.SupplierID) != "" && req.SupplierID != existing.SupplierID {
		return apperrors.BadRequest("partially received purchase orders cannot change supplier", nil)
	}
	if strings.TrimSpace(req.OrderDate) != "" && req.OrderDate != formatDate(existing.OrderDate) {
		return apperrors.BadRequest("partially received purchase orders cannot change order_date", nil)
	}

	expectedDate := optionalDateString(existing.ExpectedDeliveryDate)
	if strings.TrimSpace(req.ExpectedDeliveryDate) != "" {
		expectedDate = req.ExpectedDeliveryDate
	}
	parsedExpected, err := parseOptionalDate(expectedDate, "expected_delivery_date")
	if err != nil {
		return err
	}

	itemTotals := totals{}
	if req.Items != nil {
		items, err := s.repo.OrderItemsForUpdate(tx, existing.ID, currentUser.BusinessID)
		if err != nil {
			return apperrors.Internal("failed to load purchase order items")
		}
		inputsByID := make(map[string]PurchaseOrderItemInput, len(req.Items))
		for _, input := range req.Items {
			if strings.TrimSpace(input.ID) == "" {
				return apperrors.BadRequest("correction edits can only update existing purchase order lines. Add new items using a new purchase order or a supported adjustment flow.", map[string]interface{}{"reason": "purchase_order_correction_line_id_required"})
			}
			inputsByID[input.ID] = input
		}
		if len(inputsByID) != len(items) {
			return apperrors.BadRequest("correction edits can only update existing purchase order lines. Add new items using a new purchase order or a supported adjustment flow.", map[string]interface{}{"reason": "purchase_order_correction_lines_locked"})
		}
		for _, item := range items {
			input, ok := inputsByID[item.ID]
			if !ok {
				return apperrors.BadRequest("correction edits cannot remove existing purchase order lines.", map[string]interface{}{"reason": "purchase_order_correction_line_removed"})
			}
			storedLineType := normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID)
			if storedLineType == "account" {
				if normalizedOrderLineType(input) != "account" ||
					input.AccountID != deref(item.AccountID) ||
					strings.TrimSpace(input.Description) != strings.TrimSpace(item.Description) ||
					roundQuantity(input.QuantityOrdered) != roundQuantity(item.QuantityOrdered) ||
					roundMoney(input.UnitCost) != roundMoney(item.UnitCost) ||
					roundMoney(input.DiscountAmount) != roundMoney(item.DiscountAmount) ||
					input.TaxRateID != deref(item.TaxRateID) {
					return apperrors.BadRequest("correction edits can only adjust existing product ordered quantities.", map[string]interface{}{"reason": "purchase_order_correction_only_quantity_allowed"})
				}
				itemTotals.Subtotal += roundMoney(item.QuantityOrdered * item.UnitCost)
				itemTotals.Discount += roundMoney(item.DiscountAmount)
				itemTotals.Tax += roundMoney(item.TaxAmount)
				itemTotals.Total += roundMoney(item.LineTotal)
				continue
			}
			if normalizedOrderLineType(input) != "product" ||
				normalizedPurchaseItemType(input.ItemType, input.ProductID != "") != item.ItemType ||
				input.ProductID != deref(item.ProductID) ||
				input.IngredientID != deref(item.IngredientID) ||
				input.PackagingItemID != deref(item.PackagingItemID) ||
				input.UnitID != deref(item.UnitID) ||
				roundMoney(input.UnitCost) != roundMoney(item.UnitCost) ||
				roundMoney(input.DiscountAmount) != roundMoney(item.DiscountAmount) ||
				input.TaxRateID != deref(item.TaxRateID) {
				return apperrors.BadRequest("correction edits can only adjust existing product ordered quantities.", map[string]interface{}{"reason": "purchase_order_correction_only_quantity_allowed"})
			}
			if roundQuantity(input.QuantityOrdered) < roundQuantity(item.QuantityReceived) {
				return apperrors.BadRequest("quantity_ordered cannot be less than quantity_received", map[string]interface{}{"line_id": item.ID, "quantity_received": item.QuantityReceived})
			}
			line, err := s.calculatePurchaseLine(tx, currentUser.BusinessID, input.QuantityOrdered, item.UnitCost, item.DiscountAmount, deref(item.TaxRateID))
			if err != nil {
				return err
			}
			itemTotals.add(line)
			if err := s.repo.UpdateOrderItem(tx, item.ID, currentUser.BusinessID, map[string]interface{}{"quantity_ordered": input.QuantityOrdered, "tax_amount": line.Tax, "line_total": line.Total, "updated_at": time.Now().UTC()}); err != nil {
				return err
			}
		}
		itemTotals = itemTotals.round()
	} else {
		items, err := s.repo.OrderItemsForUpdate(tx, existing.ID, currentUser.BusinessID)
		if err != nil {
			return apperrors.Internal("failed to load purchase order items")
		}
		for _, item := range items {
			itemTotals.Subtotal += roundMoney(item.QuantityOrdered * item.UnitCost)
			itemTotals.Discount += roundMoney(item.DiscountAmount)
			itemTotals.Tax += roundMoney(item.TaxAmount)
			itemTotals.Total += roundMoney(item.LineTotal)
		}
		itemTotals = itemTotals.round()
	}

	updates := map[string]interface{}{
		"expected_delivery_date": parsedExpected,
		"notes":                  strings.TrimSpace(req.Notes),
		"updated_by_user_id":     currentUser.UserID,
		"updated_at":             time.Now().UTC(),
	}
	if req.Items != nil {
		updates["subtotal_amount"] = itemTotals.Subtotal
		updates["discount_amount"] = itemTotals.Discount
		updates["tax_amount"] = roundMoney(itemTotals.Tax + existing.ChargeTaxAmount)
		updates["total_amount"] = roundMoney(itemTotals.Total + existing.ChargeAmount + existing.ChargeTaxAmount)
	}
	if err := s.repo.UpdateOrder(tx, existing.ID, currentUser.BusinessID, updates, nil); err != nil {
		return err
	}
	return s.audit(tx, currentUser, "purchase_order.adjusted_remaining", existing.ID, "Partially received purchase order adjusted", ipAddress, userAgent)
}

func (s *Service) CreateOrderRevision(currentUser *utils.AuthContext, id string, req CreatePurchaseOrderRevisionRequest, ipAddress, userAgent string) (*PurchaseOrderRevisionResponse, error) {
	if err := requireAllOrOverride(currentUser, []string{"purchasing.orders.edit"}, []string{"purchasing.manage"}); err != nil {
		return nil, err
	}
	paymentAction := normalizedPaymentExcessAction(req.PaymentExcessAction)
	var revisionID string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		existing, err := s.repo.FindOrderForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase order not found")
		}
		if !currentUser.CanAccessBranch(existing.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if existing.Status == "cancelled" {
			return apperrors.BadRequest("cancelled purchase orders cannot be revised", nil)
		}

		original := s.orderResponse(currentUser.BusinessID, *existing, true)
		impact, err := s.purchaseOrderRevisionImpact(tx, currentUser, existing, req)
		if err != nil {
			return err
		}
		originalJSON, err := json.Marshal(original)
		if err != nil {
			return apperrors.Internal("failed to snapshot original purchase order")
		}
		revisedJSON, err := json.Marshal(req)
		if err != nil {
			return apperrors.Internal("failed to snapshot revised purchase order")
		}
		impactJSON, err := json.Marshal(impact)
		if err != nil {
			return apperrors.Internal("failed to snapshot purchase order revision impact")
		}
		revisionNumber, err := s.repo.NextOrderRevisionNumber(tx, currentUser.BusinessID, existing.ID)
		if err != nil {
			return err
		}
		revision := &PurchaseOrderRevision{
			ID:                  utils.NewUUID(),
			BusinessID:          currentUser.BusinessID,
			BranchID:            existing.BranchID,
			PurchaseOrderID:     existing.ID,
			RevisionNumber:      revisionNumber,
			Status:              "applied",
			PaymentExcessAction: paymentAction,
			Reason:              strings.TrimSpace(req.Reason),
			OriginalSnapshot:    originalJSON,
			RevisedSnapshot:     revisedJSON,
			ImpactSummary:       impactJSON,
			CreatedByUserID:     currentUser.UserID,
		}
		if err := s.repo.CreateOrderRevision(tx, revision); err != nil {
			return err
		}
		revisionID = revision.ID

		updateReq := UpdatePurchaseOrderRequest{
			BranchID:             req.BranchID,
			SupplierID:           req.SupplierID,
			OrderDate:            req.OrderDate,
			ExpectedDeliveryDate: req.ExpectedDeliveryDate,
			Items:                req.Items,
			Charges:              req.Charges,
			Notes:                req.Notes,
		}
		if impact.HasFinalizedHistory {
			if err := s.updatePartiallyReceivedOrder(tx, currentUser, existing, updateReq, ipAddress, userAgent); err != nil {
				return err
			}
			return s.refreshOrderReceivedStatus(tx, currentUser.BusinessID, existing.ID)
		}
		return s.applyDirectOrderRevisionUpdate(tx, currentUser, existing, updateReq, ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrderRevision(currentUser, revisionID)
}

func (s *Service) GetOrderRevision(currentUser *utils.AuthContext, revisionID string) (*PurchaseOrderRevisionResponse, error) {
	var revision PurchaseOrderRevision
	if err := s.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", revisionID, currentUser.BusinessID).First(&revision).Error; err != nil {
		return nil, notFound(err, "purchase order revision not found")
	}
	order, err := s.repo.FindOrder(revision.PurchaseOrderID, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "purchase order not found")
	}
	if !currentUser.CanAccessBranch(order.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	var impact PurchaseOrderRevisionImpactResponse
	_ = json.Unmarshal(revision.ImpactSummary, &impact)
	orderResponse := s.orderResponse(currentUser.BusinessID, *order, true)
	return &PurchaseOrderRevisionResponse{ID: revision.ID, PurchaseOrderID: revision.PurchaseOrderID, PurchaseOrderNumber: order.PurchaseOrderNumber, RevisionNumber: revision.RevisionNumber, Status: revision.Status, PaymentExcessAction: revision.PaymentExcessAction, Reason: revision.Reason, Impact: impact, Order: orderResponse, CreatedAt: revision.CreatedAt}, nil
}

func (s *Service) purchaseOrderRevisionImpact(tx *gorm.DB, currentUser *utils.AuthContext, existing *PurchaseOrder, req CreatePurchaseOrderRevisionRequest) (PurchaseOrderRevisionImpactResponse, error) {
	impact, err := s.repo.PurchaseOrderRevisionImpactCounts(tx, currentUser.BusinessID, existing.ID)
	if err != nil {
		return impact, err
	}
	impact.OriginalTotal = roundMoney(existing.TotalAmount)
	if req.Items != nil {
		branchID := first(req.BranchID, existing.BranchID)
		built, totals, err := s.buildOrderItems(tx, currentUser.BusinessID, branchID, existing.ID, req.Items)
		if err != nil {
			return impact, err
		}
		_ = built
		impact.RevisedTotal = roundMoney(totals.Total + existing.ChargeAmount + existing.ChargeTaxAmount)
		items, err := s.repo.OrderItemsForUpdate(tx, existing.ID, currentUser.BusinessID)
		if err != nil {
			return impact, apperrors.Internal("failed to load purchase order items")
		}
		byID := make(map[string]PurchaseOrderItemInput, len(req.Items))
		for _, input := range req.Items {
			if strings.TrimSpace(input.ID) != "" {
				byID[input.ID] = input
			}
		}
		for _, item := range items {
			input, ok := byID[item.ID]
			if !ok || normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID) == "account" {
				continue
			}
			delta := roundQuantity(input.QuantityOrdered - item.QuantityOrdered)
			if delta > 0 {
				impact.ExtraQuantityToReceive += delta
			}
			if input.QuantityOrdered < item.QuantityReceived {
				impact.OverReceivedQuantity += roundQuantity(item.QuantityReceived - input.QuantityOrdered)
			}
		}
	} else {
		impact.RevisedTotal = impact.OriginalTotal
	}
	impact.ExtraQuantityToReceive = roundQuantity(impact.ExtraQuantityToReceive)
	impact.OverReceivedQuantity = roundQuantity(impact.OverReceivedQuantity)
	impact.DifferenceAmount = roundMoney(impact.RevisedTotal - impact.OriginalTotal)
	impact.InventoryImpact = purchaseOrderInventoryImpactText(impact)
	impact.BillImpact = purchaseOrderBillImpactText(impact)
	impact.PaymentImpact = purchaseOrderPaymentImpactText(impact)
	impact.AccountingImpact = purchaseOrderAccountingImpactText(impact)
	impact.SupplierBalanceImpact = purchaseOrderSupplierBalanceImpactText(impact)
	return impact, nil
}

func (s *Service) applyDirectOrderRevisionUpdate(tx *gorm.DB, currentUser *utils.AuthContext, existing *PurchaseOrder, req UpdatePurchaseOrderRequest, ipAddress, userAgent string) error {
	branchID := first(req.BranchID, existing.BranchID)
	var err error
	branchID, err = currentUser.ResolveOperationalBranch(branchID)
	if err != nil {
		return err
	}
	supplierID := first(req.SupplierID, existing.SupplierID)
	orderDate := formatDate(existing.OrderDate)
	if strings.TrimSpace(req.OrderDate) != "" {
		orderDate = req.OrderDate
	}
	expectedDate := optionalDateString(existing.ExpectedDeliveryDate)
	if strings.TrimSpace(req.ExpectedDeliveryDate) != "" {
		expectedDate = req.ExpectedDeliveryDate
	}
	var items []PurchaseOrderItem
	if req.Items != nil {
		built, totals, err := s.buildOrderItems(tx, currentUser.BusinessID, branchID, existing.ID, req.Items)
		if err != nil {
			return err
		}
		items = built
		existing.SubtotalAmount = totals.Subtotal
		existing.TaxAmount = totals.Tax
		existing.DiscountAmount = totals.Discount
		existing.TotalAmount = totals.Total
	}
	parsedOrderDate, err := parseDate(orderDate, "order_date")
	if err != nil {
		return err
	}
	parsedExpected, err := parseOptionalDate(expectedDate, "expected_delivery_date")
	if err != nil {
		return err
	}
	if err := s.validateHeader(tx, currentUser.BusinessID, branchID, supplierID); err != nil {
		return err
	}
	updates := map[string]interface{}{"branch_id": branchID, "supplier_id": supplierID, "order_date": parsedOrderDate, "expected_delivery_date": parsedExpected, "notes": strings.TrimSpace(req.Notes), "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
	if req.Items != nil {
		updates["subtotal_amount"] = existing.SubtotalAmount
		updates["tax_amount"] = existing.TaxAmount
		updates["discount_amount"] = existing.DiscountAmount
		updates["total_amount"] = existing.TotalAmount
	}
	if err := s.repo.UpdateOrder(tx, existing.ID, currentUser.BusinessID, updates, items); err != nil {
		return err
	}
	if req.Charges != nil {
		if _, err := charges.ReplaceCharges(tx, currentUser.BusinessID, branchID, "purchase_order", existing.ID, req.Charges); err != nil {
			return err
		}
	}
	if req.Items != nil || req.Charges != nil {
		if err := s.recalculatePurchaseOrderTotals(tx, currentUser.BusinessID, existing.ID); err != nil {
			return err
		}
	}
	return s.audit(tx, currentUser, "purchase_order.revision_direct_update", existing.ID, "Purchase order revision applied directly", ipAddress, userAgent)
}

func normalizedPaymentExcessAction(value string) string {
	switch strings.TrimSpace(value) {
	case "vendor_credit", "refund_receivable":
		return strings.TrimSpace(value)
	default:
		return "supplier_advance"
	}
}

func purchaseOrderInventoryImpactText(impact PurchaseOrderRevisionImpactResponse) string {
	if impact.OverReceivedQuantity > 0 {
		return fmt.Sprintf("Over-received quantity %.3f requires a stock return or correction.", impact.OverReceivedQuantity)
	}
	if impact.ExtraQuantityToReceive > 0 {
		return fmt.Sprintf("Extra quantity %.3f can be received through an additional GRN.", impact.ExtraQuantityToReceive)
	}
	return "No quantity correction required."
}

func purchaseOrderBillImpactText(impact PurchaseOrderRevisionImpactResponse) string {
	if impact.DifferenceAmount > 0 {
		return fmt.Sprintf("Additional payable amount is %.2f.", impact.DifferenceAmount)
	}
	if impact.DifferenceAmount < 0 {
		return fmt.Sprintf("Vendor credit or bill correction amount is %.2f.", -impact.DifferenceAmount)
	}
	return "No bill amount correction required."
}

func purchaseOrderPaymentImpactText(impact PurchaseOrderRevisionImpactResponse) string {
	if impact.SupplierPaymentCount == 0 {
		return "No supplier payment allocation is linked."
	}
	if impact.DifferenceAmount < 0 {
		return fmt.Sprintf("Linked payments may create %.2f excess to handle as supplier advance, vendor credit, or refund receivable.", -impact.DifferenceAmount)
	}
	if impact.DifferenceAmount > 0 {
		return fmt.Sprintf("Linked payments remain unchanged; %.2f becomes additional balance due if billed.", impact.DifferenceAmount)
	}
	return "Linked payments remain unchanged."
}

func purchaseOrderAccountingImpactText(impact PurchaseOrderRevisionImpactResponse) string {
	if impact.HasFinalizedHistory {
		return "Posted journals are preserved; accounting differences must be posted through correction documents."
	}
	return "No posted accounting impact exists; draft/unposted records can be updated directly."
}

func purchaseOrderSupplierBalanceImpactText(impact PurchaseOrderRevisionImpactResponse) string {
	if impact.DifferenceAmount > 0 {
		return fmt.Sprintf("Supplier outstanding can increase by %.2f after correction posting.", impact.DifferenceAmount)
	}
	if impact.DifferenceAmount < 0 {
		return fmt.Sprintf("Supplier outstanding can decrease by %.2f after credit correction.", -impact.DifferenceAmount)
	}
	return "Supplier outstanding is unchanged."
}
func (s *Service) UpdateOrderStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*PurchaseOrderResponse, error) {
	if !validOrderStatus(req.Status) {
		return nil, apperrors.BadRequest("invalid purchase order status", nil)
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if req.Status == "cancelled" && (order.Status == "partially_received" || order.Status == "received") {
			return apperrors.BadRequest("received purchase orders cannot be cancelled", nil)
		}
		if err := s.repo.UpdateOrder(tx, id, currentUser.BusinessID, map[string]interface{}{"status": req.Status, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}, nil); err != nil {
			return err
		}
		event := "purchase_order.status_updated"
		if req.Status == "cancelled" {
			event = "purchase_order.cancelled"
		}
		return s.audit(tx, currentUser, event, id, "Purchase order status updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, id)
}

func (s *Service) ReopenOrder(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*PurchaseOrderResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if order.Status != "cancelled" {
			return apperrors.BadRequest("only cancelled purchase orders can be reopened", nil)
		}
		historyCount, err := s.repo.PurchaseOrderHistoryCount(tx, currentUser.BusinessID, order.ID)
		if err != nil {
			return err
		}
		if historyCount > 0 {
			return apperrors.Conflict("purchase order has linked history and cannot be reopened", map[string]interface{}{"reason": "purchase_order_has_history"})
		}
		if err := s.repo.UpdateOrder(tx, id, currentUser.BusinessID, map[string]interface{}{"status": "draft", "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}, nil); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "purchase_order.reopened", id, "Purchase order reopened", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetOrder(currentUser, id)
}

func (s *Service) DuplicateOrder(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*PurchaseOrderResponse, error) {
	source, err := s.repo.FindOrder(id, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "purchase order not found")
	}
	if !currentUser.CanAccessBranch(source.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	sourceItems, err := s.repo.OrderItems(id, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load purchase order items")
	}
	inputs := make([]PurchaseOrderItemInput, 0, len(sourceItems))
	for _, item := range sourceItems {
		inputs = append(inputs, PurchaseOrderItemInput{
			LineType:        normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID),
			ItemType:        item.ItemType,
			ProductID:       deref(item.ProductID),
			IngredientID:    deref(item.IngredientID),
			PackagingItemID: deref(item.PackagingItemID),
			AccountID:       deref(item.AccountID),
			Description:     first(item.Description, item.ItemNameSnapshot),
			QuantityOrdered: item.QuantityOrdered,
			UnitID:          deref(item.UnitID),
			UnitCost:        item.UnitCost,
			DiscountAmount:  item.DiscountAmount,
			TaxRateID:       deref(item.TaxRateID),
		})
	}
	var sourceCharges []charges.DocumentCharge
	if err := s.db.Where("business_id = ? AND document_type = ? AND document_id = ? AND deleted_at IS NULL", currentUser.BusinessID, "purchase_order", id).Find(&sourceCharges).Error; err != nil {
		return nil, apperrors.Internal("failed to load purchase order charges")
	}
	chargeInputs := make([]charges.ChargeInput, 0, len(sourceCharges))
	for _, charge := range sourceCharges {
		refundable := charge.IsRefundable
		chargeInputs = append(chargeInputs, charges.ChargeInput{
			ChargeType:   charge.ChargeType,
			ChargeName:   charge.ChargeName,
			Description:  charge.Description,
			Amount:       charge.Amount,
			TaxRateID:    deref(charge.TaxRateID),
			IsRefundable: &refundable,
		})
	}
	req := CreatePurchaseOrderRequest{
		BranchID:             source.BranchID,
		SupplierID:           source.SupplierID,
		OrderDate:            time.Now().UTC().Format("2006-01-02"),
		ExpectedDeliveryDate: optionalDateString(source.ExpectedDeliveryDate),
		Items:                inputs,
		Charges:              chargeInputs,
		Notes:                source.Notes,
	}
	return s.CreateOrder(currentUser, req, ipAddress, userAgent)
}

func (s *Service) DeleteOrder(currentUser *utils.AuthContext, id, ipAddress, userAgent string) error {
	if err := requireAllOrOverride(currentUser, []string{"purchasing.orders.delete"}, []string{"purchasing.manage"}); err != nil {
		return err
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		historyCount, err := s.repo.FinalizedPurchaseOrderHistoryCount(tx, currentUser.BusinessID, order.ID)
		if err != nil {
			return err
		}
		if historyCount > 0 {
			return apperrors.Conflict("purchase order has finalized transactions and cannot be deleted. Use returns/corrections or duplicate as draft.", map[string]interface{}{"reason": "purchase_order_has_finalized_history"})
		}
		if err := s.repo.HardDeleteOrder(tx, currentUser.BusinessID, order.ID); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "purchase_order.hard_deleted", order.ID, "Purchase order hard deleted", ipAddress, userAgent)
	})
}

func (s *Service) ConvertOrderToInvoice(currentUser *utils.AuthContext, id string, req ConvertPurchaseOrderToInvoiceRequest, ipAddress, userAgent string) (*PurchaseInvoiceResponse, error) {
	if err := requireAllOrOverride(currentUser, []string{"purchasing.orders.edit", "purchasing.invoices.create"}, []string{"purchasing.manage"}); err != nil {
		return nil, err
	}
	var invoiceID string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		order, err := s.repo.FindOrderForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase order not found")
		}
		if !currentUser.CanAccessBranch(order.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if order.Status == "cancelled" || order.Status == "received" || order.Status == "partially_received" {
			return apperrors.BadRequest("cancelled, received, or partially received purchase orders cannot be converted", nil)
		}
		existingInvoices, err := s.repo.ActiveInvoiceCountForOrder(tx, currentUser.BusinessID, order.ID)
		if err != nil {
			return err
		}
		if existingInvoices > 0 {
			return apperrors.Conflict("purchase order already has a purchase bill", nil)
		}
		orderItems, err := s.repo.OrderItemsForUpdate(tx, order.ID, currentUser.BusinessID)
		if err != nil {
			return err
		}
		if len(orderItems) == 0 {
			return apperrors.BadRequest("purchase order has no items to convert", nil)
		}
		if err := validateUnifiedPurchaseItems(orderItems); err != nil {
			return err
		}
		invoiceDate, err := parseDate(defaultDate(req.InvoiceDate), "invoice_date")
		if err != nil {
			return err
		}
		dueDate, err := parseOptionalDate(req.DueDate, "due_date")
		if err != nil {
			return err
		}
		invoiceNumber, err := s.repo.NextNumber(tx, currentUser.BusinessID, "purchase_invoices", "invoice_number", "PI", "purchase_invoices")
		if err != nil {
			return err
		}
		if exists, err := s.repo.InvoiceNumberExists(tx, currentUser.BusinessID, order.SupplierID, invoiceNumber, ""); err != nil {
			return err
		} else if exists {
			return apperrors.Conflict("generated invoice_number already exists for this supplier", nil)
		}
		notes := strings.TrimSpace(req.Notes)
		if notes == "" {
			notes = order.Notes
		}
		invoiceID = utils.NewUUID()
		invoice := &PurchaseInvoice{
			ID:                 invoiceID,
			BusinessID:         currentUser.BusinessID,
			BranchID:           order.BranchID,
			SupplierID:         order.SupplierID,
			PurchaseOrderID:    &order.ID,
			InvoiceNumber:      invoiceNumber,
			SupplierBillNumber: strings.TrimSpace(req.SupplierBillNumber),
			InvoiceDate:        invoiceDate,
			DueDate:            dueDate,
			Status:             "draft",
			PaymentStatus:      "unpaid",
			SubtotalAmount:     order.SubtotalAmount,
			TaxAmount:          order.TaxAmount,
			ChargeAmount:       order.ChargeAmount,
			ChargeTaxAmount:    order.ChargeTaxAmount,
			DiscountAmount:     order.DiscountAmount,
			TotalAmount:        order.TotalAmount,
			BalanceAmount:      order.TotalAmount,
			Notes:              notes,
			CreatedByUserID:    currentUser.UserID,
			UpdatedByUserID:    currentUser.UserID,
		}
		items := make([]PurchaseInvoiceItem, 0, len(orderItems))
		for _, item := range orderItems {
			if normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID) == "account" {
				items = append(items, PurchaseInvoiceItem{
					ID:                utils.NewUUID(),
					BusinessID:        currentUser.BusinessID,
					PurchaseInvoiceID: invoiceID,
					LineType:          "account",
					ItemType:          "account",
					AccountID:         item.AccountID,
					AccountName:       item.AccountName,
					AccountCode:       item.AccountCode,
					Description:       first(item.Description, item.ItemNameSnapshot),
					ItemNameSnapshot:  item.ItemNameSnapshot,
					Quantity:          item.QuantityOrdered,
					UnitCost:          item.UnitCost,
					DiscountAmount:    item.DiscountAmount,
					TaxRateID:         item.TaxRateID,
					TaxAmount:         item.TaxAmount,
					LineTotal:         item.LineTotal,
				})
				continue
			}
			items = append(items, PurchaseInvoiceItem{
				ID:                utils.NewUUID(),
				BusinessID:        currentUser.BusinessID,
				PurchaseInvoiceID: invoiceID,
				LineType:          "product",
				ItemType:          item.ItemType,
				ProductID:         item.ProductID,
				ItemNameSnapshot:  item.ItemNameSnapshot,
				Quantity:          item.QuantityOrdered,
				UnitID:            item.UnitID,
				UnitCost:          item.UnitCost,
				DiscountAmount:    item.DiscountAmount,
				TaxRateID:         item.TaxRateID,
				TaxAmount:         item.TaxAmount,
				LineTotal:         item.LineTotal,
			})
		}
		if err := s.repo.CreateInvoice(tx, invoice, items); err != nil {
			return err
		}
		if _, err := charges.CopyCharges(tx, currentUser.BusinessID, order.BranchID, "purchase_order", order.ID, "purchase_invoice", invoice.ID); err != nil {
			return err
		}
		if order.Status == "draft" {
			if err := s.repo.UpdateOrder(tx, order.ID, currentUser.BusinessID, map[string]interface{}{"status": "ordered", "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}, nil); err != nil {
				return err
			}
		}
		if err := s.audit(tx, currentUser, "purchase_order.converted_to_invoice", order.ID, "Purchase order converted to purchase invoice", ipAddress, userAgent); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "purchase_invoice.created", invoice.ID, "Purchase invoice created from purchase order", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetInvoice(currentUser, invoiceID)
}

func (s *Service) GetDocumentChain(currentUser *utils.AuthContext, purchaseOrderID, ipAddress, userAgent string) (*PurchasingDocumentChainResponse, error) {
	if err := validateUUID(purchaseOrderID, "purchase_order_id"); err != nil {
		return nil, err
	}
	order, err := s.repo.FindOrder(purchaseOrderID, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "purchase order not found")
	}
	if !currentUser.CanAccessBranch(order.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	invoices, err := s.repo.InvoicesForOrder(currentUser.BusinessID, purchaseOrderID)
	if err != nil {
		return nil, apperrors.Internal("failed to load purchase invoices")
	}
	receipts, err := s.repo.ReceiptsForOrder(currentUser.BusinessID, purchaseOrderID)
	if err != nil {
		return nil, apperrors.Internal("failed to load purchase receipts")
	}
	returns, err := s.repo.PurchaseReturnsForOrder(currentUser.BusinessID, purchaseOrderID)
	if err != nil {
		return nil, apperrors.Internal("failed to load purchase returns")
	}
	payments, err := s.repo.InvoicePaymentsForOrder(currentUser.BusinessID, purchaseOrderID)
	if err != nil {
		return nil, apperrors.Internal("failed to load supplier payments")
	}
	response := &PurchasingDocumentChainResponse{}
	orderID := order.ID
	response.PurchaseOrder = &PurchaseDocumentChainItem{ID: order.ID, DocumentNumber: order.PurchaseOrderNumber, DocumentType: "purchase_order", Status: order.Status, Date: order.OrderDate, TotalAmount: roundMoney(order.TotalAmount), PurchaseOrderID: &orderID}
	for _, invoice := range invoices {
		invoiceID := invoice.ID
		response.PurchaseInvoices = append(response.PurchaseInvoices, PurchaseDocumentChainItem{ID: invoice.ID, DocumentNumber: invoice.InvoiceNumber, DocumentType: "purchase_invoice", Status: invoice.Status, Date: invoice.InvoiceDate, TotalAmount: roundMoney(invoice.TotalAmount), PurchaseOrderID: invoice.PurchaseOrderID, PurchaseInvoiceID: &invoiceID, PreviousID: invoice.PurchaseOrderID})
	}
	for _, receipt := range receipts {
		receiptID := receipt.ID
		previousID := receipt.PurchaseInvoiceID
		if previousID == nil {
			previousID = receipt.PurchaseOrderID
		}
		response.PurchaseReceipts = append(response.PurchaseReceipts, PurchaseDocumentChainItem{ID: receipt.ID, DocumentNumber: receipt.ReceiptNumber, DocumentType: "purchase_receipt", Status: receipt.Status, Date: receipt.ReceivedDate, TotalAmount: 0, PurchaseOrderID: receipt.PurchaseOrderID, PurchaseInvoiceID: receipt.PurchaseInvoiceID, PurchaseReceiptID: &receiptID, PreviousID: previousID})
	}
	for _, purchaseReturn := range returns {
		returnID := purchaseReturn.ID
		receiptID := purchaseReturn.PurchaseReceiptID
		response.PurchaseReturns = append(response.PurchaseReturns, PurchaseDocumentChainItem{ID: purchaseReturn.ID, DocumentNumber: purchaseReturn.ReturnNumber, DocumentType: "purchase_return", Status: purchaseReturn.Status, Date: purchaseReturn.ReturnDate, TotalAmount: roundMoney(purchaseReturn.ReturnTotal), PurchaseOrderID: purchaseReturn.PurchaseOrderID, PurchaseInvoiceID: purchaseReturn.PurchaseInvoiceID, PurchaseReceiptID: &receiptID, PurchaseReturnID: &returnID, PreviousID: &receiptID})
	}
	for i, payment := range payments {
		invoiceID := payment.PurchaseInvoiceID
		response.SupplierPayments = append(response.SupplierPayments, PurchaseDocumentChainItem{ID: payment.PaymentID, DocumentNumber: supplierPaymentChainNumber(i + 1), DocumentType: "supplier_payment", Status: payment.PaymentStatus, Date: payment.PaidAt, TotalAmount: roundMoney(payment.Amount), PurchaseInvoiceID: &invoiceID, PreviousID: &invoiceID})
	}
	_ = s.audit(s.db, currentUser, "purchasing.document_chain_viewed", purchaseOrderID, "Purchasing document chain viewed", ipAddress, userAgent)
	return response, nil
}

func (s *Service) ListInvoices(currentUser *utils.AuthContext, query ListQuery) (*PaginatedResponse[PurchaseInvoiceResponse], error) {
	normalizeQuery(&query)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if allBranches {
		query.BranchID = ""
	} else {
		query.BranchID = branchID
	}
	invoices, total, err := s.repo.ListInvoices(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list purchase invoices")
	}
	items := make([]PurchaseInvoiceResponse, 0, len(invoices))
	for _, invoice := range invoices {
		items = append(items, s.invoiceResponse(currentUser.BusinessID, invoice, false))
	}
	return &PaginatedResponse[PurchaseInvoiceResponse]{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) CreateInvoice(currentUser *utils.AuthContext, req CreatePurchaseInvoiceRequest, ipAddress, userAgent string) (*PurchaseInvoiceResponse, error) {
	var invoiceID string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		invoice, items, chargeRows, err := s.buildInvoice(tx, currentUser, "", req)
		if err != nil {
			return err
		}
		if exists, err := s.repo.InvoiceNumberExists(tx, currentUser.BusinessID, invoice.SupplierID, invoice.InvoiceNumber, ""); err != nil {
			return err
		} else if exists {
			return apperrors.Conflict("invoice_number already exists for this supplier", nil)
		}
		if err := s.repo.CreateInvoice(tx, invoice, items); err != nil {
			return err
		}
		if len(chargeRows) > 0 {
			if err := tx.Create(&chargeRows).Error; err != nil {
				return apperrors.Internal("failed to create purchase invoice charges")
			}
		}
		if err := s.audit(tx, currentUser, "purchase_invoice.created", invoice.ID, "Purchase invoice created", ipAddress, userAgent); err != nil {
			return err
		}
		invoiceID = invoice.ID
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetInvoice(currentUser, invoiceID)
}

func (s *Service) GetInvoice(currentUser *utils.AuthContext, id string) (*PurchaseInvoiceResponse, error) {
	invoice, err := s.repo.FindInvoice(id, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "purchase invoice not found")
	}
	if !currentUser.CanAccessBranch(invoice.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	dto := s.invoiceResponse(currentUser.BusinessID, *invoice, true)
	return &dto, nil
}

func (s *Service) ListInvoicePayments(currentUser *utils.AuthContext, query PaymentListQuery) (*PaginatedResponse[PurchaseInvoicePaymentResponse], error) {
	normalizePaymentQuery(&query)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if allBranches {
		query.BranchID = ""
	} else {
		query.BranchID = branchID
	}
	if err := validatePaymentListQuery(query); err != nil {
		return nil, err
	}
	payments, total, err := s.repo.ListAllInvoicePayments(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list purchase invoice payments")
	}
	for i := range payments {
		payments[i].Amount = roundMoney(payments[i].Amount)
	}
	return &PaginatedResponse[PurchaseInvoicePaymentResponse]{Items: payments, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) ListInvoicePaymentsByInvoice(currentUser *utils.AuthContext, invoiceID string) ([]PurchaseInvoicePaymentResponse, error) {
	invoice, err := s.repo.FindInvoice(invoiceID, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "purchase invoice not found")
	}
	if !currentUser.CanAccessBranch(invoice.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	payments, err := s.repo.ListInvoicePayments(currentUser.BusinessID, invoiceID)
	if err != nil {
		return nil, apperrors.Internal("failed to list purchase invoice payments")
	}
	for i := range payments {
		payments[i].Amount = roundMoney(payments[i].Amount)
	}
	return payments, nil
}

func (s *Service) ListSupplierPayments(currentUser *utils.AuthContext, query PaymentListQuery) (*PaginatedResponse[SupplierPaymentResponse], error) {
	normalizePaymentQuery(&query)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if allBranches {
		query.BranchID = ""
	} else {
		query.BranchID = branchID
	}
	if err := validatePaymentListQuery(query); err != nil {
		return nil, err
	}
	payments, total, err := s.repo.ListSupplierPayments(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list supplier payments")
	}
	for i := range payments {
		roundSupplierPaymentResponse(&payments[i])
	}
	return &PaginatedResponse[SupplierPaymentResponse]{Items: payments, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) GetSupplierPayment(currentUser *utils.AuthContext, id string) (*SupplierPaymentResponse, error) {
	if err := validateUUID(id, "id"); err != nil {
		return nil, err
	}
	payment, err := s.repo.FindSupplierPayment(id, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "supplier payment not found")
	}
	if !currentUser.CanAccessBranch(payment.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	response, err := s.repo.SupplierPaymentResponse(currentUser.BusinessID, id)
	if err != nil {
		return nil, apperrors.Internal("failed to load supplier payment")
	}
	roundSupplierPaymentResponse(response)
	return response, nil
}

func (s *Service) CreateSupplierPayment(currentUser *utils.AuthContext, req CreateSupplierPaymentRequest, ipAddress, userAgent string) (*SupplierPaymentResponse, error) {
	paymentID, err := s.createSupplierPayment(currentUser, req, false, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}
	return s.GetSupplierPayment(currentUser, paymentID)
}

func (s *Service) AddInvoicePayment(currentUser *utils.AuthContext, invoiceID string, req AddPurchaseInvoicePaymentRequest, ipAddress, userAgent string) (*PurchaseInvoiceResponse, error) {
	if err := validateUUID(req.PaymentMethodID, "payment_method_id"); err != nil {
		return nil, err
	}
	if req.PaidThroughAccountID != "" {
		if err := validateUUID(req.PaidThroughAccountID, "paid_through_account_id"); err != nil {
			return nil, err
		}
	}
	if req.Amount <= 0 {
		return nil, apperrors.BadRequest("amount must be greater than zero", nil)
	}
	invoice, err := s.repo.FindInvoice(invoiceID, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "purchase invoice not found")
	}
	if !currentUser.CanAccessBranch(invoice.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	if invoice.Status != "posted" {
		return nil, apperrors.BadRequest("only posted purchase invoices can be paid", nil)
	}
	if invoice.BalanceAmount <= 0 || invoice.PaymentStatus == "paid" {
		return nil, apperrors.BadRequest("purchase invoice is already paid", nil)
	}
	amount := roundMoney(req.Amount)
	if amount > roundMoney(invoice.BalanceAmount) {
		return nil, apperrors.BadRequest("payment amount cannot exceed invoice balance", map[string]interface{}{
			"purchase_invoice_id": invoice.ID,
			"balance_amount":      roundMoney(invoice.BalanceAmount),
			"payment_amount":      amount,
		})
	}
	_, err = s.createSupplierPayment(currentUser, CreateSupplierPaymentRequest{
		SupplierID:           invoice.SupplierID,
		BranchID:             invoice.BranchID,
		PaymentMethodID:      req.PaymentMethodID,
		PaidThroughAccountID: req.PaidThroughAccountID,
		Amount:               amount,
		ReferenceNumber:      req.ReferenceNumber,
		PaymentDate:          req.PaidAt,
		Notes:                req.Notes,
		Allocations:          []SupplierPaymentAllocationInput{{PurchaseInvoiceID: invoice.ID, Amount: amount}},
	}, true, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}
	return s.GetInvoice(currentUser, invoiceID)
}

func (s *Service) createSupplierPayment(currentUser *utils.AuthContext, req CreateSupplierPaymentRequest, invoiceEndpoint bool, ipAddress, userAgent string) (string, error) {
	if err := validateUUID(req.SupplierID, "supplier_id"); err != nil {
		return "", err
	}
	if err := validateUUID(req.PaymentMethodID, "payment_method_id"); err != nil {
		return "", err
	}
	if req.PaidThroughAccountID != "" {
		if err := validateUUID(req.PaidThroughAccountID, "paid_through_account_id"); err != nil {
			return "", err
		}
	}
	if req.Amount <= 0 {
		return "", apperrors.BadRequest("amount must be greater than zero", nil)
	}
	branchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return "", err
	}
	paymentDate, err := parseSupplierPaymentDate(req.PaymentDate, time.Now().UTC(), "payment_date")
	if err != nil {
		return "", err
	}
	amount := roundMoney(req.Amount)
	var paymentID string
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.repo.ValidateSupplier(tx, currentUser.BusinessID, branchID, req.SupplierID); err != nil {
			return notFound(err, "supplier not found")
		}
		method, err := s.repo.PaymentMethod(tx, currentUser.BusinessID, req.PaymentMethodID)
		if err != nil {
			return notFound(err, "payment method not found")
		}
		if !method.ShowInPurchasing {
			return apperrors.BadRequest("payment method is not enabled for purchasing", nil)
		}
		reference := strings.TrimSpace(req.ReferenceNumber)
		if method.RequiresReference && reference == "" {
			return apperrors.BadRequest("reference_number is required for this payment method", nil)
		}
		paidThroughAccount, err := s.resolveSupplierPaidThroughAccount(tx, currentUser.BusinessID, branchID, method, req.PaidThroughAccountID)
		if err != nil {
			return err
		}
		if err := s.ensureSupplierPaymentAccountHasBalance(tx, currentUser.BusinessID, paidThroughAccount, amount); err != nil {
			return err
		}
		allocations := make([]SupplierPaymentAllocation, 0, len(req.Allocations))
		allocatedAmount := 0.0
		seenInvoices := map[string]struct{}{}
		for _, allocationReq := range req.Allocations {
			if err := validateUUID(allocationReq.PurchaseInvoiceID, "purchase_invoice_id"); err != nil {
				return err
			}
			allocationAmount := roundMoney(allocationReq.Amount)
			if allocationAmount <= 0 {
				return apperrors.BadRequest("allocation amount must be greater than zero", nil)
			}
			if _, exists := seenInvoices[allocationReq.PurchaseInvoiceID]; exists {
				return apperrors.BadRequest("duplicate invoice allocation is not allowed", map[string]string{"purchase_invoice_id": allocationReq.PurchaseInvoiceID})
			}
			seenInvoices[allocationReq.PurchaseInvoiceID] = struct{}{}
			invoice, err := s.repo.FindInvoiceForUpdate(tx, allocationReq.PurchaseInvoiceID, currentUser.BusinessID)
			if err != nil {
				return notFound(err, "purchase invoice not found")
			}
			if invoice.BranchID != branchID || invoice.SupplierID != req.SupplierID {
				return apperrors.BadRequest("allocated invoice must belong to the selected supplier and branch", map[string]string{"purchase_invoice_id": invoice.ID})
			}
			if invoice.Status != "posted" {
				return apperrors.BadRequest("only posted purchase invoices can be paid", map[string]string{"purchase_invoice_id": invoice.ID})
			}
			if invoice.BalanceAmount <= 0 || invoice.PaymentStatus == "paid" {
				return apperrors.BadRequest("purchase invoice is already paid", map[string]string{"purchase_invoice_id": invoice.ID})
			}
			if allocationAmount > roundMoney(invoice.BalanceAmount) {
				return apperrors.BadRequest("allocation amount cannot exceed invoice balance", map[string]interface{}{
					"purchase_invoice_id": invoice.ID,
					"balance_amount":      roundMoney(invoice.BalanceAmount),
					"allocation_amount":   allocationAmount,
				})
			}
			allocatedAmount = roundMoney(allocatedAmount + allocationAmount)
			if allocatedAmount > amount {
				return apperrors.BadRequest("total allocated amount cannot exceed payment amount", nil)
			}
			paidAmount := roundMoney(invoice.PaidAmount + allocationAmount)
			settledAmount := roundMoney(paidAmount + invoice.CreditedAmount)
			balanceAmount := roundMoney(invoice.TotalAmount - settledAmount)
			if balanceAmount < 0 {
				balanceAmount = 0
			}
			status := invoicePaymentStatus(invoice.TotalAmount, settledAmount)
			if err := s.repo.UpdateInvoice(tx, invoice.ID, currentUser.BusinessID, map[string]interface{}{"paid_amount": paidAmount, "balance_amount": balanceAmount, "payment_status": status, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}, nil); err != nil {
				return err
			}
			allocations = append(allocations, SupplierPaymentAllocation{
				ID:                utils.NewUUID(),
				BusinessID:        currentUser.BusinessID,
				BranchID:          branchID,
				PurchaseInvoiceID: invoice.ID,
				Amount:            allocationAmount,
				CreatedAt:         time.Now().UTC(),
				UpdatedAt:         time.Now().UTC(),
			})
		}
		unappliedAmount := roundMoney(amount - allocatedAmount)
		paymentID = utils.NewUUID()
		for i := range allocations {
			allocations[i].SupplierPaymentID = paymentID
		}
		payment := &SupplierPayment{
			ID:                        paymentID,
			BusinessID:                currentUser.BusinessID,
			BranchID:                  branchID,
			SupplierID:                req.SupplierID,
			PaymentMethodID:           method.ID,
			PaymentMethodNameSnapshot: method.MethodName,
			PaymentMethodTypeSnapshot: method.MethodType,
			PaidThroughAccountID:      paidThroughAccount.ID,
			Amount:                    amount,
			AllocatedAmount:           allocatedAmount,
			UnappliedAmount:           unappliedAmount,
			ReferenceNumber:           reference,
			PaymentDate:               paymentDate,
			Status:                    "completed",
			Notes:                     strings.TrimSpace(req.Notes),
			PaidByUserID:              currentUser.UserID,
			CreatedAt:                 time.Now().UTC(),
			UpdatedAt:                 time.Now().UTC(),
		}
		if err := s.repo.CreateSupplierPayment(tx, payment, allocations); err != nil {
			return err
		}
		if s.accountingService != nil {
			if _, err := s.accountingService.PostSupplierPaymentJournal(tx, currentUser, payment.ID); err != nil {
				return err
			}
		}
		event := "supplier_payment.created"
		summary := "Supplier payment created"
		if invoiceEndpoint {
			event = "purchase_invoice.payment_added"
			summary = "Purchase invoice payment added"
		}
		return s.audit(tx, currentUser, event, payment.ID, summary, ipAddress, userAgent)
	})
	return paymentID, err
}

func (s *Service) UpdateSupplierPayment(currentUser *utils.AuthContext, id string, req UpdateSupplierPaymentRequest, ipAddress, userAgent string) (*SupplierPaymentResponse, error) {
	if err := validateUUID(id, "supplier_payment_id"); err != nil {
		return nil, err
	}
	if err := validateUUID(req.SupplierID, "supplier_id"); err != nil {
		return nil, err
	}
	if err := validateUUID(req.PaymentMethodID, "payment_method_id"); err != nil {
		return nil, err
	}
	if req.PaidThroughAccountID != "" {
		if err := validateUUID(req.PaidThroughAccountID, "paid_through_account_id"); err != nil {
			return nil, err
		}
	}
	if req.Amount <= 0 {
		return nil, apperrors.BadRequest("amount must be greater than zero", nil)
	}
	branchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return nil, err
	}
	paymentDate, err := parseSupplierPaymentDate(req.PaymentDate, time.Now().UTC(), "payment_date")
	if err != nil {
		return nil, err
	}
	amount := roundMoney(req.Amount)

	err = s.db.Transaction(func(tx *gorm.DB) error {
		existing, err := s.repo.FindSupplierPaymentForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "supplier payment not found")
		}
		if !currentUser.CanAccessBranch(existing.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if existing.Status != "completed" {
			return apperrors.BadRequest("only completed supplier payments can be edited", nil)
		}
		if err := s.rollbackSupplierPaymentImpact(tx, currentUser, existing); err != nil {
			return err
		}
		if err := s.repo.ValidateSupplier(tx, currentUser.BusinessID, branchID, req.SupplierID); err != nil {
			return notFound(err, "supplier not found")
		}
		method, err := s.repo.PaymentMethod(tx, currentUser.BusinessID, req.PaymentMethodID)
		if err != nil {
			return notFound(err, "payment method not found")
		}
		if !method.ShowInPurchasing {
			return apperrors.BadRequest("payment method is not enabled for purchasing", nil)
		}
		reference := strings.TrimSpace(req.ReferenceNumber)
		if method.RequiresReference && reference == "" {
			return apperrors.BadRequest("reference_number is required for this payment method", nil)
		}
		paidThroughAccount, err := s.resolveSupplierPaidThroughAccount(tx, currentUser.BusinessID, branchID, method, req.PaidThroughAccountID)
		if err != nil {
			return err
		}
		if err := s.ensureSupplierPaymentAccountHasBalance(tx, currentUser.BusinessID, paidThroughAccount, amount); err != nil {
			return err
		}

		allocations := make([]SupplierPaymentAllocation, 0, len(req.Allocations))
		allocatedAmount := 0.0
		seenInvoices := map[string]struct{}{}
		for _, allocationReq := range req.Allocations {
			if err := validateUUID(allocationReq.PurchaseInvoiceID, "purchase_invoice_id"); err != nil {
				return err
			}
			allocationAmount := roundMoney(allocationReq.Amount)
			if allocationAmount <= 0 {
				return apperrors.BadRequest("allocation amount must be greater than zero", nil)
			}
			if _, exists := seenInvoices[allocationReq.PurchaseInvoiceID]; exists {
				return apperrors.BadRequest("duplicate invoice allocation is not allowed", map[string]string{"purchase_invoice_id": allocationReq.PurchaseInvoiceID})
			}
			seenInvoices[allocationReq.PurchaseInvoiceID] = struct{}{}
			invoice, err := s.repo.FindInvoiceForUpdate(tx, allocationReq.PurchaseInvoiceID, currentUser.BusinessID)
			if err != nil {
				return notFound(err, "purchase invoice not found")
			}
			if invoice.BranchID != branchID || invoice.SupplierID != req.SupplierID {
				return apperrors.BadRequest("allocated invoice must belong to the selected supplier and branch", map[string]string{"purchase_invoice_id": invoice.ID})
			}
			if invoice.Status != "posted" {
				return apperrors.BadRequest("only posted purchase invoices can be paid", map[string]string{"purchase_invoice_id": invoice.ID})
			}
			if invoice.BalanceAmount <= 0 || invoice.PaymentStatus == "paid" {
				return apperrors.BadRequest("purchase invoice is already paid", map[string]string{"purchase_invoice_id": invoice.ID})
			}
			if allocationAmount > roundMoney(invoice.BalanceAmount) {
				return apperrors.BadRequest("allocation amount cannot exceed invoice balance", map[string]interface{}{
					"purchase_invoice_id": invoice.ID,
					"balance_amount":      roundMoney(invoice.BalanceAmount),
					"allocation_amount":   allocationAmount,
				})
			}
			allocatedAmount = roundMoney(allocatedAmount + allocationAmount)
			if allocatedAmount > amount {
				return apperrors.BadRequest("total allocated amount cannot exceed payment amount", nil)
			}
			paidAmount := roundMoney(invoice.PaidAmount + allocationAmount)
			settledAmount := roundMoney(paidAmount + invoice.CreditedAmount)
			balanceAmount := roundMoney(invoice.TotalAmount - settledAmount)
			if balanceAmount < 0 {
				balanceAmount = 0
			}
			status := invoicePaymentStatus(invoice.TotalAmount, settledAmount)
			if err := s.repo.UpdateInvoice(tx, invoice.ID, currentUser.BusinessID, map[string]interface{}{"paid_amount": paidAmount, "balance_amount": balanceAmount, "payment_status": status, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}, nil); err != nil {
				return err
			}
			allocations = append(allocations, SupplierPaymentAllocation{
				ID:                utils.NewUUID(),
				BusinessID:        currentUser.BusinessID,
				BranchID:          branchID,
				SupplierPaymentID: existing.ID,
				PurchaseInvoiceID: invoice.ID,
				Amount:            allocationAmount,
				CreatedAt:         time.Now().UTC(),
				UpdatedAt:         time.Now().UTC(),
			})
		}

		existing.BranchID = branchID
		existing.SupplierID = req.SupplierID
		existing.PaymentMethodID = method.ID
		existing.PaymentMethodNameSnapshot = method.MethodName
		existing.PaymentMethodTypeSnapshot = method.MethodType
		existing.PaidThroughAccountID = paidThroughAccount.ID
		existing.Amount = amount
		existing.AllocatedAmount = allocatedAmount
		existing.UnappliedAmount = roundMoney(amount - allocatedAmount)
		existing.ReferenceNumber = reference
		existing.PaymentDate = paymentDate
		existing.Status = "completed"
		existing.Notes = strings.TrimSpace(req.Notes)
		existing.JournalEntryID = nil
		existing.UpdatedAt = time.Now().UTC()

		if err := s.repo.UpdateSupplierPayment(tx, existing, allocations); err != nil {
			return err
		}
		if s.accountingService != nil {
			if _, err := s.accountingService.PostSupplierPaymentJournal(tx, currentUser, existing.ID); err != nil {
				return err
			}
		}
		return s.audit(tx, currentUser, "supplier_payment.updated", existing.ID, "Supplier payment updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetSupplierPayment(currentUser, id)
}

func (s *Service) DeleteSupplierPayment(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) error {
	if err := validateUUID(id, "supplier_payment_id"); err != nil {
		return err
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		payment, err := s.repo.FindSupplierPaymentForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "supplier payment not found")
		}
		if !currentUser.CanAccessBranch(payment.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if payment.Status != "completed" {
			return apperrors.BadRequest("only completed supplier payments can be deleted", nil)
		}
		if err := s.rollbackSupplierPaymentImpact(tx, currentUser, payment); err != nil {
			return err
		}
		if err := s.repo.HardDeleteSupplierPayment(tx, currentUser.BusinessID, payment.ID); err != nil {
			return notFound(err, "supplier payment not found")
		}
		return s.audit(tx, currentUser, "supplier_payment.deleted", payment.ID, "Supplier payment hard deleted", ipAddress, userAgent)
	})
}

func (s *Service) rollbackSupplierPaymentImpact(tx *gorm.DB, currentUser *utils.AuthContext, payment *SupplierPayment) error {
	allocations, err := s.repo.SupplierPaymentAllocationsForUpdate(tx, currentUser.BusinessID, payment.ID)
	if err != nil {
		return apperrors.Internal("failed to load supplier payment allocations")
	}
	for _, allocation := range allocations {
		invoice, err := s.repo.FindInvoiceForUpdate(tx, allocation.PurchaseInvoiceID, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase invoice not found")
		}
		paidAmount := roundMoney(invoice.PaidAmount - allocation.Amount)
		if paidAmount < 0 {
			paidAmount = 0
		}
		settledAmount := roundMoney(paidAmount + invoice.CreditedAmount)
		balanceAmount := roundMoney(invoice.TotalAmount - settledAmount)
		if balanceAmount < 0 {
			balanceAmount = 0
		}
		if err := s.repo.UpdateInvoice(tx, invoice.ID, currentUser.BusinessID, map[string]interface{}{
			"paid_amount":        paidAmount,
			"balance_amount":     balanceAmount,
			"payment_status":     invoicePaymentStatus(invoice.TotalAmount, settledAmount),
			"updated_by_user_id": currentUser.UserID,
			"updated_at":         time.Now().UTC(),
		}, nil); err != nil {
			return err
		}
	}
	if err := s.repo.HardDeleteSupplierPaymentAllocations(tx, currentUser.BusinessID, payment.ID); err != nil {
		return err
	}
	if err := s.repo.HardDeleteSupplierPaymentJournal(tx, currentUser.BusinessID, payment.ID); err != nil {
		return apperrors.Internal("failed to delete supplier payment accounting journal")
	}
	return nil
}

func (s *Service) resolveSupplierPaidThroughAccount(tx *gorm.DB, businessID, branchID string, method *PaymentMethodInfo, requestedAccountID string) (*PaymentAccountInfo, error) {
	if strings.TrimSpace(requestedAccountID) != "" {
		account, err := s.repo.PaymentAccount(tx, businessID, strings.TrimSpace(requestedAccountID))
		if err != nil {
			return nil, notFound(err, "paid-through account not found")
		}
		if err := validatePurchasingPaymentAccountBranch(account, branchID); err != nil {
			return nil, err
		}
		return account, nil
	}
	account, err := s.repo.PaymentMethodMappedAccount(tx, businessID, branchID, method.ID)
	if err == nil {
		if err := validatePurchasingPaymentAccountBranch(account, branchID); err != nil {
			return nil, err
		}
		return account, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if method.DefaultPaymentAccountID == nil || strings.TrimSpace(*method.DefaultPaymentAccountID) == "" {
		return nil, apperrors.BadRequest("payment method is not linked to an active payment account", map[string]interface{}{"payment_method": method.MethodName})
	}
	account, err = s.repo.PaymentAccount(tx, businessID, *method.DefaultPaymentAccountID)
	if err != nil {
		return nil, apperrors.BadRequest("payment method is not linked to an active payment account", map[string]interface{}{"payment_method": method.MethodName})
	}
	if err := validatePurchasingPaymentAccountBranch(account, branchID); err != nil {
		return nil, err
	}
	return account, nil
}

func (s *Service) ensureSupplierPaymentAccountHasBalance(tx *gorm.DB, businessID string, account *PaymentAccountInfo, amount float64) error {
	if account == nil {
		return apperrors.BadRequest("payment method is not linked to an active payment account", nil)
	}
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":payment-account-balance:"+account.ID).Error; err != nil {
		return apperrors.Internal("failed to lock paid-through account balance")
	}
	availableBalance, err := s.repo.PaymentAccountCurrentBalance(tx, businessID, account.ChartAccountID, account.BranchID)
	if err != nil {
		return apperrors.Internal("failed to check paid-through account balance")
	}
	availableBalance = roundMoney(availableBalance)
	paymentAmount := roundMoney(amount)
	if paymentAmount <= availableBalance {
		return nil
	}
	return apperrors.BadRequest(
		fmt.Sprintf("Insufficient balance in selected payment account. Available balance is AED %.2f, payment amount is AED %.2f.", availableBalance, paymentAmount),
		map[string]interface{}{
			"reason":             "insufficient_payment_account_balance",
			"payment_account_id": account.ID,
			"available_balance":  availableBalance,
			"payment_amount":     paymentAmount,
			"shortfall_amount":   roundMoney(paymentAmount - availableBalance),
		},
	)
}

func (s *Service) UpdateInvoice(currentUser *utils.AuthContext, id string, req UpdatePurchaseInvoiceRequest, ipAddress, userAgent string) (*PurchaseInvoiceResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		existing, err := s.repo.FindInvoiceForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase invoice not found")
		}
		if !currentUser.CanAccessBranch(existing.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if existing.Status != "draft" && existing.Status != "posted" {
			return apperrors.BadRequest("only draft or safe posted invoices can be edited", nil)
		}
		editingPosted := existing.Status == "posted"
		if editingPosted {
			if err := s.ensurePostedInvoiceCanBeEdited(tx, currentUser.BusinessID, existing.ID); err != nil {
				return err
			}
		}
		branchID := first(req.BranchID, existing.BranchID)
		branchID, err = currentUser.ResolveOperationalBranch(branchID)
		if err != nil {
			return err
		}
		createReq := CreatePurchaseInvoiceRequest{
			BranchID:           branchID,
			SupplierID:         first(req.SupplierID, existing.SupplierID),
			PurchaseOrderID:    first(req.PurchaseOrderID, deref(existing.PurchaseOrderID)),
			InvoiceNumber:      first(req.InvoiceNumber, existing.InvoiceNumber),
			SupplierBillNumber: first(req.SupplierBillNumber, existing.SupplierBillNumber),
			InvoiceDate:        first(req.InvoiceDate, formatDate(existing.InvoiceDate)),
			DueDate:            first(req.DueDate, optionalDateString(existing.DueDate)),
			Items:              req.Items,
			BillDiscountAmount: existing.BillDiscountAmount,
			Charges:            req.Charges,
			Notes:              req.Notes,
		}
		if req.BillDiscountAmount != nil {
			createReq.BillDiscountAmount = *req.BillDiscountAmount
		}
		if createReq.Items == nil {
			oldItems, err := s.repo.InvoiceItems(id, currentUser.BusinessID)
			if err != nil {
				return err
			}
			createReq.Items = invoiceInputsFromItems(oldItems)
		}
		invoice, items, _, err := s.buildInvoice(tx, currentUser, id, createReq)
		if err != nil {
			return err
		}
		if exists, err := s.repo.InvoiceNumberExists(tx, currentUser.BusinessID, invoice.SupplierID, invoice.InvoiceNumber, id); err != nil {
			return err
		} else if exists {
			return apperrors.Conflict("invoice_number already exists for this supplier", nil)
		}
		updates := map[string]interface{}{"branch_id": invoice.BranchID, "supplier_id": invoice.SupplierID, "purchase_order_id": invoice.PurchaseOrderID, "invoice_number": invoice.InvoiceNumber, "supplier_bill_number": invoice.SupplierBillNumber, "invoice_date": invoice.InvoiceDate, "due_date": invoice.DueDate, "subtotal_amount": invoice.SubtotalAmount, "tax_amount": invoice.TaxAmount, "discount_amount": invoice.DiscountAmount, "bill_discount_amount": invoice.BillDiscountAmount, "charge_amount": invoice.ChargeAmount, "charge_tax_amount": invoice.ChargeTaxAmount, "total_amount": invoice.TotalAmount, "balance_amount": invoice.BalanceAmount, "notes": invoice.Notes, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
		if err := s.repo.UpdateInvoice(tx, id, currentUser.BusinessID, updates, items); err != nil {
			return err
		}
		if req.Charges != nil {
			if _, err := charges.ReplaceCharges(tx, currentUser.BusinessID, invoice.BranchID, "purchase_invoice", id, req.Charges); err != nil {
				return err
			}
		}
		if err := s.recalculatePurchaseInvoiceTotals(tx, currentUser.BusinessID, id); err != nil {
			return err
		}
		if editingPosted && s.accountingService != nil {
			if _, err := s.accountingService.RefreshPurchaseInvoiceJournalAfterEdit(tx, currentUser, id); err != nil {
				return err
			}
		}
		if err := s.audit(tx, currentUser, "purchase_invoice.updated", id, "Purchase invoice updated", ipAddress, userAgent); err != nil {
			return err
		}
		if editingPosted {
			if err := s.audit(tx, currentUser, "purchase_invoice.posted_bill_edited", id, "Posted purchase invoice edited", ipAddress, userAgent); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetInvoice(currentUser, id)
}

func (s *Service) ensurePostedInvoiceCanBeEdited(tx *gorm.DB, businessID, invoiceID string) error {
	payments, err := s.repo.CompletedInvoicePaymentCount(tx, businessID, invoiceID)
	if err != nil {
		return err
	}
	if payments > 0 {
		return apperrors.Conflict("posted bill has supplier payments and cannot be edited", map[string]interface{}{"reason": "purchase_invoice_has_payments"})
	}
	vendorCredits, err := s.repo.PostedPurchaseReturnCountForInvoice(tx, businessID, invoiceID)
	if err != nil {
		return err
	}
	if vendorCredits > 0 {
		return apperrors.Conflict("posted bill has vendor credits and cannot be edited", map[string]interface{}{"reason": "purchase_invoice_has_vendor_credits"})
	}
	receipts, err := s.repo.ActiveReceiptCountForInvoice(tx, businessID, invoiceID)
	if err != nil {
		return err
	}
	if receipts > 0 {
		return apperrors.Conflict("posted bill has received stock history and cannot be edited", map[string]interface{}{"reason": "purchase_invoice_has_receipts"})
	}
	return nil
}

func (s *Service) PostInvoice(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*PurchaseInvoiceResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		invoice, err := s.repo.FindInvoiceForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase invoice not found")
		}
		if !currentUser.CanAccessBranch(invoice.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if invoice.Status != "draft" {
			return apperrors.BadRequest("only draft invoices can be posted", nil)
		}
		if err := s.repo.UpdateInvoice(tx, id, currentUser.BusinessID, map[string]interface{}{"status": "posted", "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}, nil); err != nil {
			return err
		}
		if s.accountingService != nil {
			if _, err := s.accountingService.PostPurchaseInvoiceJournal(tx, currentUser, id); err != nil {
				return err
			}
		}
		return s.audit(tx, currentUser, "purchase_invoice.posted", id, "Purchase invoice posted", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetInvoice(currentUser, id)
}

func (s *Service) CancelInvoice(currentUser *utils.AuthContext, id string, req CancelPurchaseInvoiceRequest, ipAddress, userAgent string) (*PurchaseInvoiceResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		invoice, err := s.repo.FindInvoiceForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase invoice not found")
		}
		if !currentUser.CanAccessBranch(invoice.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if invoice.Status == "cancelled" {
			return apperrors.BadRequest("purchase invoice is already cancelled", map[string]interface{}{"reason": "purchase_invoice_already_cancelled"})
		}
		if invoice.Status == "draft" {
			return apperrors.BadRequest("draft purchase invoices should be deleted, not cancelled", map[string]interface{}{"reason": "draft_invoice_use_delete"})
		}
		if invoice.Status != "posted" {
			return apperrors.BadRequest("only posted purchase invoices can be cancelled", nil)
		}
		payments, err := s.repo.CompletedInvoicePaymentCount(tx, currentUser.BusinessID, id)
		if err != nil {
			return err
		}
		if payments > 0 {
			return apperrors.Conflict("purchase invoice has completed supplier payments and cannot be cancelled", map[string]interface{}{"reason": "purchase_invoice_has_payments"})
		}
		vendorCredits, err := s.repo.PostedPurchaseReturnCountForInvoice(tx, currentUser.BusinessID, id)
		if err != nil {
			return err
		}
		if vendorCredits > 0 {
			return apperrors.Conflict("purchase invoice has posted vendor credits and cannot be cancelled", map[string]interface{}{"reason": "purchase_invoice_has_vendor_credits"})
		}
		reversalMovementIDs, cancelledReceiptID, err := s.reverseBillInventory(tx, currentUser, invoice)
		if err != nil {
			return err
		}
		reversalJournalID := ""
		if s.accountingService != nil {
			reversalJournalID, err = s.accountingService.PostPurchaseInvoiceCancellationJournal(tx, currentUser, invoice.ID)
			if err != nil {
				return err
			}
			if reversalJournalID != "" && len(reversalMovementIDs) > 0 {
				if err := tx.Model(&inventory.StockMovement{}).
					Where("business_id = ? AND id IN ?", currentUser.BusinessID, reversalMovementIDs).
					Update("accounting_journal_entry_id", reversalJournalID).Error; err != nil {
					return err
				}
			}
		}
		now := time.Now().UTC()
		updates := map[string]interface{}{
			"status":               "cancelled",
			"payment_status":       "unpaid",
			"balance_amount":       0,
			"cancelled_by_user_id": currentUser.UserID,
			"cancelled_at":         now,
			"cancel_reason":        strings.TrimSpace(req.Reason),
			"updated_by_user_id":   currentUser.UserID,
			"updated_at":           now,
		}
		if reversalJournalID != "" {
			updates["reversal_journal_entry_id"] = reversalJournalID
		}
		if cancelledReceiptID != "" {
			updates["cancelled_receipt_id"] = cancelledReceiptID
		}
		if err := s.repo.UpdateInvoice(tx, id, currentUser.BusinessID, updates, nil); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "purchase_invoice.cancelled", id, "Purchase invoice cancelled", ipAddress, userAgent); err != nil {
			return err
		}
		if reversalJournalID != "" {
			if err := s.audit(tx, currentUser, "purchase_invoice.reversal_posted", id, "Purchase invoice reversal journal posted", ipAddress, userAgent); err != nil {
				return err
			}
		}
		if len(reversalMovementIDs) > 0 {
			return s.audit(tx, currentUser, "purchase_invoice.stock_reversed", id, "Purchase invoice stock reversed", ipAddress, userAgent)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetInvoice(currentUser, id)
}

func (s *Service) reverseBillInventory(tx *gorm.DB, currentUser *utils.AuthContext, invoice *PurchaseInvoice) ([]string, string, error) {
	receipts, err := s.repo.ReceiptsForInvoiceForUpdate(tx, currentUser.BusinessID, invoice.ID)
	if err != nil {
		return nil, "", err
	}
	reversalMovementIDs := make([]string, 0)
	cancelledReceiptID := ""
	for _, receipt := range receipts {
		if receipt.Status == "cancelled" {
			continue
		}
		if cancelledReceiptID == "" {
			cancelledReceiptID = receipt.ID
		}
		items, err := s.repo.ReceiptItemsForUpdate(tx, receipt.ID, currentUser.BusinessID)
		if err != nil {
			return nil, "", err
		}
		for _, item := range items {
			if item.StockMovementID == nil || strings.TrimSpace(*item.StockMovementID) == "" {
				continue
			}
			original, err := s.inventoryRepo.FindStockMovementForUpdate(tx, *item.StockMovementID, currentUser.BusinessID)
			if err != nil {
				return nil, "", notFound(err, "original bill stock movement not found")
			}
			if original.IsReversed {
				return nil, "", apperrors.Conflict("bill stock movement was already reversed", map[string]interface{}{"reason": "bill_stock_already_reversed", "stock_movement_id": original.ID})
			}
			unitCost := original.UnitCostSnapshot
			if unitCost <= 0 {
				unitCost = item.UnitCost
			}
			movement, err := s.inventoryService.ApplyMovement(tx, inventory.ApplyStockMovementInput{
				BusinessID:         currentUser.BusinessID,
				InventoryItemID:    item.InventoryItemID,
				StockLocationID:    original.StockLocationID,
				MovementType:       "purchase_bill_cancel_out",
				Quantity:           item.QuantityReceived,
				UnitCost:           unitCost,
				ReferenceType:      "purchase_invoice_cancel",
				ReferenceID:        &invoice.ID,
				ReferenceNumber:    invoice.InvoiceNumber,
				Reason:             "Cancelled purchase bill",
				IsReversal:         true,
				ReversedMovementID: item.StockMovementID,
				CreatedByUserID:    currentUser.UserID,
			})
			if err != nil {
				return nil, "", err
			}
			if err := s.inventoryRepo.MarkMovementReversed(tx, original.ID, currentUser.BusinessID, movement.ID); err != nil {
				return nil, "", err
			}
			reversalMovementIDs = append(reversalMovementIDs, movement.ID)
			if receipt.PurchaseOrderID != nil {
				prepared := preparedItem{ItemType: item.ItemType, UnitID: item.UnitID, ProductID: item.ProductID, IngredientID: item.IngredientID, PackagingItemID: item.PackagingItemID, Quantity: item.QuantityReceived}
				if err := s.reversePOReceiveQuantity(tx, currentUser.BusinessID, *receipt.PurchaseOrderID, prepared); err != nil {
					return nil, "", err
				}
			}
		}
		now := time.Now().UTC()
		if err := s.repo.UpdateReceipt(tx, receipt.ID, currentUser.BusinessID, map[string]interface{}{"status": "cancelled", "updated_at": now}); err != nil {
			return nil, "", err
		}
		if receipt.PurchaseOrderID != nil {
			if err := s.refreshOrderReceivedStatus(tx, currentUser.BusinessID, *receipt.PurchaseOrderID); err != nil {
				return nil, "", err
			}
		}
	}
	return reversalMovementIDs, cancelledReceiptID, nil
}

func (s *Service) ConvertInvoiceToReceipt(currentUser *utils.AuthContext, id string, req ConvertPurchaseInvoiceToReceiptRequest, ipAddress, userAgent string) (*PurchaseReceiptResponse, error) {
	if err := requireAllOrOverride(currentUser, []string{"purchasing.receipts.create"}, []string{"purchasing.manage", "inventory.manage"}); err != nil {
		return nil, err
	}
	var receiptID string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		invoice, err := s.repo.FindInvoiceForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase invoice not found")
		}
		if !currentUser.CanAccessBranch(invoice.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if invoice.Status != "posted" {
			return apperrors.BadRequest("only posted purchase invoices can be converted to receipt", nil)
		}
		existingReceipts, err := s.repo.ActiveReceiptCountForInvoice(tx, currentUser.BusinessID, invoice.ID)
		if err != nil {
			return err
		}
		if existingReceipts > 0 {
			return apperrors.Conflict("purchase invoice already has a stock receipt", nil)
		}
		invoiceItems, err := s.repo.InvoiceItems(invoice.ID, currentUser.BusinessID)
		if err != nil {
			return err
		}
		if len(invoiceItems) == 0 {
			return apperrors.BadRequest("purchase invoice has no items to convert", nil)
		}
		notes := strings.TrimSpace(req.Notes)
		if notes == "" {
			notes = invoice.Notes
		}
		receiveReq := ReceivePurchaseRequest{
			BranchID:          invoice.BranchID,
			SupplierID:        invoice.SupplierID,
			PurchaseOrderID:   deref(invoice.PurchaseOrderID),
			PurchaseInvoiceID: invoice.ID,
			ReceivedDate:      defaultDate(req.ReceivedDate),
			Notes:             notes,
		}
		receiveLines, _, canReceive := s.invoiceReceiveState(currentUser.BusinessID, *invoice, invoiceItems)
		if !canReceive {
			return apperrors.BadRequest("purchase bill has no remaining items to receive", nil)
		}
		receiveReq.Items = receiptInputsFromInvoiceItemsWithReceiveState(invoiceItems, receiveLines)
		receipt, items, _, err := s.buildReceipt(tx, currentUser, receiveReq, "draft")
		if err != nil {
			return err
		}
		if err := s.repo.CreateReceipt(tx, receipt, items); err != nil {
			return err
		}
		chargeTotals, err := charges.CopyCharges(tx, currentUser.BusinessID, invoice.BranchID, "purchase_invoice", invoice.ID, "purchase_receipt", receipt.ID)
		if err != nil {
			return err
		}
		if chargeTotals.Total > 0 {
			if err := s.repo.UpdateReceipt(tx, receipt.ID, currentUser.BusinessID, map[string]interface{}{"charge_amount": chargeTotals.Amount, "charge_tax_amount": chargeTotals.TaxAmount, "updated_at": time.Now().UTC()}); err != nil {
				return err
			}
		}
		if err := s.audit(tx, currentUser, "purchase_invoice.converted_to_receipt", invoice.ID, "Purchase invoice converted to draft stock receipt", ipAddress, userAgent); err != nil {
			return err
		}
		receiptID = receipt.ID
		return s.audit(tx, currentUser, "purchase_receipt.created", receipt.ID, "Draft purchase receipt created from purchase invoice", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetReceipt(currentUser, receiptID)
}

func (s *Service) ReceiveOrder(currentUser *utils.AuthContext, orderID string, req ReceivePurchaseOrderRequest, ipAddress, userAgent string) (*PurchaseReceiptResponse, error) {
	order, err := s.repo.FindOrder(orderID, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "purchase order not found")
	}
	if !currentUser.CanAccessBranch(order.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	if strings.TrimSpace(req.BranchID) != "" && strings.TrimSpace(req.BranchID) != order.BranchID {
		return nil, apperrors.BadRequest("purchase order branch does not match receipt branch", nil)
	}
	if strings.TrimSpace(req.SupplierID) != "" && strings.TrimSpace(req.SupplierID) != order.SupplierID {
		return nil, apperrors.BadRequest("purchase order supplier does not match receipt supplier", nil)
	}
	receiveReq := ReceivePurchaseRequest{
		BranchID:          order.BranchID,
		SupplierID:        order.SupplierID,
		PurchaseOrderID:   order.ID,
		PurchaseInvoiceID: strings.TrimSpace(req.PurchaseInvoiceID),
		ReceivedDate:      strings.TrimSpace(req.ReceivedDate),
		Items:             req.Items,
		Charges:           req.Charges,
		Notes:             req.Notes,
	}
	if strings.TrimSpace(receiveReq.ReceivedDate) == "" {
		receiveReq.ReceivedDate = time.Now().UTC().Format("2006-01-02")
	}
	if len(receiveReq.Items) == 0 {
		orderItems, err := s.repo.OrderItems(order.ID, currentUser.BusinessID)
		if err != nil {
			return nil, apperrors.Internal("failed to load purchase order items")
		}
		receiveReq.Items = make([]PurchaseReceiptItemInput, 0, len(orderItems))
		for _, item := range orderItems {
			if normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID) == "account" {
				continue
			}
			remaining := roundQuantity(item.QuantityOrdered - item.QuantityReceived)
			if remaining <= 0 {
				continue
			}
			input := PurchaseReceiptItemInput{
				ItemType:         normalizedPurchaseItemType(item.ItemType, item.ProductID != nil),
				QuantityReceived: remaining,
				UnitID:           deref(item.UnitID),
				UnitCost:         item.UnitCost,
			}
			if item.ProductID != nil {
				input.ProductID = *item.ProductID
			}
			if item.IngredientID != nil {
				input.IngredientID = *item.IngredientID
			}
			if item.PackagingItemID != nil {
				input.PackagingItemID = *item.PackagingItemID
			}
			receiveReq.Items = append(receiveReq.Items, input)
		}
	}
	if len(receiveReq.Items) == 0 {
		return nil, apperrors.BadRequest("purchase order has no remaining items to receive", nil)
	}
	return s.Receive(currentUser, receiveReq, ipAddress, userAgent)
}

func (s *Service) Receive(currentUser *utils.AuthContext, req ReceivePurchaseRequest, ipAddress, userAgent string) (*PurchaseReceiptResponse, error) {
	if err := requireAllOrOverride(currentUser, []string{"purchasing.receipts.create", "purchasing.receive_stock"}, []string{"purchasing.manage", "inventory.manage"}); err != nil {
		return nil, err
	}
	var receiptID string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		receipt, items, chargeRows, err := s.buildReceipt(tx, currentUser, req, "posted")
		if err != nil {
			return err
		}
		if err := s.repo.CreateReceipt(tx, receipt, items); err != nil {
			return err
		}
		if len(chargeRows) > 0 {
			if err := tx.Create(&chargeRows).Error; err != nil {
				return apperrors.Internal("failed to create purchase receipt charges")
			}
		}
		if err := s.applyReceiptStock(tx, currentUser, receipt); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "purchase_receipt.created", receipt.ID, "Purchase receipt created", ipAddress, userAgent); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "purchase_stock_received", receipt.ID, "Purchase stock received", ipAddress, userAgent); err != nil {
			return err
		}
		receiptID = receipt.ID
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetReceipt(currentUser, receiptID)
}

func (s *Service) ListReceipts(currentUser *utils.AuthContext, query ListQuery) (*PaginatedResponse[PurchaseReceiptResponse], error) {
	normalizeQuery(&query)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if allBranches {
		query.BranchID = ""
	} else {
		query.BranchID = branchID
	}
	receipts, total, err := s.repo.ListReceipts(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list purchase receipts")
	}
	items := make([]PurchaseReceiptResponse, 0, len(receipts))
	for _, receipt := range receipts {
		items = append(items, s.receiptResponse(currentUser.BusinessID, receipt, false))
	}
	return &PaginatedResponse[PurchaseReceiptResponse]{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) GetReceipt(currentUser *utils.AuthContext, id string) (*PurchaseReceiptResponse, error) {
	receipt, err := s.repo.FindReceipt(id, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "purchase receipt not found")
	}
	if !currentUser.CanAccessBranch(receipt.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	dto := s.receiptResponse(currentUser.BusinessID, *receipt, true)
	return &dto, nil
}

func (s *Service) PostReceipt(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*PurchaseReceiptResponse, error) {
	if err := requireAllOrOverride(currentUser, []string{"purchasing.receipts.post", "purchasing.receive_stock"}, []string{"purchasing.manage", "inventory.manage"}); err != nil {
		return nil, err
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		receipt, err := s.repo.FindReceiptForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase receipt not found")
		}
		if !currentUser.CanAccessBranch(receipt.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if receipt.Status != "draft" {
			return apperrors.BadRequest("only draft receipts can be posted", nil)
		}
		if err := s.applyReceiptStock(tx, currentUser, receipt); err != nil {
			return err
		}
		if err := s.repo.UpdateReceipt(tx, id, currentUser.BusinessID, map[string]interface{}{"status": "posted", "updated_at": time.Now().UTC()}); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "purchase_receipt.posted", id, "Purchase receipt posted", ipAddress, userAgent); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "purchase_stock_received", id, "Purchase stock received", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetReceipt(currentUser, id)
}

func (s *Service) CancelReceipt(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*PurchaseReceiptResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		receipt, err := s.repo.FindReceiptForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase receipt not found")
		}
		if !currentUser.CanAccessBranch(receipt.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if receipt.Status == "cancelled" {
			return apperrors.BadRequest("receipt is already cancelled", nil)
		}
		items, err := s.repo.ReceiptItems(id, currentUser.BusinessID)
		if err != nil {
			return err
		}
		for _, item := range items {
			if item.StockMovementID == nil {
				continue
			}
			movement, err := s.inventoryService.ApplyMovement(tx, inventory.ApplyStockMovementInput{
				BusinessID:         currentUser.BusinessID,
				InventoryItemID:    item.InventoryItemID,
				MovementType:       "adjustment_out",
				Quantity:           item.QuantityReceived,
				ReferenceType:      "purchase_receipt_cancelled",
				ReferenceID:        &receipt.ID,
				ReferenceNumber:    receipt.ReceiptNumber,
				Reason:             "Cancelled purchase receipt",
				IsReversal:         true,
				ReversedMovementID: item.StockMovementID,
				CreatedByUserID:    currentUser.UserID,
			})
			if err != nil {
				return err
			}
			if err := s.inventoryRepo.MarkMovementReversed(tx, *item.StockMovementID, currentUser.BusinessID, movement.ID); err != nil {
				return err
			}
		}
		if err := s.repo.UpdateReceipt(tx, id, currentUser.BusinessID, map[string]interface{}{"status": "cancelled", "updated_at": time.Now().UTC()}); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "purchase_receipt.cancelled", id, "Purchase receipt cancelled", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetReceipt(currentUser, id)
}

func (s *Service) ListReturns(currentUser *utils.AuthContext, query PurchaseReturnListQuery) (*PaginatedResponse[PurchaseReturnResponse], error) {
	normalizeReturnQuery(&query)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if allBranches {
		query.BranchID = ""
	} else {
		query.BranchID = branchID
	}
	if err := validateReturnListQuery(query); err != nil {
		return nil, err
	}
	rows, total, err := s.repo.ListPurchaseReturns(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list purchase returns")
	}
	items := make([]PurchaseReturnResponse, 0, len(rows))
	for _, row := range rows {
		items = append(items, s.purchaseReturnResponse(currentUser.BusinessID, row, false))
	}
	return &PaginatedResponse[PurchaseReturnResponse]{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) CreateReturn(currentUser *utils.AuthContext, req CreatePurchaseReturnRequest, ipAddress, userAgent string) (*PurchaseReturnResponse, error) {
	if err := requireAllOrOverride(currentUser, []string{"purchasing.returns.create"}, []string{"purchasing.returns.manage", "purchasing.manage"}); err != nil {
		return nil, err
	}
	var returnID string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		purchaseReturn, items, chargeRows, err := s.buildPurchaseReturn(tx, currentUser, "", req.PurchaseReceiptID, req.ReturnDate, req.SupplierReferenceNumber, req.Reason, req.Items, req.Charges, "")
		if err != nil {
			return err
		}
		number, err := s.repo.NextNumber(tx, currentUser.BusinessID, "purchase_returns", "return_number", "VC", "purchase_returns")
		if err != nil {
			return err
		}
		purchaseReturn.ReturnNumber = number
		if err := s.repo.CreatePurchaseReturn(tx, purchaseReturn, items); err != nil {
			return err
		}
		if len(chargeRows) > 0 {
			if err := tx.Create(&chargeRows).Error; err != nil {
				return apperrors.Internal("failed to create purchase return charges")
			}
		}
		if err := s.audit(tx, currentUser, "purchase_return.created", purchaseReturn.ID, "Purchase return vendor credit created", ipAddress, userAgent); err != nil {
			return err
		}
		returnID = purchaseReturn.ID
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetReturn(currentUser, returnID)
}

func (s *Service) GetReturn(currentUser *utils.AuthContext, id string) (*PurchaseReturnResponse, error) {
	purchaseReturn, err := s.repo.FindPurchaseReturn(id, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "purchase return not found")
	}
	if !currentUser.CanAccessBranch(purchaseReturn.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	dto := s.purchaseReturnResponse(currentUser.BusinessID, *purchaseReturn, true)
	return &dto, nil
}

func (s *Service) UpdateReturn(currentUser *utils.AuthContext, id string, req UpdatePurchaseReturnRequest, ipAddress, userAgent string) (*PurchaseReturnResponse, error) {
	if err := requireAllOrOverride(currentUser, []string{"purchasing.returns.edit"}, []string{"purchasing.returns.manage", "purchasing.manage"}); err != nil {
		return nil, err
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		existing, err := s.repo.FindPurchaseReturnForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase return not found")
		}
		if !currentUser.CanAccessBranch(existing.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if existing.Status != "draft" {
			return apperrors.BadRequest("only draft purchase returns can be edited", nil)
		}
		inputs := req.Items
		if inputs == nil {
			oldItems, err := s.repo.PurchaseReturnItems(id, currentUser.BusinessID)
			if err != nil {
				return err
			}
			inputs = purchaseReturnInputsFromItems(oldItems)
		}
		returnDate := first(req.ReturnDate, formatDate(existing.ReturnDate))
		purchaseReturn, items, _, err := s.buildPurchaseReturn(tx, currentUser, id, existing.PurchaseReceiptID, returnDate, first(req.SupplierReferenceNumber, existing.SupplierReferenceNumber), first(req.Reason, existing.Reason), inputs, req.Charges, existing.ID)
		if err != nil {
			return err
		}
		updates := map[string]interface{}{
			"return_date":               purchaseReturn.ReturnDate,
			"supplier_reference_number": purchaseReturn.SupplierReferenceNumber,
			"reason":                    purchaseReturn.Reason,
			"subtotal_amount":           purchaseReturn.SubtotalAmount,
			"tax_amount":                purchaseReturn.TaxAmount,
			"discount_amount":           purchaseReturn.DiscountAmount,
			"return_total":              purchaseReturn.ReturnTotal,
			"updated_at":                time.Now().UTC(),
		}
		if err := s.repo.UpdatePurchaseReturn(tx, existing.ID, currentUser.BusinessID, updates, items); err != nil {
			return err
		}
		if req.Charges != nil {
			if _, err := charges.ReplaceCharges(tx, currentUser.BusinessID, purchaseReturn.BranchID, "purchase_return", existing.ID, req.Charges); err != nil {
				return err
			}
		}
		if err := s.recalculatePurchaseReturnTotals(tx, currentUser.BusinessID, existing.ID); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "purchase_return.updated", existing.ID, "Purchase return vendor credit updated", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetReturn(currentUser, id)
}

func (s *Service) PostReturn(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*PurchaseReturnResponse, error) {
	if err := requireAllOrOverride(currentUser, []string{"purchasing.returns.post", "purchasing.receive_stock"}, []string{"purchasing.returns.manage", "purchasing.manage", "inventory.manage"}); err != nil {
		return nil, err
	}
	if s.accountingService == nil {
		return nil, apperrors.Internal("purchase return accounting service is not configured")
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		purchaseReturn, err := s.repo.FindPurchaseReturnForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase return not found")
		}
		if !currentUser.CanAccessBranch(purchaseReturn.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if purchaseReturn.Status != "draft" {
			return apperrors.BadRequest("only draft purchase returns can be posted", nil)
		}
		var invoice *PurchaseInvoice
		if purchaseReturn.PurchaseInvoiceID != nil && strings.TrimSpace(*purchaseReturn.PurchaseInvoiceID) != "" {
			loadedInvoice, err := s.repo.FindInvoiceForUpdate(tx, *purchaseReturn.PurchaseInvoiceID, currentUser.BusinessID)
			if err != nil {
				return notFound(err, "purchase invoice not found")
			}
			invoice = loadedInvoice
		}
		items, err := s.repo.PurchaseReturnItemsForUpdate(tx, purchaseReturn.ID, currentUser.BusinessID)
		if err != nil {
			return err
		}
		if len(items) == 0 {
			return apperrors.BadRequest("purchase return has no items to post", nil)
		}
		for _, item := range items {
			returnedQty, err := s.repo.PostedReturnedQuantityForReceiptItem(tx, currentUser.BusinessID, item.PurchaseReceiptItemID, purchaseReturn.ID)
			if err != nil {
				return err
			}
			receiptItem, err := receiptItemForUpdate(tx, currentUser.BusinessID, item.PurchaseReceiptItemID)
			if err != nil {
				return notFound(err, "purchase receipt item not found")
			}
			if roundQuantity(returnedQty+item.Quantity) > roundQuantity(receiptItem.QuantityReceived) {
				return apperrors.BadRequest("return quantity exceeds returnable quantity", map[string]interface{}{"item": item.ItemNameSnapshot})
			}
			if item.StockMovementID != nil {
				continue
			}
			locationID, err := s.resolvePurchaseReturnStockLocation(tx, currentUser.BusinessID, item.StockLocationID, receiptItem.StockMovementID)
			if err != nil {
				return err
			}
			movement, err := s.inventoryService.ApplyMovement(tx, inventory.ApplyStockMovementInput{
				BusinessID:      currentUser.BusinessID,
				InventoryItemID: item.InventoryItemID,
				StockLocationID: locationID,
				MovementType:    "purchase_return_out",
				Quantity:        item.Quantity,
				ReferenceType:   "purchase_return",
				ReferenceID:     &purchaseReturn.ID,
				ReferenceNumber: purchaseReturn.ReturnNumber,
				Reason:          first(item.Reason, "Purchase return to supplier"),
				CreatedByUserID: currentUser.UserID,
			})
			if err != nil {
				return err
			}
			if err := s.repo.UpdatePurchaseReturnItemStockMovement(tx, item.ID, currentUser.BusinessID, movement.ID); err != nil {
				return err
			}
		}
		appliedCredit := 0.0
		if invoice != nil {
			appliedCredit = roundMoney(purchaseReturn.ReturnTotal)
			if appliedCredit > roundMoney(invoice.BalanceAmount) {
				appliedCredit = roundMoney(invoice.BalanceAmount)
			}
		}
		openCredit := roundMoney(purchaseReturn.ReturnTotal - appliedCredit)
		now := time.Now().UTC()
		returnUpdates := map[string]interface{}{
			"status":                "posted",
			"applied_credit_amount": appliedCredit,
			"open_credit_amount":    openCredit,
			"posted_by_user_id":     currentUser.UserID,
			"posted_at":             now,
			"updated_at":            now,
		}
		if err := s.repo.UpdatePurchaseReturn(tx, purchaseReturn.ID, currentUser.BusinessID, returnUpdates, nil); err != nil {
			return err
		}
		if invoice != nil {
			creditedAmount := roundMoney(invoice.CreditedAmount + appliedCredit)
			returnedAmount := roundMoney(invoice.ReturnedAmount + purchaseReturn.ReturnTotal)
			balanceAmount := roundMoney(invoice.TotalAmount - invoice.PaidAmount - creditedAmount)
			if balanceAmount < 0 {
				balanceAmount = 0
			}
			paymentStatus := invoicePaymentStatus(invoice.TotalAmount, roundMoney(invoice.PaidAmount+creditedAmount))
			returnStatus := purchaseInvoiceReturnStatus(invoice.TotalAmount, returnedAmount)
			if err := s.repo.UpdateInvoice(tx, invoice.ID, currentUser.BusinessID, map[string]interface{}{
				"returned_amount": returnedAmount,
				"credited_amount": creditedAmount,
				"balance_amount":  balanceAmount,
				"payment_status":  paymentStatus,
				"return_status":   returnStatus,
				"updated_at":      now,
			}, nil); err != nil {
				return err
			}
		}
		if _, err := s.accountingService.PostPurchaseReturnJournal(tx, currentUser, purchaseReturn.ID); err != nil {
			return err
		}
		if err := s.audit(tx, currentUser, "purchase_return.posted", purchaseReturn.ID, "Purchase return vendor credit posted", ipAddress, userAgent); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "purchase_return.stock_returned", purchaseReturn.ID, "Purchase return stock moved out", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetReturn(currentUser, id)
}

func (s *Service) CancelReturn(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*PurchaseReturnResponse, error) {
	if err := requireAllOrOverride(currentUser, []string{"purchasing.returns.cancel"}, []string{"purchasing.returns.manage", "purchasing.manage"}); err != nil {
		return nil, err
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		purchaseReturn, err := s.repo.FindPurchaseReturnForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase return not found")
		}
		if !currentUser.CanAccessBranch(purchaseReturn.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if purchaseReturn.Status != "draft" {
			return apperrors.BadRequest("only draft purchase returns can be cancelled", nil)
		}
		now := time.Now().UTC()
		if err := s.repo.UpdatePurchaseReturn(tx, purchaseReturn.ID, currentUser.BusinessID, map[string]interface{}{"status": "cancelled", "cancelled_by_user_id": currentUser.UserID, "cancelled_at": now, "updated_at": now}, nil); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "purchase_return.cancelled", purchaseReturn.ID, "Purchase return vendor credit cancelled", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetReturn(currentUser, id)
}

func (s *Service) ReverseReturn(currentUser *utils.AuthContext, id string, req ReversePurchaseReturnRequest, ipAddress, userAgent string) (*PurchaseReturnResponse, error) {
	if err := requireAllOrOverride(currentUser, []string{"purchasing.returns.reverse"}, []string{"purchasing.returns.manage", "purchasing.manage", "inventory.manage"}); err != nil {
		return nil, err
	}
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		return nil, apperrors.BadRequest("reversal reason is required", nil)
	}
	if s.accountingService == nil {
		return nil, apperrors.Internal("purchase return accounting service is not configured")
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		purchaseReturn, err := s.repo.FindPurchaseReturnForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase return not found")
		}
		if !currentUser.CanAccessBranch(purchaseReturn.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if purchaseReturn.Status != "posted" {
			return apperrors.BadRequest("only posted vendor credits can be reversed", nil)
		}
		if purchaseReturn.JournalEntryID == nil || strings.TrimSpace(*purchaseReturn.JournalEntryID) == "" {
			return apperrors.Conflict("posted vendor credit is missing its accounting journal; run purchase return journal backfill before reversing", map[string]interface{}{"reason": "purchase_return_journal_missing"})
		}

		var invoice *PurchaseInvoice
		if purchaseReturn.PurchaseInvoiceID != nil && strings.TrimSpace(*purchaseReturn.PurchaseInvoiceID) != "" {
			loadedInvoice, err := s.repo.FindInvoiceForUpdate(tx, *purchaseReturn.PurchaseInvoiceID, currentUser.BusinessID)
			if err != nil {
				return notFound(err, "purchase invoice not found")
			}
			invoice = loadedInvoice
		}
		items, err := s.repo.PurchaseReturnItemsForUpdate(tx, purchaseReturn.ID, currentUser.BusinessID)
		if err != nil {
			return err
		}

		for _, item := range items {
			if item.StockMovementID == nil || strings.TrimSpace(*item.StockMovementID) == "" {
				continue
			}
			original, err := s.inventoryRepo.FindStockMovementForUpdate(tx, *item.StockMovementID, currentUser.BusinessID)
			if err != nil {
				return notFound(err, "purchase return stock movement not found")
			}
			if original.IsReversed {
				return apperrors.Conflict("purchase return stock movement was already reversed", map[string]interface{}{"reason": "purchase_return_stock_already_reversed", "stock_movement_id": original.ID})
			}
			movement, err := s.inventoryService.ApplyMovement(tx, inventory.ApplyStockMovementInput{
				BusinessID:         currentUser.BusinessID,
				InventoryItemID:    item.InventoryItemID,
				StockLocationID:    original.StockLocationID,
				MovementType:       "adjustment_in",
				Quantity:           item.Quantity,
				UnitCost:           original.UnitCostSnapshot,
				ReferenceType:      "purchase_return_reversal",
				ReferenceID:        &purchaseReturn.ID,
				ReferenceNumber:    purchaseReturn.ReturnNumber,
				Reason:             "Reverse vendor credit: " + reason,
				Notes:              "Reversal of purchase return stock movement " + original.ID,
				IsReversal:         true,
				ReversedMovementID: &original.ID,
				CreatedByUserID:    currentUser.UserID,
			})
			if err != nil {
				return err
			}
			if err := s.inventoryRepo.MarkMovementReversed(tx, original.ID, currentUser.BusinessID, movement.ID); err != nil {
				return err
			}
		}

		now := time.Now().UTC()

		reversalJournalID, err := s.accountingService.ReversePurchaseReturnJournal(tx, currentUser, strings.TrimSpace(*purchaseReturn.JournalEntryID), purchaseReturn.ReturnNumber)
		if err != nil {
			return err
		}

		returnUpdates := map[string]interface{}{
			"status":                "reversed",
			"applied_credit_amount": 0,
			"open_credit_amount":    0,
			"reversal_reason":       reason,
			"reversed_by_user_id":   currentUser.UserID,
			"reversed_at":           now,
			"updated_at":            now,
		}
		if reversalJournalID != "" {
			returnUpdates["reversal_journal_entry_id"] = reversalJournalID
		}
		if err := s.repo.UpdatePurchaseReturn(tx, purchaseReturn.ID, currentUser.BusinessID, returnUpdates, nil); err != nil {
			return err
		}
		if invoice != nil {
			creditedAmount := roundMoney(invoice.CreditedAmount - purchaseReturn.AppliedCreditAmount)
			if creditedAmount < 0 {
				creditedAmount = 0
			}
			returnedAmount := roundMoney(invoice.ReturnedAmount - purchaseReturn.ReturnTotal)
			if returnedAmount < 0 {
				returnedAmount = 0
			}
			balanceAmount := roundMoney(invoice.TotalAmount - invoice.PaidAmount - creditedAmount)
			if balanceAmount < 0 {
				balanceAmount = 0
			}
			paymentStatus := invoicePaymentStatus(invoice.TotalAmount, roundMoney(invoice.PaidAmount+creditedAmount))
			returnStatus := purchaseInvoiceReturnStatus(invoice.TotalAmount, returnedAmount)
			if err := s.repo.UpdateInvoice(tx, invoice.ID, currentUser.BusinessID, map[string]interface{}{
				"returned_amount": returnedAmount,
				"credited_amount": creditedAmount,
				"balance_amount":  balanceAmount,
				"payment_status":  paymentStatus,
				"return_status":   returnStatus,
				"updated_at":      now,
			}, nil); err != nil {
				return err
			}
		}
		if err := s.audit(tx, currentUser, "purchase_return.reversed", purchaseReturn.ID, "Purchase return vendor credit reversed", ipAddress, userAgent); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "purchase_return.stock_reversal", purchaseReturn.ID, "Purchase return stock reversal posted", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetReturn(currentUser, id)
}

func (s *Service) ReceiptReturnableItems(currentUser *utils.AuthContext, receiptID string) ([]PurchaseReturnableItemResponse, error) {
	receipt, err := s.repo.FindReceipt(receiptID, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "purchase receipt not found")
	}
	if !currentUser.CanAccessBranch(receipt.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	if receipt.Status != "posted" {
		return nil, apperrors.BadRequest("only posted purchase receipts have returnable items", nil)
	}
	var invoiceItems []PurchaseInvoiceItem
	if receipt.PurchaseInvoiceID != nil && strings.TrimSpace(*receipt.PurchaseInvoiceID) != "" {
		invoice, err := s.repo.FindInvoice(*receipt.PurchaseInvoiceID, currentUser.BusinessID)
		if err != nil {
			return nil, notFound(err, "purchase invoice not found")
		}
		if invoice.Status != "posted" {
			return nil, apperrors.BadRequest("receipt-linked purchase invoice must be posted before invoice credit can be applied", nil)
		}
		invoiceItems, err = s.repo.InvoiceItems(*receipt.PurchaseInvoiceID, currentUser.BusinessID)
		if err != nil {
			return nil, apperrors.Internal("failed to load invoice items")
		}
	}
	receiptItems, err := s.repo.ReceiptItems(receipt.ID, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load receipt items")
	}
	result := make([]PurchaseReturnableItemResponse, 0, len(receiptItems))
	for _, item := range receiptItems {
		returnedQty, err := s.repo.PostedReturnedQuantityForReceiptItem(s.db, currentUser.BusinessID, item.ID, "")
		if err != nil {
			return nil, apperrors.Internal("failed to calculate returned quantity")
		}
		response, err := s.returnableItemResponse(currentUser.BusinessID, receipt.BranchID, item, invoiceItems, returnedQty, item.QuantityReceived)
		if err != nil {
			return nil, err
		}
		if response.ReturnableQuantity > 0 {
			result = append(result, response)
		}
	}
	return result, nil
}

func (s *Service) ListReturnsByReceipt(currentUser *utils.AuthContext, receiptID string) ([]PurchaseReturnResponse, error) {
	receipt, err := s.repo.FindReceipt(receiptID, currentUser.BusinessID)
	if err != nil {
		return nil, notFound(err, "purchase receipt not found")
	}
	if !currentUser.CanAccessBranch(receipt.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	rows, err := s.repo.PurchaseReturnsForReceipt(currentUser.BusinessID, receiptID)
	if err != nil {
		return nil, apperrors.Internal("failed to load purchase returns")
	}
	result := make([]PurchaseReturnResponse, 0, len(rows))
	for _, row := range rows {
		result = append(result, s.purchaseReturnResponse(currentUser.BusinessID, row, false))
	}
	return result, nil
}

func (s *Service) Summary(currentUser *utils.AuthContext) (*PurchasingSummaryResponse, error) {
	branchID, allBranches, err := currentUser.ResolveBranchScope("", "")
	if err != nil {
		return nil, err
	}
	if allBranches {
		return s.repo.Summary(currentUser.BusinessID, "")
	}
	return s.repo.Summary(currentUser.BusinessID, branchID)
}

func (s *Service) SupplierHistory(currentUser *utils.AuthContext, supplierID string) (*SupplierHistoryResponse, error) {
	if err := validateUUID(supplierID, "supplier_id"); err != nil {
		return nil, err
	}
	branchID, allBranches, err := currentUser.ResolveBranchScope("", "")
	if err != nil {
		return nil, err
	}
	branchFilter := ""
	if !allBranches {
		branchFilter = branchID
		if err := s.repo.ValidateSupplier(s.db, currentUser.BusinessID, branchFilter, supplierID); err != nil {
			return nil, notFound(err, "supplier not found")
		}
	}
	orders, _, _ := s.repo.ListOrders(currentUser.BusinessID, ListQuery{BranchID: branchFilter, SupplierID: supplierID, Page: 1, Limit: 50, SortBy: "order_date", SortOrder: "desc"})
	invoices, _, _ := s.repo.ListInvoices(currentUser.BusinessID, ListQuery{BranchID: branchFilter, SupplierID: supplierID, Page: 1, Limit: 50, SortBy: "invoice_date", SortOrder: "desc"})
	receipts, _, _ := s.repo.ListReceipts(currentUser.BusinessID, ListQuery{BranchID: branchFilter, SupplierID: supplierID, Page: 1, Limit: 50, SortBy: "received_date", SortOrder: "desc"})
	returns, _, _ := s.repo.ListPurchaseReturns(currentUser.BusinessID, PurchaseReturnListQuery{BranchID: branchFilter, SupplierID: supplierID, Page: 1, Limit: 50, SortBy: "return_date", SortOrder: "desc"})
	response := &SupplierHistoryResponse{SupplierID: supplierID}
	for _, order := range orders {
		response.PurchaseOrders = append(response.PurchaseOrders, s.orderResponse(currentUser.BusinessID, order, false))
	}
	for _, invoice := range invoices {
		response.Invoices = append(response.Invoices, s.invoiceResponse(currentUser.BusinessID, invoice, false))
		if invoice.Status != "cancelled" {
			response.TotalPurchaseAmount += invoice.TotalAmount
			if response.LastPurchaseDate == nil || invoice.InvoiceDate.After(*response.LastPurchaseDate) {
				date := invoice.InvoiceDate
				response.LastPurchaseDate = &date
			}
		}
	}
	for _, receipt := range receipts {
		response.Receipts = append(response.Receipts, s.receiptResponse(currentUser.BusinessID, receipt, false))
	}
	for _, purchaseReturn := range returns {
		response.Returns = append(response.Returns, s.purchaseReturnResponse(currentUser.BusinessID, purchaseReturn, false))
		if purchaseReturn.Status == "posted" {
			response.OpenVendorCredit += purchaseReturn.OpenCreditAmount
		}
	}
	response.TotalPurchaseAmount = roundMoney(response.TotalPurchaseAmount)
	response.OpenVendorCredit = roundMoney(response.OpenVendorCredit)
	return response, nil
}

func (s *Service) buildOrder(tx *gorm.DB, currentUser *utils.AuthContext, id, branchID, supplierID, orderDate, expectedDate string, inputItems []PurchaseOrderItemInput, chargeInputs []charges.ChargeInput, notes string) (*PurchaseOrder, []PurchaseOrderItem, []charges.DocumentCharge, error) {
	resolvedBranchID, err := currentUser.ResolveOperationalBranch(branchID)
	if err != nil {
		return nil, nil, nil, err
	}
	branchID = resolvedBranchID
	if err := s.validateHeader(tx, currentUser.BusinessID, branchID, supplierID); err != nil {
		return nil, nil, nil, err
	}
	parsedOrderDate, err := parseDate(orderDate, "order_date")
	if err != nil {
		return nil, nil, nil, err
	}
	parsedExpected, err := parseOptionalDate(expectedDate, "expected_delivery_date")
	if err != nil {
		return nil, nil, nil, err
	}
	orderID := id
	if orderID == "" {
		orderID = utils.NewUUID()
	}
	items, totals, err := s.buildOrderItems(tx, currentUser.BusinessID, branchID, orderID, inputItems)
	if err != nil {
		return nil, nil, nil, err
	}
	chargeRows, chargeTotals, err := charges.BuildCharges(tx, currentUser.BusinessID, branchID, "purchase_order", orderID, chargeInputs)
	if err != nil {
		return nil, nil, nil, err
	}
	taxAmount := roundMoney(totals.Tax + chargeTotals.TaxAmount)
	totalAmount := roundMoney(totals.Total + chargeTotals.Total)
	return &PurchaseOrder{ID: orderID, BusinessID: currentUser.BusinessID, BranchID: branchID, SupplierID: supplierID, OrderDate: parsedOrderDate, ExpectedDeliveryDate: parsedExpected, Status: "draft", SubtotalAmount: totals.Subtotal, TaxAmount: taxAmount, ChargeAmount: chargeTotals.Amount, ChargeTaxAmount: chargeTotals.TaxAmount, DiscountAmount: totals.Discount, TotalAmount: totalAmount, Notes: strings.TrimSpace(notes), CreatedByUserID: currentUser.UserID, UpdatedByUserID: currentUser.UserID}, items, chargeRows, nil
}

func (s *Service) buildOrderItems(tx *gorm.DB, businessID, branchID, orderID string, inputItems []PurchaseOrderItemInput) ([]PurchaseOrderItem, totals, error) {
	if len(inputItems) == 0 {
		return nil, totals{}, apperrors.BadRequest("items are required", nil)
	}
	items := make([]PurchaseOrderItem, 0, len(inputItems))
	var total totals
	for _, input := range inputItems {
		if normalizedOrderLineType(input) == "account" {
			item, line, err := s.buildOrderAccountLine(tx, businessID, orderID, input)
			if err != nil {
				return nil, totals{}, err
			}
			total.add(line)
			items = append(items, item)
			continue
		}
		common, line, err := s.prepareLine(tx, businessID, branchID, lineInput{ItemType: input.ItemType, ProductID: input.ProductID, IngredientID: input.IngredientID, PackagingItemID: input.PackagingItemID, Quantity: input.QuantityOrdered, UnitID: input.UnitID, UnitCost: input.UnitCost, DiscountAmount: input.DiscountAmount, TaxRateID: input.TaxRateID})
		if err != nil {
			return nil, totals{}, err
		}
		total.add(line)
		items = append(items, PurchaseOrderItem{ID: utils.NewUUID(), BusinessID: businessID, PurchaseOrderID: orderID, LineType: "product", ItemType: common.ItemType, ProductID: common.ProductID, IngredientID: common.IngredientID, PackagingItemID: common.PackagingItemID, ItemNameSnapshot: common.ItemName, QuantityOrdered: input.QuantityOrdered, UnitID: nullableString(input.UnitID), UnitCost: input.UnitCost, DiscountAmount: input.DiscountAmount, TaxRateID: nullableString(input.TaxRateID), TaxAmount: line.Tax, LineTotal: line.Total})
	}
	return items, total.round(), nil
}

func (s *Service) buildOrderAccountLine(tx *gorm.DB, businessID, orderID string, input PurchaseOrderItemInput) (PurchaseOrderItem, lineTotals, error) {
	description := strings.TrimSpace(input.Description)
	if description == "" {
		return PurchaseOrderItem{}, lineTotals{}, apperrors.BadRequest("description is required for account lines", nil)
	}
	if err := validateUUID(input.AccountID, "account_id"); err != nil {
		return PurchaseOrderItem{}, lineTotals{}, err
	}
	account, err := s.purchaseBillAccount(tx, businessID, input.AccountID)
	if err != nil {
		return PurchaseOrderItem{}, lineTotals{}, err
	}
	line, err := s.calculatePurchaseLine(tx, businessID, input.QuantityOrdered, input.UnitCost, input.DiscountAmount, input.TaxRateID)
	if err != nil {
		return PurchaseOrderItem{}, lineTotals{}, err
	}
	return PurchaseOrderItem{
		ID:               utils.NewUUID(),
		BusinessID:       businessID,
		PurchaseOrderID:  orderID,
		LineType:         "account",
		ItemType:         "account",
		AccountID:        &account.ID,
		AccountName:      account.AccountName,
		AccountCode:      account.AccountCode,
		Description:      description,
		ItemNameSnapshot: description,
		QuantityOrdered:  input.QuantityOrdered,
		UnitCost:         input.UnitCost,
		DiscountAmount:   input.DiscountAmount,
		TaxRateID:        nullableString(input.TaxRateID),
		TaxAmount:        line.Tax,
		LineTotal:        line.Total,
	}, line, nil
}

func (s *Service) buildInvoice(tx *gorm.DB, currentUser *utils.AuthContext, id string, req CreatePurchaseInvoiceRequest) (*PurchaseInvoice, []PurchaseInvoiceItem, []charges.DocumentCharge, error) {
	resolvedBranchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return nil, nil, nil, err
	}
	req.BranchID = resolvedBranchID
	if err := s.validateHeader(tx, currentUser.BusinessID, req.BranchID, req.SupplierID); err != nil {
		return nil, nil, nil, err
	}
	if strings.TrimSpace(req.InvoiceNumber) == "" {
		return nil, nil, nil, apperrors.BadRequest("invoice_number is required", nil)
	}
	invoiceDate, err := parseDate(req.InvoiceDate, "invoice_date")
	if err != nil {
		return nil, nil, nil, err
	}
	dueDate, err := parseOptionalDate(req.DueDate, "due_date")
	if err != nil {
		return nil, nil, nil, err
	}
	if req.PurchaseOrderID != "" {
		order, err := s.repo.FindOrder(req.PurchaseOrderID, currentUser.BusinessID)
		if err != nil {
			return nil, nil, nil, notFound(err, "purchase order not found")
		}
		if order.BranchID != req.BranchID {
			return nil, nil, nil, apperrors.BadRequest("purchase order branch does not match invoice branch", nil)
		}
		existingInvoices, err := s.repo.ActiveInvoiceCountForOrderExcluding(tx, currentUser.BusinessID, order.ID, id)
		if err != nil {
			return nil, nil, nil, err
		}
		if existingInvoices > 0 {
			return nil, nil, nil, apperrors.Conflict("purchase order already has a purchase bill", nil)
		}
	}
	invoiceID := id
	if invoiceID == "" {
		invoiceID = utils.NewUUID()
	}
	items, total, err := s.buildInvoiceItems(tx, currentUser.BusinessID, req.BranchID, invoiceID, req.Items)
	if err != nil {
		return nil, nil, nil, err
	}
	chargeRows, chargeTotals, err := charges.BuildCharges(tx, currentUser.BusinessID, req.BranchID, "purchase_invoice", invoiceID, req.Charges)
	if err != nil {
		return nil, nil, nil, err
	}
	billDiscount := roundMoney(req.BillDiscountAmount)
	if billDiscount < 0 {
		return nil, nil, nil, apperrors.BadRequest("bill_discount_amount must be non-negative", nil)
	}
	if billDiscount > roundMoney(total.Subtotal-total.Discount) {
		return nil, nil, nil, apperrors.BadRequest("bill_discount_amount cannot exceed bill line net amount", nil)
	}
	taxAmount := roundMoney(total.Tax + chargeTotals.TaxAmount)
	totalAmount := roundMoney(total.Total - billDiscount + chargeTotals.Total)
	return &PurchaseInvoice{ID: invoiceID, BusinessID: currentUser.BusinessID, BranchID: req.BranchID, SupplierID: req.SupplierID, PurchaseOrderID: nullableString(req.PurchaseOrderID), InvoiceNumber: strings.TrimSpace(req.InvoiceNumber), SupplierBillNumber: strings.TrimSpace(req.SupplierBillNumber), InvoiceDate: invoiceDate, DueDate: dueDate, Status: "draft", PaymentStatus: "unpaid", SubtotalAmount: total.Subtotal, TaxAmount: taxAmount, ChargeAmount: chargeTotals.Amount, ChargeTaxAmount: chargeTotals.TaxAmount, DiscountAmount: total.Discount, BillDiscountAmount: billDiscount, TotalAmount: totalAmount, BalanceAmount: totalAmount, Notes: strings.TrimSpace(req.Notes), CreatedByUserID: currentUser.UserID, UpdatedByUserID: currentUser.UserID}, items, chargeRows, nil
}

func (s *Service) buildInvoiceItems(tx *gorm.DB, businessID, branchID, invoiceID string, inputItems []PurchaseInvoiceItemInput) ([]PurchaseInvoiceItem, totals, error) {
	if len(inputItems) == 0 {
		return nil, totals{}, apperrors.BadRequest("items are required", nil)
	}
	items := make([]PurchaseInvoiceItem, 0, len(inputItems))
	var total totals
	for _, input := range inputItems {
		lineType := normalizedInvoiceLineType(input)
		if lineType == "account" {
			item, line, err := s.buildInvoiceAccountLine(tx, businessID, invoiceID, input)
			if err != nil {
				return nil, totals{}, err
			}
			total.add(line)
			items = append(items, item)
			continue
		}
		common, line, err := s.prepareLine(tx, businessID, branchID, lineInput{ItemType: input.ItemType, ProductID: input.ProductID, IngredientID: input.IngredientID, PackagingItemID: input.PackagingItemID, Quantity: input.Quantity, UnitID: input.UnitID, UnitCost: input.UnitCost, DiscountAmount: input.DiscountAmount, TaxRateID: input.TaxRateID})
		if err != nil {
			return nil, totals{}, err
		}
		expiryDate, err := parseOptionalDate(input.ExpiryDate, "expiry_date")
		if err != nil {
			return nil, totals{}, err
		}
		total.add(line)
		items = append(items, PurchaseInvoiceItem{ID: utils.NewUUID(), BusinessID: businessID, PurchaseInvoiceID: invoiceID, LineType: "product", ItemType: common.ItemType, ProductID: common.ProductID, IngredientID: common.IngredientID, PackagingItemID: common.PackagingItemID, ItemNameSnapshot: common.ItemName, Quantity: input.Quantity, UnitID: nullableString(input.UnitID), UnitCost: input.UnitCost, DiscountAmount: input.DiscountAmount, TaxRateID: nullableString(input.TaxRateID), TaxAmount: line.Tax, LineTotal: line.Total, ExpiryDate: expiryDate, BatchNumber: strings.TrimSpace(input.BatchNumber)})
	}
	return items, total.round(), nil
}

func (s *Service) buildInvoiceAccountLine(tx *gorm.DB, businessID, invoiceID string, input PurchaseInvoiceItemInput) (PurchaseInvoiceItem, lineTotals, error) {
	description := strings.TrimSpace(input.Description)
	if description == "" {
		description = strings.TrimSpace(input.ItemNameSnapshot)
	}
	if description == "" {
		return PurchaseInvoiceItem{}, lineTotals{}, apperrors.BadRequest("description is required for account lines", nil)
	}
	if err := validateUUID(input.AccountID, "account_id"); err != nil {
		return PurchaseInvoiceItem{}, lineTotals{}, err
	}
	account, err := s.purchaseBillAccount(tx, businessID, input.AccountID)
	if err != nil {
		return PurchaseInvoiceItem{}, lineTotals{}, err
	}
	line, err := s.calculatePurchaseLine(tx, businessID, input.Quantity, input.UnitCost, input.DiscountAmount, input.TaxRateID)
	if err != nil {
		return PurchaseInvoiceItem{}, lineTotals{}, err
	}
	return PurchaseInvoiceItem{
		ID:                utils.NewUUID(),
		BusinessID:        businessID,
		PurchaseInvoiceID: invoiceID,
		LineType:          "account",
		ItemType:          "account",
		AccountID:         &account.ID,
		AccountName:       account.AccountName,
		AccountCode:       account.AccountCode,
		Description:       description,
		ItemNameSnapshot:  description,
		Quantity:          input.Quantity,
		UnitID:            nullableString(input.UnitID),
		UnitCost:          input.UnitCost,
		DiscountAmount:    input.DiscountAmount,
		TaxRateID:         nullableString(input.TaxRateID),
		TaxAmount:         line.Tax,
		LineTotal:         line.Total,
	}, line, nil
}

func (s *Service) buildReceipt(tx *gorm.DB, currentUser *utils.AuthContext, req ReceivePurchaseRequest, status string) (*PurchaseReceipt, []PurchaseReceiptItem, []charges.DocumentCharge, error) {
	resolvedBranchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return nil, nil, nil, err
	}
	req.BranchID = resolvedBranchID
	if err := s.validateHeader(tx, currentUser.BusinessID, req.BranchID, req.SupplierID); err != nil {
		return nil, nil, nil, err
	}
	receivedDate, err := parseDate(req.ReceivedDate, "received_date")
	if err != nil {
		return nil, nil, nil, err
	}
	var orderItems []PurchaseOrderItem
	var invoiceItems []PurchaseInvoiceItem
	var postedInvoiceReceiptItems []PurchaseReceiptItem
	if req.PurchaseOrderID != "" {
		order, err := s.repo.FindOrderForUpdate(tx, req.PurchaseOrderID, currentUser.BusinessID)
		if err != nil {
			return nil, nil, nil, notFound(err, "purchase order not found")
		}
		if order.Status == "cancelled" || order.Status == "received" {
			return nil, nil, nil, apperrors.BadRequest("purchase order cannot receive more stock", nil)
		}
		if order.BranchID != req.BranchID {
			return nil, nil, nil, apperrors.BadRequest("purchase order branch does not match receipt branch", nil)
		}
		orderItems, err = s.repo.OrderItemsForUpdate(tx, order.ID, currentUser.BusinessID)
		if err != nil {
			return nil, nil, nil, err
		}
	}
	if req.PurchaseInvoiceID != "" {
		invoice, err := s.repo.FindInvoiceForUpdate(tx, req.PurchaseInvoiceID, currentUser.BusinessID)
		if err != nil {
			return nil, nil, nil, notFound(err, "purchase invoice not found")
		}
		if invoice.Status != "posted" {
			return nil, nil, nil, apperrors.BadRequest("only posted invoices can be received", nil)
		}
		if invoice.BranchID != req.BranchID {
			return nil, nil, nil, apperrors.BadRequest("purchase invoice branch does not match receipt branch", nil)
		}
		if req.PurchaseOrderID == "" {
			invoiceItems, err = s.repo.InvoiceItemsForUpdate(tx, invoice.ID, currentUser.BusinessID)
			if err != nil {
				return nil, nil, nil, err
			}
			postedInvoiceReceiptItems, err = s.repo.PostedReceiptItemsForInvoiceForUpdate(tx, currentUser.BusinessID, invoice.ID)
			if err != nil {
				return nil, nil, nil, err
			}
		}
	}
	if len(req.Items) == 0 {
		return nil, nil, nil, apperrors.BadRequest("items are required", nil)
	}
	receiptNumber, err := s.repo.NextNumber(tx, currentUser.BusinessID, "purchase_receipts", "receipt_number", "PR", "purchase_receipts")
	if err != nil {
		return nil, nil, nil, err
	}
	receipt := &PurchaseReceipt{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, BranchID: req.BranchID, SupplierID: req.SupplierID, PurchaseOrderID: nullableString(req.PurchaseOrderID), PurchaseInvoiceID: nullableString(req.PurchaseInvoiceID), ReceiptNumber: receiptNumber, ReceivedDate: receivedDate, Status: "posted", ReceivedByUserID: currentUser.UserID, Notes: strings.TrimSpace(req.Notes)}
	if status != "" {
		receipt.Status = status
	}
	items := make([]PurchaseReceiptItem, 0, len(req.Items))
	requestedPOItems := make([]preparedItem, 0, len(req.Items))
	requestedInvoiceItems := make([]preparedItem, 0, len(req.Items))
	for _, input := range req.Items {
		prepared, err := s.prepareReceiptItem(tx, currentUser.BusinessID, req.BranchID, input)
		if err != nil {
			return nil, nil, nil, err
		}
		if req.PurchaseOrderID != "" {
			requestedPOItems = append(requestedPOItems, prepared)
			if err := validatePOReceiptQuantities(orderItems, requestedPOItems); err != nil {
				return nil, nil, nil, err
			}
		}
		if req.PurchaseInvoiceID != "" && req.PurchaseOrderID == "" {
			requestedInvoiceItems = append(requestedInvoiceItems, prepared)
			if err := validateInvoiceReceiptQuantities(invoiceItems, postedInvoiceReceiptItems, requestedInvoiceItems); err != nil {
				return nil, nil, nil, err
			}
		}
		if err := s.validateReceiptProduct(tx, currentUser.BusinessID, req.BranchID, prepared); err != nil {
			return nil, nil, nil, err
		}
		inventoryItem, err := s.findOrCreateInventoryItem(tx, currentUser.BusinessID, req.BranchID, prepared)
		if err != nil {
			return nil, nil, nil, err
		}
		expiryDate, err := parseOptionalDate(input.ExpiryDate, "expiry_date")
		if err != nil {
			return nil, nil, nil, err
		}
		items = append(items, PurchaseReceiptItem{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, PurchaseReceiptID: receipt.ID, ItemType: prepared.ItemType, ProductID: prepared.ProductID, IngredientID: prepared.IngredientID, PackagingItemID: prepared.PackagingItemID, InventoryItemID: inventoryItem.ID, QuantityReceived: input.QuantityReceived, UnitID: input.UnitID, UnitCost: input.UnitCost, ExpiryDate: expiryDate, BatchNumber: strings.TrimSpace(input.BatchNumber)})
	}
	chargeRows, chargeTotals, err := charges.BuildCharges(tx, currentUser.BusinessID, req.BranchID, "purchase_receipt", receipt.ID, req.Charges)
	if err != nil {
		return nil, nil, nil, err
	}
	receipt.ChargeAmount = chargeTotals.Amount
	receipt.ChargeTaxAmount = chargeTotals.TaxAmount
	return receipt, items, chargeRows, nil
}

func (s *Service) buildPurchaseReturn(tx *gorm.DB, currentUser *utils.AuthContext, id, receiptID, returnDate, supplierReferenceNumber, reason string, inputItems []PurchaseReturnItemInput, chargeInputs []charges.ChargeInput, excludeReturnID string) (*PurchaseReturn, []PurchaseReturnItem, []charges.DocumentCharge, error) {
	if err := validateUUID(receiptID, "purchase_receipt_id"); err != nil {
		return nil, nil, nil, err
	}
	receipt, err := s.repo.FindReceiptForUpdate(tx, receiptID, currentUser.BusinessID)
	if err != nil {
		return nil, nil, nil, notFound(err, "purchase receipt not found")
	}
	if !currentUser.CanAccessBranch(receipt.BranchID) {
		return nil, nil, nil, apperrors.Forbidden("branch access denied")
	}
	if receipt.Status != "posted" {
		return nil, nil, nil, apperrors.BadRequest("only posted purchase receipts can be returned", nil)
	}
	var invoice *PurchaseInvoice
	if receipt.PurchaseInvoiceID != nil && strings.TrimSpace(*receipt.PurchaseInvoiceID) != "" {
		loadedInvoice, err := s.repo.FindInvoiceForUpdate(tx, *receipt.PurchaseInvoiceID, currentUser.BusinessID)
		if err != nil {
			return nil, nil, nil, notFound(err, "purchase invoice not found")
		}
		if loadedInvoice.Status != "posted" {
			return nil, nil, nil, apperrors.BadRequest("receipt-linked purchase invoice must be posted before invoice credit can be applied", nil)
		}
		if loadedInvoice.BranchID != receipt.BranchID || loadedInvoice.SupplierID != receipt.SupplierID {
			return nil, nil, nil, apperrors.BadRequest("receipt and invoice supplier/branch do not match", nil)
		}
		invoice = loadedInvoice
	}
	parsedReturnDate, err := parseDate(returnDate, "return_date")
	if err != nil {
		return nil, nil, nil, err
	}
	returnID := id
	if returnID == "" {
		returnID = utils.NewUUID()
	}
	items, total, err := s.buildPurchaseReturnItems(tx, currentUser.BusinessID, receipt, invoice, returnID, inputItems, excludeReturnID)
	if err != nil {
		return nil, nil, nil, err
	}
	chargeRows, chargeTotals, err := charges.BuildCharges(tx, currentUser.BusinessID, receipt.BranchID, "purchase_return", returnID, chargeInputs)
	if err != nil {
		return nil, nil, nil, err
	}
	taxAmount := roundMoney(total.Tax + chargeTotals.TaxAmount)
	returnTotal := roundMoney(total.Total + chargeTotals.Total)
	return &PurchaseReturn{
		ID:                      returnID,
		BusinessID:              currentUser.BusinessID,
		BranchID:                receipt.BranchID,
		SupplierID:              receipt.SupplierID,
		PurchaseOrderID:         receipt.PurchaseOrderID,
		PurchaseInvoiceID:       receipt.PurchaseInvoiceID,
		PurchaseReceiptID:       receipt.ID,
		ReturnDate:              parsedReturnDate,
		SupplierReferenceNumber: strings.TrimSpace(supplierReferenceNumber),
		Reason:                  strings.TrimSpace(reason),
		Status:                  "draft",
		SubtotalAmount:          total.Subtotal,
		TaxAmount:               taxAmount,
		ChargeAmount:            chargeTotals.Amount,
		ChargeTaxAmount:         chargeTotals.TaxAmount,
		DiscountAmount:          total.Discount,
		ReturnTotal:             returnTotal,
		CreatedByUserID:         currentUser.UserID,
	}, items, chargeRows, nil
}

func (s *Service) buildPurchaseReturnItems(tx *gorm.DB, businessID string, receipt *PurchaseReceipt, invoice *PurchaseInvoice, returnID string, inputItems []PurchaseReturnItemInput, excludeReturnID string) ([]PurchaseReturnItem, totals, error) {
	if len(inputItems) == 0 {
		return nil, totals{}, apperrors.BadRequest("items are required", nil)
	}
	receiptItems, err := s.repo.ReceiptItemsForUpdate(tx, receipt.ID, businessID)
	if err != nil {
		return nil, totals{}, err
	}
	var invoiceItems []PurchaseInvoiceItem
	if invoice != nil {
		invoiceItems, err = s.repo.InvoiceItems(invoice.ID, businessID)
		if err != nil {
			return nil, totals{}, err
		}
	}
	receiptItemByID := make(map[string]PurchaseReceiptItem, len(receiptItems))
	for _, item := range receiptItems {
		receiptItemByID[item.ID] = item
	}
	items := make([]PurchaseReturnItem, 0, len(inputItems))
	seen := map[string]struct{}{}
	var total totals
	for _, input := range inputItems {
		if err := validateUUID(input.PurchaseReceiptItemID, "purchase_receipt_item_id"); err != nil {
			return nil, totals{}, err
		}
		if _, exists := seen[input.PurchaseReceiptItemID]; exists {
			return nil, totals{}, apperrors.BadRequest("duplicate purchase_receipt_item_id is not allowed", nil)
		}
		seen[input.PurchaseReceiptItemID] = struct{}{}
		if input.Quantity <= 0 {
			return nil, totals{}, apperrors.BadRequest("quantity must be greater than zero", nil)
		}
		receiptItem, ok := receiptItemByID[input.PurchaseReceiptItemID]
		if !ok {
			return nil, totals{}, apperrors.BadRequest("purchase receipt item does not belong to this receipt", nil)
		}
		alreadyReturned, err := s.repo.PostedReturnedQuantityForReceiptItem(tx, businessID, receiptItem.ID, excludeReturnID)
		if err != nil {
			return nil, totals{}, err
		}
		returnable := roundQuantity(receiptItem.QuantityReceived - alreadyReturned)
		if roundQuantity(input.Quantity) > returnable {
			return nil, totals{}, apperrors.BadRequest("return quantity exceeds returnable quantity", map[string]interface{}{"item": receiptItem.ID, "returnable_quantity": returnable})
		}
		var stockLocationID *string
		if strings.TrimSpace(input.StockLocationID) != "" {
			if err := validateUUID(input.StockLocationID, "stock_location_id"); err != nil {
				return nil, totals{}, err
			}
			location, err := s.inventoryRepo.FindStockLocation(strings.TrimSpace(input.StockLocationID), businessID)
			if err != nil {
				return nil, totals{}, notFound(err, "stock location not found")
			}
			if location.BranchID != receipt.BranchID || location.Status != "active" {
				return nil, totals{}, apperrors.BadRequest("stock location must be active and belong to receipt branch", nil)
			}
			stockLocationID = &location.ID
		}

		itemName := s.receiptItemName(tx, businessID, receipt.BranchID, receiptItem)
		unitCost := receiptItem.UnitCost
		var taxRateID *string
		discount := 0.0
		tax := 0.0
		if invoice != nil {
			invoiceItem, ok := matchingInvoiceItem(invoiceItems, receiptItem)
			if !ok {
				return nil, totals{}, apperrors.BadRequest("receipt item has no matching invoice item", map[string]interface{}{"item": receiptItem.ID})
			}
			if invoiceItem.Quantity <= 0 {
				return nil, totals{}, apperrors.BadRequest("invoice item quantity must be greater than zero", nil)
			}
			ratio := input.Quantity / invoiceItem.Quantity
			itemName = invoiceItem.ItemNameSnapshot
			unitCost = invoiceItem.UnitCost
			discount = roundMoney(invoiceItem.DiscountAmount * ratio)
			tax = roundMoney(invoiceItem.TaxAmount * ratio)
			taxRateID = invoiceItem.TaxRateID
		}
		lineSubtotal := roundMoney(unitCost * input.Quantity)
		lineTotal := roundMoney(lineSubtotal - discount + tax)
		line := lineTotals{Subtotal: lineSubtotal, Discount: discount, Tax: tax, Total: lineTotal}
		total.add(line)
		items = append(items, PurchaseReturnItem{
			ID:                    utils.NewUUID(),
			BusinessID:            businessID,
			PurchaseReturnID:      returnID,
			PurchaseReceiptItemID: receiptItem.ID,
			ItemType:              receiptItem.ItemType,
			ProductID:             receiptItem.ProductID,
			IngredientID:          receiptItem.IngredientID,
			PackagingItemID:       receiptItem.PackagingItemID,
			InventoryItemID:       receiptItem.InventoryItemID,
			ItemNameSnapshot:      itemName,
			Quantity:              input.Quantity,
			UnitID:                receiptItem.UnitID,
			UnitCost:              unitCost,
			DiscountAmount:        discount,
			TaxRateID:             taxRateID,
			TaxAmount:             tax,
			LineSubtotal:          lineSubtotal,
			LineTotal:             lineTotal,
			StockLocationID:       stockLocationID,
			Reason:                strings.TrimSpace(input.Reason),
		})
	}
	return items, total.round(), nil
}

func (s *Service) applyReceiptStock(tx *gorm.DB, currentUser *utils.AuthContext, receipt *PurchaseReceipt) error {
	items, err := s.repo.ReceiptItemsForUpdate(tx, receipt.ID, currentUser.BusinessID)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return apperrors.BadRequest("purchase receipt has no items to post", nil)
	}
	for _, item := range items {
		if item.StockMovementID != nil {
			continue
		}
		prepared := preparedItem{ItemType: item.ItemType, UnitID: item.UnitID, ProductID: item.ProductID, IngredientID: item.IngredientID, PackagingItemID: item.PackagingItemID, Quantity: item.QuantityReceived}
		if receipt.PurchaseOrderID != nil {
			if err := s.applyPOReceiveQuantity(tx, currentUser.BusinessID, *receipt.PurchaseOrderID, prepared); err != nil {
				return err
			}
		}
		movement, err := s.inventoryService.ApplyMovement(tx, inventory.ApplyStockMovementInput{BusinessID: currentUser.BusinessID, InventoryItemID: item.InventoryItemID, MovementType: "purchase_in", Quantity: item.QuantityReceived, UnitCost: item.UnitCost, ReferenceType: "purchase_receipt", ReferenceID: &receipt.ID, ReferenceNumber: receipt.ReceiptNumber, Reason: "Purchase received", CreatedByUserID: currentUser.UserID})
		if err != nil {
			return err
		}
		if s.pricingService != nil && item.ProductID != nil {
			if err := s.pricingService.ApplyPurchaseCostUpdate(tx, products.PricingCostSource{
				BusinessID:      currentUser.BusinessID,
				BranchID:        receipt.BranchID,
				ProductID:       *item.ProductID,
				InventoryItemID: item.InventoryItemID,
				Cost:            item.UnitCost,
				SourceType:      "purchase_receipt",
				SourceID:        &receipt.ID,
				SourceNumber:    receipt.ReceiptNumber,
				Reason:          "Purchase cost updated from received stock",
			}); err != nil {
				return err
			}
		}
		if item.ExpiryDate != nil {
			batch := &inventory.ExpiryBatch{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, BranchID: receipt.BranchID, InventoryItemID: item.InventoryItemID, BatchNumber: strings.TrimSpace(item.BatchNumber), Quantity: item.QuantityReceived, ExpiryDate: *item.ExpiryDate, ReceivedDate: receipt.ReceivedDate, Status: "active"}
			if err := s.inventoryRepo.CreateExpiryBatch(tx, batch); err != nil {
				return err
			}
		}
		if err := s.repo.UpdateReceiptItemStockMovement(tx, item.ID, currentUser.BusinessID, movement.ID); err != nil {
			return err
		}
	}
	if receipt.PurchaseOrderID != nil {
		return s.refreshOrderReceivedStatus(tx, currentUser.BusinessID, *receipt.PurchaseOrderID)
	}
	return nil
}

func (s *Service) validateHeader(tx *gorm.DB, businessID, branchID, supplierID string) error {
	if err := validateUUID(branchID, "branch_id"); err != nil {
		return err
	}
	if err := validateUUID(supplierID, "supplier_id"); err != nil {
		return err
	}
	if err := s.repo.ValidateBranch(tx, businessID, branchID); err != nil {
		return notFound(err, "branch not found")
	}
	if err := s.repo.ValidateSupplier(tx, businessID, branchID, supplierID); err != nil {
		return notFound(err, "supplier not found or inactive")
	}
	return nil
}

func (s *Service) prepareLine(tx *gorm.DB, businessID, branchID string, input lineInput) (preparedItem, lineTotals, error) {
	prepared, err := s.prepareItemIdentity(tx, businessID, branchID, input.ItemType, input.ProductID, input.IngredientID, input.PackagingItemID, input.UnitID)
	if err != nil {
		return preparedItem{}, lineTotals{}, err
	}
	line, err := s.calculatePurchaseLine(tx, businessID, input.Quantity, input.UnitCost, input.DiscountAmount, input.TaxRateID)
	if err != nil {
		return preparedItem{}, lineTotals{}, err
	}
	return prepared, line, nil
}

func (s *Service) calculatePurchaseLine(tx *gorm.DB, businessID string, quantity, unitCost, discountAmount float64, taxRateID string) (lineTotals, error) {
	if quantity <= 0 {
		return lineTotals{}, apperrors.BadRequest("quantity must be greater than zero", nil)
	}
	if unitCost < 0 || discountAmount < 0 {
		return lineTotals{}, apperrors.BadRequest("unit_cost and discount_amount must be non-negative", nil)
	}
	subtotal := quantity * unitCost
	if discountAmount > subtotal {
		return lineTotals{}, apperrors.BadRequest("discount_amount cannot exceed line subtotal", nil)
	}
	taxAmount := 0.0
	if strings.TrimSpace(taxRateID) != "" {
		if err := validateUUID(taxRateID, "tax_rate_id"); err != nil {
			return lineTotals{}, err
		}
		tax, err := s.repo.TaxRate(tx, businessID, taxRateID)
		if err != nil {
			return lineTotals{}, notFound(err, "tax rate not found")
		}
		taxable := subtotal - discountAmount
		if tax.IsInclusive {
			taxAmount = taxable - (taxable / (1 + tax.RatePercentage/100))
		} else {
			taxAmount = taxable * tax.RatePercentage / 100
		}
	}
	line := lineTotals{Subtotal: roundMoney(subtotal), Discount: roundMoney(discountAmount), Tax: roundMoney(taxAmount)}
	line.Total = roundMoney(line.Subtotal - line.Discount + line.Tax)
	return line, nil
}

func (s *Service) purchaseBillAccount(tx *gorm.DB, businessID, accountID string) (*purchaseBillAccount, error) {
	var account purchaseBillAccount
	err := tx.Table("chart_of_accounts").
		Select("id, account_name, account_code, account_type, status").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, accountID).
		Take(&account).Error
	if err != nil {
		return nil, notFound(err, "account not found")
	}
	if account.Status != "active" {
		return nil, apperrors.BadRequest("account line must use an active chart account", nil)
	}
	return &account, nil
}

func (s *Service) prepareReceiptItem(tx *gorm.DB, businessID, branchID string, input PurchaseReceiptItemInput) (preparedItem, error) {
	if input.QuantityReceived <= 0 {
		return preparedItem{}, apperrors.BadRequest("quantity_received must be greater than zero", nil)
	}
	if input.UnitCost < 0 {
		return preparedItem{}, apperrors.BadRequest("unit_cost must be non-negative", nil)
	}
	prepared, err := s.prepareItemIdentity(tx, businessID, branchID, input.ItemType, input.ProductID, input.IngredientID, input.PackagingItemID, input.UnitID)
	prepared.Quantity = input.QuantityReceived
	return prepared, err
}

func (s *Service) prepareItemIdentity(tx *gorm.DB, businessID, branchID, itemType, productID, ingredientID, packagingID, unitID string) (preparedItem, error) {
	if strings.TrimSpace(ingredientID) != "" || strings.TrimSpace(packagingID) != "" {
		return preparedItem{}, apperrors.BadRequest("purchase items must use product_id from Product Master; ingredient_id and packaging_item_id are no longer supported for new purchasing documents", nil)
	}
	itemType = normalizedPurchaseItemType(itemType, strings.TrimSpace(productID) != "")
	if !validItemType(itemType) {
		return preparedItem{}, apperrors.BadRequest("item_type must be product", nil)
	}
	if err := validateUUID(unitID, "unit_id"); err != nil {
		return preparedItem{}, err
	}
	if err := s.repo.ValidateUnit(tx, businessID, unitID); err != nil {
		return preparedItem{}, notFound(err, "unit not found")
	}
	prepared := preparedItem{ItemType: itemType, UnitID: unitID}
	if err := validateUUID(productID, "product_id"); err != nil {
		return preparedItem{}, err
	}
	product, err := s.repo.Product(tx, businessID, branchID, productID)
	if err != nil {
		return preparedItem{}, notFound(err, "product not found")
	}
	if product.UnitID != unitID {
		return preparedItem{}, apperrors.BadRequest("unit conversion is not available yet; product unit must match purchase unit", nil)
	}
	if !product.IsPurchasable {
		return preparedItem{}, apperrors.BadRequest("product is not enabled for purchasing", map[string]interface{}{"product_id": product.ID, "product_name": product.ProductName})
	}
	prepared.ProductID = &productID
	prepared.ItemName = product.ProductName
	return prepared, nil
}

func (s *Service) validateReceiptProduct(tx *gorm.DB, businessID, branchID string, item preparedItem) error {
	if item.ProductID == nil {
		return apperrors.BadRequest("purchase receipts require product_id from Product Master", nil)
	}
	product, err := s.repo.Product(tx, businessID, branchID, *item.ProductID)
	if err != nil {
		return notFound(err, "product not found")
	}
	if !product.IsStockTracked {
		return apperrors.BadRequest("purchase receipts require stock-tracked products", map[string]interface{}{"product_id": product.ID, "product_name": product.ProductName})
	}
	return nil
}

func (s *Service) findOrCreateInventoryItem(tx *gorm.DB, businessID, branchID string, item preparedItem) (*inventory.InventoryItem, error) {
	if item.ItemType != "product" || item.ProductID == nil {
		return nil, apperrors.BadRequest("inventory receiving now supports Product Master products only", nil)
	}
	itemID := item.itemID()
	existing, err := s.inventoryRepo.FindExistingItem(tx, businessID, branchID, item.ItemType, itemID)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	inventoryItem := &inventory.InventoryItem{ID: utils.NewUUID(), BusinessID: businessID, BranchID: branchID, ProductID: item.ProductID, ItemType: item.ItemType, UnitID: item.UnitID, CurrentQuantity: 0, ReservedQuantity: 0, AvailableQuantity: 0, ReorderLevel: 0, IsExpiryTracked: true, Status: "active"}
	if err := s.inventoryRepo.CreateInventoryItem(tx, inventoryItem); err != nil {
		return nil, err
	}
	return inventoryItem, nil
}

func (s *Service) applyPOReceiveQuantity(tx *gorm.DB, businessID, orderID string, item preparedItem) error {
	items, err := s.repo.OrderItemsForUpdate(tx, orderID, businessID)
	if err != nil {
		return err
	}
	for _, orderItem := range items {
		if item.matchesOrderItem(orderItem) {
			newReceived := orderItem.QuantityReceived + item.Quantity
			if newReceived > orderItem.QuantityOrdered {
				return apperrors.BadRequest("quantity_received exceeds quantity_ordered", nil)
			}
			return s.repo.UpdateOrderItemReceived(tx, orderItem.ID, businessID, newReceived)
		}
	}
	return apperrors.BadRequest("received item does not exist on purchase order", nil)
}

func validatePOReceiptQuantities(orderItems []PurchaseOrderItem, requestedItems []preparedItem) error {
	remainingAny := false
	virtualItems := make([]PurchaseOrderItem, 0, len(orderItems))
	for _, item := range orderItems {
		if normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID) == "account" {
			continue
		}
		if roundQuantity(item.QuantityOrdered-item.QuantityReceived) > 0 {
			remainingAny = true
		}
		virtualItems = append(virtualItems, item)
	}
	if !remainingAny {
		return apperrors.BadRequest("purchase order has no remaining items to receive", nil)
	}
	for _, requested := range requestedItems {
		matched := false
		for index := range virtualItems {
			if !requested.matchesOrderItem(virtualItems[index]) {
				continue
			}
			matched = true
			nextReceived := roundQuantity(virtualItems[index].QuantityReceived + requested.Quantity)
			if nextReceived > roundQuantity(virtualItems[index].QuantityOrdered) {
				return apperrors.BadRequest("quantity_received exceeds quantity_ordered", nil)
			}
			virtualItems[index].QuantityReceived = nextReceived
			break
		}
		if !matched {
			return apperrors.BadRequest("received item does not exist on purchase order", nil)
		}
	}
	return nil
}

func validateInvoiceReceiptQuantities(invoiceItems []PurchaseInvoiceItem, postedReceiptItems []PurchaseReceiptItem, requestedItems []preparedItem) error {
	remainingByKey := make(map[string]float64)
	for _, item := range invoiceItems {
		if normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID) == "account" {
			continue
		}
		key := purchaseInvoiceItemReceiveKey(item)
		remainingByKey[key] = roundQuantity(remainingByKey[key] + item.Quantity)
	}
	for _, item := range postedReceiptItems {
		key := purchaseReceiptItemReceiveKey(item)
		remainingByKey[key] = roundQuantity(remainingByKey[key] - item.QuantityReceived)
	}

	remainingAny := false
	for _, remaining := range remainingByKey {
		if roundQuantity(remaining) > 0 {
			remainingAny = true
			break
		}
	}
	if !remainingAny {
		return apperrors.BadRequest("purchase bill has no remaining items to receive", nil)
	}

	virtualRemaining := make(map[string]float64, len(remainingByKey))
	for key, remaining := range remainingByKey {
		virtualRemaining[key] = remaining
	}
	for _, requested := range requestedItems {
		key := preparedReceiveKey(requested)
		remaining, ok := virtualRemaining[key]
		if !ok {
			return apperrors.BadRequest("received item does not exist on purchase bill", nil)
		}
		nextRemaining := roundQuantity(remaining - requested.Quantity)
		if nextRemaining < 0 {
			return apperrors.BadRequest("quantity_received exceeds remaining bill quantity", map[string]interface{}{"remaining_quantity": roundQuantity(remaining)})
		}
		virtualRemaining[key] = nextRemaining
	}
	return nil
}

func (s *Service) reversePOReceiveQuantity(tx *gorm.DB, businessID, orderID string, item preparedItem) error {
	items, err := s.repo.OrderItemsForUpdate(tx, orderID, businessID)
	if err != nil {
		return err
	}
	for _, orderItem := range items {
		if item.matchesOrderItem(orderItem) {
			newReceived := roundQuantity(orderItem.QuantityReceived - item.Quantity)
			if newReceived < 0 {
				newReceived = 0
			}
			return s.repo.UpdateOrderItemReceived(tx, orderItem.ID, businessID, newReceived)
		}
	}
	return apperrors.BadRequest("received item does not exist on purchase order", nil)
}

func (s *Service) refreshOrderReceivedStatus(tx *gorm.DB, businessID, orderID string) error {
	items, err := s.repo.OrderItemsForUpdate(tx, orderID, businessID)
	if err != nil {
		return err
	}
	receivedAny := false
	receivedAll := true
	productLineCount := 0
	for _, item := range items {
		if normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID) == "account" {
			continue
		}
		productLineCount++
		if item.QuantityReceived > 0 {
			receivedAny = true
		}
		if item.QuantityReceived < item.QuantityOrdered {
			receivedAll = false
		}
	}
	if productLineCount == 0 {
		return s.repo.UpdateOrder(tx, orderID, businessID, map[string]interface{}{"status": "received", "updated_at": time.Now().UTC()}, nil)
	}
	status := "ordered"
	if receivedAny {
		status = "partially_received"
	}
	if receivedAll {
		status = "received"
	}
	return s.repo.UpdateOrder(tx, orderID, businessID, map[string]interface{}{"status": status, "updated_at": time.Now().UTC()}, nil)
}

func (s *Service) recalculatePurchaseOrderTotals(tx *gorm.DB, businessID, orderID string) error {
	items, err := s.repo.OrderItems(orderID, businessID)
	if err != nil {
		return err
	}
	var itemTotals totals
	for _, item := range items {
		itemTotals.Subtotal += roundMoney(item.QuantityOrdered * item.UnitCost)
		itemTotals.Discount += item.DiscountAmount
		itemTotals.Tax += item.TaxAmount
		itemTotals.Total += item.LineTotal
	}
	itemTotals = itemTotals.round()
	chargeTotals, err := charges.SumCharges(tx, businessID, "purchase_order", orderID)
	if err != nil {
		return err
	}
	return s.repo.UpdateOrder(tx, orderID, businessID, map[string]interface{}{
		"subtotal_amount":   itemTotals.Subtotal,
		"discount_amount":   itemTotals.Discount,
		"tax_amount":        roundMoney(itemTotals.Tax + chargeTotals.TaxAmount),
		"charge_amount":     chargeTotals.Amount,
		"charge_tax_amount": chargeTotals.TaxAmount,
		"total_amount":      roundMoney(itemTotals.Total + chargeTotals.Total),
		"updated_at":        time.Now().UTC(),
	}, nil)
}

func (s *Service) recalculatePurchaseInvoiceTotals(tx *gorm.DB, businessID, invoiceID string) error {
	invoice, err := s.repo.FindInvoiceForUpdate(tx, invoiceID, businessID)
	if err != nil {
		return err
	}
	items, err := s.repo.InvoiceItems(invoiceID, businessID)
	if err != nil {
		return err
	}
	var itemTotals totals
	for _, item := range items {
		itemTotals.Subtotal += roundMoney(item.Quantity * item.UnitCost)
		itemTotals.Discount += item.DiscountAmount
		itemTotals.Tax += item.TaxAmount
		itemTotals.Total += item.LineTotal
	}
	itemTotals = itemTotals.round()
	chargeTotals, err := charges.SumCharges(tx, businessID, "purchase_invoice", invoiceID)
	if err != nil {
		return err
	}
	billDiscount := roundMoney(invoice.BillDiscountAmount)
	lineNetAmount := roundMoney(itemTotals.Subtotal - itemTotals.Discount)
	if billDiscount > lineNetAmount {
		billDiscount = lineNetAmount
	}
	totalAmount := roundMoney(itemTotals.Total - billDiscount + chargeTotals.Total)
	settledAmount := roundMoney(invoice.PaidAmount + invoice.CreditedAmount)
	balanceAmount := roundMoney(totalAmount - settledAmount)
	if balanceAmount < 0 {
		balanceAmount = 0
	}
	return s.repo.UpdateInvoice(tx, invoiceID, businessID, map[string]interface{}{
		"subtotal_amount":      itemTotals.Subtotal,
		"discount_amount":      itemTotals.Discount,
		"bill_discount_amount": billDiscount,
		"tax_amount":           roundMoney(itemTotals.Tax + chargeTotals.TaxAmount),
		"charge_amount":        chargeTotals.Amount,
		"charge_tax_amount":    chargeTotals.TaxAmount,
		"total_amount":         totalAmount,
		"balance_amount":       balanceAmount,
		"payment_status":       invoicePaymentStatus(totalAmount, settledAmount),
		"updated_at":           time.Now().UTC(),
	}, nil)
}

func (s *Service) recalculatePurchaseReturnTotals(tx *gorm.DB, businessID, returnID string) error {
	items, err := s.repo.PurchaseReturnItems(returnID, businessID)
	if err != nil {
		return err
	}
	var itemTotals totals
	for _, item := range items {
		itemTotals.Subtotal += item.LineSubtotal
		itemTotals.Discount += item.DiscountAmount
		itemTotals.Tax += item.TaxAmount
		itemTotals.Total += item.LineTotal
	}
	itemTotals = itemTotals.round()
	chargeTotals, err := charges.SumCharges(tx, businessID, "purchase_return", returnID)
	if err != nil {
		return err
	}
	return s.repo.UpdatePurchaseReturn(tx, returnID, businessID, map[string]interface{}{
		"subtotal_amount":   itemTotals.Subtotal,
		"discount_amount":   itemTotals.Discount,
		"tax_amount":        roundMoney(itemTotals.Tax + chargeTotals.TaxAmount),
		"charge_amount":     chargeTotals.Amount,
		"charge_tax_amount": chargeTotals.TaxAmount,
		"return_total":      roundMoney(itemTotals.Total + chargeTotals.Total),
		"updated_at":        time.Now().UTC(),
	}, nil)
}

func (s *Service) orderResponse(businessID string, order PurchaseOrder, includeItems bool) PurchaseOrderResponse {
	branchName, supplierName := s.repo.NameLookups(businessID, order.BranchID, order.SupplierID)
	response := PurchaseOrderResponse{ID: order.ID, BusinessID: order.BusinessID, BranchID: order.BranchID, BranchName: branchName, SupplierID: order.SupplierID, SupplierName: supplierName, PurchaseOrderNumber: order.PurchaseOrderNumber, OrderDate: order.OrderDate, ExpectedDeliveryDate: order.ExpectedDeliveryDate, Status: order.Status, SubtotalAmount: roundMoney(order.SubtotalAmount), TaxAmount: roundMoney(order.TaxAmount), ChargeAmount: roundMoney(order.ChargeAmount), ChargeTaxAmount: roundMoney(order.ChargeTaxAmount), DiscountAmount: roundMoney(order.DiscountAmount), TotalAmount: roundMoney(order.TotalAmount), Notes: order.Notes, CreatedAt: order.CreatedAt, UpdatedAt: order.UpdatedAt}
	if includeItems {
		items, _ := s.repo.OrderItems(order.ID, businessID)
		for _, item := range items {
			unitID := deref(item.UnitID)
			response.Items = append(response.Items, PurchaseOrderItemResponse{ID: item.ID, LineType: normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID), ItemType: item.ItemType, ProductID: item.ProductID, IngredientID: item.IngredientID, PackagingItemID: item.PackagingItemID, AccountID: item.AccountID, AccountName: item.AccountName, AccountCode: item.AccountCode, Description: item.Description, ItemNameSnapshot: item.ItemNameSnapshot, QuantityOrdered: roundQuantity(item.QuantityOrdered), QuantityReceived: roundQuantity(item.QuantityReceived), UnitID: unitID, UnitSymbol: s.repo.UnitSymbol(unitID), UnitCost: roundMoney(item.UnitCost), DiscountAmount: roundMoney(item.DiscountAmount), TaxRateID: item.TaxRateID, TaxAmount: roundMoney(item.TaxAmount), LineTotal: roundMoney(item.LineTotal)})
		}
		response.Charges, _ = charges.ListChargeResponses(s.db, businessID, "purchase_order", order.ID)
	}
	return response
}

func (s *Service) purchaseOrderNumber(businessID string, orderID *string) string {
	if orderID == nil || *orderID == "" {
		return ""
	}
	order, err := s.repo.FindOrder(*orderID, businessID)
	if err != nil {
		return ""
	}
	return order.PurchaseOrderNumber
}

func (s *Service) purchaseInvoiceNumber(businessID string, invoiceID *string) string {
	if invoiceID == nil || *invoiceID == "" {
		return ""
	}
	invoice, err := s.repo.FindInvoice(*invoiceID, businessID)
	if err != nil {
		return ""
	}
	return invoice.InvoiceNumber
}

func (s *Service) invoiceResponse(businessID string, invoice PurchaseInvoice, includeItems bool) PurchaseInvoiceResponse {
	branchName, supplierName := s.repo.NameLookups(businessID, invoice.BranchID, invoice.SupplierID)
	response := PurchaseInvoiceResponse{ID: invoice.ID, BusinessID: invoice.BusinessID, BranchID: invoice.BranchID, BranchName: branchName, SupplierID: invoice.SupplierID, SupplierName: supplierName, PurchaseOrderID: invoice.PurchaseOrderID, PurchaseOrderNumber: s.purchaseOrderNumber(businessID, invoice.PurchaseOrderID), InvoiceNumber: invoice.InvoiceNumber, SupplierBillNumber: invoice.SupplierBillNumber, InvoiceDate: invoice.InvoiceDate, DueDate: invoice.DueDate, Status: invoice.Status, PaymentStatus: invoice.PaymentStatus, SubtotalAmount: roundMoney(invoice.SubtotalAmount), TaxAmount: roundMoney(invoice.TaxAmount), ChargeAmount: roundMoney(invoice.ChargeAmount), ChargeTaxAmount: roundMoney(invoice.ChargeTaxAmount), DiscountAmount: roundMoney(invoice.DiscountAmount), BillDiscountAmount: roundMoney(invoice.BillDiscountAmount), TotalAmount: roundMoney(invoice.TotalAmount), PaidAmount: roundMoney(invoice.PaidAmount), BalanceAmount: roundMoney(invoice.BalanceAmount), ReturnedAmount: roundMoney(invoice.ReturnedAmount), CreditedAmount: roundMoney(invoice.CreditedAmount), ReturnStatus: invoice.ReturnStatus, JournalEntryID: invoice.JournalEntryID, CancelledByUserID: invoice.CancelledByUserID, CancelledAt: invoice.CancelledAt, CancelReason: invoice.CancelReason, ReversalJournalEntryID: invoice.ReversalJournalEntryID, CancelledReceiptID: invoice.CancelledReceiptID, Notes: invoice.Notes, CreatedAt: invoice.CreatedAt, UpdatedAt: invoice.UpdatedAt}
	items, _ := s.repo.InvoiceItems(invoice.ID, businessID)
	receiveLines, receiveStatus, canReceive := s.invoiceReceiveState(businessID, invoice, items)
	response.ReceiveStatus = receiveStatus
	response.CanReceiveStock = canReceive
	if includeItems {
		for _, item := range items {
			unitID := deref(item.UnitID)
			receiveLine := receiveLines[item.ID]
			response.Items = append(response.Items, PurchaseInvoiceItemResponse{ID: item.ID, LineType: normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID), ItemType: item.ItemType, ProductID: item.ProductID, IngredientID: item.IngredientID, PackagingItemID: item.PackagingItemID, AccountID: item.AccountID, AccountName: item.AccountName, AccountCode: item.AccountCode, Description: item.Description, ItemNameSnapshot: item.ItemNameSnapshot, Quantity: roundQuantity(item.Quantity), QuantityReceived: roundQuantity(receiveLine.Received), QuantityRemaining: roundQuantity(receiveLine.Remaining), CanReceive: receiveLine.CanReceive, UnitID: unitID, UnitSymbol: s.repo.UnitSymbol(unitID), UnitCost: roundMoney(item.UnitCost), DiscountAmount: roundMoney(item.DiscountAmount), TaxRateID: item.TaxRateID, TaxAmount: roundMoney(item.TaxAmount), LineTotal: roundMoney(item.LineTotal), ExpiryDate: item.ExpiryDate, BatchNumber: item.BatchNumber})
		}
		response.Charges, _ = charges.ListChargeResponses(s.db, businessID, "purchase_invoice", invoice.ID)
		payments, _ := s.repo.ListInvoicePayments(businessID, invoice.ID)
		for i := range payments {
			payments[i].Amount = roundMoney(payments[i].Amount)
		}
		response.Payments = payments
	}
	return response
}

type invoiceReceiveLineState struct {
	Received   float64
	Remaining  float64
	CanReceive bool
}

func (s *Service) invoiceReceiveState(businessID string, invoice PurchaseInvoice, items []PurchaseInvoiceItem) (map[string]invoiceReceiveLineState, string, bool) {
	result := make(map[string]invoiceReceiveLineState, len(items))
	if invoice.Status != "posted" {
		return result, "not_received", false
	}

	receivedByKey := map[string]float64{}
	remainingByKey := map[string]float64{}
	if invoice.PurchaseOrderID != nil && strings.TrimSpace(*invoice.PurchaseOrderID) != "" {
		orderItems, err := s.repo.OrderItems(*invoice.PurchaseOrderID, businessID)
		if err == nil {
			for _, orderItem := range orderItems {
				if normalizedStoredLineType(orderItem.LineType, orderItem.ItemType, orderItem.AccountID) == "account" {
					continue
				}
				key := purchaseOrderItemReceiveKey(orderItem)
				receivedByKey[key] = roundQuantity(receivedByKey[key] + orderItem.QuantityReceived)
				remainingByKey[key] = roundQuantity(remainingByKey[key] + orderItem.QuantityOrdered - orderItem.QuantityReceived)
			}
		}
	} else {
		receiptItems, err := s.repo.PostedReceiptItemsForInvoice(businessID, invoice.ID)
		if err == nil {
			for _, receiptItem := range receiptItems {
				key := purchaseReceiptItemReceiveKey(receiptItem)
				receivedByKey[key] = roundQuantity(receivedByKey[key] + receiptItem.QuantityReceived)
			}
		}
		for _, item := range items {
			if normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID) == "account" {
				continue
			}
			key := purchaseInvoiceItemReceiveKey(item)
			remainingByKey[key] = roundQuantity(remainingByKey[key] + item.Quantity)
		}
		for key, received := range receivedByKey {
			remainingByKey[key] = roundQuantity(remainingByKey[key] - received)
		}
	}

	var totalQuantity float64
	var totalReceived float64
	var totalRemaining float64
	for _, item := range items {
		if normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID) == "account" {
			continue
		}
		key := purchaseInvoiceItemReceiveKey(item)
		lineReceived := minPositive(item.Quantity, receivedByKey[key])
		receivedByKey[key] = roundQuantity(receivedByKey[key] - lineReceived)
		lineRemaining := minPositive(item.Quantity-lineReceived, remainingByKey[key])
		remainingByKey[key] = roundQuantity(remainingByKey[key] - lineRemaining)
		if lineRemaining < 0 {
			lineRemaining = 0
		}
		totalQuantity += item.Quantity
		totalReceived += lineReceived
		totalRemaining += lineRemaining
		result[item.ID] = invoiceReceiveLineState{Received: lineReceived, Remaining: lineRemaining, CanReceive: lineRemaining > 0}
	}

	totalQuantity = roundQuantity(totalQuantity)
	totalReceived = roundQuantity(totalReceived)
	totalRemaining = roundQuantity(totalRemaining)
	if totalQuantity <= 0 || totalRemaining <= 0 {
		return result, "received", false
	}
	if totalReceived <= 0 {
		return result, "not_received", true
	}
	return result, "partially_received", true
}

func minPositive(limit, value float64) float64 {
	if value <= 0 || limit <= 0 {
		return 0
	}
	if value < limit {
		return roundQuantity(value)
	}
	return roundQuantity(limit)
}

func (s *Service) purchaseReturnResponse(businessID string, purchaseReturn PurchaseReturn, includeItems bool) PurchaseReturnResponse {
	branchName, supplierName := s.repo.NameLookups(businessID, purchaseReturn.BranchID, purchaseReturn.SupplierID)
	invoiceNumber, receiptNumber := s.purchaseReturnDocumentNumbers(businessID, purchaseReturn.PurchaseInvoiceID, purchaseReturn.PurchaseReceiptID)
	response := PurchaseReturnResponse{
		ID:                         purchaseReturn.ID,
		BusinessID:                 purchaseReturn.BusinessID,
		BranchID:                   purchaseReturn.BranchID,
		BranchName:                 branchName,
		SupplierID:                 purchaseReturn.SupplierID,
		SupplierName:               supplierName,
		PurchaseOrderID:            purchaseReturn.PurchaseOrderID,
		PurchaseInvoiceID:          purchaseReturn.PurchaseInvoiceID,
		PurchaseInvoiceNumber:      invoiceNumber,
		PurchaseReceiptID:          purchaseReturn.PurchaseReceiptID,
		PurchaseReceiptNumber:      receiptNumber,
		ReturnNumber:               purchaseReturn.ReturnNumber,
		ReturnDate:                 purchaseReturn.ReturnDate,
		SupplierReferenceNumber:    purchaseReturn.SupplierReferenceNumber,
		Reason:                     purchaseReturn.Reason,
		Status:                     purchaseReturn.Status,
		SubtotalAmount:             roundMoney(purchaseReturn.SubtotalAmount),
		TaxAmount:                  roundMoney(purchaseReturn.TaxAmount),
		ChargeAmount:               roundMoney(purchaseReturn.ChargeAmount),
		ChargeTaxAmount:            roundMoney(purchaseReturn.ChargeTaxAmount),
		DiscountAmount:             roundMoney(purchaseReturn.DiscountAmount),
		ReturnTotal:                roundMoney(purchaseReturn.ReturnTotal),
		AppliedCreditAmount:        roundMoney(purchaseReturn.AppliedCreditAmount),
		OpenCreditAmount:           roundMoney(purchaseReturn.OpenCreditAmount),
		JournalEntryID:             purchaseReturn.JournalEntryID,
		JournalEntryNumber:         s.repo.JournalEntryNumber(businessID, purchaseReturn.JournalEntryID),
		ReversalJournalEntryID:     purchaseReturn.ReversalJournalEntryID,
		ReversalJournalEntryNumber: s.repo.JournalEntryNumber(businessID, purchaseReturn.ReversalJournalEntryID),
		OriginalReturnID:           purchaseReturn.OriginalReturnID,
		OriginalReturnNumber:       s.purchaseReturnNumber(businessID, purchaseReturn.OriginalReturnID),
		ReversalReturnID:           purchaseReturn.ReversalReturnID,
		ReversalReturnNumber:       s.purchaseReturnNumber(businessID, purchaseReturn.ReversalReturnID),
		ReversalReason:             purchaseReturn.ReversalReason,
		ReversedByUserID:           purchaseReturn.ReversedByUserID,
		ReversedAt:                 purchaseReturn.ReversedAt,
		CreatedByUserID:            purchaseReturn.CreatedByUserID,
		PostedByUserID:             purchaseReturn.PostedByUserID,
		PostedAt:                   purchaseReturn.PostedAt,
		CancelledByUserID:          purchaseReturn.CancelledByUserID,
		CancelledAt:                purchaseReturn.CancelledAt,
		CreatedAt:                  purchaseReturn.CreatedAt,
		UpdatedAt:                  purchaseReturn.UpdatedAt,
	}
	if includeItems {
		items, _ := s.repo.PurchaseReturnItems(purchaseReturn.ID, businessID)
		for _, item := range items {
			response.Items = append(response.Items, PurchaseReturnItemResponse{
				ID:                    item.ID,
				PurchaseReceiptItemID: item.PurchaseReceiptItemID,
				ItemType:              item.ItemType,
				ProductID:             item.ProductID,
				IngredientID:          item.IngredientID,
				PackagingItemID:       item.PackagingItemID,
				InventoryItemID:       item.InventoryItemID,
				ItemNameSnapshot:      item.ItemNameSnapshot,
				Quantity:              roundQuantity(item.Quantity),
				UnitID:                item.UnitID,
				UnitSymbol:            s.repo.UnitSymbol(item.UnitID),
				UnitCost:              roundMoney(item.UnitCost),
				DiscountAmount:        roundMoney(item.DiscountAmount),
				TaxRateID:             item.TaxRateID,
				TaxAmount:             roundMoney(item.TaxAmount),
				LineSubtotal:          roundMoney(item.LineSubtotal),
				LineTotal:             roundMoney(item.LineTotal),
				StockLocationID:       item.StockLocationID,
				StockLocationName:     s.repo.StockLocationName(item.StockLocationID, businessID),
				StockMovementID:       item.StockMovementID,
				Reason:                item.Reason,
			})
		}
		response.Charges, _ = charges.ListChargeResponses(s.db, businessID, "purchase_return", purchaseReturn.ID)
	}
	return response
}

func (s *Service) purchaseReturnDocumentNumbers(businessID string, invoiceID *string, receiptID string) (string, string) {
	invoiceNumber := ""
	receiptNumber := ""
	if invoiceID != nil && strings.TrimSpace(*invoiceID) != "" {
		if invoice, err := s.repo.FindInvoice(*invoiceID, businessID); err == nil {
			invoiceNumber = invoice.InvoiceNumber
		}
	}
	if receipt, err := s.repo.FindReceipt(receiptID, businessID); err == nil {
		receiptNumber = receipt.ReceiptNumber
	}
	return invoiceNumber, receiptNumber
}

func (s *Service) purchaseReturnNumber(businessID string, returnID *string) *string {
	if returnID == nil || strings.TrimSpace(*returnID) == "" {
		return nil
	}
	if purchaseReturn, err := s.repo.FindPurchaseReturn(strings.TrimSpace(*returnID), businessID); err == nil {
		return &purchaseReturn.ReturnNumber
	}
	return nil
}

func (s *Service) receiptResponse(businessID string, receipt PurchaseReceipt, includeItems bool) PurchaseReceiptResponse {
	branchName, supplierName := s.repo.NameLookups(businessID, receipt.BranchID, receipt.SupplierID)
	response := PurchaseReceiptResponse{ID: receipt.ID, BusinessID: receipt.BusinessID, BranchID: receipt.BranchID, BranchName: branchName, SupplierID: receipt.SupplierID, SupplierName: supplierName, PurchaseOrderID: receipt.PurchaseOrderID, PurchaseOrderNumber: first(receipt.PurchaseOrderNumber, s.purchaseOrderNumber(businessID, receipt.PurchaseOrderID)), PurchaseInvoiceID: receipt.PurchaseInvoiceID, PurchaseInvoiceNumber: first(receipt.PurchaseInvoiceNumber, s.purchaseInvoiceNumber(businessID, receipt.PurchaseInvoiceID)), ReceiptNumber: receipt.ReceiptNumber, ReceivedDate: receipt.ReceivedDate, Status: receipt.Status, ChargeAmount: roundMoney(receipt.ChargeAmount), ChargeTaxAmount: roundMoney(receipt.ChargeTaxAmount), JournalEntryID: receipt.JournalEntryID, ReceivedByUserID: receipt.ReceivedByUserID, Notes: receipt.Notes, CreatedAt: receipt.CreatedAt, UpdatedAt: receipt.UpdatedAt}
	if includeItems {
		items, _ := s.repo.ReceiptItems(receipt.ID, businessID)
		for _, item := range items {
			response.Items = append(response.Items, PurchaseReceiptItemResponse{ID: item.ID, ItemType: item.ItemType, ProductID: item.ProductID, IngredientID: item.IngredientID, PackagingItemID: item.PackagingItemID, InventoryItemID: item.InventoryItemID, QuantityReceived: roundQuantity(item.QuantityReceived), UnitID: item.UnitID, UnitSymbol: s.repo.UnitSymbol(item.UnitID), UnitCost: roundMoney(item.UnitCost), ExpiryDate: item.ExpiryDate, BatchNumber: item.BatchNumber, StockMovementID: item.StockMovementID})
		}
		response.Charges, _ = charges.ListChargeResponses(s.db, businessID, "purchase_receipt", receipt.ID)
	}
	return response
}

func (s *Service) audit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	entityType := purchasingAuditEntityType(eventType)
	metadata := s.purchasingAuditMetadata(tx, currentUser.BusinessID, entityType, entityID)
	return s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  entityType,
		EntityID:    entityID,
		Summary:     summary,
		Metadata:    audit.Metadata(metadata, nil),
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	})
}

func (s *Service) purchasingAuditMetadata(tx *gorm.DB, businessID, entityType, entityID string) map[string]interface{} {
	metadata := map[string]interface{}{"source_module": "purchasing"}
	if tx == nil || strings.TrimSpace(entityID) == "" {
		return metadata
	}

	switch entityType {
	case "purchase_order":
		var row struct{ PurchaseOrderNumber string }
		_ = tx.Unscoped().Table("purchase_orders").Select("purchase_order_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		metadata["purchase_order_number"] = row.PurchaseOrderNumber
		metadata["document_number"] = row.PurchaseOrderNumber
	case "purchase_invoice":
		var row struct{ InvoiceNumber, SupplierBillNumber string }
		_ = tx.Unscoped().Table("purchase_invoices").Select("invoice_number, supplier_bill_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		metadata["invoice_number"] = row.InvoiceNumber
		metadata["purchase_invoice_number"] = row.InvoiceNumber
		metadata["supplier_bill_number"] = row.SupplierBillNumber
		metadata["bill_number"] = first(row.InvoiceNumber, row.SupplierBillNumber)
		metadata["document_number"] = first(row.InvoiceNumber, row.SupplierBillNumber)
	case "purchase_receipt":
		var row struct{ ReceiptNumber string }
		_ = tx.Unscoped().Table("purchase_receipts").Select("receipt_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		metadata["receipt_number"] = row.ReceiptNumber
		metadata["purchase_receipt_number"] = row.ReceiptNumber
		metadata["goods_receipt_number"] = row.ReceiptNumber
		metadata["document_number"] = row.ReceiptNumber
	case "purchase_return":
		var row struct{ ReturnNumber string }
		_ = tx.Unscoped().Table("purchase_returns").Select("return_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		metadata["return_number"] = row.ReturnNumber
		metadata["document_number"] = row.ReturnNumber
	case "supplier_payment":
		var row struct{ ReferenceNumber string }
		_ = tx.Unscoped().Table("supplier_payments").Select("reference_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		metadata["reference_number"] = row.ReferenceNumber
		metadata["document_number"] = row.ReferenceNumber
	}
	return metadata
}

func purchasingAuditEntityType(eventType string) string {
	switch {
	case strings.HasPrefix(eventType, "purchase_order."):
		return "purchase_order"
	case strings.HasPrefix(eventType, "purchase_invoice."):
		return "purchase_invoice"
	case strings.HasPrefix(eventType, "purchase_receipt."), eventType == "purchase_stock_received":
		return "purchase_receipt"
	case strings.HasPrefix(eventType, "purchase_return."):
		return "purchase_return"
	case strings.HasPrefix(eventType, "supplier_payment."):
		return "supplier_payment"
	default:
		return "purchasing"
	}
}

type totals struct{ Subtotal, Tax, Discount, Total float64 }
type lineTotals = totals

func (t *totals) add(line lineTotals) {
	t.Subtotal += line.Subtotal
	t.Tax += line.Tax
	t.Discount += line.Discount
	t.Total += line.Total
}

func (t totals) round() totals {
	return totals{Subtotal: roundMoney(t.Subtotal), Tax: roundMoney(t.Tax), Discount: roundMoney(t.Discount), Total: roundMoney(t.Total)}
}

type lineInput struct {
	ItemType, ProductID, IngredientID, PackagingItemID, UnitID, TaxRateID string
	Quantity, UnitCost, DiscountAmount                                    float64
}

type purchaseBillAccount struct {
	ID          string
	AccountName string
	AccountCode string
	AccountType string
	Status      string
}

type preparedItem struct {
	ItemType, ItemName, UnitID               string
	ProductID, IngredientID, PackagingItemID *string
	Quantity                                 float64
}

func (p preparedItem) itemID() *string {
	if p.ProductID != nil {
		return p.ProductID
	}
	if p.IngredientID != nil {
		return p.IngredientID
	}
	return p.PackagingItemID
}

func (p preparedItem) matchesOrderItem(item PurchaseOrderItem) bool {
	if p.ProductID != nil && item.ProductID != nil && equalStringPtr(p.ProductID, item.ProductID) {
		return true
	}
	return p.ItemType == item.ItemType && equalStringPtr(p.ProductID, item.ProductID) && equalStringPtr(p.IngredientID, item.IngredientID) && equalStringPtr(p.PackagingItemID, item.PackagingItemID)
}

func preparedReceiveKey(item preparedItem) string {
	return strings.Join([]string{item.ItemType, deref(item.ProductID), deref(item.IngredientID), deref(item.PackagingItemID), item.UnitID}, "|")
}

func purchaseInvoiceItemReceiveKey(item PurchaseInvoiceItem) string {
	return strings.Join([]string{item.ItemType, deref(item.ProductID), deref(item.IngredientID), deref(item.PackagingItemID), deref(item.UnitID)}, "|")
}

func purchaseOrderItemReceiveKey(item PurchaseOrderItem) string {
	return strings.Join([]string{item.ItemType, deref(item.ProductID), deref(item.IngredientID), deref(item.PackagingItemID), deref(item.UnitID)}, "|")
}

func purchaseReceiptItemReceiveKey(item PurchaseReceiptItem) string {
	return strings.Join([]string{item.ItemType, deref(item.ProductID), deref(item.IngredientID), deref(item.PackagingItemID), item.UnitID}, "|")
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

func normalizePaymentQuery(query *PaymentListQuery) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.Limit <= 0 || query.Limit > 100 {
		query.Limit = 20
	}
	if query.SortBy == "" {
		query.SortBy = "paid_at"
	}
	if query.SortOrder == "" {
		query.SortOrder = "desc"
	}
}

func normalizeReturnQuery(query *PurchaseReturnListQuery) {
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

func validateReturnListQuery(query PurchaseReturnListQuery) error {
	for field, value := range map[string]string{"branch_id": query.BranchID, "supplier_id": query.SupplierID, "purchase_invoice_id": query.PurchaseInvoiceID, "purchase_receipt_id": query.PurchaseReceiptID} {
		if strings.TrimSpace(value) != "" {
			if err := validateUUID(value, field); err != nil {
				return err
			}
		}
	}
	if query.Status != "" && query.Status != "draft" && query.Status != "posted" && query.Status != "cancelled" {
		return apperrors.BadRequest("status must be draft, posted, or cancelled", nil)
	}
	if query.DateFrom != "" {
		if _, err := parseDate(query.DateFrom, "date_from"); err != nil {
			return err
		}
	}
	if query.DateTo != "" {
		if _, err := parseDate(query.DateTo, "date_to"); err != nil {
			return err
		}
	}
	return nil
}

func validatePaymentListQuery(query PaymentListQuery) error {
	for field, value := range map[string]string{"branch_id": query.BranchID, "supplier_id": query.SupplierID, "purchase_invoice_id": query.InvoiceID, "payment_method_id": query.PaymentMethodID, "paid_by_user_id": query.PaidByUserID} {
		if strings.TrimSpace(value) != "" {
			if err := validateUUID(value, field); err != nil {
				return err
			}
		}
	}
	if query.PaymentStatus != "" && query.PaymentStatus != "completed" && query.PaymentStatus != "voided" {
		return apperrors.BadRequest("payment_status must be completed or voided", nil)
	}
	return nil
}

func validatePurchasingPaymentAccountBranch(account *PaymentAccountInfo, branchID string) error {
	if account == nil || strings.TrimSpace(account.ID) == "" || strings.TrimSpace(account.ChartAccountID) == "" || account.Status != "active" {
		return apperrors.BadRequest("paid-through account is inactive or missing", nil)
	}
	if account.BranchID != nil && strings.TrimSpace(*account.BranchID) != "" && *account.BranchID != branchID {
		return apperrors.BadRequest("paid-through account is not available for this branch", map[string]interface{}{"payment_account": account.AccountName})
	}
	return nil
}

func roundSupplierPaymentResponse(payment *SupplierPaymentResponse) {
	if payment == nil {
		return
	}
	payment.Amount = roundMoney(payment.Amount)
	payment.AllocatedAmount = roundMoney(payment.AllocatedAmount)
	payment.UnappliedAmount = roundMoney(payment.UnappliedAmount)
	for i := range payment.Allocations {
		payment.Allocations[i].Amount = roundMoney(payment.Allocations[i].Amount)
	}
}

func parseDate(value, field string) (time.Time, error) {
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, apperrors.BadRequest(field+" must use YYYY-MM-DD format", nil)
	}
	return parsed, nil
}

func parseOptionalDateTime(value string, fallback time.Time, field string) (time.Time, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback, nil
	}
	parsed, err := time.Parse(time.RFC3339, trimmed)
	if err != nil {
		return time.Time{}, apperrors.BadRequest(field+" must use RFC3339 datetime format", nil)
	}
	return parsed.UTC(), nil
}

func parseSupplierPaymentDate(value string, fallback time.Time, field string) (time.Time, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback, nil
	}
	if parsed, err := time.Parse("2006-01-02", trimmed); err == nil {
		return parsed.UTC(), nil
	}
	if parsed, err := time.Parse(time.RFC3339, trimmed); err == nil {
		return parsed.UTC(), nil
	}
	return time.Time{}, apperrors.BadRequest(field+" must use YYYY-MM-DD or RFC3339 format", nil)
}

func parseOptionalDate(value, field string) (*time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	parsed, err := parseDate(value, field)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func validateUUID(value, field string) error {
	if _, err := uuid.Parse(strings.TrimSpace(value)); err != nil {
		return apperrors.BadRequest(field+" must be a valid UUID", nil)
	}
	return nil
}

func validItemType(value string) bool {
	return value == "product"
}

func normalizedInvoiceLineType(input PurchaseInvoiceItemInput) string {
	lineType := strings.TrimSpace(input.LineType)
	if lineType == "account" || strings.TrimSpace(input.AccountID) != "" || strings.TrimSpace(input.ItemType) == "account" {
		return "account"
	}
	return "product"
}

func normalizedOrderLineType(input PurchaseOrderItemInput) string {
	lineType := strings.TrimSpace(input.LineType)
	if lineType == "account" || strings.TrimSpace(input.AccountID) != "" || strings.TrimSpace(input.ItemType) == "account" {
		return "account"
	}
	return "product"
}

func normalizedStoredLineType(lineType, itemType string, accountID *string) string {
	if strings.TrimSpace(lineType) == "account" || strings.TrimSpace(itemType) == "account" || accountID != nil {
		return "account"
	}
	return "product"
}

func normalizedPurchaseItemType(value string, hasProductID bool) string {
	if hasProductID {
		return "product"
	}
	return strings.TrimSpace(value)
}

func validOrderStatus(value string) bool {
	return value == "draft" || value == "ordered" || value == "partially_received" || value == "received" || value == "cancelled"
}

func invoicePaymentStatus(totalAmount, paidAmount float64) string {
	if paidAmount <= 0 {
		return "unpaid"
	}
	if roundMoney(paidAmount) < roundMoney(totalAmount) {
		return "partial"
	}
	return "paid"
}

func purchaseInvoiceReturnStatus(totalAmount, returnedAmount float64) string {
	if returnedAmount <= 0 {
		return "none"
	}
	if roundMoney(returnedAmount) < roundMoney(totalAmount) {
		return "partially_returned"
	}
	return "returned"
}

func nullableString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func first(value, fallback string) string {
	if strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	return fallback
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func optionalDateString(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.Format("2006-01-02")
}

func formatDate(value time.Time) string {
	return value.Format("2006-01-02")
}

func equalStringPtr(a, b *string) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func validateUnifiedPurchaseItems(items []PurchaseOrderItem) error {
	for _, item := range items {
		if normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID) == "account" {
			continue
		}
		if item.ItemType != "product" || item.ProductID == nil || item.IngredientID != nil || item.PackagingItemID != nil {
			return apperrors.BadRequest("purchase order contains legacy ingredient/packaging items; recreate the document using Product Master products before conversion", map[string]interface{}{"purchase_order_item_id": item.ID})
		}
	}
	return nil
}

func notFound(err error, message string) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apperrors.NotFound(message)
	}
	return err
}

func invoiceInputsFromItems(items []PurchaseInvoiceItem) []PurchaseInvoiceItemInput {
	result := make([]PurchaseInvoiceItemInput, 0, len(items))
	for _, item := range items {
		lineType := normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID)
		result = append(result, PurchaseInvoiceItemInput{LineType: lineType, ItemType: item.ItemType, ProductID: deref(item.ProductID), IngredientID: deref(item.IngredientID), PackagingItemID: deref(item.PackagingItemID), AccountID: deref(item.AccountID), Description: first(item.Description, item.ItemNameSnapshot), ItemNameSnapshot: item.ItemNameSnapshot, Quantity: item.Quantity, UnitID: deref(item.UnitID), UnitCost: item.UnitCost, DiscountAmount: item.DiscountAmount, TaxRateID: deref(item.TaxRateID), ExpiryDate: optionalDateString(item.ExpiryDate), BatchNumber: item.BatchNumber})
	}
	return result
}

func receiptInputsFromInvoiceItems(items []PurchaseInvoiceItem) []PurchaseReceiptItemInput {
	result := make([]PurchaseReceiptItemInput, 0, len(items))
	for _, item := range items {
		if normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID) == "account" {
			continue
		}
		result = append(result, PurchaseReceiptItemInput{ItemType: normalizedPurchaseItemType(item.ItemType, item.ProductID != nil), ProductID: deref(item.ProductID), IngredientID: deref(item.IngredientID), PackagingItemID: deref(item.PackagingItemID), QuantityReceived: item.Quantity, UnitID: deref(item.UnitID), UnitCost: item.UnitCost, ExpiryDate: optionalDateString(item.ExpiryDate), BatchNumber: item.BatchNumber})
	}
	return result
}

func receiptInputsFromInvoiceItemsWithReceiveState(items []PurchaseInvoiceItem, receiveLines map[string]invoiceReceiveLineState) []PurchaseReceiptItemInput {
	result := make([]PurchaseReceiptItemInput, 0, len(items))
	for _, item := range items {
		if normalizedStoredLineType(item.LineType, item.ItemType, item.AccountID) == "account" {
			continue
		}
		remaining := roundQuantity(receiveLines[item.ID].Remaining)
		if remaining <= 0 {
			continue
		}
		result = append(result, PurchaseReceiptItemInput{ItemType: normalizedPurchaseItemType(item.ItemType, item.ProductID != nil), ProductID: deref(item.ProductID), IngredientID: deref(item.IngredientID), PackagingItemID: deref(item.PackagingItemID), QuantityReceived: remaining, UnitID: deref(item.UnitID), UnitCost: item.UnitCost, ExpiryDate: optionalDateString(item.ExpiryDate), BatchNumber: item.BatchNumber})
	}
	return result
}

func purchaseReturnInputsFromItems(items []PurchaseReturnItem) []PurchaseReturnItemInput {
	result := make([]PurchaseReturnItemInput, 0, len(items))
	for _, item := range items {
		result = append(result, PurchaseReturnItemInput{
			PurchaseReceiptItemID: item.PurchaseReceiptItemID,
			Quantity:              item.Quantity,
			StockLocationID:       deref(item.StockLocationID),
			Reason:                item.Reason,
		})
	}
	return result
}

func matchingInvoiceItem(invoiceItems []PurchaseInvoiceItem, receiptItem PurchaseReceiptItem) (PurchaseInvoiceItem, bool) {
	for _, item := range invoiceItems {
		if item.ItemType == receiptItem.ItemType &&
			deref(item.UnitID) == receiptItem.UnitID &&
			equalStringPtr(item.ProductID, receiptItem.ProductID) &&
			equalStringPtr(item.IngredientID, receiptItem.IngredientID) &&
			equalStringPtr(item.PackagingItemID, receiptItem.PackagingItemID) {
			return item, true
		}
	}
	return PurchaseInvoiceItem{}, false
}

func (s *Service) receiptItemName(tx *gorm.DB, businessID, branchID string, receiptItem PurchaseReceiptItem) string {
	if receiptItem.ProductID != nil && strings.TrimSpace(*receiptItem.ProductID) != "" {
		if product, err := s.repo.Product(tx, businessID, branchID, *receiptItem.ProductID); err == nil && strings.TrimSpace(product.ProductName) != "" {
			return product.ProductName
		}
	}
	if receiptItem.IngredientID != nil && strings.TrimSpace(*receiptItem.IngredientID) != "" {
		if ingredient, err := s.repo.IngredientItem(tx, businessID, branchID, *receiptItem.IngredientID); err == nil && strings.TrimSpace(ingredient.IngredientName) != "" {
			return ingredient.IngredientName
		}
	}
	if receiptItem.PackagingItemID != nil && strings.TrimSpace(*receiptItem.PackagingItemID) != "" {
		if packaging, err := s.repo.PackagingItem(tx, businessID, branchID, *receiptItem.PackagingItemID); err == nil && strings.TrimSpace(packaging.PackagingName) != "" {
			return packaging.PackagingName
		}
	}
	return "Received item"
}

func (s *Service) returnableItemResponse(businessID, branchID string, receiptItem PurchaseReceiptItem, invoiceItems []PurchaseInvoiceItem, returnedQty, receivedQty float64) (PurchaseReturnableItemResponse, error) {
	returnable := roundQuantity(receivedQty - returnedQty)
	if returnable < 0 {
		returnable = 0
	}
	itemName := s.receiptItemName(s.db, businessID, branchID, receiptItem)
	unitCost := receiptItem.UnitCost
	var taxRateID *string
	discount := 0.0
	tax := 0.0
	if len(invoiceItems) > 0 {
		invoiceItem, ok := matchingInvoiceItem(invoiceItems, receiptItem)
		if !ok {
			return PurchaseReturnableItemResponse{}, apperrors.BadRequest("receipt item has no matching invoice item", map[string]interface{}{"item": receiptItem.ID})
		}
		ratio := 0.0
		if invoiceItem.Quantity > 0 {
			ratio = returnable / invoiceItem.Quantity
		}
		itemName = invoiceItem.ItemNameSnapshot
		unitCost = invoiceItem.UnitCost
		discount = roundMoney(invoiceItem.DiscountAmount * ratio)
		tax = roundMoney(invoiceItem.TaxAmount * ratio)
		taxRateID = invoiceItem.TaxRateID
	}
	lineSubtotal := roundMoney(unitCost * returnable)
	lineTotal := roundMoney(lineSubtotal - discount + tax)
	return PurchaseReturnableItemResponse{
		PurchaseReceiptItemID: receiptItem.ID,
		ItemType:              receiptItem.ItemType,
		ProductID:             receiptItem.ProductID,
		IngredientID:          receiptItem.IngredientID,
		PackagingItemID:       receiptItem.PackagingItemID,
		InventoryItemID:       receiptItem.InventoryItemID,
		ItemNameSnapshot:      itemName,
		QuantityReceived:      roundQuantity(receivedQty),
		QuantityReturned:      roundQuantity(returnedQty),
		ReturnableQuantity:    returnable,
		UnitID:                receiptItem.UnitID,
		UnitSymbol:            s.repo.UnitSymbol(receiptItem.UnitID),
		UnitCost:              roundMoney(unitCost),
		DiscountAmount:        discount,
		TaxRateID:             taxRateID,
		TaxAmount:             tax,
		LineSubtotal:          lineSubtotal,
		LineTotal:             lineTotal,
		ExpiryDate:            receiptItem.ExpiryDate,
		BatchNumber:           receiptItem.BatchNumber,
	}, nil
}

func (s *Service) resolvePurchaseReturnStockLocation(tx *gorm.DB, businessID string, requestedLocationID *string, originalMovementID *string) (*string, error) {
	if requestedLocationID != nil && strings.TrimSpace(*requestedLocationID) != "" {
		return requestedLocationID, nil
	}
	if originalMovementID == nil || strings.TrimSpace(*originalMovementID) == "" {
		return nil, nil
	}
	movement, err := s.inventoryRepo.FindStockMovementForUpdate(tx, *originalMovementID, businessID)
	if err != nil {
		return nil, notFound(err, "original receipt stock movement not found")
	}
	return movement.StockLocationID, nil
}

func receiptItemForUpdate(tx *gorm.DB, businessID, receiptItemID string) (*PurchaseReceiptItem, error) {
	var item PurchaseReceiptItem
	err := tx.Where("id = ? AND business_id = ? AND deleted_at IS NULL", receiptItemID, businessID).First(&item).Error
	return &item, err
}

func defaultDate(value string) string {
	if strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	return time.Now().UTC().Format("2006-01-02")
}

func supplierPaymentChainNumber(sequence int) string {
	return fmt.Sprintf("SP-%06d", sequence)
}

func requireAllOrOverride(currentUser *utils.AuthContext, required []string, overrides []string) error {
	if currentUser == nil {
		return apperrors.Unauthorized("missing authenticated user")
	}
	for _, permission := range overrides {
		if hasPermission(currentUser, permission) {
			return nil
		}
	}
	for _, permission := range required {
		if !hasPermission(currentUser, permission) {
			return apperrors.Forbidden("missing required permission")
		}
	}
	return nil
}

func hasPermission(currentUser *utils.AuthContext, permission string) bool {
	for _, existing := range currentUser.Permissions {
		if existing == permission {
			return true
		}
	}
	return false
}
