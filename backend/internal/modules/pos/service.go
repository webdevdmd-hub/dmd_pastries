package pos

import (
	"fmt"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/inventory"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db               *gorm.DB
	repo             *Repository
	inventoryService *inventory.Service
	auditRepo        *audit.Repository
}

func NewService(db *gorm.DB, repo *Repository, inventoryService *inventory.Service, auditRepo *audit.Repository) *Service {
	return &Service{db: db, repo: repo, inventoryService: inventoryService, auditRepo: auditRepo}
}

func (s *Service) ListPOSProducts(currentUser *utils.AuthContext, query POSProductQuery) (*PaginatedResponse[POSProductResponse], error) {
	query.Page, query.Limit = normalizePagination(query.Page, query.Limit)
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	rows, total, err := s.repo.ListPOSProducts(currentUser.BusinessID, branchID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list POS products")
	}
	productIDs := make([]string, 0, len(rows))
	for _, row := range rows {
		productIDs = append(productIDs, row.ID)
	}
	variants, err := s.repo.LoadActiveVariants(currentUser.BusinessID, productIDs)
	if err != nil {
		return nil, apperrors.Internal("failed to load product variants")
	}
	items := make([]POSProductResponse, 0, len(rows))
	for _, row := range rows {
		item := toPOSProduct(row)
		item.Variants = variants[row.ID]
		items = append(items, item)
	}
	return &PaginatedResponse[POSProductResponse]{
		Items: items,
		Pagination: PaginationResponse{
			Page:       query.Page,
			Limit:      query.Limit,
			Total:      total,
			TotalPages: totalPages(total, query.Limit),
		},
	}, nil
}

func (s *Service) LookupProduct(currentUser *utils.AuthContext, barcode, sku, productCode string) (*POSLookupResponse, error) {
	field, value, matchedBy := lookupField(barcode, sku, productCode)
	if value == "" {
		return nil, apperrors.BadRequest("barcode, sku, or product_code is required", nil)
	}
	branchID, err := currentUser.ResolveOperationalBranch("")
	if err != nil {
		return nil, err
	}
	product, variant, err := s.repo.LookupProduct(currentUser.BusinessID, branchID, field, value)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("product not found")
		}
		return nil, apperrors.Internal("failed to lookup product")
	}
	response := toPOSProduct(*product)
	var matchedVariant *POSVariantResponse
	if variant != nil {
		v := toPOSVariant(*variant)
		matchedVariant = &v
	}
	return &POSLookupResponse{Product: response, Variant: matchedVariant, MatchedBy: matchedBy}, nil
}

func (s *Service) Checkout(currentUser *utils.AuthContext, req CheckoutRequest, ipAddress, userAgent string) (*SaleResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return nil, err
	}
	req.BranchID = branchID
	if err := validateCheckoutRequest(req); err != nil {
		return nil, err
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	defer rollbackIfOpen(tx)

	if ok, err := s.repo.BranchExists(tx, currentUser.BusinessID, req.BranchID); err != nil {
		return nil, apperrors.Internal("failed to validate branch")
	} else if !ok {
		return nil, apperrors.BadRequest("invalid branch_id", nil)
	}
	if req.CustomerID != nil && strings.TrimSpace(*req.CustomerID) != "" {
		if ok, err := s.repo.CustomerExists(tx, currentUser.BusinessID, req.BranchID, *req.CustomerID); err != nil {
			return nil, apperrors.Internal("failed to validate customer")
		} else if !ok {
			return nil, apperrors.BadRequest("invalid customer_id", nil)
		}
	}

	calculation, err := s.calculateSale(tx, currentUser.BusinessID, req.BranchID, req)
	if err != nil {
		return nil, err
	}
	if len(req.Payments) == 0 && calculation.TotalAmount > 0 {
		return nil, apperrors.BadRequest("payments are required", nil)
	}
	payments, paidAmount, cashPaidAmount, err := s.buildPayments(tx, currentUser.BusinessID, req.BranchID, currentUser.UserID, req.Payments)
	if err != nil {
		return nil, err
	}
	overpayAmount := roundMoney(paidAmount - calculation.TotalAmount)
	if overpayAmount > 0 && cashPaidAmount+0.0001 < overpayAmount {
		return nil, apperrors.BadRequest("non-cash overpayment is not allowed", nil)
	}

	now := time.Now().UTC()
	saleNumber, err := s.repo.GenerateSaleNumber(tx, currentUser.BusinessID, now)
	if err != nil {
		return nil, apperrors.Internal("failed to generate sale number")
	}

	changeAmount := 0.0
	if overpayAmount > 0 {
		changeAmount = overpayAmount
	}
	sale := &Sale{
		ID:             utils.NewUUID(),
		BusinessID:     currentUser.BusinessID,
		BranchID:       req.BranchID,
		CashierUserID:  currentUser.UserID,
		CustomerID:     cleanStringPointer(req.CustomerID),
		SaleNumber:     saleNumber,
		SubtotalAmount: calculation.SubtotalAmount,
		DiscountType:   cleanStringPointer(req.SaleDiscountType),
		DiscountValue:  roundMoney(req.SaleDiscountValue),
		DiscountAmount: calculation.DiscountAmount,
		TaxableAmount:  calculation.TaxableAmount,
		TaxAmount:      calculation.TaxAmount,
		TotalAmount:    calculation.TotalAmount,
		PaidAmount:     roundMoney(paidAmount),
		ChangeAmount:   changeAmount,
		PaymentStatus:  paymentStatus(paidAmount, calculation.TotalAmount),
		SaleStatus:     "completed",
		Notes:          strings.TrimSpace(req.Notes),
		SoldAt:         now,
	}

	for i := range calculation.Items {
		calculation.Items[i].SaleID = sale.ID
	}
	for i := range payments {
		payments[i].SaleID = sale.ID
	}

	if err := s.repo.CreateSale(tx, sale, calculation.Items, payments); err != nil {
		return nil, apperrors.Internal("failed to create sale")
	}
	if err := s.deductInventoryForSale(tx, currentUser, sale, calculation.Items); err != nil {
		return nil, err
	}
	if err := s.writeAudit(tx, currentUser, "sale.created", sale.ID, "Sale completed.", ipAddress, userAgent); err != nil {
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit checkout")
	}
	tx = nil

	response, err := s.repo.LoadSaleDetails(currentUser.BusinessID, sale.ID)
	if err != nil {
		return nil, apperrors.Internal("failed to load sale")
	}
	receipt, err := s.repo.LoadReceipt(*sale)
	if err == nil {
		response.Receipt = receipt
	}
	return response, nil
}

