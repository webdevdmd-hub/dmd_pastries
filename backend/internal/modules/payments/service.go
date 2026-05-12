package payments

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

func NewService(db *gorm.DB, repo *Repository, auditRepo *audit.Repository) *Service {
	return &Service{db: db, repo: repo, auditRepo: auditRepo}
}

func (s *Service) ListPayments(currentUser *utils.AuthContext, query PaymentListQuery) (*PaginatedResponse[PaymentResponse], error) {
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
	items, total, err := s.repo.ListPayments(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list payments")
	}
	return &PaginatedResponse[PaymentResponse]{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) GetPayment(currentUser *utils.AuthContext, id string) (*PaymentResponse, error) {
	payment, err := s.repo.FindPayment(currentUser.BusinessID, id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("payment not found")
		}
		return nil, apperrors.Internal("failed to load payment")
	}
	if !currentUser.CanAccessBranch(payment.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	return payment, nil
}

func (s *Service) SalePayments(currentUser *utils.AuthContext, saleID string) (*SalePaymentsResponse, error) {
	sale, err := s.repo.FindSale(s.db, currentUser.BusinessID, saleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("sale not found")
		}
		return nil, apperrors.Internal("failed to load sale")
	}
	if !currentUser.CanAccessBranch(sale.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	payments, err := s.repo.ListSalePayments(currentUser.BusinessID, saleID)
	if err != nil {
		return nil, apperrors.Internal("failed to load sale payments")
	}
	paid, refunded, err := s.repo.SalePaymentTotals(s.db, currentUser.BusinessID, saleID)
	if err != nil {
		return nil, apperrors.Internal("failed to calculate payment totals")
	}
	netPaid := roundMoney(paid - refunded)
	return &SalePaymentsResponse{
		SaleID:                    sale.ID,
		SaleNumber:                sale.SaleNumber,
		TotalAmount:               sale.TotalAmount,
		TotalPaid:                 roundMoney(paid),
		TotalRefunded:             roundMoney(refunded),
		RemainingBalance:          roundMoney(maxFloat(sale.TotalAmount-netPaid, 0)),
		RemainingRefundableAmount: roundMoney(maxFloat(netPaid, 0)),
		Payments:                  payments,
	}, nil
}

func (s *Service) AddPayment(currentUser *utils.AuthContext, saleID string, req AddPaymentRequest, ipAddress, userAgent string) (*SalePaymentsResponse, error) {
	if req.Amount <= 0 {
		return nil, apperrors.BadRequest("amount must be > 0", nil)
	}
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	defer rollbackIfOpen(tx)

	sale, err := s.repo.FindSale(tx, currentUser.BusinessID, saleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("sale not found")
		}
		return nil, apperrors.Internal("failed to load sale")
	}
	if sale.SaleStatus == "voided" || sale.SaleStatus == "refunded" {
		return nil, apperrors.BadRequest("sale cannot accept new payments", nil)
	}
	if !currentUser.CanAccessBranch(sale.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	method, err := s.repo.FindPaymentMethod(tx, currentUser.BusinessID, req.PaymentMethodID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.BadRequest("invalid payment_method_id", nil)
		}
		return nil, apperrors.Internal("failed to validate payment method")
	}
	if method.RequiresReference && strings.TrimSpace(req.ReferenceNumber) == "" {
		return nil, apperrors.BadRequest("reference_number is required for this payment method", nil)
	}
	paid, refunded, err := s.repo.SalePaymentTotals(tx, currentUser.BusinessID, sale.ID)
	if err != nil {
		return nil, apperrors.Internal("failed to calculate payment totals")
	}
	remaining := roundMoney(sale.TotalAmount - (paid - refunded))
	overpayAmount := roundMoney(req.Amount - remaining)
	if overpayAmount > 0 && method.MethodType != "cash" {
		return nil, apperrors.BadRequest("non-cash payment amount exceeds remaining balance", nil)
	}
	now := time.Now().UTC()
	payment := &SalePayment{
		ID:                        utils.NewUUID(),
		BusinessID:                currentUser.BusinessID,
		BranchID:                  sale.BranchID,
		SaleID:                    sale.ID,
		PaymentMethodID:           method.ID,
		PaymentMethodNameSnapshot: method.MethodName,
		PaymentMethodTypeSnapshot: method.MethodType,
		Amount:                    roundMoney(req.Amount),
		ReferenceNumber:           strings.TrimSpace(req.ReferenceNumber),
		ProviderTransactionID:     strings.TrimSpace(req.ProviderTransactionID),
		PaymentStatus:             "completed",
		PaidByUserID:              currentUser.UserID,
		Notes:                     strings.TrimSpace(req.Notes),
		PaidAt:                    now,
	}
	if err := s.repo.CreatePayment(tx, payment); err != nil {
		return nil, apperrors.Internal("failed to create payment")
	}
	if err := s.syncSalePaymentStatus(tx, currentUser.BusinessID, sale.ID, now, roundMoney(maxFloat(sale.ChangeAmount, overpayAmount))); err != nil {
		return nil, err
	}
	if err := s.writeAudit(tx, currentUser, "payment.added", payment.ID, "Payment added.", ipAddress, userAgent); err != nil {
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit payment")
	}
	tx = nil
	return s.SalePayments(currentUser, sale.ID)
}

