package salesreturns

import (
	"errors"
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

func NewService(db *gorm.DB, repo *Repository, inventoryService *inventory.Service, auditRepo *audit.Repository, accountingService *accounting.Service) *Service {
	return &Service{db: db, repo: repo, inventoryService: inventoryService, auditRepo: auditRepo, accountingService: accountingService}
}

type normalizedRequest struct {
	SaleID                string
	ReturnDate            time.Time
	Reason                string
	RefundMode            string
	RefundPaymentMethodID *string
	RefundReferenceNumber string
	Items                 []SalesReturnItemRequest
	RefundCharges         []charges.ChargeRefundInput
}

func (s *Service) List(currentUser *utils.AuthContext, query SalesReturnListQuery) (*PaginatedResponse[SalesReturnResponse], error) {
	if currentUser == nil {
		return nil, apperrors.Unauthorized("missing authenticated user")
	}
	query = normalizeListQuery(query)
	if err := validateListQuery(currentUser, query); err != nil {
		return nil, err
	}
	// The branch predicate used to be applied only when the client happened to
	// send branch_id, so omitting it listed every branch's returns. Resolve the
	// scope here so the filter is never optional.
	branchID, allBranches, err := currentUser.ResolveBranchScope(query.BranchID, "")
	if err != nil {
		return nil, err
	}
	if allBranches {
		query.BranchID = ""
	} else {
		query.BranchID = branchID
	}
	rows, total, err := s.repo.List(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list sales returns")
	}
	items, err := s.repo.LoadResponses(currentUser.BusinessID, rows, false)
	if err != nil {
		return nil, apperrors.Internal("failed to load sales return details")
	}
	return &PaginatedResponse[SalesReturnResponse]{
		Items: items,
		Pagination: PaginationResponse{
			Page:       query.Page,
			Limit:      query.Limit,
			Total:      total,
			TotalPages: int(math.Ceil(float64(total) / float64(query.Limit))),
		},
	}, nil
}

func (s *Service) Get(currentUser *utils.AuthContext, id string) (SalesReturnResponse, error) {
	if currentUser == nil {
		return SalesReturnResponse{}, apperrors.Unauthorized("missing authenticated user")
	}
	row, err := s.repo.FindByID(nil, currentUser.BusinessID, id)
	if err != nil {
		return SalesReturnResponse{}, mapNotFound(err, "sales return not found")
	}
	if err := currentUser.EnsureRecordBranch(row.BranchID); err != nil {
		return SalesReturnResponse{}, err
	}
	return s.repo.LoadResponse(currentUser.BusinessID, *row)
}

func (s *Service) Create(currentUser *utils.AuthContext, req CreateSalesReturnRequest, ipAddress, userAgent string) (SalesReturnResponse, error) {
	if currentUser == nil {
		return SalesReturnResponse{}, apperrors.Unauthorized("missing authenticated user")
	}
	normalized, err := normalizeCreateRequest(req)
	if err != nil {
		return SalesReturnResponse{}, err
	}

	var created SalesReturn
	err = s.db.Transaction(func(tx *gorm.DB) error {
		sale, err := s.validateSaleForReturn(tx, currentUser, normalized.SaleID)
		if err != nil {
			return err
		}
		returnID := utils.NewUUID()
		items, subtotal, tax, total, err := s.buildReturnItems(tx, currentUser.BusinessID, sale.ID, returnID, "", normalized.Items)
		if err != nil {
			return err
		}
		chargeRows, chargeTotals, err := s.buildChargeRefunds(tx, currentUser.BusinessID, sale.ID, sale.BranchID, returnID, "", normalized.RefundCharges)
		if err != nil {
			return err
		}
		tax = roundMoney(tax + chargeTotals.TaxAmount)
		total = roundMoney(total + chargeTotals.Total)
		if normalized.RefundMode == "refund" {
			if err := s.validateRefundRequest(tx, currentUser.BusinessID, sale.ID, sale.BranchID, normalized.RefundPaymentMethodID, normalized.RefundReferenceNumber, total); err != nil {
				return err
			}
		}
		returnNumber, err := s.repo.GenerateReturnNumber(tx, currentUser.BusinessID)
		if err != nil {
			return apperrors.Internal("failed to generate credit note number")
		}
		now := time.Now().UTC()
		refundAmount := 0.0
		if normalized.RefundMode == "refund" {
			refundAmount = total
		}
		created = SalesReturn{
			ID:                    returnID,
			BusinessID:            currentUser.BusinessID,
			BranchID:              sale.BranchID,
			SaleID:                sale.ID,
			CustomerID:            sale.CustomerID,
			ReturnNumber:          returnNumber,
			ReturnDate:            normalized.ReturnDate,
			Reason:                normalized.Reason,
			Status:                "draft",
			SubtotalAmount:        subtotal,
			TaxAmount:             tax,
			ChargeAmount:          chargeTotals.Amount,
			ChargeTaxAmount:       chargeTotals.TaxAmount,
			ReturnTotal:           total,
			RefundMode:            normalized.RefundMode,
			RefundPaymentMethodID: normalized.RefundPaymentMethodID,
			RefundAmount:          refundAmount,
			RefundReferenceNumber: normalized.RefundReferenceNumber,
			CreatedByUserID:       currentUser.UserID,
			CreatedAt:             now,
			UpdatedAt:             now,
		}
		for i := range items {
			items[i].SalesReturnID = created.ID
		}
		if err := s.repo.Create(tx, &created, items); err != nil {
			return apperrors.Internal("failed to create sales return")
		}
		if len(chargeRows) > 0 {
			if err := tx.Create(&chargeRows).Error; err != nil {
				return apperrors.Internal("failed to create sales return charges")
			}
		}
		return s.writeAudit(tx, currentUser, "sales_return.created", created.ID, "Sales return draft created.", ipAddress, userAgent)
	})
	if err != nil {
		return SalesReturnResponse{}, err
	}
	return s.repo.LoadResponse(currentUser.BusinessID, created)
}

func (s *Service) Update(currentUser *utils.AuthContext, id string, req UpdateSalesReturnRequest, ipAddress, userAgent string) (SalesReturnResponse, error) {
	if currentUser == nil {
		return SalesReturnResponse{}, apperrors.Unauthorized("missing authenticated user")
	}
	normalized, err := normalizeUpdateRequest(req)
	if err != nil {
		return SalesReturnResponse{}, err
	}

	var updated SalesReturn
	err = s.db.Transaction(func(tx *gorm.DB) error {
		existing, err := s.repo.FindForUpdate(tx, currentUser.BusinessID, id)
		if err != nil {
			return mapNotFound(err, "sales return not found")
		}
		if existing.Status != "draft" {
			return apperrors.BadRequest("only draft sales returns can be edited", nil)
		}
		if err := currentUser.EnsureRecordBranch(existing.BranchID); err != nil {
			return err
		}
		sale, err := s.validateSaleForReturn(tx, currentUser, existing.SaleID)
		if err != nil {
			return err
		}
		items, subtotal, tax, total, err := s.buildReturnItems(tx, currentUser.BusinessID, sale.ID, existing.ID, existing.ID, normalized.Items)
		if err != nil {
			return err
		}
		chargeRows, chargeTotals, err := s.buildChargeRefunds(tx, currentUser.BusinessID, sale.ID, sale.BranchID, existing.ID, existing.ID, normalized.RefundCharges)
		if err != nil {
			return err
		}
		tax = roundMoney(tax + chargeTotals.TaxAmount)
		total = roundMoney(total + chargeTotals.Total)
		if normalized.RefundMode == "refund" {
			if err := s.validateRefundRequest(tx, currentUser.BusinessID, sale.ID, sale.BranchID, normalized.RefundPaymentMethodID, normalized.RefundReferenceNumber, total); err != nil {
				return err
			}
		}
		now := time.Now().UTC()
		refundAmount := 0.0
		if normalized.RefundMode == "refund" {
			refundAmount = total
		}
		updates := map[string]interface{}{
			"return_date":              normalized.ReturnDate,
			"reason":                   normalized.Reason,
			"subtotal_amount":          subtotal,
			"tax_amount":               tax,
			"charge_amount":            chargeTotals.Amount,
			"charge_tax_amount":        chargeTotals.TaxAmount,
			"return_total":             total,
			"refund_mode":              normalized.RefundMode,
			"refund_payment_method_id": normalized.RefundPaymentMethodID,
			"refund_amount":            refundAmount,
			"refund_reference_number":  normalized.RefundReferenceNumber,
			"updated_at":               now,
		}
		if err := s.repo.Update(tx, currentUser.BusinessID, existing.ID, updates); err != nil {
			return apperrors.Internal("failed to update sales return")
		}
		for i := range items {
			items[i].SalesReturnID = existing.ID
		}
		if err := s.repo.ReplaceItems(tx, currentUser.BusinessID, existing.ID, items); err != nil {
			return apperrors.Internal("failed to update sales return items")
		}
		if err := s.replaceChargeRefunds(tx, currentUser.BusinessID, existing.ID, chargeRows); err != nil {
			return err
		}
		refreshed, err := s.repo.FindByID(tx, currentUser.BusinessID, existing.ID)
		if err != nil {
			return err
		}
		updated = *refreshed
		return s.writeAudit(tx, currentUser, "sales_return.updated", existing.ID, "Sales return draft updated.", ipAddress, userAgent)
	})
	if err != nil {
		return SalesReturnResponse{}, err
	}
	return s.repo.LoadResponse(currentUser.BusinessID, updated)
}

func (s *Service) Post(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) (SalesReturnResponse, error) {
	if currentUser == nil {
		return SalesReturnResponse{}, apperrors.Unauthorized("missing authenticated user")
	}

	var posted SalesReturn
	err := s.db.Transaction(func(tx *gorm.DB) error {
		salesReturn, err := s.repo.FindForUpdate(tx, currentUser.BusinessID, id)
		if err != nil {
			return mapNotFound(err, "sales return not found")
		}
		if salesReturn.Status != "draft" {
			return apperrors.BadRequest("only draft sales returns can be posted", nil)
		}
		if err := currentUser.EnsureRecordBranch(salesReturn.BranchID); err != nil {
			return err
		}
		if salesReturn.RefundMode == "refund" && !hasAnyPermission(currentUser, "sales_returns.refund", "payments.refund", "sales_returns.manage") {
			return apperrors.Forbidden("missing refund permission")
		}
		sale, err := s.validateSaleForReturn(tx, currentUser, salesReturn.SaleID)
		if err != nil {
			return err
		}
		items, err := s.repo.Items(tx, currentUser.BusinessID, salesReturn.ID)
		if err != nil {
			return apperrors.Internal("failed to load sales return items")
		}
		if len(items) == 0 {
			return apperrors.BadRequest("sales return must have at least one item", nil)
		}
		if err := s.validateStoredReturnItems(tx, currentUser.BusinessID, sale.ID, salesReturn.ID, items); err != nil {
			return err
		}
		if err := s.validateStoredChargeRefunds(tx, currentUser.BusinessID, sale.ID, salesReturn.ID); err != nil {
			return err
		}
		if salesReturn.RefundMode == "refund" {
			if err := s.validateRefundRequest(tx, currentUser.BusinessID, sale.ID, sale.BranchID, salesReturn.RefundPaymentMethodID, salesReturn.RefundReferenceNumber, salesReturn.ReturnTotal); err != nil {
				return err
			}
		}
		for _, item := range items {
			if item.RestockAction != "restock" {
				continue
			}
			if err := s.applyRestockMovement(tx, currentUser, sale, salesReturn, item); err != nil {
				return err
			}
		}
		var refundID *string
		if salesReturn.RefundMode == "refund" {
			id, err := s.createPaymentRefund(tx, currentUser, sale, salesReturn)
			if err != nil {
				return err
			}
			refundID = &id
		}
		now := time.Now().UTC()
		updates := map[string]interface{}{
			"status":            "posted",
			"payment_refund_id": refundID,
			"posted_by_user_id": currentUser.UserID,
			"posted_at":         now,
			"updated_at":        now,
		}
		if err := s.repo.Update(tx, currentUser.BusinessID, salesReturn.ID, updates); err != nil {
			return apperrors.Internal("failed to post sales return")
		}
		// Only a "refund" return reverses revenue. A "none" return still posts
		// its inventory journal below, so the goods come back and COGS falls
		// while revenue stands — the sale is treated as earned because the
		// customer was not paid anything back.
		//
		// That is deliberate for a no-refund return, but it does raise reported
		// gross margin. If "none" is being used for returns settled outside the
		// system, the revenue side needs a counterparty account and this gate
		// has to change; refund_mode currently permits only 'none' and 'refund'
		// (see migration 000051).
		if salesReturn.RefundMode == "refund" && s.accountingService != nil {
			journalID, err := s.accountingService.PostSalesReturnJournal(tx, currentUser, salesReturn.ID)
			if err != nil {
				return err
			}
			if strings.TrimSpace(journalID) != "" {
				if err := s.repo.Update(tx, currentUser.BusinessID, salesReturn.ID, map[string]interface{}{"journal_entry_id": journalID, "updated_at": time.Now().UTC()}); err != nil {
					return apperrors.Internal("failed to attach sales return journal")
				}
			}
		}
		if s.accountingService != nil {
			if _, err := s.accountingService.PostSalesReturnInventoryJournal(tx, currentUser, salesReturn.ID); err != nil {
				return err
			}
		}
		if err := s.repo.RefreshSaleReturnTotals(tx, currentUser.BusinessID, sale.ID); err != nil {
			return apperrors.Internal("failed to update sale return status")
		}
		refreshed, err := s.repo.FindByID(tx, currentUser.BusinessID, salesReturn.ID)
		if err != nil {
			return err
		}
		posted = *refreshed
		return s.writeAudit(tx, currentUser, "sales_return.posted", salesReturn.ID, "Sales return posted.", ipAddress, userAgent)
	})
	if err != nil {
		return SalesReturnResponse{}, err
	}
	return s.repo.LoadResponse(currentUser.BusinessID, posted)
}

func (s *Service) Cancel(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) (SalesReturnResponse, error) {
	if currentUser == nil {
		return SalesReturnResponse{}, apperrors.Unauthorized("missing authenticated user")
	}
	var cancelled SalesReturn
	err := s.db.Transaction(func(tx *gorm.DB) error {
		salesReturn, err := s.repo.FindForUpdate(tx, currentUser.BusinessID, id)
		if err != nil {
			return mapNotFound(err, "sales return not found")
		}
		if salesReturn.Status != "draft" {
			return apperrors.BadRequest("only draft sales returns can be cancelled", nil)
		}
		if err := currentUser.EnsureRecordBranch(salesReturn.BranchID); err != nil {
			return err
		}
		now := time.Now().UTC()
		if err := s.repo.Update(tx, currentUser.BusinessID, salesReturn.ID, map[string]interface{}{
			"status":               "cancelled",
			"cancelled_by_user_id": currentUser.UserID,
			"cancelled_at":         now,
			"updated_at":           now,
		}); err != nil {
			return apperrors.Internal("failed to cancel sales return")
		}
		refreshed, err := s.repo.FindByID(tx, currentUser.BusinessID, salesReturn.ID)
		if err != nil {
			return err
		}
		cancelled = *refreshed
		return s.writeAudit(tx, currentUser, "sales_return.cancelled", salesReturn.ID, "Sales return cancelled.", ipAddress, userAgent)
	})
	if err != nil {
		return SalesReturnResponse{}, err
	}
	return s.repo.LoadResponse(currentUser.BusinessID, cancelled)
}

func (s *Service) ReturnableItems(currentUser *utils.AuthContext, saleID string) ([]ReturnableItemResponse, error) {
	if currentUser == nil {
		return nil, apperrors.Unauthorized("missing authenticated user")
	}
	sale, err := s.repo.FindSale(nil, currentUser.BusinessID, saleID)
	if err != nil {
		return nil, mapNotFound(err, "sale not found")
	}
	if err := currentUser.EnsureRecordBranch(sale.BranchID); err != nil {
		return nil, err
	}
	if sale.SaleStatus != "completed" {
		return nil, apperrors.BadRequest("only completed POS sales can be returned", nil)
	}
	items, err := s.repo.ListSaleItems(nil, currentUser.BusinessID, sale.ID)
	if err != nil {
		return nil, apperrors.Internal("failed to load sale items")
	}
	result := make([]ReturnableItemResponse, 0, len(items))
	for _, item := range items {
		returned, err := s.repo.PostedReturnedQuantity(s.db, currentUser.BusinessID, item.ID, "")
		if err != nil {
			return nil, apperrors.Internal("failed to calculate returned quantity")
		}
		itemName := item.ProductNameSnapshot
		if strings.TrimSpace(item.VariantNameSnapshot) != "" {
			itemName = strings.TrimSpace(item.ProductNameSnapshot + " - " + item.VariantNameSnapshot)
		}
		result = append(result, ReturnableItemResponse{
			SaleItemID:                item.ID,
			ProductID:                 item.ProductID,
			ProductVariantID:          item.ProductVariantID,
			ProductNameSnapshot:       item.ProductNameSnapshot,
			VariantNameSnapshot:       item.VariantNameSnapshot,
			ItemNameSnapshot:          itemName,
			SKUSnapshot:               item.SKUSnapshot,
			SoldQuantity:              item.Quantity,
			AlreadyReturnedQuantity:   roundQuantity(returned),
			ReturnableQuantity:        roundQuantity(item.Quantity - returned),
			UnitPrice:                 item.UnitPrice,
			DiscountAmount:            item.DiscountAmount,
			TaxRateID:                 item.TaxRateID,
			TaxRateNameSnapshot:       item.TaxRateNameSnapshot,
			TaxRatePercentageSnapshot: item.TaxRatePercentageSnapshot,
			TaxAmount:                 item.TaxAmount,
			LineSubtotal:              item.LineSubtotal,
			LineTotal:                 item.LineTotal,
		})
	}
	return result, nil
}

func (s *Service) ListBySale(currentUser *utils.AuthContext, saleID string) ([]SalesReturnResponse, error) {
	query := SalesReturnListQuery{SaleID: saleID, Page: 1, Limit: 100, SortOrder: "desc"}
	result, err := s.List(currentUser, query)
	if err != nil {
		return nil, err
	}
	return result.Items, nil
}

func (s *Service) validateSaleForReturn(tx *gorm.DB, currentUser *utils.AuthContext, saleID string) (*saleRow, error) {
	sale, err := s.repo.FindSaleForUpdate(tx, currentUser.BusinessID, saleID)
	if err != nil {
		return nil, mapNotFound(err, "sale not found")
	}
	if err := currentUser.EnsureRecordBranch(sale.BranchID); err != nil {
		return nil, err
	}
	if sale.SaleStatus != "completed" {
		return nil, apperrors.BadRequest("only completed POS sales can be returned", nil)
	}
	return sale, nil
}

func (s *Service) buildReturnItems(tx *gorm.DB, businessID, saleID, salesReturnID, excludeReturnID string, requests []SalesReturnItemRequest) ([]SalesReturnItem, float64, float64, float64, error) {
	if len(requests) == 0 {
		return nil, 0, 0, 0, apperrors.BadRequest("at least one return item is required", nil)
	}
	seen := map[string]struct{}{}
	now := time.Now().UTC()
	items := make([]SalesReturnItem, 0, len(requests))
	subtotal, tax, total := 0.0, 0.0, 0.0
	for _, req := range requests {
		saleItemID := strings.TrimSpace(req.SaleItemID)
		if _, ok := seen[saleItemID]; ok {
			return nil, 0, 0, 0, apperrors.BadRequest("duplicate sale_item_id in return items", map[string]interface{}{"sale_item_id": saleItemID})
		}
		seen[saleItemID] = struct{}{}
		if req.Quantity <= 0 {
			return nil, 0, 0, 0, apperrors.BadRequest("return quantity must be greater than zero", map[string]interface{}{"sale_item_id": saleItemID})
		}
		restockAction := strings.ToLower(strings.TrimSpace(req.RestockAction))
		if restockAction != "restock" && restockAction != "discard" {
			return nil, 0, 0, 0, apperrors.BadRequest("invalid restock_action", map[string]interface{}{"sale_item_id": saleItemID})
		}
		saleItem, err := s.repo.FindSaleItem(tx, businessID, saleID, saleItemID)
		if err != nil {
			return nil, 0, 0, 0, mapNotFound(err, "sale item not found")
		}
		postedReturned, err := s.repo.PostedReturnedQuantity(tx, businessID, saleItemID, excludeReturnID)
		if err != nil {
			return nil, 0, 0, 0, apperrors.Internal("failed to calculate returned quantity")
		}
		returnable := saleItem.Quantity - postedReturned
		if req.Quantity > returnable+0.0001 {
			return nil, 0, 0, 0, apperrors.BadRequest("return quantity exceeds returnable quantity", map[string]interface{}{
				"sale_item_id":        saleItemID,
				"returnable_quantity": roundQuantity(returnable),
			})
		}
		ratio := req.Quantity / saleItem.Quantity
		lineSubtotal := roundMoney(saleItem.LineSubtotal * ratio)
		lineDiscount := roundMoney(saleItem.DiscountAmount * ratio)
		lineTax := roundMoney(saleItem.TaxAmount * ratio)
		lineTotal := roundMoney(saleItem.LineTotal * ratio)
		item := SalesReturnItem{
			ID:                        utils.NewUUID(),
			BusinessID:                businessID,
			SalesReturnID:             salesReturnID,
			SaleItemID:                saleItem.ID,
			ProductID:                 saleItem.ProductID,
			ProductVariantID:          saleItem.ProductVariantID,
			ProductNameSnapshot:       saleItem.ProductNameSnapshot,
			VariantNameSnapshot:       saleItem.VariantNameSnapshot,
			SKUSnapshot:               saleItem.SKUSnapshot,
			Quantity:                  roundQuantity(req.Quantity),
			UnitPrice:                 saleItem.UnitPrice,
			DiscountAmount:            lineDiscount,
			TaxRateID:                 saleItem.TaxRateID,
			TaxRateNameSnapshot:       saleItem.TaxRateNameSnapshot,
			TaxRatePercentageSnapshot: saleItem.TaxRatePercentageSnapshot,
			TaxAmount:                 lineTax,
			LineSubtotal:              lineSubtotal,
			LineTotal:                 lineTotal,
			RestockAction:             restockAction,
			StockLocationID:           cleanStringPointer(req.StockLocationID),
			Reason:                    strings.TrimSpace(req.Reason),
			CreatedAt:                 now,
			UpdatedAt:                 now,
		}
		items = append(items, item)
		subtotal += lineSubtotal
		tax += lineTax
		total += lineTotal
	}
	return items, roundMoney(subtotal), roundMoney(tax), roundMoney(total), nil
}

func (s *Service) buildChargeRefunds(tx *gorm.DB, businessID, saleID, branchID, salesReturnID, excludeReturnID string, requests []charges.ChargeRefundInput) ([]charges.DocumentCharge, charges.ChargeTotals, error) {
	if len(requests) == 0 {
		return nil, charges.ChargeTotals{}, nil
	}
	seen := map[string]struct{}{}
	now := time.Now().UTC()
	rows := make([]charges.DocumentCharge, 0, len(requests))
	totals := charges.ChargeTotals{}
	for _, req := range requests {
		sourceID := strings.TrimSpace(req.SourceChargeID)
		if _, ok := seen[sourceID]; ok {
			return nil, charges.ChargeTotals{}, apperrors.BadRequest("duplicate source_charge_id in refund_charges", map[string]interface{}{"source_charge_id": sourceID})
		}
		seen[sourceID] = struct{}{}
		if _, err := uuid.Parse(sourceID); err != nil {
			return nil, charges.ChargeTotals{}, apperrors.BadRequest("source_charge_id must be a valid UUID", nil)
		}
		refundAmount := roundMoney(req.RefundAmount)
		if refundAmount <= 0 {
			return nil, charges.ChargeTotals{}, apperrors.BadRequest("charge refund_amount must be greater than zero", map[string]interface{}{"source_charge_id": sourceID})
		}
		source, remaining, err := s.sourceChargeRemaining(tx, businessID, saleID, sourceID, excludeReturnID)
		if err != nil {
			return nil, charges.ChargeTotals{}, err
		}
		if source.BranchID != branchID {
			return nil, charges.ChargeTotals{}, apperrors.BadRequest("source charge branch does not match sale branch", map[string]interface{}{"source_charge_id": sourceID})
		}
		if refundAmount > remaining+0.0001 {
			return nil, charges.ChargeTotals{}, apperrors.BadRequest("charge refund exceeds refundable charge balance", map[string]interface{}{
				"source_charge_id":            sourceID,
				"refund_amount":               refundAmount,
				"remaining_refundable_amount": roundMoney(remaining),
			})
		}
		if source.TotalAmount <= 0 {
			return nil, charges.ChargeTotals{}, apperrors.BadRequest("source charge has no refundable amount", map[string]interface{}{"source_charge_id": sourceID})
		}
		ratio := refundAmount / source.TotalAmount
		taxAmount := roundMoney(source.TaxAmount * ratio)
		netAmount := roundMoney(refundAmount - taxAmount)
		if netAmount < 0 {
			netAmount = 0
		}
		row := charges.DocumentCharge{
			ID:                        utils.NewUUID(),
			BusinessID:                businessID,
			BranchID:                  branchID,
			DocumentType:              "sales_return",
			DocumentID:                salesReturnID,
			ChargeType:                source.ChargeType,
			ChargeName:                source.ChargeName,
			Description:               cleanReason(req.Reason, "Charge refund"),
			Amount:                    netAmount,
			TaxRateID:                 source.TaxRateID,
			TaxRateNameSnapshot:       source.TaxRateNameSnapshot,
			TaxRatePercentageSnapshot: source.TaxRatePercentageSnapshot,
			TaxAmount:                 taxAmount,
			TotalAmount:               refundAmount,
			IsRefundable:              false,
			SourceChargeID:            &source.ID,
			CreatedAt:                 now,
			UpdatedAt:                 now,
		}
		rows = append(rows, row)
		totals.Amount = roundMoney(totals.Amount + row.Amount)
		totals.TaxAmount = roundMoney(totals.TaxAmount + row.TaxAmount)
		totals.Total = roundMoney(totals.Total + row.TotalAmount)
	}
	return rows, totals, nil
}

func (s *Service) replaceChargeRefunds(tx *gorm.DB, businessID, salesReturnID string, rows []charges.DocumentCharge) error {
	if err := tx.Model(&charges.DocumentCharge{}).
		Where("business_id = ? AND document_type = ? AND document_id = ? AND deleted_at IS NULL", businessID, "sales_return", salesReturnID).
		Update("deleted_at", gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}).Error; err != nil {
		return apperrors.Internal("failed to replace sales return charges")
	}
	if len(rows) == 0 {
		return nil
	}
	if err := tx.Create(&rows).Error; err != nil {
		return apperrors.Internal("failed to replace sales return charges")
	}
	return nil
}