func (s *Service) CreateHeldSale(currentUser *utils.AuthContext, req HoldSaleRequest, ipAddress, userAgent string) (*HeldSaleResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return nil, err
	}
	req.BranchID = branchID
	if err := validateHoldSaleRequest(req); err != nil {
		return nil, err
	}
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	defer rollbackIfOpen(tx)

	if ok, err := s.repo.BranchExists(tx, currentUser.BusinessID, req.BranchID); err != nil {
		return nil, apperrors.Internal("failed to validate branch")
	} else if !ok {
		return nil, apperrors.BadRequest("invalid branch_id", nil)
	}
	if req.CustomerID != nil && strings.TrimSpace(*req.CustomerID) != "" {
		if ok, err := s.repo.CustomerExists(tx, currentUser.BusinessID, req.BranchID, *req.CustomerID); err != nil {
			return nil, apperrors.Internal("failed to validate customer")
		} else if !ok {
			return nil, apperrors.BadRequest("invalid customer_id", nil)
		}
	}

	calculation, err := s.calculateHeldSale(tx, currentUser.BusinessID, req.BranchID, req)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	holdNumber, err := s.repo.GenerateHoldNumber(tx, currentUser.BusinessID, now)
	if err != nil {
		return nil, apperrors.Internal("failed to generate hold number")
	}
	heldSale := &HeldSale{
		ID:                      utils.NewUUID(),
		BusinessID:              currentUser.BusinessID,
		BranchID:                req.BranchID,
		CashierUserID:           currentUser.UserID,
		CustomerID:              cleanStringPointer(req.CustomerID),
		HoldNumber:              holdNumber,
		ItemCount:               len(calculation.Items),
		EstimatedSubtotal:       calculation.SubtotalAmount,
		EstimatedDiscountAmount: calculation.DiscountAmount,
		EstimatedTaxAmount:      calculation.TaxAmount,
		EstimatedTotal:          calculation.TotalAmount,
		Status:                  "held",
		Notes:                   strings.TrimSpace(req.Notes),
		HeldAt:                  now,
		ExpiresAt:               req.ExpiresAt,
	}
	for i := range calculation.Items {
		calculation.Items[i].HeldSaleID = heldSale.ID
	}
	if err := s.repo.CreateHeldSale(tx, heldSale, calculation.Items); err != nil {
		return nil, apperrors.Internal("failed to hold sale")
	}
	if err := s.writeAudit(tx, currentUser, "held_sale.created", heldSale.ID, "Held sale created.", ipAddress, userAgent); err != nil {
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit held sale")
	}
	tx = nil
	return s.repo.LoadHeldSaleDetails(currentUser.BusinessID, heldSale.ID)
}

func (s *Service) ListHeldSales(currentUser *utils.AuthContext, query HeldSalesListQuery) (*PaginatedResponse[HeldSaleResponse], error) {
	query.Page, query.Limit = normalizePagination(query.Page, query.Limit)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		query.BranchID = branchID
	} else {
		query.BranchID = ""
	}
	if query.Status == "" {
		query.Status = "held"
	}
	if !validHeldSaleStatus(query.Status) {
		return nil, apperrors.BadRequest("invalid held sale status", nil)
	}
	items, total, err := s.repo.ListHeldSales(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list held sales")
	}
	return &PaginatedResponse[HeldSaleResponse]{
		Items: items,
		Pagination: PaginationResponse{
			Page:       query.Page,
			Limit:      query.Limit,
			Total:      total,
			TotalPages: totalPages(total, query.Limit),
		},
	}, nil
}