func (s *Service) RefundPayment(currentUser *utils.AuthContext, paymentID string, req RefundPaymentRequest, ipAddress, userAgent string) (*PaymentRefundResponse, error) {
	if req.RefundAmount <= 0 {
		return nil, apperrors.BadRequest("refund_amount must be > 0", nil)
	}
	if strings.TrimSpace(req.RefundReason) == "" {
		return nil, apperrors.BadRequest("refund_reason is required", nil)
	}
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	defer rollbackIfOpen(tx)

	payment, err := s.repo.FindPaymentModel(tx, currentUser.BusinessID, paymentID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("payment not found")
		}
		return nil, apperrors.Internal("failed to load payment")
	}
	if payment.PaymentStatus != "completed" && payment.PaymentStatus != "partially_refunded" {
		return nil, apperrors.BadRequest("payment cannot be refunded", nil)
	}
	if !currentUser.CanAccessBranch(payment.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	sale, err := s.repo.FindSale(tx, currentUser.BusinessID, payment.SaleID)
	if err != nil {
		return nil, apperrors.Internal("failed to load sale")
	}
	if sale.SaleStatus == "voided" {
		return nil, apperrors.BadRequest("voided sale cannot be refunded", nil)
	}
	if _, err := s.repo.FindPaymentMethod(tx, currentUser.BusinessID, payment.PaymentMethodID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.BadRequest("inactive payment method cannot be refunded", nil)
		}
		return nil, apperrors.Internal("failed to validate payment method")
	}
	refunded, err := s.repo.PaymentRefundedAmount(tx, currentUser.BusinessID, payment.ID)
	if err != nil {
		return nil, apperrors.Internal("failed to calculate refundable amount")
	}
	remaining := roundMoney(payment.Amount - refunded)
	if req.RefundAmount > remaining {
		return nil, apperrors.BadRequest("refund_amount exceeds refundable amount", nil)
	}
	paidTotal, refundedTotal, err := s.repo.SalePaymentTotals(tx, currentUser.BusinessID, payment.SaleID)
	if err != nil {
		return nil, apperrors.Internal("failed to calculate sale refundable amount")
	}
	if req.RefundAmount > roundMoney(paidTotal-refundedTotal) {
		return nil, apperrors.BadRequest("refund_amount exceeds sale refundable amount", nil)
	}
	now := time.Now().UTC()
	refundNumber, err := s.repo.GenerateRefundNumber(tx, currentUser.BusinessID, now)
	if err != nil {
		return nil, apperrors.Internal("failed to generate refund number")
	}
	refund := &PaymentRefund{
		ID:                        utils.NewUUID(),
		BusinessID:                currentUser.BusinessID,
		BranchID:                  payment.BranchID,
		SaleID:                    payment.SaleID,
		SalePaymentID:             &payment.ID,
		RefundNumber:              refundNumber,
		PaymentMethodID:           payment.PaymentMethodID,
		PaymentMethodNameSnapshot: payment.PaymentMethodNameSnapshot,
		RefundAmount:              roundMoney(req.RefundAmount),
		RefundReason:              strings.TrimSpace(req.RefundReason),
		RefundStatus:              "completed",
		ApprovedByUserID:          cleanStringPointer(req.ApprovedByUserID),
		CreatedByUserID:           currentUser.UserID,
		RefundedAt:                now,
	}
	if err := s.repo.CreateRefund(tx, refund); err != nil {
		return nil, apperrors.Internal("failed to create payment refund")
	}
	newRefunded := roundMoney(refunded + refund.RefundAmount)
	status := "partially_refunded"
	if newRefunded >= payment.Amount {
		status = "refunded"
	}
	if err := s.repo.UpdatePayment(tx, currentUser.BusinessID, payment.ID, map[string]interface{}{"payment_status": status, "updated_at": now}); err != nil {
		return nil, apperrors.Internal("failed to update payment status")
	}
	if err := s.syncSalePaymentStatus(tx, currentUser.BusinessID, sale.ID, now, sale.ChangeAmount); err != nil {
		return nil, err
	}
	if err := s.writeAudit(tx, currentUser, "payment.refunded", payment.ID, "Payment refunded.", ipAddress, userAgent); err != nil {
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit payment refund")
	}
	tx = nil
	row, err := s.repo.FindRefund(currentUser.BusinessID, refund.ID)
	if err != nil {
		return nil, apperrors.Internal("failed to load refund")
	}
	return row, nil
}