func (s *Service) sourceChargeRemaining(tx *gorm.DB, businessID, saleID, sourceChargeID, excludeReturnID string) (*charges.DocumentCharge, float64, error) {
	var source charges.DocumentCharge
	if err := tx.Where("business_id = ? AND document_type = ? AND document_id = ? AND id = ? AND is_refundable = ? AND deleted_at IS NULL", businessID, "pos_sale", saleID, sourceChargeID, true).Take(&source).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, 0, apperrors.BadRequest("refundable source charge not found", map[string]interface{}{"source_charge_id": sourceChargeID})
		}
		return nil, 0, apperrors.Internal("failed to validate source charge")
	}
	var refunded float64
	query := tx.Table("document_charges dc").
		Select("COALESCE(SUM(dc.total_amount), 0)").
		Joins("JOIN sales_returns sr ON sr.id = dc.document_id AND sr.business_id = dc.business_id").
		Where("dc.business_id = ? AND dc.document_type = ? AND dc.source_charge_id = ? AND dc.deleted_at IS NULL AND sr.deleted_at IS NULL AND sr.status <> ?", businessID, "sales_return", sourceChargeID, "cancelled")
	if strings.TrimSpace(excludeReturnID) != "" {
		query = query.Where("sr.id <> ?", excludeReturnID)
	}
	if err := query.Scan(&refunded).Error; err != nil {
		return nil, 0, apperrors.Internal("failed to calculate refunded charge amount")
	}
	return &source, roundMoney(source.TotalAmount - refunded), nil
}