func (s *Service) GetHeldSale(currentUser *utils.AuthContext, id string) (*HeldSaleResponse, error) {
	heldSale, err := s.repo.LoadHeldSaleDetails(currentUser.BusinessID, id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("held sale not found")
		}
		return nil, apperrors.Internal("failed to load held sale")
	}
	if !currentUser.CanAccessBranch(heldSale.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	return heldSale, nil
}

func (s *Service) ResumeHeldSale(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*ResumeHeldSaleResponse, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	defer rollbackIfOpen(tx)
	heldSale, err := s.repo.FindHeldSale(tx, currentUser.BusinessID, id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("held sale not found")
		}
		return nil, apperrors.Internal("failed to load held sale")
	}
	if heldSale.Status != "held" {
		return nil, apperrors.BadRequest("only held sales can be resumed", nil)
	}
	if !currentUser.CanAccessBranch(heldSale.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	now := time.Now().UTC()
	if err := s.repo.UpdateHeldSale(tx, currentUser.BusinessID, id, map[string]interface{}{
		"status":     "resumed",
		"resumed_at": now,
		"updated_at": now,
	}); err != nil {
		return nil, apperrors.Internal("failed to resume held sale")
	}
	if err := s.writeAudit(tx, currentUser, "held_sale.resumed", id, "Held sale resumed.", ipAddress, userAgent); err != nil {
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit held sale resume")
	}
	tx = nil
	response, err := s.repo.LoadHeldSaleDetails(currentUser.BusinessID, id)
	if err != nil {
		return nil, apperrors.Internal("failed to load held sale")
	}
	return &ResumeHeldSaleResponse{HeldSale: *response, Cart: heldSaleToCart(*response)}, nil
}

func (s *Service) CancelHeldSale(currentUser *utils.AuthContext, id, ipAddress, userAgent string) error {
	tx := s.db.Begin()
	if tx.Error != nil {
		return apperrors.Internal("failed to start transaction")
	}
	defer rollbackIfOpen(tx)
	heldSale, err := s.repo.FindHeldSale(tx, currentUser.BusinessID, id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("held sale not found")
		}
		return apperrors.Internal("failed to load held sale")
	}
	if heldSale.Status != "held" {
		return apperrors.BadRequest("only held sales can be cancelled", nil)
	}
	if !currentUser.CanAccessBranch(heldSale.BranchID) {
		return apperrors.Forbidden("branch access denied")
	}
	now := time.Now().UTC()
	if err := s.repo.UpdateHeldSale(tx, currentUser.BusinessID, id, map[string]interface{}{
		"status":       "cancelled",
		"cancelled_at": now,
		"updated_at":   now,
	}); err != nil {
		return apperrors.Internal("failed to cancel held sale")
	}
	if err := s.writeAudit(tx, currentUser, "held_sale.cancelled", id, "Held sale cancelled.", ipAddress, userAgent); err != nil {
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return apperrors.Internal("failed to commit held sale cancel")
	}
	tx = nil
	return nil
}

func (s *Service) ListSales(currentUser *utils.AuthContext, query SalesListQuery) (*PaginatedResponse[SaleSummaryResponse], error) {
	query.Page, query.Limit = normalizePagination(query.Page, query.Limit)
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		query.BranchID = branchID
	} else {
		query.BranchID = ""
	}
	if err := validateSalesQuery(query); err != nil {
		return nil, err
	}
	items, total, err := s.repo.ListSales(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list sales")
	}
	return &PaginatedResponse[SaleSummaryResponse]{
		Items: items,
		Pagination: PaginationResponse{
			Page:       query.Page,
			Limit:      query.Limit,
			Total:      total,
			TotalPages: totalPages(total, query.Limit),
		},
	}, nil
}

func (s *Service) GetSale(currentUser *utils.AuthContext, saleID string) (*SaleResponse, error) {
	response, err := s.repo.LoadSaleDetails(currentUser.BusinessID, saleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("sale not found")
		}
		return nil, apperrors.Internal("failed to load sale")
	}
	if !currentUser.CanAccessBranch(response.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	return response, nil
}

func (s *Service) GetReceipt(currentUser *utils.AuthContext, saleID string, ipAddress, userAgent string) (*ReceiptReadyResponse, error) {
	sale, err := s.repo.FindSaleByID(s.db, currentUser.BusinessID, saleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("sale not found")
		}
		return nil, apperrors.Internal("failed to load sale")
	}
	if !currentUser.CanAccessBranch(sale.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	receipt, err := s.repo.LoadReceipt(*sale)
	if err != nil {
		return nil, apperrors.Internal("failed to load receipt")
	}
	_ = s.auditRepo.CreateActivity(s.db, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   "sale.receipt_viewed",
		EntityType:  "sale",
		EntityID:    sale.ID,
		Summary:     "Sale receipt viewed.",
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	})
	return receipt, nil
}

