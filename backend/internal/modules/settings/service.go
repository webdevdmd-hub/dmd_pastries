package settings

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	"pastries-pos/internal/modules/businesses"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db           *gorm.DB
	repo         *Repository
	businessRepo *businesses.Repository
	auditRepo    *audit.Repository
}

func NewService(db *gorm.DB, repo *Repository, businessRepo *businesses.Repository, auditRepo *audit.Repository) *Service {
	return &Service{db: db, repo: repo, businessRepo: businessRepo, auditRepo: auditRepo}
}

func (s *Service) GetCompanySettings(currentUser *utils.AuthContext) (*CompanySettingsResponse, error) {
	settings, err := s.ensureCompanySettings(currentUser.BusinessID)
	if err != nil {
		return nil, err
	}
	response := toCompanySettingsResponse(*settings)
	return &response, nil
}

func (s *Service) UpdateCompanySettings(currentUser *utils.AuthContext, req UpdateCompanySettingsRequest, ipAddress, userAgent string) (*CompanySettingsResponse, error) {
	settings, err := s.ensureCompanySettings(currentUser.BusinessID)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{}
	if req.BusinessDisplayName != "" {
		updates["business_display_name"] = strings.TrimSpace(req.BusinessDisplayName)
	}
	if req.LogoFileID != "" {
		updates["logo_file_id"] = strings.TrimSpace(req.LogoFileID)
	}
	if req.Address != "" {
		updates["address"] = strings.TrimSpace(req.Address)
	}
	if req.Phone != "" {
		updates["phone"] = strings.TrimSpace(req.Phone)
	}
	if req.Email != "" {
		updates["email"] = strings.ToLower(strings.TrimSpace(req.Email))
	}
	if req.Website != "" {
		updates["website"] = strings.TrimSpace(req.Website)
	}
	if req.VATNumber != "" {
		updates["vat_number"] = strings.TrimSpace(req.VATNumber)
	}
	if req.Currency != "" {
		updates["currency"] = strings.ToUpper(strings.TrimSpace(req.Currency))
	}
	if req.Timezone != "" {
		updates["timezone"] = strings.TrimSpace(req.Timezone)
	}
	if req.InvoiceFooter != "" {
		updates["invoice_footer"] = strings.TrimSpace(req.InvoiceFooter)
	}
	if req.ReceiptFooter != "" {
		updates["receipt_footer"] = strings.TrimSpace(req.ReceiptFooter)
	}
	if len(updates) == 0 {
		response := toCompanySettingsResponse(*settings)
		return &response, nil
	}

	updates["updated_at"] = time.Now().UTC()
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.UpdateCompanySettings(tx, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to update company settings")
	}
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   "settings.company.updated",
		EntityType:  "settings",
		EntityID:    settings.ID,
		Summary:     "Company settings updated.",
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create activity log")
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit company settings update")
	}

	updated, err := s.repo.FindCompanySettingsByBusinessID(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to reload company settings")
	}
	response := toCompanySettingsResponse(*updated)
	return &response, nil
}

func (s *Service) GetOverview(currentUser *utils.AuthContext) (*SettingsOverviewResponse, error) {
	settings, err := s.ensureCompanySettings(currentUser.BusinessID)
	if err != nil {
		return nil, err
	}
	branchCount, err := s.repo.CountBranches(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to count branches")
	}
	activeTaxRatesCount, err := s.repo.CountActiveTaxRates(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to count tax rates")
	}
	activePaymentMethodsCount, err := s.repo.CountActivePaymentMethods(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to count payment methods")
	}

	return &SettingsOverviewResponse{
		CompanyProfileCompleted:   settings.BusinessDisplayName != "" && settings.Currency != "" && settings.Timezone != "",
		BranchCount:               branchCount,
		ActiveTaxRatesCount:       activeTaxRatesCount,
		ActivePaymentMethodsCount: activePaymentMethodsCount,
		DefaultCurrency:           settings.Currency,
		DefaultTimezone:           settings.Timezone,
	}, nil
}