func (s *Service) validateStoredChargeRefunds(tx *gorm.DB, businessID, saleID, salesReturnID string) error {
	rows, err := charges.ListChargeRows(tx, businessID, "sales_return", salesReturnID)
	if err != nil {
		return apperrors.Internal("failed to load sales return charges")
	}
	for _, row := range rows {
		if row.SourceChargeID == nil || strings.TrimSpace(*row.SourceChargeID) == "" {
			return apperrors.BadRequest("sales return charge is missing source_charge_id", map[string]interface{}{"charge_id": row.ID})
		}
		_, remaining, err := s.sourceChargeRemaining(tx, businessID, saleID, *row.SourceChargeID, salesReturnID)
		if err != nil {
			return err
		}
		if row.TotalAmount > remaining+0.0001 {
			return apperrors.BadRequest("charge refund exceeds refundable charge balance", map[string]interface{}{
				"source_charge_id":            *row.SourceChargeID,
				"refund_amount":               roundMoney(row.TotalAmount),
				"remaining_refundable_amount": roundMoney(remaining),
			})
		}
	}
	return nil
}

func (s *Service) validateStoredReturnItems(tx *gorm.DB, businessID, saleID, excludeReturnID string, items []SalesReturnItem) error {
	for _, item := range items {
		saleItem, err := s.repo.FindSaleItem(tx, businessID, saleID, item.SaleItemID)
		if err != nil {
			return mapNotFound(err, "sale item not found")
		}
		postedReturned, err := s.repo.PostedReturnedQuantity(tx, businessID, item.SaleItemID, excludeReturnID)
		if err != nil {
			return apperrors.Internal("failed to calculate returned quantity")
		}
		if item.Quantity > saleItem.Quantity-postedReturned+0.0001 {
			return apperrors.BadRequest("return quantity exceeds returnable quantity", map[string]interface{}{
				"sale_item_id":        item.SaleItemID,
				"returnable_quantity": roundQuantity(saleItem.Quantity - postedReturned),
			})
		}
	}
	return nil
}

