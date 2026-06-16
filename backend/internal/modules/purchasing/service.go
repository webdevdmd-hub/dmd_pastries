package purchasing

import (
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
}

func NewService(db *gorm.DB, repo *Repository, inventoryRepo *inventory.Repository, inventoryService *inventory.Service, auditRepo *audit.Repository, accountingService ...*accounting.Service) *Service {
	service := &Service{db: db, repo: repo, inventoryRepo: inventoryRepo, inventoryService: inventoryService, auditRepo: auditRepo}
	if len(accountingService) > 0 {
		service.accountingService = accountingService[0]
	}
	return service
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
		if order.Status == "partially_received" || order.Status == "received" {
			return apperrors.Conflict("purchase order has linked documents and cannot be hard deleted", map[string]interface{}{"reason": "purchase_order_has_history"})
		}
		historyCount, err := s.repo.PurchaseOrderHistoryCount(tx, currentUser.BusinessID, order.ID)
		if err != nil {
			return err
		}
		if historyCount > 0 {
			return apperrors.Conflict("purchase order has linked documents and cannot be hard deleted", map[string]interface{}{"reason": "purchase_order_has_history"})
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
			return apperrors.Conflict("purchase order already has a purchase invoice", nil)
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
			items = append(items, PurchaseInvoiceItem{
				ID:                utils.NewUUID(),
				BusinessID:        currentUser.BusinessID,
				PurchaseInvoiceID: invoiceID,
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
		invoiceID := purchaseReturn.PurchaseInvoiceID
		receiptID := purchaseReturn.PurchaseReceiptID
		response.PurchaseReturns = append(response.PurchaseReturns, PurchaseDocumentChainItem{ID: purchaseReturn.ID, DocumentNumber: purchaseReturn.ReturnNumber, DocumentType: "purchase_return", Status: purchaseReturn.Status, Date: purchaseReturn.ReturnDate, TotalAmount: roundMoney(purchaseReturn.ReturnTotal), PurchaseOrderID: purchaseReturn.PurchaseOrderID, PurchaseInvoiceID: &invoiceID, PurchaseReceiptID: &receiptID, PurchaseReturnID: &returnID, PreviousID: &receiptID})
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

func (s *Service) AddInvoicePayment(currentUser *utils.AuthContext, invoiceID string, req AddPurchaseInvoicePaymentRequest, ipAddress, userAgent string) (*PurchaseInvoiceResponse, error) {
	if err := validateUUID(req.PaymentMethodID, "payment_method_id"); err != nil {
		return nil, err
	}
	if req.Amount <= 0 {
		return nil, apperrors.BadRequest("amount must be greater than zero", nil)
	}
	paidAt, err := parseOptionalDateTime(req.PaidAt, time.Now().UTC(), "paid_at")
	if err != nil {
		return nil, err
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		invoice, err := s.repo.FindInvoiceForUpdate(tx, invoiceID, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase invoice not found")
		}
		if !currentUser.CanAccessBranch(invoice.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if invoice.Status != "posted" {
			return apperrors.BadRequest("only posted purchase invoices can be paid", nil)
		}
		if invoice.BalanceAmount <= 0 || invoice.PaymentStatus == "paid" {
			return apperrors.BadRequest("purchase invoice is already paid", nil)
		}
		amount := roundMoney(req.Amount)
		if amount > roundMoney(invoice.BalanceAmount) {
			return apperrors.BadRequest("payment amount cannot exceed invoice balance", map[string]float64{"balance_amount": roundMoney(invoice.BalanceAmount)})
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
		payment := &PurchaseInvoicePayment{
			ID:                        utils.NewUUID(),
			BusinessID:                currentUser.BusinessID,
			BranchID:                  invoice.BranchID,
			PurchaseInvoiceID:         invoice.ID,
			SupplierID:                invoice.SupplierID,
			PaymentMethodID:           method.ID,
			PaymentMethodNameSnapshot: method.MethodName,
			PaymentMethodTypeSnapshot: method.MethodType,
			Amount:                    amount,
			PaymentStatus:             "completed",
			ReferenceNumber:           reference,
			PaidByUserID:              currentUser.UserID,
			PaidAt:                    paidAt,
			Notes:                     strings.TrimSpace(req.Notes),
		}
		if err := s.repo.CreateInvoicePayment(tx, payment); err != nil {
			return err
		}
		if s.accountingService != nil {
			if _, err := s.accountingService.PostPurchaseInvoicePaymentJournal(tx, currentUser, payment.ID); err != nil {
				return err
			}
		}
		paidAmount := roundMoney(invoice.PaidAmount + amount)
		settledAmount := roundMoney(paidAmount + invoice.CreditedAmount)
		balanceAmount := roundMoney(invoice.TotalAmount - settledAmount)
		if balanceAmount < 0 {
			balanceAmount = 0
		}
		status := invoicePaymentStatus(invoice.TotalAmount, settledAmount)
		if err := s.repo.UpdateInvoice(tx, invoice.ID, currentUser.BusinessID, map[string]interface{}{"paid_amount": paidAmount, "balance_amount": balanceAmount, "payment_status": status, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}, nil); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "purchase_invoice.payment_added", invoice.ID, "Purchase invoice payment added", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetInvoice(currentUser, invoiceID)
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
		if existing.Status != "draft" {
			return apperrors.BadRequest("only draft invoices can be edited", nil)
		}
		branchID := first(req.BranchID, existing.BranchID)
		branchID, err = currentUser.ResolveOperationalBranch(branchID)
		if err != nil {
			return err
		}
		createReq := CreatePurchaseInvoiceRequest{
			BranchID:        branchID,
			SupplierID:      first(req.SupplierID, existing.SupplierID),
			PurchaseOrderID: first(req.PurchaseOrderID, deref(existing.PurchaseOrderID)),
			InvoiceNumber:   first(req.InvoiceNumber, existing.InvoiceNumber),
			InvoiceDate:     first(req.InvoiceDate, formatDate(existing.InvoiceDate)),
			DueDate:         first(req.DueDate, optionalDateString(existing.DueDate)),
			Items:           req.Items,
			Charges:         req.Charges,
			Notes:           req.Notes,
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
		updates := map[string]interface{}{"branch_id": invoice.BranchID, "supplier_id": invoice.SupplierID, "purchase_order_id": invoice.PurchaseOrderID, "invoice_number": invoice.InvoiceNumber, "supplier_bill_number": invoice.SupplierBillNumber, "invoice_date": invoice.InvoiceDate, "due_date": invoice.DueDate, "subtotal_amount": invoice.SubtotalAmount, "tax_amount": invoice.TaxAmount, "discount_amount": invoice.DiscountAmount, "total_amount": invoice.TotalAmount, "balance_amount": invoice.BalanceAmount, "notes": invoice.Notes, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
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
		if err := s.audit(tx, currentUser, "purchase_invoice.updated", id, "Purchase invoice updated", ipAddress, userAgent); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetInvoice(currentUser, id)
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
			Items:             receiptInputsFromInvoiceItems(invoiceItems),
			Notes:             notes,
		}
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
			remaining := roundQuantity(item.QuantityOrdered - item.QuantityReceived)
			if remaining <= 0 {
				continue
			}
			input := PurchaseReceiptItemInput{
				ItemType:         normalizedPurchaseItemType(item.ItemType, item.ProductID != nil),
				QuantityReceived: remaining,
				UnitID:           item.UnitID,
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
		if s.accountingService != nil {
			if _, err := s.accountingService.PostPurchaseReceiptJournal(tx, currentUser, receipt.ID); err != nil {
				return err
			}
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
		if s.accountingService != nil {
			if _, err := s.accountingService.PostPurchaseReceiptJournal(tx, currentUser, id); err != nil {
				return err
			}
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
		invoice, err := s.repo.FindInvoiceForUpdate(tx, purchaseReturn.PurchaseInvoiceID, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase invoice not found")
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
		appliedCredit := roundMoney(purchaseReturn.ReturnTotal)
		if appliedCredit > roundMoney(invoice.BalanceAmount) {
			appliedCredit = roundMoney(invoice.BalanceAmount)
		}
		openCredit := roundMoney(purchaseReturn.ReturnTotal - appliedCredit)
		creditedAmount := roundMoney(invoice.CreditedAmount + appliedCredit)
		returnedAmount := roundMoney(invoice.ReturnedAmount + purchaseReturn.ReturnTotal)
		balanceAmount := roundMoney(invoice.TotalAmount - invoice.PaidAmount - creditedAmount)
		if balanceAmount < 0 {
			balanceAmount = 0
		}
		paymentStatus := invoicePaymentStatus(invoice.TotalAmount, roundMoney(invoice.PaidAmount+creditedAmount))
		returnStatus := purchaseInvoiceReturnStatus(invoice.TotalAmount, returnedAmount)
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
		if s.accountingService != nil {
			if _, err := s.accountingService.PostPurchaseReturnJournal(tx, currentUser, purchaseReturn.ID); err != nil {
				return err
			}
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
	if receipt.PurchaseInvoiceID == nil {
		return nil, apperrors.BadRequest("purchase receipt must be linked to a posted invoice before return", nil)
	}
	invoiceItems, err := s.repo.InvoiceItems(*receipt.PurchaseInvoiceID, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load invoice items")
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
		invoiceItem, ok := matchingInvoiceItem(invoiceItems, item)
		if !ok {
			return nil, apperrors.BadRequest("receipt item has no matching invoice item", map[string]interface{}{"item": item.ID})
		}
		response := s.returnableItemResponse(item, invoiceItem, returnedQty, item.QuantityReceived)
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
		common, line, err := s.prepareLine(tx, businessID, branchID, lineInput{ItemType: input.ItemType, ProductID: input.ProductID, IngredientID: input.IngredientID, PackagingItemID: input.PackagingItemID, Quantity: input.QuantityOrdered, UnitID: input.UnitID, UnitCost: input.UnitCost, DiscountAmount: input.DiscountAmount, TaxRateID: input.TaxRateID})
		if err != nil {
			return nil, totals{}, err
		}
		total.add(line)
		items = append(items, PurchaseOrderItem{ID: utils.NewUUID(), BusinessID: businessID, PurchaseOrderID: orderID, ItemType: common.ItemType, ProductID: common.ProductID, IngredientID: common.IngredientID, PackagingItemID: common.PackagingItemID, ItemNameSnapshot: common.ItemName, QuantityOrdered: input.QuantityOrdered, UnitID: input.UnitID, UnitCost: input.UnitCost, DiscountAmount: input.DiscountAmount, TaxRateID: nullableString(input.TaxRateID), TaxAmount: line.Tax, LineTotal: line.Total})
	}
	return items, total.round(), nil
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
	taxAmount := roundMoney(total.Tax + chargeTotals.TaxAmount)
	totalAmount := roundMoney(total.Total + chargeTotals.Total)
	return &PurchaseInvoice{ID: invoiceID, BusinessID: currentUser.BusinessID, BranchID: req.BranchID, SupplierID: req.SupplierID, PurchaseOrderID: nullableString(req.PurchaseOrderID), InvoiceNumber: strings.TrimSpace(req.InvoiceNumber), SupplierBillNumber: strings.TrimSpace(req.SupplierBillNumber), InvoiceDate: invoiceDate, DueDate: dueDate, Status: "draft", PaymentStatus: "unpaid", SubtotalAmount: total.Subtotal, TaxAmount: taxAmount, ChargeAmount: chargeTotals.Amount, ChargeTaxAmount: chargeTotals.TaxAmount, DiscountAmount: total.Discount, TotalAmount: totalAmount, BalanceAmount: totalAmount, Notes: strings.TrimSpace(req.Notes), CreatedByUserID: currentUser.UserID, UpdatedByUserID: currentUser.UserID}, items, chargeRows, nil
}

func (s *Service) buildInvoiceItems(tx *gorm.DB, businessID, branchID, invoiceID string, inputItems []PurchaseInvoiceItemInput) ([]PurchaseInvoiceItem, totals, error) {
	if len(inputItems) == 0 {
		return nil, totals{}, apperrors.BadRequest("items are required", nil)
	}
	items := make([]PurchaseInvoiceItem, 0, len(inputItems))
	var total totals
	for _, input := range inputItems {
		common, line, err := s.prepareLine(tx, businessID, branchID, lineInput{ItemType: input.ItemType, ProductID: input.ProductID, IngredientID: input.IngredientID, PackagingItemID: input.PackagingItemID, Quantity: input.Quantity, UnitID: input.UnitID, UnitCost: input.UnitCost, DiscountAmount: input.DiscountAmount, TaxRateID: input.TaxRateID})
		if err != nil {
			return nil, totals{}, err
		}
		expiryDate, err := parseOptionalDate(input.ExpiryDate, "expiry_date")
		if err != nil {
			return nil, totals{}, err
		}
		total.add(line)
		items = append(items, PurchaseInvoiceItem{ID: utils.NewUUID(), BusinessID: businessID, PurchaseInvoiceID: invoiceID, ItemType: common.ItemType, ProductID: common.ProductID, IngredientID: common.IngredientID, PackagingItemID: common.PackagingItemID, ItemNameSnapshot: common.ItemName, Quantity: input.Quantity, UnitID: input.UnitID, UnitCost: input.UnitCost, DiscountAmount: input.DiscountAmount, TaxRateID: nullableString(input.TaxRateID), TaxAmount: line.Tax, LineTotal: line.Total, ExpiryDate: expiryDate, BatchNumber: strings.TrimSpace(input.BatchNumber)})
	}
	return items, total.round(), nil
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
	for _, input := range req.Items {
		prepared, err := s.prepareReceiptItem(tx, currentUser.BusinessID, req.BranchID, input)
		if err != nil {
			return nil, nil, nil, err
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
	if receipt.PurchaseInvoiceID == nil {
		return nil, nil, nil, apperrors.BadRequest("purchase receipt must be linked to a posted invoice before return", nil)
	}
	invoice, err := s.repo.FindInvoiceForUpdate(tx, *receipt.PurchaseInvoiceID, currentUser.BusinessID)
	if err != nil {
		return nil, nil, nil, notFound(err, "purchase invoice not found")
	}
	if invoice.Status != "posted" {
		return nil, nil, nil, apperrors.BadRequest("only posted purchase invoices can receive vendor credits", nil)
	}
	if invoice.BranchID != receipt.BranchID || invoice.SupplierID != receipt.SupplierID {
		return nil, nil, nil, apperrors.BadRequest("receipt and invoice supplier/branch do not match", nil)
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
		PurchaseInvoiceID:       invoice.ID,
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
	invoiceItems, err := s.repo.InvoiceItems(invoice.ID, businessID)
	if err != nil {
		return nil, totals{}, err
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
		invoiceItem, ok := matchingInvoiceItem(invoiceItems, receiptItem)
		if !ok {
			return nil, totals{}, apperrors.BadRequest("receipt item has no matching invoice item", map[string]interface{}{"item": receiptItem.ID})
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
		if invoiceItem.Quantity <= 0 {
			return nil, totals{}, apperrors.BadRequest("invoice item quantity must be greater than zero", nil)
		}
		ratio := input.Quantity / invoiceItem.Quantity
		lineSubtotal := roundMoney(invoiceItem.UnitCost * input.Quantity)
		discount := roundMoney(invoiceItem.DiscountAmount * ratio)
		tax := roundMoney(invoiceItem.TaxAmount * ratio)
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
			ItemNameSnapshot:      invoiceItem.ItemNameSnapshot,
			Quantity:              input.Quantity,
			UnitID:                receiptItem.UnitID,
			UnitCost:              invoiceItem.UnitCost,
			DiscountAmount:        discount,
			TaxRateID:             invoiceItem.TaxRateID,
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
	if input.Quantity <= 0 {
		return preparedItem{}, lineTotals{}, apperrors.BadRequest("quantity must be greater than zero", nil)
	}
	if input.UnitCost < 0 || input.DiscountAmount < 0 {
		return preparedItem{}, lineTotals{}, apperrors.BadRequest("unit_cost and discount_amount must be non-negative", nil)
	}
	subtotal := input.Quantity * input.UnitCost
	if input.DiscountAmount > subtotal {
		return preparedItem{}, lineTotals{}, apperrors.BadRequest("discount_amount cannot exceed line subtotal", nil)
	}
	taxAmount := 0.0
	if strings.TrimSpace(input.TaxRateID) != "" {
		if err := validateUUID(input.TaxRateID, "tax_rate_id"); err != nil {
			return preparedItem{}, lineTotals{}, err
		}
		tax, err := s.repo.TaxRate(tx, businessID, input.TaxRateID)
		if err != nil {
			return preparedItem{}, lineTotals{}, notFound(err, "tax rate not found")
		}
		taxable := subtotal - input.DiscountAmount
		if tax.IsInclusive {
			taxAmount = taxable - (taxable / (1 + tax.RatePercentage/100))
		} else {
			taxAmount = taxable * tax.RatePercentage / 100
		}
	}
	line := lineTotals{Subtotal: roundMoney(subtotal), Discount: roundMoney(input.DiscountAmount), Tax: roundMoney(taxAmount)}
	line.Total = roundMoney(line.Subtotal - line.Discount + line.Tax)
	return prepared, line, nil
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
	for _, item := range items {
		if item.QuantityReceived > 0 {
			receivedAny = true
		}
		if item.QuantityReceived < item.QuantityOrdered {
			receivedAll = false
		}
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
	totalAmount := roundMoney(itemTotals.Total + chargeTotals.Total)
	settledAmount := roundMoney(invoice.PaidAmount + invoice.CreditedAmount)
	balanceAmount := roundMoney(totalAmount - settledAmount)
	if balanceAmount < 0 {
		balanceAmount = 0
	}
	return s.repo.UpdateInvoice(tx, invoiceID, businessID, map[string]interface{}{
		"subtotal_amount":   itemTotals.Subtotal,
		"discount_amount":   itemTotals.Discount,
		"tax_amount":        roundMoney(itemTotals.Tax + chargeTotals.TaxAmount),
		"charge_amount":     chargeTotals.Amount,
		"charge_tax_amount": chargeTotals.TaxAmount,
		"total_amount":      totalAmount,
		"balance_amount":    balanceAmount,
		"payment_status":    invoicePaymentStatus(totalAmount, settledAmount),
		"updated_at":        time.Now().UTC(),
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
			response.Items = append(response.Items, PurchaseOrderItemResponse{ID: item.ID, ItemType: item.ItemType, ProductID: item.ProductID, IngredientID: item.IngredientID, PackagingItemID: item.PackagingItemID, ItemNameSnapshot: item.ItemNameSnapshot, QuantityOrdered: roundQuantity(item.QuantityOrdered), QuantityReceived: roundQuantity(item.QuantityReceived), UnitID: item.UnitID, UnitSymbol: s.repo.UnitSymbol(item.UnitID), UnitCost: roundMoney(item.UnitCost), DiscountAmount: roundMoney(item.DiscountAmount), TaxRateID: item.TaxRateID, TaxAmount: roundMoney(item.TaxAmount), LineTotal: roundMoney(item.LineTotal)})
		}
		response.Charges, _ = charges.ListChargeResponses(s.db, businessID, "purchase_order", order.ID)
	}
	return response
}

func (s *Service) invoiceResponse(businessID string, invoice PurchaseInvoice, includeItems bool) PurchaseInvoiceResponse {
	branchName, supplierName := s.repo.NameLookups(businessID, invoice.BranchID, invoice.SupplierID)
	response := PurchaseInvoiceResponse{ID: invoice.ID, BusinessID: invoice.BusinessID, BranchID: invoice.BranchID, BranchName: branchName, SupplierID: invoice.SupplierID, SupplierName: supplierName, PurchaseOrderID: invoice.PurchaseOrderID, InvoiceNumber: invoice.InvoiceNumber, SupplierBillNumber: invoice.SupplierBillNumber, InvoiceDate: invoice.InvoiceDate, DueDate: invoice.DueDate, Status: invoice.Status, PaymentStatus: invoice.PaymentStatus, SubtotalAmount: roundMoney(invoice.SubtotalAmount), TaxAmount: roundMoney(invoice.TaxAmount), ChargeAmount: roundMoney(invoice.ChargeAmount), ChargeTaxAmount: roundMoney(invoice.ChargeTaxAmount), DiscountAmount: roundMoney(invoice.DiscountAmount), TotalAmount: roundMoney(invoice.TotalAmount), PaidAmount: roundMoney(invoice.PaidAmount), BalanceAmount: roundMoney(invoice.BalanceAmount), ReturnedAmount: roundMoney(invoice.ReturnedAmount), CreditedAmount: roundMoney(invoice.CreditedAmount), ReturnStatus: invoice.ReturnStatus, JournalEntryID: invoice.JournalEntryID, CancelledByUserID: invoice.CancelledByUserID, CancelledAt: invoice.CancelledAt, CancelReason: invoice.CancelReason, ReversalJournalEntryID: invoice.ReversalJournalEntryID, CancelledReceiptID: invoice.CancelledReceiptID, Notes: invoice.Notes, CreatedAt: invoice.CreatedAt, UpdatedAt: invoice.UpdatedAt}
	if includeItems {
		items, _ := s.repo.InvoiceItems(invoice.ID, businessID)
		for _, item := range items {
			response.Items = append(response.Items, PurchaseInvoiceItemResponse{ID: item.ID, ItemType: item.ItemType, ProductID: item.ProductID, IngredientID: item.IngredientID, PackagingItemID: item.PackagingItemID, ItemNameSnapshot: item.ItemNameSnapshot, Quantity: roundQuantity(item.Quantity), UnitID: item.UnitID, UnitSymbol: s.repo.UnitSymbol(item.UnitID), UnitCost: roundMoney(item.UnitCost), DiscountAmount: roundMoney(item.DiscountAmount), TaxRateID: item.TaxRateID, TaxAmount: roundMoney(item.TaxAmount), LineTotal: roundMoney(item.LineTotal), ExpiryDate: item.ExpiryDate, BatchNumber: item.BatchNumber})
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

func (s *Service) purchaseReturnResponse(businessID string, purchaseReturn PurchaseReturn, includeItems bool) PurchaseReturnResponse {
	branchName, supplierName := s.repo.NameLookups(businessID, purchaseReturn.BranchID, purchaseReturn.SupplierID)
	invoiceNumber, receiptNumber := s.purchaseReturnDocumentNumbers(businessID, purchaseReturn.PurchaseInvoiceID, purchaseReturn.PurchaseReceiptID)
	response := PurchaseReturnResponse{
		ID:                      purchaseReturn.ID,
		BusinessID:              purchaseReturn.BusinessID,
		BranchID:                purchaseReturn.BranchID,
		BranchName:              branchName,
		SupplierID:              purchaseReturn.SupplierID,
		SupplierName:            supplierName,
		PurchaseOrderID:         purchaseReturn.PurchaseOrderID,
		PurchaseInvoiceID:       purchaseReturn.PurchaseInvoiceID,
		PurchaseInvoiceNumber:   invoiceNumber,
		PurchaseReceiptID:       purchaseReturn.PurchaseReceiptID,
		PurchaseReceiptNumber:   receiptNumber,
		ReturnNumber:            purchaseReturn.ReturnNumber,
		ReturnDate:              purchaseReturn.ReturnDate,
		SupplierReferenceNumber: purchaseReturn.SupplierReferenceNumber,
		Reason:                  purchaseReturn.Reason,
		Status:                  purchaseReturn.Status,
		SubtotalAmount:          roundMoney(purchaseReturn.SubtotalAmount),
		TaxAmount:               roundMoney(purchaseReturn.TaxAmount),
		ChargeAmount:            roundMoney(purchaseReturn.ChargeAmount),
		ChargeTaxAmount:         roundMoney(purchaseReturn.ChargeTaxAmount),
		DiscountAmount:          roundMoney(purchaseReturn.DiscountAmount),
		ReturnTotal:             roundMoney(purchaseReturn.ReturnTotal),
		AppliedCreditAmount:     roundMoney(purchaseReturn.AppliedCreditAmount),
		OpenCreditAmount:        roundMoney(purchaseReturn.OpenCreditAmount),
		JournalEntryID:          purchaseReturn.JournalEntryID,
		CreatedByUserID:         purchaseReturn.CreatedByUserID,
		PostedByUserID:          purchaseReturn.PostedByUserID,
		PostedAt:                purchaseReturn.PostedAt,
		CancelledByUserID:       purchaseReturn.CancelledByUserID,
		CancelledAt:             purchaseReturn.CancelledAt,
		CreatedAt:               purchaseReturn.CreatedAt,
		UpdatedAt:               purchaseReturn.UpdatedAt,
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

func (s *Service) purchaseReturnDocumentNumbers(businessID, invoiceID, receiptID string) (string, string) {
	invoiceNumber := ""
	receiptNumber := ""
	if invoice, err := s.repo.FindInvoice(invoiceID, businessID); err == nil {
		invoiceNumber = invoice.InvoiceNumber
	}
	if receipt, err := s.repo.FindReceipt(receiptID, businessID); err == nil {
		receiptNumber = receipt.ReceiptNumber
	}
	return invoiceNumber, receiptNumber
}

func (s *Service) receiptResponse(businessID string, receipt PurchaseReceipt, includeItems bool) PurchaseReceiptResponse {
	branchName, supplierName := s.repo.NameLookups(businessID, receipt.BranchID, receipt.SupplierID)
	response := PurchaseReceiptResponse{ID: receipt.ID, BusinessID: receipt.BusinessID, BranchID: receipt.BranchID, BranchName: branchName, SupplierID: receipt.SupplierID, SupplierName: supplierName, PurchaseOrderID: receipt.PurchaseOrderID, PurchaseInvoiceID: receipt.PurchaseInvoiceID, ReceiptNumber: receipt.ReceiptNumber, ReceivedDate: receipt.ReceivedDate, Status: receipt.Status, ChargeAmount: roundMoney(receipt.ChargeAmount), ChargeTaxAmount: roundMoney(receipt.ChargeTaxAmount), JournalEntryID: receipt.JournalEntryID, ReceivedByUserID: receipt.ReceivedByUserID, Notes: receipt.Notes, CreatedAt: receipt.CreatedAt, UpdatedAt: receipt.UpdatedAt}
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
	return s.auditRepo.CreateActivity(tx, audit.ActivityInput{BusinessID: currentUser.BusinessID, ActorUserID: currentUser.UserID, EventType: eventType, EntityType: "purchasing", EntityID: entityID, Summary: summary, IPAddress: ipAddress, UserAgent: userAgent})
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
		result = append(result, PurchaseInvoiceItemInput{ItemType: normalizedPurchaseItemType(item.ItemType, item.ProductID != nil), ProductID: deref(item.ProductID), IngredientID: deref(item.IngredientID), PackagingItemID: deref(item.PackagingItemID), Quantity: item.Quantity, UnitID: item.UnitID, UnitCost: item.UnitCost, DiscountAmount: item.DiscountAmount, TaxRateID: deref(item.TaxRateID), ExpiryDate: optionalDateString(item.ExpiryDate), BatchNumber: item.BatchNumber})
	}
	return result
}

func receiptInputsFromInvoiceItems(items []PurchaseInvoiceItem) []PurchaseReceiptItemInput {
	result := make([]PurchaseReceiptItemInput, 0, len(items))
	for _, item := range items {
		result = append(result, PurchaseReceiptItemInput{ItemType: normalizedPurchaseItemType(item.ItemType, item.ProductID != nil), ProductID: deref(item.ProductID), IngredientID: deref(item.IngredientID), PackagingItemID: deref(item.PackagingItemID), QuantityReceived: item.Quantity, UnitID: item.UnitID, UnitCost: item.UnitCost, ExpiryDate: optionalDateString(item.ExpiryDate), BatchNumber: item.BatchNumber})
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
			item.UnitID == receiptItem.UnitID &&
			equalStringPtr(item.ProductID, receiptItem.ProductID) &&
			equalStringPtr(item.IngredientID, receiptItem.IngredientID) &&
			equalStringPtr(item.PackagingItemID, receiptItem.PackagingItemID) {
			return item, true
		}
	}
	return PurchaseInvoiceItem{}, false
}

func (s *Service) returnableItemResponse(receiptItem PurchaseReceiptItem, invoiceItem PurchaseInvoiceItem, returnedQty, receivedQty float64) PurchaseReturnableItemResponse {
	returnable := roundQuantity(receivedQty - returnedQty)
	if returnable < 0 {
		returnable = 0
	}
	ratio := 0.0
	if invoiceItem.Quantity > 0 {
		ratio = returnable / invoiceItem.Quantity
	}
	lineSubtotal := roundMoney(invoiceItem.UnitCost * returnable)
	discount := roundMoney(invoiceItem.DiscountAmount * ratio)
	tax := roundMoney(invoiceItem.TaxAmount * ratio)
	lineTotal := roundMoney(lineSubtotal - discount + tax)
	return PurchaseReturnableItemResponse{
		PurchaseReceiptItemID: receiptItem.ID,
		ItemType:              receiptItem.ItemType,
		ProductID:             receiptItem.ProductID,
		IngredientID:          receiptItem.IngredientID,
		PackagingItemID:       receiptItem.PackagingItemID,
		InventoryItemID:       receiptItem.InventoryItemID,
		ItemNameSnapshot:      invoiceItem.ItemNameSnapshot,
		QuantityReceived:      roundQuantity(receivedQty),
		QuantityReturned:      roundQuantity(returnedQty),
		ReturnableQuantity:    returnable,
		UnitID:                receiptItem.UnitID,
		UnitSymbol:            s.repo.UnitSymbol(receiptItem.UnitID),
		UnitCost:              roundMoney(invoiceItem.UnitCost),
		DiscountAmount:        discount,
		TaxRateID:             invoiceItem.TaxRateID,
		TaxAmount:             tax,
		LineSubtotal:          lineSubtotal,
		LineTotal:             lineTotal,
		ExpiryDate:            receiptItem.ExpiryDate,
		BatchNumber:           receiptItem.BatchNumber,
	}
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