func (s *Service) ListPaymentMethods(currentUser *utils.AuthContext) ([]PaymentMethodResponse, error) {
	methods, err := s.repo.ListPaymentMethods(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to list payment methods")
	}
	response := make([]PaymentMethodResponse, 0, len(methods))
	for _, method := range methods {
		response = append(response, toPaymentMethodResponse(method))
	}
	return response, nil
}

func (s *Service) GetPaymentMethod(currentUser *utils.AuthContext, id string) (*PaymentMethodResponse, error) {
	method, err := s.repo.FindPaymentMethod(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("payment method not found")
		}
		return nil, apperrors.Internal("failed to fetch payment method")
	}
	response := toPaymentMethodResponse(*method)
	return &response, nil
}

func (s *Service) CreatePaymentMethod(currentUser *utils.AuthContext, req CreatePaymentMethodRequest, ipAddress, userAgent string) (*PaymentMethodResponse, error) {
	name := strings.TrimSpace(req.MethodName)
	methodType := strings.TrimSpace(req.MethodType)
	if name == "" || methodType == "" {
		return nil, apperrors.BadRequest("method_name and method_type are required", nil)
	}
	if err := validatePaymentMethodType(methodType); err != nil {
		return nil, err
	}
	exists, err := s.repo.PaymentMethodNameExists(currentUser.BusinessID, name, "")
	if err != nil {
		return nil, apperrors.Internal("failed to validate payment method")
	}
	if exists {
		return nil, apperrors.Conflict("payment method name already exists", nil)
	}

	method := &PaymentMethod{
		ID:                utils.NewUUID(),
		BusinessID:        currentUser.BusinessID,
		MethodName:        name,
		MethodType:        methodType,
		IsDefault:         req.IsDefault,
		AllowSplitPayment: req.AllowSplitPayment,
		RequiresReference: req.RequiresReference,
		Status:            "active",
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if method.IsDefault {
		if err := s.repo.ClearDefaultPaymentMethods(tx, currentUser.BusinessID, ""); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to update default payment method")
		}
	}
	if err := s.repo.CreatePaymentMethod(tx, method); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create payment method")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "payment_method.created", "payment_method", method.ID, "Payment method created.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit payment method creation")
	}
	return s.GetPaymentMethod(currentUser, method.ID)
}

func (s *Service) UpdatePaymentMethod(currentUser *utils.AuthContext, id string, req UpdatePaymentMethodRequest, ipAddress, userAgent string) (*PaymentMethodResponse, error) {
	if _, err := s.repo.FindPaymentMethod(id, currentUser.BusinessID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("payment method not found")
		}
		return nil, apperrors.Internal("failed to fetch payment method")
	}

	updates := map[string]interface{}{}
	if req.MethodName != "" {
		name := strings.TrimSpace(req.MethodName)
		exists, err := s.repo.PaymentMethodNameExists(currentUser.BusinessID, name, id)
		if err != nil {
			return nil, apperrors.Internal("failed to validate payment method")
		}
		if exists {
			return nil, apperrors.Conflict("payment method name already exists", nil)
		}
		updates["method_name"] = name
	}
	if req.MethodType != "" {
		methodType := strings.TrimSpace(req.MethodType)
		if err := validatePaymentMethodType(methodType); err != nil {
			return nil, err
		}
		updates["method_type"] = methodType
	}
	if req.IsDefault != nil {
		updates["is_default"] = *req.IsDefault
	}
	if req.AllowSplitPayment != nil {
		updates["allow_split_payment"] = *req.AllowSplitPayment
	}
	if req.RequiresReference != nil {
		updates["requires_reference"] = *req.RequiresReference
	}
	if len(updates) == 0 {
		return s.GetPaymentMethod(currentUser, id)
	}
	updates["updated_at"] = time.Now().UTC()

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if req.IsDefault != nil && *req.IsDefault {
		if err := s.repo.ClearDefaultPaymentMethods(tx, currentUser.BusinessID, id); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to update default payment method")
		}
	}
	if err := s.repo.UpdatePaymentMethod(tx, id, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("payment method not found")
		}
		return nil, apperrors.Internal("failed to update payment method")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "payment_method.updated", "payment_method", id, "Payment method updated.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit payment method update")
	}
	return s.GetPaymentMethod(currentUser, id)
}

func (s *Service) UpdatePaymentMethodStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*PaymentMethodResponse, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	updates := map[string]interface{}{"status": req.Status, "updated_at": time.Now().UTC()}
	if req.Status == "inactive" {
		updates["is_default"] = false
	}
	if err := s.repo.UpdatePaymentMethod(tx, id, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("payment method not found")
		}
		return nil, apperrors.Internal("failed to update payment method status")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "payment_method.status_changed", "payment_method", id, "Payment method status changed.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit payment method status update")
	}
	return s.GetPaymentMethod(currentUser, id)
}

func (s *Service) DeletePaymentMethod(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) error {
	tx := s.db.Begin()
	if tx.Error != nil {
		return apperrors.Internal("failed to start transaction")
	}
	updates := map[string]interface{}{"status": "inactive", "is_default": false, "updated_at": time.Now().UTC()}
	if err := s.repo.UpdatePaymentMethod(tx, id, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("payment method not found")
		}
		return apperrors.Internal("failed to deactivate payment method")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "payment_method.deleted", "payment_method", id, "Payment method deactivated.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return apperrors.Internal("failed to commit payment method deactivation")
	}
	return nil
}

func (s *Service) ListTaxRates(currentUser *utils.AuthContext) ([]TaxRateResponse, error) {
	taxRates, err := s.repo.ListTaxRates(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to list tax rates")
	}
	response := make([]TaxRateResponse, 0, len(taxRates))
	for _, taxRate := range taxRates {
		response = append(response, toTaxRateResponse(taxRate))
	}
	return response, nil
}

func (s *Service) GetTaxRate(currentUser *utils.AuthContext, id string) (*TaxRateResponse, error) {
	taxRate, err := s.repo.FindTaxRate(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("tax rate not found")
		}
		return nil, apperrors.Internal("failed to fetch tax rate")
	}
	response := toTaxRateResponse(*taxRate)
	return &response, nil
}

func (s *Service) CreateTaxRate(currentUser *utils.AuthContext, req CreateTaxRateRequest, ipAddress, userAgent string) (*TaxRateResponse, error) {
	name := strings.TrimSpace(req.TaxName)
	taxType := strings.TrimSpace(req.TaxType)
	if name == "" || taxType == "" {
		return nil, apperrors.BadRequest("tax_name and tax_type are required", nil)
	}
	if err := validateTaxType(taxType); err != nil {
		return nil, err
	}
	if req.RatePercentage < 0 || req.RatePercentage > 100 {
		return nil, apperrors.BadRequest("rate_percentage must be between 0 and 100", nil)
	}
	exists, err := s.repo.TaxRateNameExists(currentUser.BusinessID, name, "")
	if err != nil {
		return nil, apperrors.Internal("failed to validate tax rate")
	}
	if exists {
		return nil, apperrors.Conflict("tax rate name already exists", nil)
	}

	taxRate := &TaxRate{
		ID:             utils.NewUUID(),
		BusinessID:     currentUser.BusinessID,
		TaxName:        name,
		TaxType:        taxType,
		RatePercentage: req.RatePercentage,
		IsInclusive:    req.IsInclusive,
		Country:        strings.TrimSpace(req.Country),
		Region:         strings.TrimSpace(req.Region),
		IsDefault:      req.IsDefault,
		Status:         "active",
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if taxRate.IsDefault {
		if err := s.repo.ClearDefaultTaxRates(tx, currentUser.BusinessID, ""); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to update default tax rate")
		}
	}
	if err := s.repo.CreateTaxRate(tx, taxRate); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create tax rate")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "tax_rate.created", "tax_rate", taxRate.ID, "Tax rate created.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit tax rate creation")
	}
	return s.GetTaxRate(currentUser, taxRate.ID)
}