func (s *Service) RefundSale(currentUser *utils.AuthContext, saleID string, req RefundRequest, ipAddress, userAgent string) (*SaleResponse, error) {
	if strings.TrimSpace(req.Reason) == "" {
		return nil, apperrors.BadRequest("reason is required", nil)
	}
	if req.RefundAmount <= 0 {
		return nil, apperrors.BadRequest("refund_amount must be > 0", nil)
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	defer rollbackIfOpen(tx)

	sale, err := s.repo.FindSaleByID(tx, currentUser.BusinessID, saleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("sale not found")
		}
		return nil, apperrors.Internal("failed to load sale")
	}
	if sale.SaleStatus != "completed" && sale.SaleStatus != "partially_refunded" {
		return nil, apperrors.BadRequest("sale cannot be refunded", nil)
	}
	if !currentUser.CanAccessBranch(sale.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	refunded, err := s.repo.SumRefunds(tx, currentUser.BusinessID, saleID)
	if err != nil {
		return nil, apperrors.Internal("failed to validate refund amount")
	}
	remaining := roundMoney(sale.TotalAmount - refunded)
	if req.RefundAmount > remaining {
		return nil, apperrors.BadRequest("refund_amount exceeds refundable amount", nil)
	}

	now := time.Now().UTC()
	refundNumber, err := s.repo.GenerateRefundNumber(tx, currentUser.BusinessID, now)
	if err != nil {
		return nil, apperrors.Internal("failed to generate refund number")
	}
	refund := &SaleRefund{
		ID:               utils.NewUUID(),
		BusinessID:       currentUser.BusinessID,
		SaleID:           sale.ID,
		RefundNumber:     refundNumber,
		RefundAmount:     roundMoney(req.RefundAmount),
		Reason:           strings.TrimSpace(req.Reason),
		ApprovedByUserID: cleanStringPointer(req.ApprovedByUserID),
		CreatedByUserID:  currentUser.UserID,
	}
	newRefunded := roundMoney(refunded + req.RefundAmount)
	newSaleStatus := "partially_refunded"
	if newRefunded >= sale.TotalAmount {
		newSaleStatus = "refunded"
	}
	if err := s.repo.CreateRefund(tx, refund); err != nil {
		return nil, apperrors.Internal("failed to create refund")
	}
	if err := s.repo.UpdateSale(tx, currentUser.BusinessID, sale.ID, map[string]interface{}{
		"sale_status":    newSaleStatus,
		"payment_status": "refunded",
		"updated_at":     now,
	}); err != nil {
		return nil, apperrors.Internal("failed to update sale")
	}
	if err := s.writeAudit(tx, currentUser, "sale.refunded", sale.ID, "Sale refunded.", ipAddress, userAgent); err != nil {
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit refund")
	}
	tx = nil
	return s.GetSale(currentUser, sale.ID)
}

func (s *Service) VoidSale(currentUser *utils.AuthContext, saleID string, req VoidRequest, ipAddress, userAgent string) (*SaleResponse, error) {
	if strings.TrimSpace(req.Reason) == "" {
		return nil, apperrors.BadRequest("reason is required", nil)
	}
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	defer rollbackIfOpen(tx)

	sale, err := s.repo.FindSaleByID(tx, currentUser.BusinessID, saleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("sale not found")
		}
		return nil, apperrors.Internal("failed to load sale")
	}
	if sale.SaleStatus != "completed" {
		return nil, apperrors.BadRequest("only completed sales can be voided", nil)
	}
	if !currentUser.CanAccessBranch(sale.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	saleVoid := &SaleVoid{
		ID:              utils.NewUUID(),
		BusinessID:      currentUser.BusinessID,
		SaleID:          sale.ID,
		Reason:          strings.TrimSpace(req.Reason),
		CreatedByUserID: currentUser.UserID,
	}
	if err := s.repo.CreateVoid(tx, saleVoid); err != nil {
		return nil, apperrors.Internal("failed to create void")
	}
	if err := s.repo.UpdateSale(tx, currentUser.BusinessID, sale.ID, map[string]interface{}{
		"sale_status": "voided",
		"updated_at":  time.Now().UTC(),
	}); err != nil {
		return nil, apperrors.Internal("failed to update sale")
	}
	items, err := s.repo.SaleItems(tx, currentUser.BusinessID, sale.ID)
	if err != nil {
		return nil, apperrors.Internal("failed to load sale items")
	}
	if err := s.returnInventoryForVoidedSale(tx, currentUser, sale, items, req.Reason); err != nil {
		return nil, err
	}
	if err := s.writeAudit(tx, currentUser, "sale.voided", sale.ID, "Sale voided.", ipAddress, userAgent); err != nil {
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit void")
	}
	tx = nil
	return s.GetSale(currentUser, sale.ID)
}

func (s *Service) deductInventoryForSale(tx *gorm.DB, currentUser *utils.AuthContext, sale *Sale, items []SaleItem) error {
	quantities := aggregateSaleItemQuantities(items)
	for productID, quantity := range quantities {
		stock, err := s.repo.FindProductInventoryForSale(tx, sale.BusinessID, sale.BranchID, productID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return apperrors.BadRequest("invalid product on sale", nil)
			}
			return apperrors.Internal("failed to validate product inventory")
		}
		if !stock.IsStockTracked {
			continue
		}
		if stock.InventoryItemID == nil || strings.TrimSpace(*stock.InventoryItemID) == "" {
			return apperrors.BadRequest("inventory item not found for stock-tracked product "+stock.ProductName, nil)
		}
		if quantity > stock.AvailableQuantity+0.0001 {
			return apperrors.BadRequest(fmt.Sprintf("insufficient stock for %s. Required %.4f, available %.4f", stock.ProductName, quantity, stock.AvailableQuantity), nil)
		}
		if _, err := s.inventoryService.ApplyMovement(tx, inventory.ApplyStockMovementInput{
			BusinessID:      sale.BusinessID,
			InventoryItemID: *stock.InventoryItemID,
			MovementType:    "sale_out",
			Quantity:        quantity,
			ReferenceType:   "sale",
			ReferenceID:     &sale.ID,
			ReferenceNumber: sale.SaleNumber,
			Reason:          "POS sale checkout",
			CreatedByUserID: currentUser.UserID,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) returnInventoryForVoidedSale(tx *gorm.DB, currentUser *utils.AuthContext, sale *Sale, items []SaleItem, reason string) error {
	quantities := aggregateSaleItemQuantities(items)
	for productID, quantity := range quantities {
		stock, err := s.repo.FindProductInventoryForSale(tx, sale.BusinessID, sale.BranchID, productID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return apperrors.BadRequest("invalid product on sale", nil)
			}
			return apperrors.Internal("failed to validate product inventory")
		}
		if !stock.IsStockTracked {
			continue
		}
		if stock.InventoryItemID == nil || strings.TrimSpace(*stock.InventoryItemID) == "" {
			return apperrors.BadRequest("inventory item not found for stock-tracked product "+stock.ProductName, nil)
		}
		if _, err := s.inventoryService.ApplyMovement(tx, inventory.ApplyStockMovementInput{
			BusinessID:      sale.BusinessID,
			InventoryItemID: *stock.InventoryItemID,
			MovementType:    "return_in",
			Quantity:        quantity,
			ReferenceType:   "sale_void",
			ReferenceID:     &sale.ID,
			ReferenceNumber: sale.SaleNumber,
			Reason:          strings.TrimSpace(reason),
			CreatedByUserID: currentUser.UserID,
		}); err != nil {
			return err
		}
	}
	return nil
}

func aggregateSaleItemQuantities(items []SaleItem) map[string]float64 {
	quantities := make(map[string]float64)
	for _, item := range items {
		quantities[item.ProductID] += item.Quantity
	}
	return quantities
}

type saleCalculation struct {
	Items          []SaleItem
	SubtotalAmount float64
	DiscountAmount float64
	TaxableAmount  float64
	TaxAmount      float64
	TotalAmount    float64
}

type heldSaleCalculation struct {
	Items          []HeldSaleItem
	SubtotalAmount float64
	DiscountAmount float64
	TaxAmount      float64
	TotalAmount    float64
}

func (s *Service) calculateSale(tx *gorm.DB, businessID, branchID string, req CheckoutRequest) (*saleCalculation, error) {
	items := make([]SaleItem, 0, len(req.Items))
	subtotal := 0.0
	lineNets := make([]float64, 0, len(req.Items))
	lineTaxInclusive := make([]bool, 0, len(req.Items))

	for _, reqItem := range req.Items {
		product, err := s.repo.FindPOSProductByID(tx, businessID, branchID, reqItem.ProductID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, apperrors.BadRequest("invalid or inactive product_id", nil)
			}
			return nil, apperrors.Internal("failed to validate product")
		}
		unitPrice := product.SalePrice
		var variantName, sku string
		var variantID *string
		if reqItem.ProductVariantID != nil && strings.TrimSpace(*reqItem.ProductVariantID) != "" {
			variant, err := s.repo.FindVariantByID(tx, businessID, branchID, product.ID, *reqItem.ProductVariantID)
			if err != nil {
				if err == gorm.ErrRecordNotFound {
					return nil, apperrors.BadRequest("invalid product_variant_id", nil)
				}
				return nil, apperrors.Internal("failed to validate variant")
			}
			unitPrice = variant.SalePrice
			variantName = variant.VariantName
			sku = variant.SKU
			variantID = &variant.ID
		} else {
			sku = product.SKU
		}

		lineSubtotal := roundMoney(reqItem.Quantity * unitPrice)
		lineDiscount, err := calculateDiscount(reqItem.DiscountType, reqItem.DiscountValue, lineSubtotal)
		if err != nil {
			return nil, err
		}
		lineNet := roundMoney(lineSubtotal - lineDiscount)
		subtotal += lineSubtotal
		lineNets = append(lineNets, lineNet)
		lineTaxInclusive = append(lineTaxInclusive, product.IsInclusive)
		items = append(items, SaleItem{
			ID:                        utils.NewUUID(),
			BusinessID:                businessID,
			ProductID:                 product.ID,
			ProductVariantID:          variantID,
			ProductNameSnapshot:       product.ProductName,
			VariantNameSnapshot:       variantName,
			SKUSnapshot:               sku,
			Quantity:                  reqItem.Quantity,
			UnitPrice:                 roundMoney(unitPrice),
			DiscountAmount:            lineDiscount,
			TaxRateID:                 product.TaxRateID,
			TaxRateNameSnapshot:       product.TaxName,
			TaxRatePercentageSnapshot: product.RatePercentage,
			LineSubtotal:              lineSubtotal,
		})
	}

	subtotal = roundMoney(subtotal)
	lineNetTotal := sum(lineNets)
	saleDiscount, err := calculateDiscount(req.SaleDiscountType, req.SaleDiscountValue, lineNetTotal)
	if err != nil {
		return nil, err
	}

	taxableAmount := 0.0
	taxAmount := 0.0
	totalAmount := 0.0
	for i := range items {
		allocatedSaleDiscount := proportionalAmount(saleDiscount, lineNets[i], lineNetTotal)
		items[i].DiscountAmount = roundMoney(items[i].DiscountAmount + allocatedSaleDiscount)
		discountedLine := roundMoney(items[i].LineSubtotal - items[i].DiscountAmount)
		lineTax := calculateTax(discountedLine, items[i].TaxRatePercentageSnapshot, lineTaxInclusive[i])
		items[i].TaxAmount = lineTax
		if lineTaxInclusive[i] {
			items[i].LineTotal = discountedLine
			taxableAmount += roundMoney(discountedLine - lineTax)
			totalAmount += discountedLine
		} else {
			items[i].LineTotal = roundMoney(discountedLine + lineTax)
			taxableAmount += discountedLine
			totalAmount += items[i].LineTotal
		}
		taxAmount += lineTax
	}

	return &saleCalculation{
		Items:          items,
		SubtotalAmount: subtotal,
		DiscountAmount: roundMoney(sumDiscounts(items)),
		TaxableAmount:  roundMoney(taxableAmount),
		TaxAmount:      roundMoney(taxAmount),
		TotalAmount:    roundMoney(totalAmount),
	}, nil
}

func (s *Service) calculateHeldSale(tx *gorm.DB, businessID, branchID string, req HoldSaleRequest) (*heldSaleCalculation, error) {
	items := make([]HeldSaleItem, 0, len(req.Items))
	subtotal := 0.0
	lineNets := make([]float64, 0, len(req.Items))
	lineTaxInclusive := make([]bool, 0, len(req.Items))

	for index, reqItem := range req.Items {
		product, err := s.repo.FindPOSProductByID(tx, businessID, branchID, reqItem.ProductID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, apperrors.BadRequest("invalid or inactive product_id", nil)
			}
			return nil, apperrors.Internal("failed to validate product")
		}
		unitPrice := product.SalePrice
		var variantName, sku string
		var variantID *string
		if reqItem.ProductVariantID != nil && strings.TrimSpace(*reqItem.ProductVariantID) != "" {
			variant, err := s.repo.FindVariantByID(tx, businessID, branchID, product.ID, *reqItem.ProductVariantID)
			if err != nil {
				if err == gorm.ErrRecordNotFound {
					return nil, apperrors.BadRequest("invalid product_variant_id", nil)
				}
				return nil, apperrors.Internal("failed to validate variant")
			}
			unitPrice = variant.SalePrice
			variantName = variant.VariantName
			sku = variant.SKU
			variantID = &variant.ID
		} else {
			sku = product.SKU
		}
		lineSubtotal := roundMoney(reqItem.Quantity * unitPrice)
		lineDiscount, err := calculateDiscount(reqItem.DiscountType, reqItem.DiscountValue, lineSubtotal)
		if err != nil {
			return nil, err
		}
		lineNet := roundMoney(lineSubtotal - lineDiscount)
		subtotal += lineSubtotal
		lineNets = append(lineNets, lineNet)
		lineTaxInclusive = append(lineTaxInclusive, product.IsInclusive)
		items = append(items, HeldSaleItem{
			ID:                        utils.NewUUID(),
			BusinessID:                businessID,
			ProductID:                 product.ID,
			ProductVariantID:          variantID,
			ProductNameSnapshot:       product.ProductName,
			VariantNameSnapshot:       variantName,
			SKUSnapshot:               sku,
			Quantity:                  reqItem.Quantity,
			UnitPrice:                 roundMoney(unitPrice),
			DiscountType:              cleanStringPointer(reqItem.DiscountType),
			DiscountValue:             roundMoney(reqItem.DiscountValue),
			DiscountAmount:            lineDiscount,
			TaxRateID:                 product.TaxRateID,
			TaxRateNameSnapshot:       product.TaxName,
			TaxRatePercentageSnapshot: product.RatePercentage,
			LineSubtotal:              lineSubtotal,
			SortOrder:                 index,
		})
	}

	lineNetTotal := sum(lineNets)
	saleDiscount, err := calculateDiscount(req.SaleDiscountType, req.SaleDiscountValue, lineNetTotal)
	if err != nil {
		return nil, err
	}

	taxAmount := 0.0
	totalAmount := 0.0
	for i := range items {
		allocatedSaleDiscount := proportionalAmount(saleDiscount, lineNets[i], lineNetTotal)
		items[i].DiscountAmount = roundMoney(items[i].DiscountAmount + allocatedSaleDiscount)
		discountedLine := roundMoney(items[i].LineSubtotal - items[i].DiscountAmount)
		lineTax := calculateTax(discountedLine, items[i].TaxRatePercentageSnapshot, lineTaxInclusive[i])
		items[i].TaxAmount = lineTax
		if lineTaxInclusive[i] {
			items[i].LineTotal = discountedLine
			totalAmount += discountedLine
		} else {
			items[i].LineTotal = roundMoney(discountedLine + lineTax)
			totalAmount += items[i].LineTotal
		}
		taxAmount += lineTax
	}

	return &heldSaleCalculation{
		Items:          items,
		SubtotalAmount: roundMoney(subtotal),
		DiscountAmount: roundMoney(sumHeldDiscounts(items)),
		TaxAmount:      roundMoney(taxAmount),
		TotalAmount:    roundMoney(totalAmount),
	}, nil
}