func (s *Service) ListRefunds(currentUser *utils.AuthContext, query RefundListQuery) (*PaginatedResponse[PaymentRefundResponse], error) {
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
	items, total, err := s.repo.ListRefunds(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list refunds")
	}
	return &PaginatedResponse[PaymentRefundResponse]{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) GetRefund(currentUser *utils.AuthContext, id string) (*PaymentRefundResponse, error) {
	refund, err := s.repo.FindRefund(currentUser.BusinessID, id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("refund not found")
		}
		return nil, apperrors.Internal("failed to load refund")
	}
	if !currentUser.CanAccessBranch(refund.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	return refund, nil
}

func (s *Service) DailySummary(currentUser *utils.AuthContext, date, branchID, ipAddress, userAgent string) (*DailySummaryResponse, error) {
	if strings.TrimSpace(date) == "" {
		date = time.Now().UTC().Format("2006-01-02")
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		return nil, apperrors.BadRequest("date must be YYYY-MM-DD", nil)
	}
	resolvedBranchID, allBranches, err := currentUser.ResolveBranchScope(branchID, "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		branchID = resolvedBranchID
	} else {
		branchID = ""
	}
	result, err := s.repo.DailySummary(currentUser.BusinessID, date, branchID)
	if err != nil {
		return nil, apperrors.Internal("failed to load daily payment summary")
	}
	_ = s.writeAudit(s.db, currentUser, "payment.summary.viewed", currentUser.BusinessID, "Daily payment summary viewed.", ipAddress, userAgent)
	return result, nil
}

func (s *Service) MethodSummary(currentUser *utils.AuthContext, dateFrom, dateTo, branchID, ipAddress, userAgent string) ([]PaymentSummaryByMethod, error) {
	if err := validateDateRange(dateFrom, dateTo); err != nil {
		return nil, err
	}
	resolvedBranchID, allBranches, err := currentUser.ResolveBranchScope(branchID, "")
	if err != nil {
		return nil, err
	}
	if !allBranches {
		branchID = resolvedBranchID
	} else {
		branchID = ""
	}
	items, err := s.repo.MethodSummary(currentUser.BusinessID, dateFrom, dateTo, branchID)
	if err != nil {
		return nil, apperrors.Internal("failed to load payment summary")
	}
	_ = s.writeAudit(s.db, currentUser, "payment.summary.viewed", currentUser.BusinessID, "Payment method summary viewed.", ipAddress, userAgent)
	return items, nil
}

func (s *Service) CreateReconciliation(currentUser *utils.AuthContext, req CreateReconciliationRequest, ipAddress, userAgent string) (*ReconciliationResponse, error) {
	branchID, err := currentUser.ResolveOperationalBranch(req.BranchID)
	if err != nil {
		return nil, err
	}
	req.BranchID = branchID
	if req.CountedAmount < 0 {
		return nil, apperrors.BadRequest("counted_amount must be >= 0", nil)
	}
	date, err := time.Parse("2006-01-02", req.ReconciliationDate)
	if err != nil {
		return nil, apperrors.BadRequest("reconciliation_date must be YYYY-MM-DD", nil)
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "submitted"
	}
	if status != "draft" && status != "submitted" {
		return nil, apperrors.BadRequest("status must be draft or submitted", nil)
	}
	if ok, err := s.repo.BranchExists(s.db, currentUser.BusinessID, req.BranchID); err != nil {
		return nil, apperrors.Internal("failed to validate branch")
	} else if !ok {
		return nil, apperrors.BadRequest("invalid branch_id", nil)
	}
	if _, err := s.repo.FindPaymentMethod(s.db, currentUser.BusinessID, req.PaymentMethodID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.BadRequest("invalid payment_method_id", nil)
		}
		return nil, apperrors.Internal("failed to validate payment method")
	}
	expected, err := s.repo.ExpectedAmount(currentUser.BusinessID, req.BranchID, req.PaymentMethodID, date)
	if err != nil {
		return nil, apperrors.Internal("failed to calculate expected amount")
	}
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	defer rollbackIfOpen(tx)
	reconciliation := &PaymentReconciliation{
		ID:                 utils.NewUUID(),
		BusinessID:         currentUser.BusinessID,
		BranchID:           req.BranchID,
		ReconciliationDate: date,
		PaymentMethodID:    req.PaymentMethodID,
		ExpectedAmount:     expected,
		CountedAmount:      roundMoney(req.CountedAmount),
		DifferenceAmount:   roundMoney(req.CountedAmount - expected),
		Status:             status,
		CreatedByUserID:    currentUser.UserID,
		Notes:              strings.TrimSpace(req.Notes),
	}
	if err := s.repo.CreateReconciliation(tx, reconciliation); err != nil {
		return nil, apperrors.Internal("failed to create reconciliation")
	}
	if err := s.writeAudit(tx, currentUser, "reconciliation.created", reconciliation.ID, "Payment reconciliation created.", ipAddress, userAgent); err != nil {
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit reconciliation")
	}
	tx = nil
	return s.repo.FindReconciliation(currentUser.BusinessID, reconciliation.ID)
}