func (s *Service) UpdateTaxRate(currentUser *utils.AuthContext, id string, req UpdateTaxRateRequest, ipAddress, userAgent string) (*TaxRateResponse, error) {
	if _, err := s.repo.FindTaxRate(id, currentUser.BusinessID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("tax rate not found")
		}
		return nil, apperrors.Internal("failed to fetch tax rate")
	}

	updates := map[string]interface{}{}
	if req.TaxName != "" {
		name := strings.TrimSpace(req.TaxName)
		exists, err := s.repo.TaxRateNameExists(currentUser.BusinessID, name, id)
		if err != nil {
			return nil, apperrors.Internal("failed to validate tax rate")
		}
		if exists {
			return nil, apperrors.Conflict("tax rate name already exists", nil)
		}
		updates["tax_name"] = name
	}
	if req.TaxType != "" {
		taxType := strings.TrimSpace(req.TaxType)
		if err := validateTaxType(taxType); err != nil {
			return nil, err
		}
		updates["tax_type"] = taxType
	}
	if req.RatePercentage != nil {
		if *req.RatePercentage < 0 || *req.RatePercentage > 100 {
			return nil, apperrors.BadRequest("rate_percentage must be between 0 and 100", nil)
		}
		updates["rate_percentage"] = *req.RatePercentage
	}
	if req.IsInclusive != nil {
		updates["is_inclusive"] = *req.IsInclusive
	}
	if req.Country != "" {
		updates["country"] = strings.TrimSpace(req.Country)
	}
	if req.Region != "" {
		updates["region"] = strings.TrimSpace(req.Region)
	}
	if req.IsDefault != nil {
		updates["is_default"] = *req.IsDefault
	}
	if len(updates) == 0 {
		return s.GetTaxRate(currentUser, id)
	}
	updates["updated_at"] = time.Now().UTC()

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if req.IsDefault != nil && *req.IsDefault {
		if err := s.repo.ClearDefaultTaxRates(tx, currentUser.BusinessID, id); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to update default tax rate")
		}
	}
	if err := s.repo.UpdateTaxRate(tx, id, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("tax rate not found")
		}
		return nil, apperrors.Internal("failed to update tax rate")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "tax_rate.updated", "tax_rate", id, "Tax rate updated.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit tax rate update")
	}
	return s.GetTaxRate(currentUser, id)
}

func (s *Service) UpdateTaxRateStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*TaxRateResponse, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	updates := map[string]interface{}{"status": req.Status, "updated_at": time.Now().UTC()}
	if req.Status == "inactive" {
		updates["is_default"] = false
	}
	if err := s.repo.UpdateTaxRate(tx, id, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("tax rate not found")
		}
		return nil, apperrors.Internal("failed to update tax rate status")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "tax_rate.status_changed", "tax_rate", id, "Tax rate status changed.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit tax rate status update")
	}
	return s.GetTaxRate(currentUser, id)
}

func (s *Service) DeleteTaxRate(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) error {
	tx := s.db.Begin()
	if tx.Error != nil {
		return apperrors.Internal("failed to start transaction")
	}
	updates := map[string]interface{}{"status": "inactive", "is_default": false, "updated_at": time.Now().UTC()}
	if err := s.repo.UpdateTaxRate(tx, id, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("tax rate not found")
		}
		return apperrors.Internal("failed to deactivate tax rate")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "tax_rate.deleted", "tax_rate", id, "Tax rate deactivated.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return apperrors.Internal("failed to commit tax rate deactivation")
	}
	return nil
}