func (s *Service) buildPayments(tx *gorm.DB, businessID, branchID, paidByUserID string, reqPayments []CheckoutPaymentRequest) ([]SalePayment, float64, float64, error) {
	payments := make([]SalePayment, 0, len(reqPayments))
	total := 0.0
	cashTotal := 0.0
	now := time.Now().UTC()
	for _, reqPayment := range reqPayments {
		if reqPayment.Amount <= 0 {
			return nil, 0, 0, apperrors.BadRequest("payment amount must be > 0", nil)
		}
		method, err := s.repo.FindPaymentMethod(tx, businessID, reqPayment.PaymentMethodID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, 0, 0, apperrors.BadRequest("invalid payment_method_id", nil)
			}
			return nil, 0, 0, apperrors.Internal("failed to validate payment method")
		}
		if method.RequiresReference && strings.TrimSpace(reqPayment.ReferenceNumber) == "" {
			return nil, 0, 0, apperrors.BadRequest("reference_number is required for this payment method", nil)
		}
		amount := roundMoney(reqPayment.Amount)
		total += amount
		if method.MethodType == "cash" {
			cashTotal += amount
		}
		payments = append(payments, SalePayment{
			ID:                        utils.NewUUID(),
			BusinessID:                businessID,
			BranchID:                  branchID,
			PaymentMethodID:           method.ID,
			PaymentMethodNameSnapshot: method.MethodName,
			PaymentMethodTypeSnapshot: method.MethodType,
			Amount:                    amount,
			ReferenceNumber:           strings.TrimSpace(reqPayment.ReferenceNumber),
			ProviderTransactionID:     strings.TrimSpace(reqPayment.ProviderTransactionID),
			PaymentStatus:             "completed",
			PaidByUserID:              paidByUserID,
			Notes:                     strings.TrimSpace(reqPayment.Notes),
			PaidAt:                    now,
		})
	}
	return payments, roundMoney(total), roundMoney(cashTotal), nil
}

