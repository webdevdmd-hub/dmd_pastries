package purchasing

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
		order, items, err := s.buildOrder(tx, currentUser, "", req.BranchID, req.SupplierID, req.OrderDate, req.ExpectedDeliveryDate, req.Items, req.Notes)
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
	_, err := s.UpdateOrderStatus(currentUser, id, UpdateStatusRequest{Status: "cancelled"}, ipAddress, userAgent)
	return err
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
		invoice, items, err := s.buildInvoice(tx, currentUser, "", req)
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
		paidAmount := roundMoney(invoice.PaidAmount + amount)
		balanceAmount := roundMoney(invoice.TotalAmount - paidAmount)
		if balanceAmount < 0 {
			balanceAmount = 0
		}
		status := invoicePaymentStatus(invoice.TotalAmount, paidAmount)
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
			Notes:           req.Notes,
		}
		if createReq.Items == nil {
			oldItems, err := s.repo.InvoiceItems(id, currentUser.BusinessID)
			if err != nil {
				return err
			}
			createReq.Items = invoiceInputsFromItems(oldItems)
		}
		invoice, items, err := s.buildInvoice(tx, currentUser, id, createReq)
		if err != nil {
			return err
		}
		if exists, err := s.repo.InvoiceNumberExists(tx, currentUser.BusinessID, invoice.SupplierID, invoice.InvoiceNumber, id); err != nil {
			return err
		} else if exists {
			return apperrors.Conflict("invoice_number already exists for this supplier", nil)
		}
		updates := map[string]interface{}{"branch_id": invoice.BranchID, "supplier_id": invoice.SupplierID, "purchase_order_id": invoice.PurchaseOrderID, "invoice_number": invoice.InvoiceNumber, "invoice_date": invoice.InvoiceDate, "due_date": invoice.DueDate, "subtotal_amount": invoice.SubtotalAmount, "tax_amount": invoice.TaxAmount, "discount_amount": invoice.DiscountAmount, "total_amount": invoice.TotalAmount, "balance_amount": invoice.BalanceAmount, "notes": invoice.Notes, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
		if err := s.repo.UpdateInvoice(tx, id, currentUser.BusinessID, updates, items); err != nil {
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
		return s.audit(tx, currentUser, "purchase_invoice.posted", id, "Purchase invoice posted", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetInvoice(currentUser, id)
}

func (s *Service) CancelInvoice(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*PurchaseInvoiceResponse, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		invoice, err := s.repo.FindInvoiceForUpdate(tx, id, currentUser.BusinessID)
		if err != nil {
			return notFound(err, "purchase invoice not found")
		}
		if !currentUser.CanAccessBranch(invoice.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		var receipts int64
		if err := tx.Model(&PurchaseReceipt{}).Where("business_id = ? AND purchase_invoice_id = ? AND status = ? AND deleted_at IS NULL", currentUser.BusinessID, id, "posted").Count(&receipts).Error; err != nil {
			return err
		}
		if receipts > 0 {
			return apperrors.BadRequest("invoice with posted receipts cannot be cancelled", nil)
		}
		payments, err := s.repo.CompletedInvoicePaymentCount(tx, currentUser.BusinessID, id)
		if err != nil {
			return err
		}
		if payments > 0 {
			return apperrors.BadRequest("invoice with completed supplier payments cannot be cancelled", nil)
		}
		if err := s.repo.UpdateInvoice(tx, id, currentUser.BusinessID, map[string]interface{}{"status": "cancelled", "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}, nil); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "purchase_invoice.cancelled", id, "Purchase invoice cancelled", ipAddress, userAgent)
	})
	if err != nil {
		return nil, err
	}
	return s.GetInvoice(currentUser, id)
}

func (s *Service) Receive(currentUser *utils.AuthContext, req ReceivePurchaseRequest, ipAddress, userAgent string) (*PurchaseReceiptResponse, error) {
	var receiptID string
	err := s.db.Transaction(func(tx *gorm.DB) error {
		receipt, items, err := s.buildReceiptWithStock(tx, currentUser, req)
		if err != nil {
			return err
		}
		if err := s.repo.CreateReceipt(tx, receipt, items); err != nil {
			return err
		}
		if receipt.PurchaseOrderID != nil {
			if err := s.refreshOrderReceivedStatus(tx, currentUser.BusinessID, *receipt.PurchaseOrderID); err != nil {
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
		if err := s.repo.UpdateReceipt(tx, id, currentUser.BusinessID, map[string]interface{}{"status": "posted", "updated_at": time.Now().UTC()}); err != nil {
			return err
		}
		return s.audit(tx, currentUser, "purchase_receipt.posted", id, "Purchase receipt posted", ipAddress, userAgent)
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
	response.TotalPurchaseAmount = roundMoney(response.TotalPurchaseAmount)
	return response, nil
}

func (s *Service) buildOrder(tx *gorm.DB, currentUser *utils.AuthContext, id, branchID, supplierID, orderDate, expectedDate string, inputItems []PurchaseOrderItemInput, notes string) (*PurchaseOrder, []PurchaseOrderItem, error) {
	resolvedBranchID, err := currentUser.ResolveOperationalBranch(branchID)
	if err != nil {
		return nil, nil, err
	}
	branchID = resolvedBranchID
	if err := s.validateHeader(tx, currentUser.BusinessID, branchID, supplierID); err != nil {
		return nil, nil, err
	}
	parsedOrderDate, err := parseDate(orderDate, "order_date")
	if err != nil {
		return nil, nil, err
	}
	parsedExpected, err := parseOptionalDate(expectedDate, "expected_delivery_date")
	if err != nil {
		return nil, nil, err
	}
	orderID := id
	if orderID == "" {
		orderID = utils.NewUUID()
	}
	items, totals, err := s.buildOrderItems(tx, currentUser.BusinessID, branchID, orderID, inputItems)
	if err != nil {
		return nil, nil, err
	}
	return &PurchaseOrder{ID: orderID, BusinessID: currentUser.BusinessID, BranchID: branchID, SupplierID: supplierID, OrderDate: parsedOrderDate, ExpectedDeliveryDate: parsedExpected, Status: "draft", SubtotalAmount: totals.Subtotal, TaxAmount: totals.Tax, DiscountAmount: totals.Discount, TotalAmount: totals.Total, Notes: strings.TrimSpace(notes), CreatedByUserID: currentUser.UserID, UpdatedByUserID: currentUser.UserID}, items, nil
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

func (s *Service) buildInvoice(tx *gorm.DB, currentUser *utils.AuthContext, id string, req CreatePurchaseInvoiceRequest) (*PurchaseInvoice, []PurchaseInvoiceItem, error) {
	resolvedBranchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return nil, nil, err
	}
	req.BranchID = resolvedBranchID
	if err := s.validateHeader(tx, currentUser.BusinessID, req.BranchID, req.SupplierID); err != nil {
		return nil, nil, err
	}
	if strings.TrimSpace(req.InvoiceNumber) == "" {
		return nil, nil, apperrors.BadRequest("invoice_number is required", nil)
	}
	invoiceDate, err := parseDate(req.InvoiceDate, "invoice_date")
	if err != nil {
		return nil, nil, err
	}
	dueDate, err := parseOptionalDate(req.DueDate, "due_date")
	if err != nil {
		return nil, nil, err
	}
	if req.PurchaseOrderID != "" {
		order, err := s.repo.FindOrder(req.PurchaseOrderID, currentUser.BusinessID)
		if err != nil {
			return nil, nil, notFound(err, "purchase order not found")
		}
		if order.BranchID != req.BranchID {
			return nil, nil, apperrors.BadRequest("purchase order branch does not match invoice branch", nil)
		}
	}
	invoiceID := id
	if invoiceID == "" {
		invoiceID = utils.NewUUID()
	}
	items, total, err := s.buildInvoiceItems(tx, currentUser.BusinessID, req.BranchID, invoiceID, req.Items)
	if err != nil {
		return nil, nil, err
	}
	return &PurchaseInvoice{ID: invoiceID, BusinessID: currentUser.BusinessID, BranchID: req.BranchID, SupplierID: req.SupplierID, PurchaseOrderID: nullableString(req.PurchaseOrderID), InvoiceNumber: strings.TrimSpace(req.InvoiceNumber), InvoiceDate: invoiceDate, DueDate: dueDate, Status: "draft", PaymentStatus: "unpaid", SubtotalAmount: total.Subtotal, TaxAmount: total.Tax, DiscountAmount: total.Discount, TotalAmount: total.Total, BalanceAmount: total.Total, Notes: strings.TrimSpace(req.Notes), CreatedByUserID: currentUser.UserID, UpdatedByUserID: currentUser.UserID}, items, nil
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

func (s *Service) buildReceiptWithStock(tx *gorm.DB, currentUser *utils.AuthContext, req ReceivePurchaseRequest) (*PurchaseReceipt, []PurchaseReceiptItem, error) {
	resolvedBranchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return nil, nil, err
	}
	req.BranchID = resolvedBranchID
	if err := s.validateHeader(tx, currentUser.BusinessID, req.BranchID, req.SupplierID); err != nil {
		return nil, nil, err
	}
	receivedDate, err := parseDate(req.ReceivedDate, "received_date")
	if err != nil {
		return nil, nil, err
	}
	if req.PurchaseOrderID != "" {
		order, err := s.repo.FindOrderForUpdate(tx, req.PurchaseOrderID, currentUser.BusinessID)
		if err != nil {
			return nil, nil, notFound(err, "purchase order not found")
		}
		if order.Status == "cancelled" || order.Status == "received" {
			return nil, nil, apperrors.BadRequest("purchase order cannot receive more stock", nil)
		}
		if order.BranchID != req.BranchID {
			return nil, nil, apperrors.BadRequest("purchase order branch does not match receipt branch", nil)
		}
	}
	if req.PurchaseInvoiceID != "" {
		invoice, err := s.repo.FindInvoiceForUpdate(tx, req.PurchaseInvoiceID, currentUser.BusinessID)
		if err != nil {
			return nil, nil, notFound(err, "purchase invoice not found")
		}
		if invoice.Status != "posted" {
			return nil, nil, apperrors.BadRequest("only posted invoices can be received", nil)
		}
		if invoice.BranchID != req.BranchID {
			return nil, nil, apperrors.BadRequest("purchase invoice branch does not match receipt branch", nil)
		}
	}
	if len(req.Items) == 0 {
		return nil, nil, apperrors.BadRequest("items are required", nil)
	}
	receiptNumber, err := s.repo.NextNumber(tx, currentUser.BusinessID, "purchase_receipts", "receipt_number", "PR", "purchase_receipts")
	if err != nil {
		return nil, nil, err
	}
	receipt := &PurchaseReceipt{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, BranchID: req.BranchID, SupplierID: req.SupplierID, PurchaseOrderID: nullableString(req.PurchaseOrderID), PurchaseInvoiceID: nullableString(req.PurchaseInvoiceID), ReceiptNumber: receiptNumber, ReceivedDate: receivedDate, Status: "posted", ReceivedByUserID: currentUser.UserID, Notes: strings.TrimSpace(req.Notes)}
	items := make([]PurchaseReceiptItem, 0, len(req.Items))
	for _, input := range req.Items {
		prepared, err := s.prepareReceiptItem(tx, currentUser.BusinessID, req.BranchID, input)
		if err != nil {
			return nil, nil, err
		}
		if req.PurchaseOrderID != "" {
			if err := s.applyPOReceiveQuantity(tx, currentUser.BusinessID, req.PurchaseOrderID, prepared); err != nil {
				return nil, nil, err
			}
		}
		inventoryItem, err := s.findOrCreateInventoryItem(tx, currentUser.BusinessID, req.BranchID, prepared)
		if err != nil {
			return nil, nil, err
		}
		movement, err := s.inventoryService.ApplyMovement(tx, inventory.ApplyStockMovementInput{BusinessID: currentUser.BusinessID, InventoryItemID: inventoryItem.ID, MovementType: "purchase_in", Quantity: input.QuantityReceived, ReferenceType: "purchase_receipt", ReferenceID: &receipt.ID, ReferenceNumber: receipt.ReceiptNumber, Reason: "Purchase received", CreatedByUserID: currentUser.UserID})
		if err != nil {
			return nil, nil, err
		}
		expiryDate, err := parseOptionalDate(input.ExpiryDate, "expiry_date")
		if err != nil {
			return nil, nil, err
		}
		if expiryDate != nil {
			batch := &inventory.ExpiryBatch{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, BranchID: req.BranchID, InventoryItemID: inventoryItem.ID, BatchNumber: strings.TrimSpace(input.BatchNumber), Quantity: input.QuantityReceived, ExpiryDate: *expiryDate, ReceivedDate: receivedDate, Status: "active"}
			if err := s.inventoryRepo.CreateExpiryBatch(tx, batch); err != nil {
				return nil, nil, err
			}
		}
		items = append(items, PurchaseReceiptItem{ID: utils.NewUUID(), BusinessID: currentUser.BusinessID, PurchaseReceiptID: receipt.ID, ItemType: prepared.ItemType, ProductID: prepared.ProductID, IngredientID: prepared.IngredientID, PackagingItemID: prepared.PackagingItemID, InventoryItemID: inventoryItem.ID, QuantityReceived: input.QuantityReceived, UnitID: input.UnitID, ExpiryDate: expiryDate, BatchNumber: strings.TrimSpace(input.BatchNumber), StockMovementID: &movement.ID})
	}
	return receipt, items, nil
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
	prepared, err := s.prepareItemIdentity(tx, businessID, branchID, input.ItemType, input.ProductID, input.IngredientID, input.PackagingItemID, input.UnitID)
	prepared.Quantity = input.QuantityReceived
	return prepared, err
}

func (s *Service) prepareItemIdentity(tx *gorm.DB, businessID, branchID, itemType, productID, ingredientID, packagingID, unitID string) (preparedItem, error) {
	if !validItemType(itemType) {
		return preparedItem{}, apperrors.BadRequest("invalid item_type", nil)
	}
	if err := validateUUID(unitID, "unit_id"); err != nil {
		return preparedItem{}, err
	}
	if err := s.repo.ValidateUnit(tx, businessID, unitID); err != nil {
		return preparedItem{}, notFound(err, "unit not found")
	}
	prepared := preparedItem{ItemType: itemType, UnitID: unitID}
	switch itemType {
	case "product":
		if err := validateUUID(productID, "product_id"); err != nil {
			return preparedItem{}, err
		}
		product, err := s.repo.Product(tx, businessID, branchID, productID)
		if err != nil {
			return preparedItem{}, notFound(err, "product not found")
		}
		prepared.ProductID = &productID
		prepared.ItemName = product.ProductName
	case "ingredient":
		if err := validateUUID(ingredientID, "ingredient_id"); err != nil {
			return preparedItem{}, err
		}
		ingredient, err := s.repo.IngredientItem(tx, businessID, branchID, ingredientID)
		if err != nil {
			return preparedItem{}, notFound(err, "ingredient not found")
		}
		if ingredient.UnitID != unitID {
			return preparedItem{}, apperrors.BadRequest("unit conversion is not available yet; ingredient unit must match purchase unit", nil)
		}
		prepared.IngredientID = &ingredientID
		prepared.ItemName = ingredient.IngredientName
	case "packaging":
		if err := validateUUID(packagingID, "packaging_item_id"); err != nil {
			return preparedItem{}, err
		}
		packaging, err := s.repo.PackagingItem(tx, businessID, branchID, packagingID)
		if err != nil {
			return preparedItem{}, notFound(err, "packaging item not found")
		}
		prepared.PackagingItemID = &packagingID
		prepared.ItemName = packaging.PackagingName
	}
	return prepared, nil
}

func (s *Service) findOrCreateInventoryItem(tx *gorm.DB, businessID, branchID string, item preparedItem) (*inventory.InventoryItem, error) {
	itemID := item.itemID()
	existing, err := s.inventoryRepo.FindExistingItem(tx, businessID, branchID, item.ItemType, itemID)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	inventoryItem := &inventory.InventoryItem{ID: utils.NewUUID(), BusinessID: businessID, BranchID: branchID, ProductID: item.ProductID, IngredientID: item.IngredientID, PackagingItemID: item.PackagingItemID, ItemType: item.ItemType, UnitID: item.UnitID, CurrentQuantity: 0, ReservedQuantity: 0, AvailableQuantity: 0, ReorderLevel: 0, IsExpiryTracked: true, Status: "active"}
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

func (s *Service) orderResponse(businessID string, order PurchaseOrder, includeItems bool) PurchaseOrderResponse {
	branchName, supplierName := s.repo.NameLookups(businessID, order.BranchID, order.SupplierID)
	response := PurchaseOrderResponse{ID: order.ID, BusinessID: order.BusinessID, BranchID: order.BranchID, BranchName: branchName, SupplierID: order.SupplierID, SupplierName: supplierName, PurchaseOrderNumber: order.PurchaseOrderNumber, OrderDate: order.OrderDate, ExpectedDeliveryDate: order.ExpectedDeliveryDate, Status: order.Status, SubtotalAmount: roundMoney(order.SubtotalAmount), TaxAmount: roundMoney(order.TaxAmount), DiscountAmount: roundMoney(order.DiscountAmount), TotalAmount: roundMoney(order.TotalAmount), Notes: order.Notes, CreatedAt: order.CreatedAt, UpdatedAt: order.UpdatedAt}
	if includeItems {
		items, _ := s.repo.OrderItems(order.ID, businessID)
		for _, item := range items {
			response.Items = append(response.Items, PurchaseOrderItemResponse{ID: item.ID, ItemType: item.ItemType, ProductID: item.ProductID, IngredientID: item.IngredientID, PackagingItemID: item.PackagingItemID, ItemNameSnapshot: item.ItemNameSnapshot, QuantityOrdered: roundQuantity(item.QuantityOrdered), QuantityReceived: roundQuantity(item.QuantityReceived), UnitID: item.UnitID, UnitSymbol: s.repo.UnitSymbol(item.UnitID), UnitCost: roundMoney(item.UnitCost), DiscountAmount: roundMoney(item.DiscountAmount), TaxRateID: item.TaxRateID, TaxAmount: roundMoney(item.TaxAmount), LineTotal: roundMoney(item.LineTotal)})
		}
	}
	return response
}

func (s *Service) invoiceResponse(businessID string, invoice PurchaseInvoice, includeItems bool) PurchaseInvoiceResponse {
	branchName, supplierName := s.repo.NameLookups(businessID, invoice.BranchID, invoice.SupplierID)
	response := PurchaseInvoiceResponse{ID: invoice.ID, BusinessID: invoice.BusinessID, BranchID: invoice.BranchID, BranchName: branchName, SupplierID: invoice.SupplierID, SupplierName: supplierName, PurchaseOrderID: invoice.PurchaseOrderID, InvoiceNumber: invoice.InvoiceNumber, InvoiceDate: invoice.InvoiceDate, DueDate: invoice.DueDate, Status: invoice.Status, PaymentStatus: invoice.PaymentStatus, SubtotalAmount: roundMoney(invoice.SubtotalAmount), TaxAmount: roundMoney(invoice.TaxAmount), DiscountAmount: roundMoney(invoice.DiscountAmount), TotalAmount: roundMoney(invoice.TotalAmount), PaidAmount: roundMoney(invoice.PaidAmount), BalanceAmount: roundMoney(invoice.BalanceAmount), Notes: invoice.Notes, CreatedAt: invoice.CreatedAt, UpdatedAt: invoice.UpdatedAt}
	if includeItems {
		items, _ := s.repo.InvoiceItems(invoice.ID, businessID)
		for _, item := range items {
			response.Items = append(response.Items, PurchaseInvoiceItemResponse{ID: item.ID, ItemType: item.ItemType, ProductID: item.ProductID, IngredientID: item.IngredientID, PackagingItemID: item.PackagingItemID, ItemNameSnapshot: item.ItemNameSnapshot, Quantity: roundQuantity(item.Quantity), UnitID: item.UnitID, UnitSymbol: s.repo.UnitSymbol(item.UnitID), UnitCost: roundMoney(item.UnitCost), DiscountAmount: roundMoney(item.DiscountAmount), TaxRateID: item.TaxRateID, TaxAmount: roundMoney(item.TaxAmount), LineTotal: roundMoney(item.LineTotal), ExpiryDate: item.ExpiryDate, BatchNumber: item.BatchNumber})
		}
		payments, _ := s.repo.ListInvoicePayments(businessID, invoice.ID)
		for i := range payments {
			payments[i].Amount = roundMoney(payments[i].Amount)
		}
		response.Payments = payments
	}
	return response
}

func (s *Service) receiptResponse(businessID string, receipt PurchaseReceipt, includeItems bool) PurchaseReceiptResponse {
	branchName, supplierName := s.repo.NameLookups(businessID, receipt.BranchID, receipt.SupplierID)
	response := PurchaseReceiptResponse{ID: receipt.ID, BusinessID: receipt.BusinessID, BranchID: receipt.BranchID, BranchName: branchName, SupplierID: receipt.SupplierID, SupplierName: supplierName, PurchaseOrderID: receipt.PurchaseOrderID, PurchaseInvoiceID: receipt.PurchaseInvoiceID, ReceiptNumber: receipt.ReceiptNumber, ReceivedDate: receipt.ReceivedDate, Status: receipt.Status, ReceivedByUserID: receipt.ReceivedByUserID, Notes: receipt.Notes, CreatedAt: receipt.CreatedAt, UpdatedAt: receipt.UpdatedAt}
	if includeItems {
		items, _ := s.repo.ReceiptItems(receipt.ID, businessID)
		for _, item := range items {
			response.Items = append(response.Items, PurchaseReceiptItemResponse{ID: item.ID, ItemType: item.ItemType, ProductID: item.ProductID, IngredientID: item.IngredientID, PackagingItemID: item.PackagingItemID, InventoryItemID: item.InventoryItemID, QuantityReceived: roundQuantity(item.QuantityReceived), UnitID: item.UnitID, UnitSymbol: s.repo.UnitSymbol(item.UnitID), ExpiryDate: item.ExpiryDate, BatchNumber: item.BatchNumber, StockMovementID: item.StockMovementID})
		}
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
	return value == "product" || value == "ingredient" || value == "packaging"
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

func notFound(err error, message string) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apperrors.NotFound(message)
	}
	return err
}

func invoiceInputsFromItems(items []PurchaseInvoiceItem) []PurchaseInvoiceItemInput {
	result := make([]PurchaseInvoiceItemInput, 0, len(items))
	for _, item := range items {
		result = append(result, PurchaseInvoiceItemInput{ItemType: item.ItemType, ProductID: deref(item.ProductID), IngredientID: deref(item.IngredientID), PackagingItemID: deref(item.PackagingItemID), Quantity: item.Quantity, UnitID: item.UnitID, UnitCost: item.UnitCost, DiscountAmount: item.DiscountAmount, TaxRateID: deref(item.TaxRateID), ExpiryDate: optionalDateString(item.ExpiryDate), BatchNumber: item.BatchNumber})
	}
	return result
}