func (s *Service) ListReceiptLayouts(currentUser *utils.AuthContext, branchID, receiptType, status string) ([]ReceiptLayoutResponse, error) {
	branchID = strings.TrimSpace(branchID)
	if branchID != "" && branchID != "global" {
		if err := s.validateReceiptLayoutBranch(currentUser, &branchID); err != nil {
			return nil, err
		}
	}
	layouts, err := s.repo.ListReceiptLayouts(currentUser.BusinessID, branchID, strings.TrimSpace(receiptType), strings.TrimSpace(status))
	if err != nil {
		return nil, apperrors.Internal("failed to list receipt layouts")
	}
	response := make([]ReceiptLayoutResponse, 0, len(layouts))
	for _, layout := range layouts {
		response = append(response, toReceiptLayoutResponse(layout))
	}
	return response, nil
}

func (s *Service) GetReceiptLayout(currentUser *utils.AuthContext, id string) (*ReceiptLayoutResponse, error) {
	layout, err := s.repo.FindReceiptLayout(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("receipt layout not found")
		}
		return nil, apperrors.Internal("failed to fetch receipt layout")
	}
	if err := s.validateReceiptLayoutBranch(currentUser, layout.BranchID); err != nil {
		return nil, err
	}
	response := toReceiptLayoutResponse(*layout)
	return &response, nil
}

func (s *Service) CreateReceiptLayout(currentUser *utils.AuthContext, req CreateReceiptLayoutRequest, ipAddress, userAgent string) (*ReceiptLayoutResponse, error) {
	layoutName := strings.TrimSpace(req.LayoutName)
	if layoutName == "" {
		return nil, apperrors.BadRequest("layout_name is required", nil)
	}
	if err := validateReceiptType(req.ReceiptType); err != nil {
		return nil, err
	}
	if len(req.LayoutConfig) == 0 || !json.Valid(req.LayoutConfig) {
		return nil, apperrors.BadRequest("layout_config must be valid JSON", nil)
	}
	branchID := normalizeOptionalStringPtr(req.BranchID)
	if err := s.validateReceiptLayoutBranch(currentUser, branchID); err != nil {
		return nil, err
	}
	exists, err := s.repo.ReceiptLayoutNameExists(currentUser.BusinessID, branchID, layoutName, "")
	if err != nil {
		return nil, apperrors.Internal("failed to validate receipt layout")
	}
	if exists {
		return nil, apperrors.Conflict("receipt layout name already exists", nil)
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "active"
	}
	if status != "active" && status != "inactive" {
		return nil, apperrors.BadRequest("status must be active or inactive", nil)
	}
	layout := &ReceiptLayout{
		ID:           utils.NewUUID(),
		BusinessID:   currentUser.BusinessID,
		BranchID:     branchID,
		LayoutName:   layoutName,
		ReceiptType:  req.ReceiptType,
		PrinterType:  strings.TrimSpace(req.PrinterType),
		CounterID:    strings.TrimSpace(req.CounterID),
		IsDefault:    req.IsDefault,
		Status:       status,
		LayoutConfig: string(req.LayoutConfig),
	}
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if layout.IsDefault {
		if err := s.repo.ClearDefaultReceiptLayouts(tx, currentUser.BusinessID, branchID, layout.ReceiptType, layout.PrinterType, layout.CounterID, ""); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to update default receipt layout")
		}
	}
	if err := s.repo.CreateReceiptLayout(tx, layout); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create receipt layout")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "receipt_layout.created", "receipt_layout", layout.ID, "Receipt layout created.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit receipt layout creation")
	}
	return s.GetReceiptLayout(currentUser, layout.ID)
}