func validateCheckoutRequest(req CheckoutRequest) error {
	if strings.TrimSpace(req.BranchID) == "" {
		return apperrors.BadRequest("branch_id is required", nil)
	}
	if len(req.Items) == 0 {
		return apperrors.BadRequest("items are required", nil)
	}
	if err := validateDiscount(req.SaleDiscountType, req.SaleDiscountValue); err != nil {
		return err
	}
	for _, item := range req.Items {
		if strings.TrimSpace(item.ProductID) == "" {
			return apperrors.BadRequest("product_id is required", nil)
		}
		if item.Quantity <= 0 {
			return apperrors.BadRequest("quantity must be > 0", nil)
		}
		if err := validateDiscount(item.DiscountType, item.DiscountValue); err != nil {
			return err
		}
	}
	return nil
}

func validateHoldSaleRequest(req HoldSaleRequest) error {
	if strings.TrimSpace(req.BranchID) == "" {
		return apperrors.BadRequest("branch_id is required", nil)
	}
	if len(req.Items) == 0 {
		return apperrors.BadRequest("items are required", nil)
	}
	if err := validateDiscount(req.SaleDiscountType, req.SaleDiscountValue); err != nil {
		return err
	}
	for _, item := range req.Items {
		if strings.TrimSpace(item.ProductID) == "" {
			return apperrors.BadRequest("product_id is required", nil)
		}
		if item.Quantity <= 0 {
			return apperrors.BadRequest("quantity must be > 0", nil)
		}
		if err := validateDiscount(item.DiscountType, item.DiscountValue); err != nil {
			return err
		}
	}
	return nil
}