func (s *Service) validateRefundRequest(tx *gorm.DB, businessID, saleID, branchID string, paymentMethodID *string, reference string, amount float64) error {
	if amount <= 0 {
		return apperrors.BadRequest("refund amount must be greater than zero", nil)
	}
	if paymentMethodID == nil || strings.TrimSpace(*paymentMethodID) == "" {
		return apperrors.BadRequest("refund_payment_method_id is required when refund_mode=refund", nil)
	}
	method, err := s.repo.FindPaymentMethod(tx, businessID, strings.TrimSpace(*paymentMethodID))
	if err != nil {
		return mapNotFound(err, "payment method not found")
	}
	if method.RequiresReference && strings.TrimSpace(reference) == "" {
		return apperrors.BadRequest("refund_reference_number is required for this payment method", nil)
	}
	if method.DefaultPaymentAccountID == nil || strings.TrimSpace(method.ChartAccountID) == "" {
		return apperrors.BadRequest("refund payment method is not linked to an active payment account", map[string]interface{}{"payment_method": method.MethodName})
	}
	if method.PaymentAccountBranchID != nil && strings.TrimSpace(*method.PaymentAccountBranchID) != "" && *method.PaymentAccountBranchID != branchID {
		return apperrors.BadRequest("refund payment account is not available for this branch", map[string]interface{}{"payment_account": method.PaymentAccountName})
	}
	available, err := s.repo.AvailableRefundableAmount(tx, businessID, saleID)
	if err != nil {
		return apperrors.Internal("failed to calculate refundable amount")
	}
	if amount > available+0.0001 {
		return apperrors.BadRequest("refund amount exceeds available collected balance", map[string]interface{}{
			"refund_amount":               roundMoney(amount),
			"available_refundable_amount": roundMoney(available),
		})
	}
	return nil
}