func (s *Service) UpdateReceiptLayout(currentUser *utils.AuthContext, id string, req UpdateReceiptLayoutRequest, ipAddress, userAgent string) (*ReceiptLayoutResponse, error) {
	layout, err := s.repo.FindReceiptLayout(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("receipt layout not found")
		}
		return nil, apperrors.Internal("failed to fetch receipt layout")
	}
	if err := s.validateReceiptLayoutBranch(currentUser, layout.BranchID); err != nil {
		return nil, err
	}

	updates := map[string]interface{}{}
	targetBranchID := layout.BranchID
	if req.BranchID != nil {
		targetBranchID = normalizeOptionalStringPtr(req.BranchID)
		if err := s.validateReceiptLayoutBranch(currentUser, targetBranchID); err != nil {
			return nil, err
		}
		updates["branch_id"] = targetBranchID
	}
	targetName := layout.LayoutName
	if strings.TrimSpace(req.LayoutName) != "" {
		targetName = strings.TrimSpace(req.LayoutName)
		updates["layout_name"] = targetName
	}
	targetReceiptType := layout.ReceiptType
	if strings.TrimSpace(req.ReceiptType) != "" {
		if err := validateReceiptType(req.ReceiptType); err != nil {
			return nil, err
		}
		targetReceiptType = req.ReceiptType
		updates["receipt_type"] = targetReceiptType
	}
	targetPrinterType := layout.PrinterType
	if req.PrinterType != nil {
		targetPrinterType = strings.TrimSpace(*req.PrinterType)
		updates["printer_type"] = targetPrinterType
	}
	targetCounterID := layout.CounterID
	if req.CounterID != nil {
		targetCounterID = strings.TrimSpace(*req.CounterID)
		updates["counter_id"] = targetCounterID
	}
	if req.Status != "" {
		updates["status"] = req.Status
		if req.Status == "inactive" {
			updates["is_default"] = false
		}
	}
	if req.LayoutConfig != nil {
		if len(*req.LayoutConfig) == 0 || !json.Valid(*req.LayoutConfig) {
			return nil, apperrors.BadRequest("layout_config must be valid JSON", nil)
		}
		updates["layout_config"] = string(*req.LayoutConfig)
	}
	targetDefault := layout.IsDefault
	if req.IsDefault != nil {
		targetDefault = *req.IsDefault
		updates["is_default"] = targetDefault
	}
	if targetName != layout.LayoutName || !sameOptionalString(targetBranchID, layout.BranchID) {
		exists, err := s.repo.ReceiptLayoutNameExists(currentUser.BusinessID, targetBranchID, targetName, id)
		if err != nil {
			return nil, apperrors.Internal("failed to validate receipt layout")
		}
		if exists {
			return nil, apperrors.Conflict("receipt layout name already exists", nil)
		}
	}
	if len(updates) == 0 {
		response := toReceiptLayoutResponse(*layout)
		return &response, nil
	}
	updates["updated_at"] = time.Now().UTC()
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if targetDefault {
		if err := s.repo.ClearDefaultReceiptLayouts(tx, currentUser.BusinessID, targetBranchID, targetReceiptType, targetPrinterType, targetCounterID, id); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to update default receipt layout")
		}
	}
	if err := s.repo.UpdateReceiptLayout(tx, id, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("receipt layout not found")
		}
		return nil, apperrors.Internal("failed to update receipt layout")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "receipt_layout.updated", "receipt_layout", id, "Receipt layout updated.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit receipt layout update")
	}
	return s.GetReceiptLayout(currentUser, id)
}

func (s *Service) DeleteReceiptLayout(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) error {
	layout, err := s.repo.FindReceiptLayout(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("receipt layout not found")
		}
		return apperrors.Internal("failed to fetch receipt layout")
	}
	if err := s.validateReceiptLayoutBranch(currentUser, layout.BranchID); err != nil {
		return err
	}
	tx := s.db.Begin()
	if tx.Error != nil {
		return apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.DeleteReceiptLayout(tx, id, currentUser.BusinessID); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("receipt layout not found")
		}
		return apperrors.Internal("failed to delete receipt layout")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "receipt_layout.deleted", "receipt_layout", id, "Receipt layout deleted.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return apperrors.Internal("failed to commit receipt layout deletion")
	}
	return nil
}

