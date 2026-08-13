package pos

import (
	"fmt"
	"math"
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
	inventoryService  *inventory.Service
	auditRepo         *audit.Repository
	accountingService *accounting.Service
}

func NewService(db *gorm.DB, repo *Repository, inventoryService *inventory.Service, auditRepo *audit.Repository, accountingService ...*accounting.Service) *Service {
	service := &Service{db: db, repo: repo, inventoryService: inventoryService, auditRepo: auditRepo}
	if len(accountingService) > 0 {
		service.accountingService = accountingService[0]
	}
	return service
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
	variants, err := s.repo.LoadActiveVariants(currentUser.BusinessID, branchID, productIDs)
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

func (s *Service) ListPaymentMethods(currentUser *utils.AuthContext, branchID string) ([]POSPaymentMethodResponse, error) {
	resolvedBranchID, err := resolvePOSPaymentMethodBranch(currentUser, branchID)
	if err != nil {
		return nil, err
	}
	if ok, err := s.repo.BranchExists(s.db, currentUser.BusinessID, resolvedBranchID); err != nil {
		return nil, apperrors.Internal("failed to validate branch")
	} else if !ok {
		return nil, apperrors.BadRequest("invalid branch_id", nil)
	}
	rows, err := s.repo.ListPOSPaymentMethods(currentUser.BusinessID, resolvedBranchID)
	if err != nil {
		return nil, apperrors.Internal("failed to list POS payment methods")
	}
	return rows, nil
}

func (s *Service) ReferenceData(currentUser *utils.AuthContext, branchID string) (*POSReferenceDataResponse, error) {
	resolvedBranchID, err := resolvePOSPaymentMethodBranch(currentUser, branchID)
	if err != nil {
		return nil, err
	}
	if ok, err := s.repo.BranchExists(s.db, currentUser.BusinessID, resolvedBranchID); err != nil {
		return nil, apperrors.Internal("failed to validate branch")
	} else if !ok {
		return nil, apperrors.BadRequest("invalid branch_id", nil)
	}

	productCategories, err := s.repo.ListPOSProductCategories(currentUser.BusinessID, resolvedBranchID)
	if err != nil {
		return nil, apperrors.Internal("failed to list POS product categories")
	}
	units, err := s.repo.ListPOSUnits(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to list POS units")
	}
	taxRates, err := s.repo.ListPOSTaxRates(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to list POS tax rates")
	}
	salesChannels, err := s.repo.ListPOSSalesChannels(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to list POS sales channels")
	}
	receiptLayouts, err := s.repo.ListPOSReceiptLayouts(currentUser.BusinessID, resolvedBranchID)
	if err != nil {
		return nil, apperrors.Internal("failed to list POS receipt layouts")
	}

	return &POSReferenceDataResponse{
		ProductCategories: productCategories,
		Units:             units,
		TaxRates:          taxRates,
		SalesChannels:     salesChannels,
		ReceiptLayouts:    receiptLayouts,
	}, nil
}

func resolvePOSPaymentMethodBranch(currentUser *utils.AuthContext, requestedBranchID string) (string, error) {
	requestedBranchID = strings.TrimSpace(requestedBranchID)
	if requestedBranchID != "" {
		if _, err := uuid.Parse(requestedBranchID); err != nil {
			return "", apperrors.BadRequest("branch_id must be a valid UUID", nil)
		}
		if err := currentUser.EnsureRecordBranch(requestedBranchID); err != nil {
			return "", err
		}
		return requestedBranchID, nil
	}
	if currentUser.CurrentBranchID != nil && strings.TrimSpace(*currentUser.CurrentBranchID) != "" {
		currentBranchID := strings.TrimSpace(*currentUser.CurrentBranchID)
		if err := currentUser.EnsureRecordBranch(currentBranchID); err != nil {
			return "", err
		}
		return currentBranchID, nil
	}
	if currentUser.AssignedBranchID != nil && strings.TrimSpace(*currentUser.AssignedBranchID) != "" {
		assignedBranchID := strings.TrimSpace(*currentUser.AssignedBranchID)
		if err := currentUser.EnsureRecordBranch(assignedBranchID); err != nil {
			return "", err
		}
		return assignedBranchID, nil
	}
	return "", apperrors.Forbidden("no active branch assigned")
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
	req.CheckoutReference = strings.TrimSpace(req.CheckoutReference)
	if err := validateCheckoutRequest(req); err != nil {
		return nil, err
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	defer rollbackIfOpen(tx)

	if err := s.repo.LockCheckoutReference(tx, currentUser.BusinessID, req.CheckoutReference); err != nil {
		return nil, apperrors.Internal("failed to lock checkout reference")
	}
	if existingSale, err := s.repo.FindSaleByCheckoutReference(tx, currentUser.BusinessID, req.CheckoutReference); err == nil {
		if err := currentUser.EnsureRecordBranch(existingSale.BranchID); err != nil {
			return nil, err
		}
		existingSaleID := existingSale.ID
		_ = tx.Rollback().Error
		tx = nil
		return s.loadCheckoutSaleResponse(currentUser.BusinessID, existingSaleID)
	} else if err != gorm.ErrRecordNotFound {
		return nil, apperrors.Internal("failed to check checkout reference")
	}

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
	salesChannel, externalOrderNumber, err := s.resolveSalesChannel(tx, currentUser.BusinessID, req.SalesChannelID, req.ExternalOrderNumber)
	if err != nil {
		return nil, err
	}

	saleID := utils.NewUUID()
	calculation, err := s.calculateSale(tx, currentUser.BusinessID, req.BranchID, saleID, req)
	if err != nil {
		return nil, err
	}
	if err := requireNoTaxPermission(currentUser, calculation.TaxMode); err != nil {
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
	// Phase 4 / W4: a store-credit tender spends the customer's credit
	// balance, so the sale needs a customer and the redemption (validated +
	// row-locked in RedeemCustomerCredit) happens after the sale row exists.
	storeCreditAmount := 0.0
	for _, payment := range payments {
		if payment.PaymentMethodTypeSnapshot == "store_credit" {
			storeCreditAmount = roundMoney(storeCreditAmount + payment.Amount)
		}
	}
	if storeCreditAmount > 0 {
		if cleanStringPointer(req.CustomerID) == nil {
			return nil, apperrors.BadRequest("store credit requires a customer on the sale", nil)
		}
		if s.accountingService == nil {
			return nil, apperrors.Internal("store credit accounting service is not configured")
		}
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
		ID:                       saleID,
		BusinessID:               currentUser.BusinessID,
		BranchID:                 req.BranchID,
		CashierUserID:            currentUser.UserID,
		CustomerID:               cleanStringPointer(req.CustomerID),
		SalesChannelID:           &salesChannel.ID,
		SalesChannelNameSnapshot: salesChannel.ChannelName,
		ExternalOrderNumber:      externalOrderNumber,
		CheckoutReference:        req.CheckoutReference,
		SaleNumber:               saleNumber,
		SubtotalAmount:           calculation.SubtotalAmount,
		DiscountType:             cleanStringPointer(req.SaleDiscountType),
		DiscountValue:            roundMoney(req.SaleDiscountValue),
		DiscountAmount:           calculation.DiscountAmount,
		TaxableAmount:            calculation.TaxableAmount,
		TaxAmount:                calculation.TaxAmount,
		ChargeAmount:             calculation.ChargeAmount,
		ChargeTaxAmount:          calculation.ChargeTaxAmount,
		TotalAmount:              calculation.TotalAmount,
		TaxMode:                  calculation.TaxMode,
		PaidAmount:               roundMoney(paidAmount),
		ChangeAmount:             changeAmount,
		PaymentStatus:            paymentStatus(paidAmount, calculation.TotalAmount),
		SaleStatus:               "completed",
		Notes:                    strings.TrimSpace(req.Notes),
		SoldAt:                   now,
	}

	for i := range calculation.Items {
		calculation.Items[i].SaleID = sale.ID
	}
	for i := range payments {
		payments[i].SaleID = sale.ID
	}

	if err := s.repo.CreateSale(tx, sale, calculation.Items, payments); err != nil {
		if isCheckoutReferenceConflict(err) {
			_ = tx.Rollback().Error
			tx = nil
			existingSale, findErr := s.repo.FindSaleByCheckoutReference(s.db, currentUser.BusinessID, req.CheckoutReference)
			if findErr == nil {
				if err := currentUser.EnsureRecordBranch(existingSale.BranchID); err != nil {
					return nil, err
				}
				return s.loadCheckoutSaleResponse(currentUser.BusinessID, existingSale.ID)
			}
		}
		return nil, apperrors.Internal("failed to create sale")
	}
	if len(calculation.Charges) > 0 {
		if err := tx.Create(&calculation.Charges).Error; err != nil {
			return nil, apperrors.Internal("failed to create sale charges")
		}
	}
	if storeCreditAmount > 0 {
		if err := s.accountingService.RedeemCustomerCredit(tx, currentUser, *sale.CustomerID, sale.ID, storeCreditAmount); err != nil {
			return nil, err
		}
	}
	if s.accountingService != nil {
		if _, err := s.accountingService.PostPOSSaleJournal(tx, currentUser, sale.ID); err != nil {
			return nil, err
		}
	}
	if err := s.deductInventoryForSale(tx, currentUser, sale, calculation.Items); err != nil {
		return nil, err
	}
	if s.accountingService != nil {
		if _, err := s.accountingService.PostPOSSaleCOGSJournal(tx, currentUser, sale.ID); err != nil {
			return nil, err
		}
	}
	if err := s.writeAudit(tx, currentUser, "sale.created", sale.ID, "Sale completed.", ipAddress, userAgent); err != nil {
		return nil, err
	}
	// W3: every no-tax document is audit-flagged for VAT-filing review.
	if calculation.TaxMode == charges.TaxModeNoTax {
		if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
			BusinessID:  currentUser.BusinessID,
			ActorUserID: currentUser.UserID,
			EventType:   "sale.no_tax_applied",
			EntityType:  "sale",
			EntityID:    sale.ID,
			Summary:     "Sale completed with the no-tax mode.",
			Metadata: audit.Metadata(map[string]interface{}{
				"source_module": "pos",
				"sale_number":   sale.SaleNumber,
				"total_amount":  sale.TotalAmount,
				"branch_id":     sale.BranchID,
			}, nil),
			IPAddress: ipAddress,
			UserAgent: userAgent,
		}); err != nil {
			return nil, apperrors.Internal("failed to record no-tax audit event")
		}
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit checkout")
	}
	tx = nil

	return s.loadCheckoutSaleResponse(currentUser.BusinessID, sale.ID)
}

func (s *Service) loadCheckoutSaleResponse(businessID, saleID string) (*SaleResponse, error) {
	response, err := s.repo.LoadSaleDetails(businessID, saleID)
	if err != nil {
		return nil, apperrors.Internal("failed to load sale")
	}
	sale, err := s.repo.FindSaleByID(s.db, businessID, saleID)
	if err == nil {
		if receipt, receiptErr := s.repo.LoadReceipt(*sale); receiptErr == nil {
			response.Receipt = receipt
		}
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

	heldSaleID := utils.NewUUID()
	calculation, err := s.calculateHeldSale(tx, currentUser.BusinessID, req.BranchID, heldSaleID, req)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	holdNumber, err := s.repo.GenerateHoldNumber(tx, currentUser.BusinessID, now)
	if err != nil {
		return nil, apperrors.Internal("failed to generate hold number")
	}
	heldSale := &HeldSale{
		ID:                       heldSaleID,
		BusinessID:               currentUser.BusinessID,
		BranchID:                 req.BranchID,
		CashierUserID:            currentUser.UserID,
		CustomerID:               cleanStringPointer(req.CustomerID),
		HoldNumber:               holdNumber,
		ItemCount:                len(calculation.Items),
		EstimatedSubtotal:        calculation.SubtotalAmount,
		EstimatedDiscountAmount:  calculation.DiscountAmount,
		EstimatedTaxAmount:       calculation.TaxAmount,
		EstimatedChargeAmount:    calculation.ChargeAmount,
		EstimatedChargeTaxAmount: calculation.ChargeTaxAmount,
		EstimatedTotal:           calculation.TotalAmount,
		TaxMode:                  calculation.TaxMode,
		Status:                   "held",
		Notes:                    strings.TrimSpace(req.Notes),
		HeldAt:                   now,
		ExpiresAt:                req.ExpiresAt,
	}
	for i := range calculation.Items {
		calculation.Items[i].HeldSaleID = heldSale.ID
	}
	if err := s.repo.CreateHeldSale(tx, heldSale, calculation.Items); err != nil {
		return nil, apperrors.Internal("failed to hold sale")
	}
	if len(calculation.Charges) > 0 {
		if err := tx.Create(&calculation.Charges).Error; err != nil {
			return nil, apperrors.Internal("failed to create held sale charges")
		}
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
	if err := currentUser.EnsureRecordBranch(heldSale.BranchID); err != nil {
		return nil, err
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
	if err := currentUser.EnsureRecordBranch(heldSale.BranchID); err != nil {
		return nil, err
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
	if err := currentUser.EnsureRecordBranch(heldSale.BranchID); err != nil {
		return err
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
	if err := currentUser.EnsureRecordBranch(response.BranchID); err != nil {
		return nil, err
	}
	return response, nil
}

func (s *Service) GetCheckoutStatus(currentUser *utils.AuthContext, checkoutReference string) (*SaleResponse, error) {
	checkoutReference = strings.TrimSpace(checkoutReference)
	if _, err := uuid.Parse(checkoutReference); err != nil {
		return nil, apperrors.BadRequest("checkout_reference must be a valid UUID", nil)
	}
	sale, err := s.repo.FindSaleByCheckoutReference(s.db, currentUser.BusinessID, checkoutReference)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("checkout not found")
		}
		return nil, apperrors.Internal("failed to load checkout status")
	}
	if err := currentUser.EnsureRecordBranch(sale.BranchID); err != nil {
		return nil, err
	}
	return s.loadCheckoutSaleResponse(currentUser.BusinessID, sale.ID)
}

func (s *Service) GetReceipt(currentUser *utils.AuthContext, saleID string, ipAddress, userAgent string) (*ReceiptReadyResponse, error) {
	sale, err := s.repo.FindSaleByID(s.db, currentUser.BusinessID, saleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("sale not found")
		}
		return nil, apperrors.Internal("failed to load sale")
	}
	if err := currentUser.EnsureRecordBranch(sale.BranchID); err != nil {
		return nil, err
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
		Metadata: audit.Metadata(map[string]interface{}{
			"source_module":    "pos",
			"sale_number":      sale.SaleNumber,
			"document_number":  sale.SaleNumber,
			"reference_number": sale.ExternalOrderNumber,
		}, nil),
		IPAddress: ipAddress,
		UserAgent: userAgent,
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

	sale, err := s.repo.FindSaleByIDForUpdate(tx, currentUser.BusinessID, saleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("sale not found")
		}
		return nil, apperrors.Internal("failed to load sale")
	}
	if sale.SaleStatus != "completed" && sale.SaleStatus != "partially_refunded" {
		return nil, apperrors.BadRequest("sale cannot be refunded", nil)
	}
	if err := currentUser.EnsureRecordBranch(sale.BranchID); err != nil {
		return nil, err
	}
	operationalRefunded, err := s.repo.SumOperationalRefunds(tx, currentUser.BusinessID, saleID)
	if err != nil {
		return nil, apperrors.Internal("failed to validate refund amount")
	}
	legacyRefunded, err := s.repo.SumRefunds(tx, currentUser.BusinessID, saleID)
	if err != nil {
		return nil, apperrors.Internal("failed to validate refund amount")
	}
	refunded := math.Max(operationalRefunded, legacyRefunded)
	remaining := roundMoney(sale.TotalAmount - refunded)
	refundAmount := roundMoney(req.RefundAmount)
	if refundAmount > remaining {
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
		RefundAmount:     refundAmount,
		Reason:           strings.TrimSpace(req.Reason),
		ApprovedByUserID: cleanStringPointer(req.ApprovedByUserID),
		CreatedByUserID:  currentUser.UserID,
	}
	newRefunded := roundMoney(refunded + refundAmount)
	newSaleStatus := "partially_refunded"
	if newRefunded >= sale.TotalAmount {
		newSaleStatus = "refunded"
	}
	if err := s.repo.CreateRefund(tx, refund); err != nil {
		return nil, apperrors.Internal("failed to create refund")
	}
	// Phase 4 / W6: cash is allocated across the sale's collected payments;
	// whatever the collected money cannot cover is the receivable slice — the
	// refund first cancels what the customer still owes, and only the
	// collected part leaves as cash.
	payments, cashLeftover, err := s.createOperationalPaymentRefunds(tx, currentUser, sale, refund, now)
	if err != nil {
		return nil, err
	}
	if cashLeftover > 0 {
		collected := 0.0
		for _, payment := range payments {
			collected = roundMoney(collected + payment.Amount)
		}
		priorARRefunded := math.Max(0, roundMoney(legacyRefunded-operationalRefunded))
		outstandingAR := roundMoney(sale.TotalAmount - collected - priorARRefunded)
		if cashLeftover > outstandingAR+0.005 {
			return nil, apperrors.BadRequest("refund_amount exceeds refundable payment amount", nil)
		}
	}
	if s.accountingService == nil {
		return nil, apperrors.Internal("payment refund accounting service is not configured")
	}
	if _, err := s.accountingService.PostPOSSaleRefundJournal(tx, currentUser, refund.ID); err != nil {
		return nil, err
	}
	saleUpdates := map[string]interface{}{
		"sale_status": newSaleStatus,
		"updated_at":  now,
	}
	// The sales.payment_status check constraint only allows unpaid/partial/paid/refunded,
	// so a partial refund keeps the existing payment status; sale_status carries
	// "partially_refunded".
	if newSaleStatus == "refunded" {
		saleUpdates["payment_status"] = "refunded"
	}
	if err := s.repo.UpdateSale(tx, currentUser.BusinessID, sale.ID, saleUpdates); err != nil {
		return nil, apperrors.Internal("failed to update sale")
	}
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   "sale.refunded",
		EntityType:  "sale_refund",
		EntityID:    refund.ID,
		Summary:     "Sale refunded.",
		Metadata: audit.Metadata(map[string]interface{}{
			"source_module": "pos",
			"sale_id":       sale.ID,
			"sale_number":   sale.SaleNumber,
			"refund_number": refund.RefundNumber,
			"refund_amount": refund.RefundAmount,
			"reason":        refund.Reason,
		}, nil),
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}); err != nil {
		return nil, apperrors.Internal("failed to create activity log")
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit refund")
	}
	tx = nil
	return s.GetSale(currentUser, sale.ID)
}

// createOperationalPaymentRefunds allocates a refund event's cash across the
// sale's collected payments (oldest first), linking each allocation row to
// the sale_refunds header. The unified refund journal is posted once by the
// caller — allocation rows carry no journals of their own (Phase 4 / W6).
// The returned leftover is the slice no collected payment can cover; the
// caller validates it against the sale's outstanding receivable.
func (s *Service) createOperationalPaymentRefunds(tx *gorm.DB, currentUser *utils.AuthContext, sale *Sale, refund *SaleRefund, refundedAt time.Time) ([]SalePayment, float64, error) {
	payments, err := s.repo.SalePaymentsForRefundAllocation(tx, currentUser.BusinessID, sale.ID)
	if err != nil {
		return nil, 0, apperrors.Internal("failed to load sale payments for refund allocation")
	}
	remaining := roundMoney(refund.RefundAmount)
	for _, payment := range payments {
		if remaining <= 0 {
			break
		}
		alreadyRefunded, err := s.repo.SalePaymentRefundedAmount(tx, currentUser.BusinessID, payment.ID)
		if err != nil {
			return nil, 0, apperrors.Internal("failed to validate payment refund amount")
		}
		paymentAvailable := roundMoney(payment.Amount - alreadyRefunded)
		if paymentAvailable <= 0 {
			continue
		}
		refundAmount := roundMoney(math.Min(remaining, paymentAvailable))
		refundNumber, err := s.repo.GeneratePaymentRefundNumber(tx, currentUser.BusinessID, refundedAt)
		if err != nil {
			return nil, 0, apperrors.Internal("failed to generate payment refund number")
		}
		paymentID := payment.ID
		saleRefundID := refund.ID
		operationalRefund := &POSPaymentRefund{
			ID:                        utils.NewUUID(),
			BusinessID:                currentUser.BusinessID,
			BranchID:                  payment.BranchID,
			SaleID:                    sale.ID,
			SalePaymentID:             &paymentID,
			SaleRefundID:              &saleRefundID,
			RefundSource:              "pos_sale",
			RefundNumber:              refundNumber,
			PaymentMethodID:           payment.PaymentMethodID,
			PaymentMethodNameSnapshot: payment.PaymentMethodNameSnapshot,
			RefundAmount:              refundAmount,
			RefundReason:              refund.Reason,
			RefundStatus:              "completed",
			ApprovedByUserID:          refund.ApprovedByUserID,
			CreatedByUserID:           currentUser.UserID,
			RefundedAt:                refundedAt,
			CreatedAt:                 refundedAt,
			UpdatedAt:                 refundedAt,
		}
		if err := s.repo.CreateOperationalPaymentRefund(tx, operationalRefund); err != nil {
			return nil, 0, apperrors.Internal("failed to create operational payment refund")
		}
		status := "partially_refunded"
		if roundMoney(alreadyRefunded+refundAmount) >= payment.Amount {
			status = "refunded"
		}
		if err := s.repo.UpdateSalePaymentStatus(tx, currentUser.BusinessID, payment.ID, status, refundedAt); err != nil {
			return nil, 0, apperrors.Internal("failed to update sale payment refund status")
		}
		remaining = roundMoney(remaining - refundAmount)
	}
	return payments, roundMoney(math.Max(remaining, 0)), nil
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
	if err := currentUser.EnsureRecordBranch(sale.BranchID); err != nil {
		return nil, err
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
	voidedAt := time.Now().UTC()
	if err := s.repo.UpdateSale(tx, currentUser.BusinessID, sale.ID, map[string]interface{}{
		"sale_status": "voided",
		"updated_at":  voidedAt,
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
	if s.accountingService != nil {
		if _, err := s.accountingService.PostPOSSaleVoidJournal(tx, currentUser, sale.ID, voidedAt); err != nil {
			return nil, err
		}
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
	for key, quantity := range quantities {
		stock, err := s.repo.FindProductInventoryForSale(tx, sale.BusinessID, sale.BranchID, key.ProductID, key.variantIDPointer())
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return apperrors.BadRequest("invalid product on sale", nil)
			}
			return apperrors.Internal("failed to validate product inventory")
		}
		if !stock.IsStockTracked {
			continue
		}
		itemName := stockName(stock)
		if stock.InventoryItemID == nil || strings.TrimSpace(*stock.InventoryItemID) == "" {
			return apperrors.BadRequest("inventory item not found for stock-tracked product "+itemName, nil)
		}
		if quantity > stock.AvailableQuantity+0.0001 {
			return apperrors.BadRequest(fmt.Sprintf("insufficient stock for %s. Required %.4f, available %.4f", itemName, quantity, stock.AvailableQuantity), nil)
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
	for key, quantity := range quantities {
		stock, err := s.repo.FindProductInventoryForSale(tx, sale.BusinessID, sale.BranchID, key.ProductID, key.variantIDPointer())
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return apperrors.BadRequest("invalid product on sale", nil)
			}
			return apperrors.Internal("failed to validate product inventory")
		}
		if !stock.IsStockTracked {
			continue
		}
		itemName := stockName(stock)
		if stock.InventoryItemID == nil || strings.TrimSpace(*stock.InventoryItemID) == "" {
			return apperrors.BadRequest("inventory item not found for stock-tracked product "+itemName, nil)
		}
		unitCost, err := s.saleStockMovementUnitCost(tx, sale.BusinessID, sale.ID, *stock.InventoryItemID)
		if err != nil {
			return err
		}
		if _, err := s.inventoryService.ApplyMovement(tx, inventory.ApplyStockMovementInput{
			BusinessID:      sale.BusinessID,
			InventoryItemID: *stock.InventoryItemID,
			MovementType:    "return_in",
			Quantity:        quantity,
			UnitCost:        unitCost,
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

func (s *Service) saleStockMovementUnitCost(tx *gorm.DB, businessID, saleID, inventoryItemID string) (float64, error) {
	var unitCost float64
	err := tx.Table("stock_movements").
		Select("COALESCE(SUM(total_cost) / NULLIF(SUM(quantity), 0), 0)").
		// stock_movements is not soft-deleted; a soft-delete predicate here makes Postgres reject the query.
		Where("business_id = ? AND reference_type = ? AND reference_id = ? AND inventory_item_id = ? AND movement_direction = ?", businessID, "sale", saleID, inventoryItemID, "out").
		Scan(&unitCost).Error
	if err != nil {
		return 0, apperrors.Internal("failed to calculate original sale stock cost")
	}
	return unitCost, nil
}

type saleStockKey struct {
	ProductID        string
	ProductVariantID string
}

func aggregateSaleItemQuantities(items []SaleItem) map[saleStockKey]float64 {
	quantities := make(map[saleStockKey]float64)
	for _, item := range items {
		key := saleStockKey{ProductID: item.ProductID}
		if item.ProductVariantID != nil && strings.TrimSpace(*item.ProductVariantID) != "" {
			key.ProductVariantID = strings.TrimSpace(*item.ProductVariantID)
		}
		quantities[key] += item.Quantity
	}
	return quantities
}

func (key saleStockKey) variantIDPointer() *string {
	if strings.TrimSpace(key.ProductVariantID) == "" {
		return nil
	}
	variantID := key.ProductVariantID
	return &variantID
}

func stockName(stock *ProductInventoryStockRow) string {
	if stock == nil {
		return ""
	}
	if stock.ProductVariantID != nil && strings.TrimSpace(stock.VariantName) != "" {
		return strings.TrimSpace(stock.ProductName + " - " + stock.VariantName)
	}
	return stock.ProductName
}

type saleCalculation struct {
	Items           []SaleItem
	Charges         []charges.DocumentCharge
	TaxMode         string
	SubtotalAmount  float64
	DiscountAmount  float64
	TaxableAmount   float64
	TaxAmount       float64
	ChargeAmount    float64
	ChargeTaxAmount float64
	TotalAmount     float64
}

// resolveDocumentTaxMode validates a requested document tax mode, falling
// back to the business default when the request carries none (W3).
func resolveDocumentTaxMode(tx *gorm.DB, businessID, requested string) (string, error) {
	requested = strings.TrimSpace(requested)
	if requested == "" {
		return charges.DefaultTaxMode(tx, businessID), nil
	}
	if !charges.ValidTaxMode(requested) {
		return "", apperrors.BadRequest("tax_mode must be inclusive, exclusive, or no_tax", nil)
	}
	return requested, nil
}

// requireNoTaxPermission gates the no-tax mode behind sales.no_tax.apply (W3).
func requireNoTaxPermission(currentUser *utils.AuthContext, taxMode string) error {
	if taxMode != charges.TaxModeNoTax {
		return nil
	}
	for _, permission := range currentUser.Permissions {
		if permission == "sales.no_tax.apply" {
			return nil
		}
	}
	return apperrors.Forbidden("missing permission to apply the no-tax mode")
}

type heldSaleCalculation struct {
	Items           []HeldSaleItem
	Charges         []charges.DocumentCharge
	TaxMode         string
	SubtotalAmount  float64
	DiscountAmount  float64
	TaxAmount       float64
	ChargeAmount    float64
	ChargeTaxAmount float64
	TotalAmount     float64
}

func (s *Service) calculateSale(tx *gorm.DB, businessID, branchID, saleID string, req CheckoutRequest) (*saleCalculation, error) {
	taxMode, err := resolveDocumentTaxMode(tx, businessID, req.TaxMode)
	if err != nil {
		return nil, err
	}
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
		// W3: the document's tax mode decides how each line's rate applies;
		// the rate's own inclusive flag is only the legacy fallback.
		lineTax, lineTotal := charges.ResolveLineTax(discountedLine, items[i].TaxRatePercentageSnapshot, lineTaxInclusive[i], taxMode)
		items[i].TaxAmount = lineTax
		items[i].LineTotal = lineTotal
		taxableAmount += roundMoney(lineTotal - lineTax)
		totalAmount += lineTotal
		taxAmount += lineTax
	}

	chargeRows, chargeTotals, err := charges.BuildChargesWithMode(tx, businessID, branchID, "pos_sale", saleID, req.Charges, taxMode)
	if err != nil {
		return nil, err
	}

	return &saleCalculation{
		Items:           items,
		Charges:         chargeRows,
		TaxMode:         taxMode,
		SubtotalAmount:  subtotal,
		DiscountAmount:  roundMoney(sumDiscounts(items)),
		TaxableAmount:   roundMoney(taxableAmount),
		TaxAmount:       roundMoney(taxAmount + chargeTotals.TaxAmount),
		ChargeAmount:    chargeTotals.Amount,
		ChargeTaxAmount: chargeTotals.TaxAmount,
		TotalAmount:     roundMoney(totalAmount + chargeTotals.Total),
	}, nil
}

func (s *Service) calculateHeldSale(tx *gorm.DB, businessID, branchID, heldSaleID string, req HoldSaleRequest) (*heldSaleCalculation, error) {
	taxMode, err := resolveDocumentTaxMode(tx, businessID, req.TaxMode)
	if err != nil {
		return nil, err
	}
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
		lineTax, lineTotal := charges.ResolveLineTax(discountedLine, items[i].TaxRatePercentageSnapshot, lineTaxInclusive[i], taxMode)
		items[i].TaxAmount = lineTax
		items[i].LineTotal = lineTotal
		totalAmount += lineTotal
		taxAmount += lineTax
	}

	chargeRows, chargeTotals, err := charges.BuildChargesWithMode(tx, businessID, branchID, "held_sale", heldSaleID, req.Charges, taxMode)
	if err != nil {
		return nil, err
	}

	return &heldSaleCalculation{
		Items:           items,
		Charges:         chargeRows,
		TaxMode:         taxMode,
		SubtotalAmount:  roundMoney(subtotal),
		DiscountAmount:  roundMoney(sumHeldDiscounts(items)),
		TaxAmount:       roundMoney(taxAmount + chargeTotals.TaxAmount),
		ChargeAmount:    chargeTotals.Amount,
		ChargeTaxAmount: chargeTotals.TaxAmount,
		TotalAmount:     roundMoney(totalAmount + chargeTotals.Total),
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
		if !method.ShowInPOS {
			return nil, 0, 0, apperrors.BadRequest("payment method is not enabled for POS", nil)
		}
		ready, err := s.repo.POSPaymentMethodHasReadyAccount(tx, businessID, branchID, method.ID)
		if err != nil {
			return nil, 0, 0, apperrors.Internal("failed to validate payment method account")
		}
		if !ready {
			return nil, 0, 0, apperrors.BadRequest(
				"payment method is not linked to an active payment account for this branch",
				map[string]interface{}{"payment_method": method.MethodName},
			)
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

func (s *Service) resolveSalesChannel(tx *gorm.DB, businessID string, requestedID *string, requestedExternalNumber string) (*SalesChannelRow, string, error) {
	channelID := ""
	if requestedID != nil {
		channelID = strings.TrimSpace(*requestedID)
	}

	var channel *SalesChannelRow
	var err error
	if channelID != "" {
		if _, parseErr := uuid.Parse(channelID); parseErr != nil {
			return nil, "", apperrors.BadRequest("sales_channel_id must be a valid UUID", nil)
		}
		channel, err = s.repo.FindSalesChannel(tx, businessID, channelID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, "", apperrors.BadRequest("invalid sales_channel_id", nil)
			}
			return nil, "", apperrors.Internal("failed to validate sales channel")
		}
	} else {
		channel, err = s.repo.DefaultSalesChannel(tx, businessID)
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, "", apperrors.BadRequest("default sales channel is not configured", nil)
			}
			return nil, "", apperrors.Internal("failed to load default sales channel")
		}
	}

	externalNumber := strings.TrimSpace(requestedExternalNumber)
	if channel.RequiresExternalOrderNumber && externalNumber == "" {
		return nil, "", apperrors.BadRequest("external_order_number is required for the selected sales channel", nil)
	}
	return channel, externalNumber, nil
}

func validateCheckoutRequest(req CheckoutRequest) error {
	if strings.TrimSpace(req.BranchID) == "" {
		return apperrors.BadRequest("branch_id is required", nil)
	}
	if _, err := uuid.Parse(strings.TrimSpace(req.CheckoutReference)); err != nil {
		return apperrors.BadRequest("checkout_reference must be a valid UUID", nil)
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

func isCheckoutReferenceConflict(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "idx_sales_business_checkout_reference") ||
		strings.Contains(message, "checkout_reference") && strings.Contains(message, "duplicate")
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
	if strings.TrimSpace(query.SalesChannelID) != "" {
		if _, err := uuid.Parse(strings.TrimSpace(query.SalesChannelID)); err != nil {
			return apperrors.BadRequest("sales_channel_id must be a valid UUID", nil)
		}
	}
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
	metadata := s.posAuditMetadata(tx, currentUser.BusinessID, saleID)
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "sale",
		EntityID:    saleID,
		Summary:     summary,
		Metadata:    audit.Metadata(metadata, nil),
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

func (s *Service) posAuditMetadata(tx *gorm.DB, businessID, saleID string) map[string]interface{} {
	metadata := map[string]interface{}{"source_module": "pos"}
	if tx == nil || strings.TrimSpace(saleID) == "" {
		return metadata
	}
	var row struct{ SaleNumber, ExternalOrderNumber string }
	_ = tx.Unscoped().Table("sales").Select("sale_number, external_order_number").Where("business_id = ? AND id = ?", businessID, saleID).Scan(&row).Error
	metadata["sale_number"] = row.SaleNumber
	metadata["document_number"] = auditFirstNonEmpty(row.SaleNumber, row.ExternalOrderNumber)
	metadata["reference_number"] = row.ExternalOrderNumber
	return metadata
}

func auditFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
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
		ItemStructure:  defaultItemStructure(row.ItemStructure),
		SalePrice:      row.SalePrice,
		ImageFileID:    row.ImageFileID,
		IsSellable:     row.IsSellable,
		IsPOSVisible:   row.IsPOSVisible,
		IsStockTracked: row.IsStockTracked,
		Status:         row.Status,
	}
}

func defaultItemStructure(value string) string {
	if strings.TrimSpace(value) == "" {
		return "single"
	}
	return value
}

func toPOSVariant(row VariantRow) POSVariantResponse {
	return POSVariantResponse{
		ID:                     row.ID,
		VariantName:            row.VariantName,
		SKU:                    row.SKU,
		Barcode:                row.Barcode,
		SalePrice:              row.SalePrice,
		ImageFileID:            row.ImageFileID,
		CurrentStockQuantity:   row.CurrentStockQuantity,
		AvailableStockQuantity: row.AvailableStockQuantity,
		Status:                 row.Status,
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
		Charges:    chargeResponsesToInputs(heldSale.Charges),
		Notes:      heldSale.Notes,
		ExpiresAt:  heldSale.ExpiresAt,
	}
}

func chargeResponsesToInputs(rows []charges.ChargeResponse) []charges.ChargeInput {
	inputs := make([]charges.ChargeInput, 0, len(rows))
	for _, row := range rows {
		isRefundable := row.IsRefundable
		taxRateID := ""
		if row.TaxRateID != nil {
			taxRateID = *row.TaxRateID
		}
		inputs = append(inputs, charges.ChargeInput{
			ChargeType:   row.ChargeType,
			ChargeName:   row.ChargeName,
			Description:  row.Description,
			Amount:       row.Amount,
			TaxRateID:    taxRateID,
			IsRefundable: &isRefundable,
		})
	}
	return inputs
}