func (s *Service) applyRestockMovement(tx *gorm.DB, currentUser *utils.AuthContext, sale *saleRow, salesReturn *SalesReturn, item SalesReturnItem) error {
	stock, err := s.repo.FindProductInventoryForReturn(tx, currentUser.BusinessID, sale.BranchID, item.ProductID, item.ProductVariantID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperrors.BadRequest("invalid product on sales return", nil)
		}
		return apperrors.Internal("failed to validate product inventory")
	}
	if !stock.IsStockTracked {
		return nil
	}
	itemName := stock.ProductName
	if stock.ProductVariantID != nil && strings.TrimSpace(stock.VariantName) != "" {
		itemName = strings.TrimSpace(stock.ProductName + " - " + stock.VariantName)
	}
	if stock.InventoryItemID == nil || strings.TrimSpace(*stock.InventoryItemID) == "" {
		return apperrors.BadRequest("inventory item not found for stock-tracked product "+itemName, nil)
	}
	unitCost, err := s.saleStockMovementUnitCost(tx, currentUser.BusinessID, sale.ID, *stock.InventoryItemID)
	if err != nil {
		return err
	}
	movement, err := s.inventoryService.ApplyMovement(tx, inventory.ApplyStockMovementInput{
		BusinessID:      currentUser.BusinessID,
		InventoryItemID: *stock.InventoryItemID,
		StockLocationID: item.StockLocationID,
		MovementType:    "return_in",
		Quantity:        item.Quantity,
		UnitCost:        unitCost,
		ReferenceType:   "sales_return",
		ReferenceID:     &salesReturn.ID,
		ReferenceNumber: salesReturn.ReturnNumber,
		Reason:          cleanReason(item.Reason, salesReturn.Reason),
		CreatedByUserID: currentUser.UserID,
	})
	if err != nil {
		return err
	}
	return s.repo.UpdateItem(tx, currentUser.BusinessID, item.ID, map[string]interface{}{
		"stock_movement_id": movement.ID,
		"stock_location_id": movement.StockLocationID,
		"updated_at":        time.Now().UTC(),
	})
}