func (s *Service) SetDefaultReceiptLayout(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) (*ReceiptLayoutResponse, error) {
	layout, err := s.repo.FindReceiptLayout(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("receipt layout not found")
		}
		return nil, apperrors.Internal("failed to fetch receipt layout")
	}
	if err := s.validateReceiptLayoutBranch(currentUser, layout.BranchID); err != nil {
		return nil, err
	}
	if layout.Status != "active" {
		return nil, apperrors.BadRequest("only active receipt layouts can be default", nil)
	}
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.ClearDefaultReceiptLayouts(tx, currentUser.BusinessID, layout.BranchID, layout.ReceiptType, layout.PrinterType, layout.CounterID, layout.ID); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to update default receipt layout")
	}
	if err := s.repo.UpdateReceiptLayout(tx, id, currentUser.BusinessID, map[string]interface{}{"is_default": true, "updated_at": time.Now().UTC()}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to set default receipt layout")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "receipt_layout.default_updated", "receipt_layout", id, "Default receipt layout updated.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit default receipt layout update")
	}
	return s.GetReceiptLayout(currentUser, id)
}

func (s *Service) PreviewReceiptLayout(currentUser *utils.AuthContext, id string, req ReceiptLayoutPreviewRequest) (*ReceiptLayoutPreviewResponse, error) {
	layout, err := s.GetReceiptLayout(currentUser, id)
	if err != nil {
		return nil, err
	}
	previewData := req.SampleData
	if previewData == nil {
		previewData = map[string]interface{}{
			"receipt_number": "SALE-PREVIEW",
			"business_name":  "Preview Business",
			"items": []map[string]interface{}{
				{"name": "Chocolate Cake", "quantity": 1, "unit_price": 120, "total": 120},
			},
			"subtotal_amount": 120,
			"tax_amount":      6,
			"discount_amount": 0,
			"total_amount":    126,
			"payment_method":  "Cash",
		}
	}
	return &ReceiptLayoutPreviewResponse{Layout: *layout, PreviewData: previewData}, nil
}