func (s *Service) ListReconciliations(currentUser *utils.AuthContext, query ReconciliationListQuery) (*PaginatedResponse[ReconciliationResponse], error) {
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
	items, total, err := s.repo.ListReconciliations(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list reconciliations")
	}
	return &PaginatedResponse[ReconciliationResponse]{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) GetReconciliation(currentUser *utils.AuthContext, id string) (*ReconciliationResponse, error) {
	item, err := s.repo.FindReconciliation(currentUser.BusinessID, id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("reconciliation not found")
		}
		return nil, apperrors.Internal("failed to load reconciliation")
	}
	if !currentUser.CanAccessBranch(item.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	return item, nil
}

func (s *Service) writeAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{BusinessID: currentUser.BusinessID, ActorUserID: currentUser.UserID, EventType: eventType, EntityType: "payment", EntityID: entityID, Summary: summary, IPAddress: ipAddress, UserAgent: userAgent}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

func salePaymentStatus(paidAmount, totalAmount float64) string {
	if paidAmount <= 0 {
		return "unpaid"
	}
	if paidAmount+0.0001 >= totalAmount {
		return "paid"
	}
	return "partial"
}

func salePaymentStatusFromTotals(paidAmount, totalAmount, refundedAmount float64) string {
	if paidAmount <= 0 && refundedAmount > 0 {
		return "refunded"
	}
	return salePaymentStatus(paidAmount, totalAmount)
}

func (s *Service) syncSalePaymentStatus(tx *gorm.DB, businessID, saleID string, now time.Time, changeAmount float64) error {
	sale, err := s.repo.FindSale(tx, businessID, saleID)
	if err != nil {
		return apperrors.Internal("failed to load sale")
	}
	paid, refunded, err := s.repo.SalePaymentTotals(tx, businessID, saleID)
	if err != nil {
		return apperrors.Internal("failed to calculate sale payment status")
	}
	netPaid := roundMoney(paid - refunded)
	updates := map[string]interface{}{
		"paid_amount":    netPaid,
		"payment_status": salePaymentStatusFromTotals(netPaid, sale.TotalAmount, refunded),
		"change_amount":  changeAmount,
		"updated_at":     now,
	}
	if refunded > 0 {
		if netPaid <= 0 {
			updates["sale_status"] = "refunded"
		} else {
			updates["sale_status"] = "partially_refunded"
		}
	}
	if err := s.repo.UpdateSale(tx, businessID, saleID, updates); err != nil {
		return apperrors.Internal("failed to synchronize sale payment status")
	}
	return nil
}

func validateDateRange(dateFrom, dateTo string) error {
	var from, to time.Time
	var err error
	if strings.TrimSpace(dateFrom) != "" {
		from, err = time.Parse("2006-01-02", dateFrom)
		if err != nil {
			return apperrors.BadRequest("date_from must be YYYY-MM-DD", nil)
		}
	}
	if strings.TrimSpace(dateTo) != "" {
		to, err = time.Parse("2006-01-02", dateTo)
		if err != nil {
			return apperrors.BadRequest("date_to must be YYYY-MM-DD", nil)
		}
	}
	if !from.IsZero() && !to.IsZero() && from.After(to) {
		return apperrors.BadRequest("date_from cannot be after date_to", nil)
	}
	return nil
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

func maxFloat(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func rollbackIfOpen(tx *gorm.DB) {
	if tx != nil {
		_ = tx.Rollback().Error
	}
}