func (s *Service) createPaymentRefund(tx *gorm.DB, currentUser *utils.AuthContext, sale *saleRow, salesReturn *SalesReturn) (string, error) {
	method, err := s.repo.FindPaymentMethod(tx, currentUser.BusinessID, *salesReturn.RefundPaymentMethodID)
	if err != nil {
		return "", mapNotFound(err, "payment method not found")
	}
	now := time.Now().UTC()
	refundNumber, err := s.repo.GeneratePaymentRefundNumber(tx, currentUser.BusinessID, now)
	if err != nil {
		return "", apperrors.Internal("failed to generate refund number")
	}
	refundID := utils.NewUUID()
	if err := tx.Table("payment_refunds").Create(map[string]interface{}{
		"id":                           refundID,
		"business_id":                  currentUser.BusinessID,
		"branch_id":                    sale.BranchID,
		"sale_id":                      sale.ID,
		"sale_payment_id":              nil,
		"sales_return_id":              salesReturn.ID,
		"refund_source":                "sales_return",
		"refund_number":                refundNumber,
		"payment_method_id":            method.ID,
		"payment_method_name_snapshot": method.MethodName,
		"refund_amount":                salesReturn.ReturnTotal,
		"refund_reason":                cleanReason(salesReturn.Reason, "Sales return "+salesReturn.ReturnNumber),
		"refund_status":                "completed",
		"approved_by_user_id":          currentUser.UserID,
		"created_by_user_id":           currentUser.UserID,
		"refunded_at":                  now,
		"created_at":                   now,
		"updated_at":                   now,
	}).Error; err != nil {
		return "", apperrors.Internal("failed to create refund history")
	}
	return refundID, nil
}