func (s *Service) writeSettingsAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityType, entityID, summary, ipAddress, userAgent string) error {
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

func validateTaxType(taxType string) error {
	switch taxType {
	case "VAT", "GST", "Sales Tax", "Service Charge", "Custom":
		return nil
	default:
		return apperrors.BadRequest("tax_type must be VAT, GST, Sales Tax, Service Charge, or Custom", nil)
	}
}

func validatePaymentMethodType(methodType string) error {
	switch methodType {
	case "cash", "card", "bank_transfer", "online", "wallet", "custom":
		return nil
	default:
		return apperrors.BadRequest("method_type must be cash, card, bank_transfer, online, wallet, or custom", nil)
	}
}

func validateReceiptType(receiptType string) error {
	switch receiptType {
	case "58mm", "80mm", "a4", "custom":
		return nil
	default:
		return apperrors.BadRequest("receipt_type must be 58mm, 80mm, a4, or custom", nil)
	}
}

func (s *Service) validateReceiptLayoutBranch(currentUser *utils.AuthContext, branchID *string) error {
	if branchID == nil || strings.TrimSpace(*branchID) == "" {
		return nil
	}
	normalized := strings.TrimSpace(*branchID)
	if _, err := uuid.Parse(normalized); err != nil {
		return apperrors.BadRequest("branch_id must be a valid UUID", nil)
	}
	if !currentUser.CanAccessBranch(normalized) {
		return apperrors.Forbidden("branch access denied")
	}
	var count int64
	if err := s.db.Table("branches").
		Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", normalized, currentUser.BusinessID, "active").
		Count(&count).Error; err != nil {
		return apperrors.Internal("failed to validate branch")
	}
	if count == 0 {
		return apperrors.BadRequest("branch_id is invalid or inactive", nil)
	}
	*branchID = normalized
	return nil
}

func normalizeOptionalStringPtr(input *string) *string {
	if input == nil {
		return nil
	}
	value := strings.TrimSpace(*input)
	if value == "" {
		return nil
	}
	return &value
}

func sameOptionalString(left, right *string) bool {
	if left == nil || strings.TrimSpace(*left) == "" {
		return right == nil || strings.TrimSpace(*right) == ""
	}
	return right != nil && strings.TrimSpace(*left) == strings.TrimSpace(*right)
}

func (s *Service) ensureCompanySettings(businessID string) (*CompanySettings, error) {
	business, err := s.businessRepo.FindByID(businessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load business")
	}
	settings, err := s.repo.EnsureCompanySettings(s.db, DefaultCompanySettingsInput{
		BusinessID:          business.ID,
		BusinessDisplayName: business.BusinessName,
		VATNumber:           business.VATNumber,
		Currency:            business.Currency,
		Timezone:            business.Timezone,
	})
	if err != nil {
		return nil, apperrors.Internal("failed to load company settings")
	}
	return settings, nil
}

func toCompanySettingsResponse(settings CompanySettings) CompanySettingsResponse {
	return CompanySettingsResponse{
		ID:                  settings.ID,
		BusinessID:          settings.BusinessID,
		BusinessDisplayName: settings.BusinessDisplayName,
		LogoFileID:          settings.LogoFileID,
		Address:             settings.Address,
		Phone:               settings.Phone,
		Email:               settings.Email,
		Website:             settings.Website,
		VATNumber:           settings.VATNumber,
		Currency:            settings.Currency,
		Timezone:            settings.Timezone,
		InvoiceFooter:       settings.InvoiceFooter,
		ReceiptFooter:       settings.ReceiptFooter,
		CreatedAt:           settings.CreatedAt,
		UpdatedAt:           settings.UpdatedAt,
	}
}

func toTaxRateResponse(taxRate TaxRate) TaxRateResponse {
	return TaxRateResponse{
		ID:             taxRate.ID,
		BusinessID:     taxRate.BusinessID,
		TaxName:        taxRate.TaxName,
		TaxType:        taxRate.TaxType,
		RatePercentage: taxRate.RatePercentage,
		IsInclusive:    taxRate.IsInclusive,
		Country:        taxRate.Country,
		Region:         taxRate.Region,
		IsDefault:      taxRate.IsDefault,
		Status:         taxRate.Status,
		CreatedAt:      taxRate.CreatedAt,
		UpdatedAt:      taxRate.UpdatedAt,
	}
}

func toPaymentMethodResponse(method PaymentMethod) PaymentMethodResponse {
	return PaymentMethodResponse{
		ID:                method.ID,
		BusinessID:        method.BusinessID,
		MethodName:        method.MethodName,
		MethodType:        method.MethodType,
		IsDefault:         method.IsDefault,
		AllowSplitPayment: method.AllowSplitPayment,
		RequiresReference: method.RequiresReference,
		Status:            method.Status,
		CreatedAt:         method.CreatedAt,
		UpdatedAt:         method.UpdatedAt,
	}
}

func toReceiptLayoutResponse(layout ReceiptLayout) ReceiptLayoutResponse {
	raw := json.RawMessage(layout.LayoutConfig)
	if !json.Valid(raw) {
		raw = json.RawMessage(`{}`)
	}
	return ReceiptLayoutResponse{
		ID:           layout.ID,
		BusinessID:   layout.BusinessID,
		BranchID:     layout.BranchID,
		LayoutName:   layout.LayoutName,
		ReceiptType:  layout.ReceiptType,
		PrinterType:  layout.PrinterType,
		CounterID:    layout.CounterID,
		IsDefault:    layout.IsDefault,
		Status:       layout.Status,
		LayoutConfig: raw,
		CreatedAt:    layout.CreatedAt,
		UpdatedAt:    layout.UpdatedAt,
	}
}