func validateSalesQuery(query SalesListQuery) error {
	if query.SaleStatus != "" {
		switch query.SaleStatus {
		case "completed", "voided", "refunded", "partially_refunded":
		default:
			return apperrors.BadRequest("invalid sale_status", nil)
		}
	}
	if query.PaymentStatus != "" {
		switch query.PaymentStatus {
		case "unpaid", "partial", "paid", "refunded":
		default:
			return apperrors.BadRequest("invalid payment_status", nil)
		}
	}
	return nil
}

func validateDiscount(discountType *string, value float64) error {
	if value < 0 {
		return apperrors.BadRequest("discount_value must be >= 0", nil)
	}
	if discountType == nil || strings.TrimSpace(*discountType) == "" {
		if value > 0 {
			return apperrors.BadRequest("discount_type is required when discount_value is provided", nil)
		}
		return nil
	}
	switch strings.TrimSpace(*discountType) {
	case "percentage":
		if value > 100 {
			return apperrors.BadRequest("percentage discount cannot exceed 100", nil)
		}
	case "fixed":
	default:
		return apperrors.BadRequest("invalid discount_type", nil)
	}
	return nil
}

func calculateDiscount(discountType *string, value, base float64) (float64, error) {
	if err := validateDiscount(discountType, value); err != nil {
		return 0, err
	}
	if discountType == nil || strings.TrimSpace(*discountType) == "" || value == 0 {
		return 0, nil
	}
	var discount float64
	switch strings.TrimSpace(*discountType) {
	case "percentage":
		discount = base * value / 100
	case "fixed":
		discount = value
	}
	if discount > base {
		return 0, apperrors.BadRequest("fixed discount cannot exceed subtotal", nil)
	}
	return roundMoney(discount), nil
}