func normalizeCreateRequest(req CreateSalesReturnRequest) (normalizedRequest, error) {
	return normalizeRequest(req.SaleID, req.ReturnDate, req.Reason, req.RefundMode, req.RefundPaymentMethodID, req.RefundReferenceNumber, req.Items, req.RefundCharges)
}

func normalizeUpdateRequest(req UpdateSalesReturnRequest) (normalizedRequest, error) {
	return normalizeRequest("", req.ReturnDate, req.Reason, req.RefundMode, req.RefundPaymentMethodID, req.RefundReferenceNumber, req.Items, req.RefundCharges)
}

func normalizeRequest(saleID, returnDate, reason, refundMode string, refundPaymentMethodID *string, refundReferenceNumber string, items []SalesReturnItemRequest, refundCharges []charges.ChargeRefundInput) (normalizedRequest, error) {
	if strings.TrimSpace(saleID) != "" {
		if _, err := uuid.Parse(strings.TrimSpace(saleID)); err != nil {
			return normalizedRequest{}, apperrors.BadRequest("sale_id must be a valid UUID", nil)
		}
	}
	parsedDate, err := time.Parse("2006-01-02", strings.TrimSpace(returnDate))
	if err != nil {
		return normalizedRequest{}, apperrors.BadRequest("return_date must be YYYY-MM-DD", nil)
	}
	mode := strings.ToLower(strings.TrimSpace(refundMode))
	if mode != "none" && mode != "refund" {
		return normalizedRequest{}, apperrors.BadRequest("invalid refund_mode", nil)
	}
	if mode != "refund" && len(refundCharges) > 0 {
		return normalizedRequest{}, apperrors.BadRequest("refund_charges are only allowed when refund_mode=refund", nil)
	}
	return normalizedRequest{
		SaleID:                strings.TrimSpace(saleID),
		ReturnDate:            parsedDate,
		Reason:                strings.TrimSpace(reason),
		RefundMode:            mode,
		RefundPaymentMethodID: cleanStringPointer(refundPaymentMethodID),
		RefundReferenceNumber: strings.TrimSpace(refundReferenceNumber),
		Items:                 items,
		RefundCharges:         refundCharges,
	}, nil
}

func normalizeListQuery(query SalesReturnListQuery) SalesReturnListQuery {
	query.Page = normalizePositive(query.Page, 1)
	query.Limit = normalizeLimit(query.Limit)
	query.Search = strings.TrimSpace(query.Search)
	query.SaleID = strings.TrimSpace(query.SaleID)
	query.BranchID = strings.TrimSpace(query.BranchID)
	query.CustomerID = strings.TrimSpace(query.CustomerID)
	query.Status = strings.ToLower(strings.TrimSpace(query.Status))
	query.DateFrom = strings.TrimSpace(query.DateFrom)
	query.DateTo = strings.TrimSpace(query.DateTo)
	query.SortOrder = strings.ToLower(strings.TrimSpace(query.SortOrder))
	return query
}

func validateListQuery(currentUser *utils.AuthContext, query SalesReturnListQuery) error {
	for field, value := range map[string]string{"sale_id": query.SaleID, "branch_id": query.BranchID, "customer_id": query.CustomerID} {
		if value != "" {
			if _, err := uuid.Parse(value); err != nil {
				return apperrors.BadRequest(field+" must be a valid UUID", nil)
			}
		}
	}
	if query.BranchID != "" && !currentUser.CanAccessBranch(query.BranchID) {
		return apperrors.Forbidden("branch access denied")
	}
	if query.Status != "" && query.Status != "draft" && query.Status != "posted" && query.Status != "cancelled" {
		return apperrors.BadRequest("invalid status", nil)
	}
	if query.SortOrder != "" && query.SortOrder != "asc" && query.SortOrder != "desc" {
		return apperrors.BadRequest("invalid sort_order", nil)
	}
	if query.DateFrom != "" {
		if _, err := time.Parse("2006-01-02", query.DateFrom); err != nil {
			return apperrors.BadRequest("date_from must be YYYY-MM-DD", nil)
		}
	}
	if query.DateTo != "" {
		if _, err := time.Parse("2006-01-02", query.DateTo); err != nil {
			return apperrors.BadRequest("date_to must be YYYY-MM-DD", nil)
		}
	}
	if query.DateFrom != "" && query.DateTo != "" && query.DateFrom > query.DateTo {
		return apperrors.BadRequest("date_from must be before or equal to date_to", nil)
	}
	return nil
}

func hasAnyPermission(currentUser *utils.AuthContext, permissions ...string) bool {
	if currentUser == nil {
		return false
	}
	for _, userPermission := range currentUser.Permissions {
		for _, required := range permissions {
			if userPermission == required {
				return true
			}
		}
	}
	return false
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

func cleanReason(primary, fallback string) string {
	primary = strings.TrimSpace(primary)
	if primary != "" {
		return primary
	}
	return strings.TrimSpace(fallback)
}

func normalizePositive(value, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return value
}

func normalizeLimit(value int) int {
	if value <= 0 {
		return 20
	}
	if value > 100 {
		return 100
	}
	return value
}

func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}

func roundQuantity(value float64) float64 {
	return math.Round(value*10000) / 10000
}

func (s *Service) saleStockMovementUnitCost(tx *gorm.DB, businessID, saleID, inventoryItemID string) (float64, error) {
	var unitCost float64
	err := tx.Table("stock_movements").
		Select("COALESCE(SUM(total_cost) / NULLIF(SUM(quantity), 0), 0)").
		Where("business_id = ? AND reference_type = ? AND reference_id = ? AND inventory_item_id = ? AND movement_direction = ? AND deleted_at IS NULL", businessID, "sale", saleID, inventoryItemID, "out").
		Scan(&unitCost).Error
	if err != nil {
		return 0, apperrors.Internal("failed to calculate original sale stock cost")
	}
	return unitCost, nil
}

func mapNotFound(err error, message string) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apperrors.NotFound(message)
	}
	return apperrors.Internal(message)
}

func (s *Service) writeAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	if s.auditRepo == nil || currentUser == nil {
		return nil
	}
	metadata := s.salesReturnAuditMetadata(tx, currentUser.BusinessID, entityID)
	return s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "sales_return",
		EntityID:    entityID,
		Summary:     summary,
		Metadata:    audit.Metadata(metadata, nil),
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	})
}

func (s *Service) salesReturnAuditMetadata(tx *gorm.DB, businessID, entityID string) map[string]interface{} {
	metadata := map[string]interface{}{"source_module": "sales_returns"}
	if tx == nil || strings.TrimSpace(entityID) == "" {
		return metadata
	}
	var row struct {
		ReturnNumber          string
		RefundReferenceNumber string
	}
	_ = tx.Unscoped().Table("sales_returns").Select("return_number, refund_reference_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
	metadata["return_number"] = row.ReturnNumber
	metadata["sales_return_number"] = row.ReturnNumber
	metadata["document_number"] = row.ReturnNumber
	metadata["reference_number"] = row.RefundReferenceNumber
	return metadata
}