func calculateTax(amount, rate float64, inclusive bool) float64 {
	if amount <= 0 || rate <= 0 {
		return 0
	}
	if inclusive {
		return roundMoney(amount - (amount / (1 + rate/100)))
	}
	return roundMoney(amount * rate / 100)
}

func paymentStatus(paidAmount, totalAmount float64) string {
	if paidAmount <= 0 {
		return "unpaid"
	}
	if paidAmount+0.0001 >= totalAmount {
		return "paid"
	}
	return "partial"
}

func (s *Service) writeAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, saleID, summary, ipAddress, userAgent string) error {
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "sale",
		EntityID:    saleID,
		Summary:     summary,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

func toPOSProduct(row ProductRow) POSProductResponse {
	var taxRate *TaxRateInfo
	if row.TaxRateID != nil {
		taxRate = &TaxRateInfo{
			ID:             *row.TaxRateID,
			TaxName:        row.TaxName,
			TaxType:        row.TaxType,
			RatePercentage: row.RatePercentage,
			IsInclusive:    row.IsInclusive,
		}
	}
	return POSProductResponse{
		ID:          row.ID,
		ProductName: row.ProductName,
		ProductCode: row.ProductCode,
		SKU:         row.SKU,
		Barcode:     row.Barcode,
		Category: LookupInfo{
			ID:   row.CategoryID,
			Name: row.CategoryName,
			Code: row.CategoryCode,
		},
		Unit: UnitInfo{
			ID:       row.UnitID,
			UnitName: row.UnitName,
			Symbol:   row.Symbol,
		},
		TaxRate:        taxRate,
		ProductType:    row.ProductType,
		SalePrice:      row.SalePrice,
		ImageFileID:    row.ImageFileID,
		IsStockTracked: row.IsStockTracked,
		Status:         row.Status,
	}
}

func toPOSVariant(row VariantRow) POSVariantResponse {
	return POSVariantResponse{
		ID:          row.ID,
		VariantName: row.VariantName,
		SKU:         row.SKU,
		Barcode:     row.Barcode,
		SalePrice:   row.SalePrice,
		ImageFileID: row.ImageFileID,
		Status:      row.Status,
	}
}

func lookupField(barcode, sku, productCode string) (string, string, string) {
	if strings.TrimSpace(barcode) != "" {
		return "barcode", strings.TrimSpace(barcode), "barcode"
	}
	if strings.TrimSpace(sku) != "" {
		return "sku", strings.TrimSpace(sku), "sku"
	}
	return "product_code", strings.TrimSpace(productCode), "product_code"
}

func cleanStringPointer(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func sum(values []float64) float64 {
	total := 0.0
	for _, value := range values {
		total += value
	}
	return roundMoney(total)
}

func sumDiscounts(items []SaleItem) float64 {
	total := 0.0
	for _, item := range items {
		total += item.DiscountAmount
	}
	return total
}

func sumHeldDiscounts(items []HeldSaleItem) float64 {
	total := 0.0
	for _, item := range items {
		total += item.DiscountAmount
	}
	return total
}

func proportionalAmount(total, part, base float64) float64 {
	if total <= 0 || base <= 0 || part <= 0 {
		return 0
	}
	return roundMoney(total * part / base)
}

func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}

func rollbackIfOpen(tx *gorm.DB) {
	if tx != nil {
		_ = tx.Rollback().Error
	}
}

func validHeldSaleStatus(value string) bool {
	switch value {
	case "held", "resumed", "cancelled", "expired":
		return true
	default:
		return false
	}
}

func heldSaleToCart(heldSale HeldSaleResponse) HoldSaleRequest {
	items := make([]HoldSaleItemRequest, 0, len(heldSale.Items))
	for _, item := range heldSale.Items {
		items = append(items, HoldSaleItemRequest{
			ProductID:        item.ProductID,
			ProductVariantID: item.ProductVariantID,
			Quantity:         item.Quantity,
			DiscountType:     item.DiscountType,
			DiscountValue:    item.DiscountValue,
		})
	}
	return HoldSaleRequest{
		BranchID:   heldSale.BranchID,
		CustomerID: heldSale.CustomerID,
		Items:      items,
		Notes:      heldSale.Notes,
		ExpiresAt:  heldSale.ExpiresAt,
	}
}
