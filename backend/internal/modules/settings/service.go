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
	changes := companySettingsChanges(*settings, updates)

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
		Metadata: audit.RecordMetadata(settings.BusinessDisplayName, map[string]interface{}{
			"source_module": "settings",
		}, changes),
		IPAddress: ipAddress,
		UserAgent: userAgent,
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
		response = append(response, s.toPaymentMethodResponse(method))
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
	response := s.toPaymentMethodResponse(*method)
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
	defaultPaymentAccountID, err := s.normalizePaymentMethodPaymentAccount(currentUser.BusinessID, req.DefaultPaymentAccountID)
	if err != nil {
		return nil, err
	}

	method := &PaymentMethod{
		ID:                        utils.NewUUID(),
		BusinessID:                currentUser.BusinessID,
		MethodName:                name,
		MethodType:                methodType,
		IsDefault:                 req.IsDefault,
		AllowSplitPayment:         req.AllowSplitPayment,
		RequiresReference:         req.RequiresReference,
		ShowInPOS:                 defaultBool(req.ShowInPOS, defaultShowInPOS(methodType)),
		ShowInBakeryOrders:        defaultBool(req.ShowInBakeryOrders, true),
		ShowInPurchasing:          defaultBool(req.ShowInPurchasing, defaultShowInPurchasing(methodType)),
		ShowInExpenses:            defaultBool(req.ShowInExpenses, defaultShowInExpenses(methodType)),
		ShowInDashboardCollection: defaultBool(req.ShowInDashboardCollection, true),
		DefaultPaymentAccountID:   defaultPaymentAccountID,
		Status:                    "active",
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
	if err := s.writeSettingsAudit(tx, currentUser, "payment_method.created", "payment_method", method.ID, "Payment method created.", ipAddress, userAgent, audit.RecordMetadata(method.MethodName, map[string]interface{}{
		"method_name":               method.MethodName,
		"method_type":               method.MethodType,
		"status":                    method.Status,
		"default_payment_account":   method.DefaultPaymentAccountID,
		"show_in_pos":               method.ShowInPOS,
		"show_in_bakery_orders":     method.ShowInBakeryOrders,
		"show_in_purchasing":        method.ShowInPurchasing,
		"show_in_expenses":          method.ShowInExpenses,
		"show_in_dashboard":         method.ShowInDashboardCollection,
		"requires_reference":        method.RequiresReference,
		"allow_split_payment":       method.AllowSplitPayment,
		"is_default_payment_method": method.IsDefault,
	}, nil)); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit payment method creation")
	}
	return s.GetPaymentMethod(currentUser, method.ID)
}

func (s *Service) UpdatePaymentMethod(currentUser *utils.AuthContext, id string, req UpdatePaymentMethodRequest, ipAddress, userAgent string) (*PaymentMethodResponse, error) {
	existing, err := s.repo.FindPaymentMethod(id, currentUser.BusinessID)
	if err != nil {
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
	if req.ShowInPOS != nil {
		updates["show_in_pos"] = *req.ShowInPOS
	}
	if req.ShowInBakeryOrders != nil {
		updates["show_in_bakery_orders"] = *req.ShowInBakeryOrders
	}
	if req.ShowInPurchasing != nil {
		updates["show_in_purchasing"] = *req.ShowInPurchasing
	}
	if req.ShowInExpenses != nil {
		updates["show_in_expenses"] = *req.ShowInExpenses
	}
	if req.ShowInDashboardCollection != nil {
		updates["show_in_dashboard_collection"] = *req.ShowInDashboardCollection
	}
	if req.DefaultPaymentAccountID != nil {
		defaultPaymentAccountID, err := s.normalizePaymentMethodPaymentAccount(currentUser.BusinessID, req.DefaultPaymentAccountID)
		if err != nil {
			return nil, err
		}
		if defaultPaymentAccountID == nil {
			updates["default_payment_account_id"] = nil
		} else {
			updates["default_payment_account_id"] = *defaultPaymentAccountID
		}
	}
	if len(updates) == 0 {
		return s.GetPaymentMethod(currentUser, id)
	}
	changes := paymentMethodChanges(*existing, updates)
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
	if err := s.writeSettingsAudit(tx, currentUser, "payment_method.updated", "payment_method", id, "Payment method updated.", ipAddress, userAgent, audit.RecordMetadata(existing.MethodName, map[string]interface{}{
		"method_name": existing.MethodName,
		"method_type": existing.MethodType,
		"status":      existing.Status,
	}, changes)); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit payment method update")
	}
	return s.GetPaymentMethod(currentUser, id)
}

func (s *Service) UpdatePaymentMethodStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*PaymentMethodResponse, error) {
	existing, err := s.repo.FindPaymentMethod(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("payment method not found")
		}
		return nil, apperrors.Internal("failed to fetch payment method")
	}
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
	changes := []audit.AuditChange{}
	audit.AddChange(&changes, "status", "Status", existing.Status, req.Status)
	if req.Status == "inactive" {
		audit.AddChange(&changes, "is_default", "Default", existing.IsDefault, false)
	}
	if err := s.writeSettingsAudit(tx, currentUser, "payment_method.status_changed", "payment_method", id, "Payment method status changed.", ipAddress, userAgent, audit.RecordMetadata(existing.MethodName, map[string]interface{}{
		"method_name": existing.MethodName,
		"status":      req.Status,
	}, changes)); err != nil {
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

func (s *Service) ListSalesChannels(currentUser *utils.AuthContext, channelType, status string) ([]SalesChannelResponse, error) {
	channelType = strings.TrimSpace(channelType)
	status = strings.TrimSpace(status)
	if channelType != "" {
		if err := validateSalesChannelType(channelType); err != nil {
			return nil, err
		}
	}
	if status != "" && status != "active" && status != "inactive" {
		return nil, apperrors.BadRequest("status must be active or inactive", nil)
	}
	channels, err := s.repo.ListSalesChannels(currentUser.BusinessID, channelType, status)
	if err != nil {
		return nil, apperrors.Internal("failed to list sales channels")
	}
	response := make([]SalesChannelResponse, 0, len(channels))
	for _, channel := range channels {
		response = append(response, s.toSalesChannelResponse(channel))
	}
	return response, nil
}

func (s *Service) GetSalesChannel(currentUser *utils.AuthContext, id string) (*SalesChannelResponse, error) {
	channel, err := s.repo.FindSalesChannel(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("sales channel not found")
		}
		return nil, apperrors.Internal("failed to fetch sales channel")
	}
	response := s.toSalesChannelResponse(*channel)
	return &response, nil
}

func (s *Service) CreateSalesChannel(currentUser *utils.AuthContext, req CreateSalesChannelRequest, ipAddress, userAgent string) (*SalesChannelResponse, error) {
	name := strings.TrimSpace(req.ChannelName)
	channelType := strings.TrimSpace(req.ChannelType)
	if name == "" || channelType == "" {
		return nil, apperrors.BadRequest("channel_name and channel_type are required", nil)
	}
	if err := validateSalesChannelType(channelType); err != nil {
		return nil, err
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "active"
	}
	if status != "active" && status != "inactive" {
		return nil, apperrors.BadRequest("status must be active or inactive", nil)
	}
	if req.IsDefault && status != "active" {
		return nil, apperrors.BadRequest("only active sales channels can be default", nil)
	}
	if err := validateCommissionRate(req.CommissionRate); err != nil {
		return nil, err
	}
	paymentMethodID, err := s.normalizeSalesChannelPaymentMethod(currentUser.BusinessID, req.DefaultPaymentMethodID)
	if err != nil {
		return nil, err
	}
	exists, err := s.repo.SalesChannelNameExists(currentUser.BusinessID, name, "")
	if err != nil {
		return nil, apperrors.Internal("failed to validate sales channel")
	}
	if exists {
		return nil, apperrors.Conflict("sales channel name already exists", nil)
	}

	channel := &SalesChannel{
		ID:                          utils.NewUUID(),
		BusinessID:                  currentUser.BusinessID,
		ChannelName:                 name,
		ChannelType:                 channelType,
		RequiresExternalOrderNumber: req.RequiresExternalOrderNumber,
		DefaultPaymentMethodID:      paymentMethodID,
		CommissionRate:              req.CommissionRate,
		IsDefault:                   req.IsDefault,
		Status:                      status,
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if channel.IsDefault {
		if err := s.repo.ClearDefaultSalesChannels(tx, currentUser.BusinessID, ""); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to update default sales channel")
		}
	}
	if err := s.repo.CreateSalesChannel(tx, channel); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create sales channel")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "sales_channel.created", "sales_channel", channel.ID, "Sales channel created.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit sales channel creation")
	}
	return s.GetSalesChannel(currentUser, channel.ID)
}

func (s *Service) UpdateSalesChannel(currentUser *utils.AuthContext, id string, req UpdateSalesChannelRequest, ipAddress, userAgent string) (*SalesChannelResponse, error) {
	channel, err := s.repo.FindSalesChannel(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("sales channel not found")
		}
		return nil, apperrors.Internal("failed to fetch sales channel")
	}

	updates := map[string]interface{}{}
	if strings.TrimSpace(req.ChannelName) != "" {
		name := strings.TrimSpace(req.ChannelName)
		exists, err := s.repo.SalesChannelNameExists(currentUser.BusinessID, name, id)
		if err != nil {
			return nil, apperrors.Internal("failed to validate sales channel")
		}
		if exists {
			return nil, apperrors.Conflict("sales channel name already exists", nil)
		}
		updates["channel_name"] = name
	}
	if strings.TrimSpace(req.ChannelType) != "" {
		channelType := strings.TrimSpace(req.ChannelType)
		if err := validateSalesChannelType(channelType); err != nil {
			return nil, err
		}
		updates["channel_type"] = channelType
	}
	if req.RequiresExternalOrderNumber != nil {
		updates["requires_external_order_number"] = *req.RequiresExternalOrderNumber
	}
	if req.DefaultPaymentMethodID != nil {
		paymentMethodID, err := s.normalizeSalesChannelPaymentMethod(currentUser.BusinessID, req.DefaultPaymentMethodID)
		if err != nil {
			return nil, err
		}
		updates["default_payment_method_id"] = paymentMethodID
	}
	if req.CommissionRate != nil {
		if err := validateCommissionRate(req.CommissionRate); err != nil {
			return nil, err
		}
		updates["commission_rate"] = req.CommissionRate
	}
	targetStatus := channel.Status
	if req.Status != "" {
		targetStatus = req.Status
		updates["status"] = req.Status
		if req.Status == "inactive" {
			updates["is_default"] = false
		}
	}
	if req.IsDefault != nil {
		if *req.IsDefault && targetStatus != "active" {
			return nil, apperrors.BadRequest("only active sales channels can be default", nil)
		}
		updates["is_default"] = *req.IsDefault
	}
	if len(updates) == 0 {
		response := s.toSalesChannelResponse(*channel)
		return &response, nil
	}
	updates["updated_at"] = time.Now().UTC()

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if req.IsDefault != nil && *req.IsDefault {
		if err := s.repo.ClearDefaultSalesChannels(tx, currentUser.BusinessID, id); err != nil {
			tx.Rollback()
			return nil, apperrors.Internal("failed to update default sales channel")
		}
	}
	if err := s.repo.UpdateSalesChannel(tx, id, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("sales channel not found")
		}
		return nil, apperrors.Internal("failed to update sales channel")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "sales_channel.updated", "sales_channel", id, "Sales channel updated.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit sales channel update")
	}
	return s.GetSalesChannel(currentUser, id)
}

func (s *Service) UpdateSalesChannelStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*SalesChannelResponse, error) {
	updates := map[string]interface{}{"status": req.Status, "updated_at": time.Now().UTC()}
	if req.Status == "inactive" {
		updates["is_default"] = false
	}
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.UpdateSalesChannel(tx, id, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("sales channel not found")
		}
		return nil, apperrors.Internal("failed to update sales channel status")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "sales_channel.status_changed", "sales_channel", id, "Sales channel status changed.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit sales channel status update")
	}
	return s.GetSalesChannel(currentUser, id)
}

func (s *Service) SetDefaultSalesChannel(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) (*SalesChannelResponse, error) {
	channel, err := s.repo.FindSalesChannel(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("sales channel not found")
		}
		return nil, apperrors.Internal("failed to fetch sales channel")
	}
	if channel.Status != "active" {
		return nil, apperrors.BadRequest("only active sales channels can be default", nil)
	}
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start transaction")
	}
	if err := s.repo.ClearDefaultSalesChannels(tx, currentUser.BusinessID, id); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to update default sales channel")
	}
	if err := s.repo.UpdateSalesChannel(tx, id, currentUser.BusinessID, map[string]interface{}{"is_default": true, "updated_at": time.Now().UTC()}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to set default sales channel")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "sales_channel.default_updated", "sales_channel", id, "Default sales channel updated.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit default sales channel update")
	}
	return s.GetSalesChannel(currentUser, id)
}

func (s *Service) DeleteSalesChannel(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) error {
	tx := s.db.Begin()
	if tx.Error != nil {
		return apperrors.Internal("failed to start transaction")
	}
	updates := map[string]interface{}{"status": "inactive", "is_default": false, "updated_at": time.Now().UTC()}
	if err := s.repo.UpdateSalesChannel(tx, id, currentUser.BusinessID, updates); err != nil {
		tx.Rollback()
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("sales channel not found")
		}
		return apperrors.Internal("failed to deactivate sales channel")
	}
	if err := s.writeSettingsAudit(tx, currentUser, "sales_channel.deleted", "sales_channel", id, "Sales channel deactivated.", ipAddress, userAgent); err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return apperrors.Internal("failed to commit sales channel deactivation")
	}
	return nil
}

func (s *Service) ListTaxRates(currentUser *utils.AuthContext, status string) ([]TaxRateResponse, error) {
	status = strings.TrimSpace(strings.ToLower(status))
	if status != "" && status != "active" && status != "inactive" {
		return nil, apperrors.BadRequest("invalid tax rate status filter", nil)
	}

	taxRates, err := s.repo.ListTaxRates(currentUser.BusinessID, status)
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
	if err := s.writeSettingsAudit(tx, currentUser, "tax_rate.created", "tax_rate", taxRate.ID, "Tax rate created.", ipAddress, userAgent, audit.RecordMetadata(taxRate.TaxName, map[string]interface{}{
		"tax_name":        taxRate.TaxName,
		"tax_type":        taxRate.TaxType,
		"rate_percentage": taxRate.RatePercentage,
		"is_inclusive":    taxRate.IsInclusive,
		"is_default":      taxRate.IsDefault,
		"status":          taxRate.Status,
	}, nil)); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit tax rate creation")
	}
	return s.GetTaxRate(currentUser, taxRate.ID)
}

func (s *Service) UpdateTaxRate(currentUser *utils.AuthContext, id string, req UpdateTaxRateRequest, ipAddress, userAgent string) (*TaxRateResponse, error) {
	existing, err := s.repo.FindTaxRate(id, currentUser.BusinessID)
	if err != nil {
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
	changes := taxRateChanges(*existing, updates)
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
	if err := s.writeSettingsAudit(tx, currentUser, "tax_rate.updated", "tax_rate", id, "Tax rate updated.", ipAddress, userAgent, audit.RecordMetadata(existing.TaxName, map[string]interface{}{
		"tax_name":        existing.TaxName,
		"tax_type":        existing.TaxType,
		"rate_percentage": existing.RatePercentage,
		"status":          existing.Status,
	}, changes)); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit tax rate update")
	}
	return s.GetTaxRate(currentUser, id)
}

func (s *Service) UpdateTaxRateStatus(currentUser *utils.AuthContext, id string, req UpdateStatusRequest, ipAddress, userAgent string) (*TaxRateResponse, error) {
	existing, err := s.repo.FindTaxRate(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFound("tax rate not found")
		}
		return nil, apperrors.Internal("failed to fetch tax rate")
	}
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
	changes := []audit.AuditChange{}
	audit.AddChange(&changes, "status", "Status", existing.Status, req.Status)
	if req.Status == "inactive" {
		audit.AddChange(&changes, "is_default", "Default", existing.IsDefault, false)
	}
	if err := s.writeSettingsAudit(tx, currentUser, "tax_rate.status_changed", "tax_rate", id, "Tax rate status changed.", ipAddress, userAgent, audit.RecordMetadata(existing.TaxName, map[string]interface{}{
		"tax_name": existing.TaxName,
		"status":   req.Status,
	}, changes)); err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit tax rate status update")
	}
	return s.GetTaxRate(currentUser, id)
}

func (s *Service) DeleteTaxRate(currentUser *utils.AuthContext, id string, ipAddress, userAgent string) error {
	existing, err := s.repo.FindTaxRate(id, currentUser.BusinessID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperrors.NotFound("tax rate not found")
		}
		return apperrors.Internal("failed to fetch tax rate")
	}
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
	changes := []audit.AuditChange{}
	audit.AddChange(&changes, "status", "Status", existing.Status, "inactive")
	audit.AddChange(&changes, "is_default", "Default", existing.IsDefault, false)
	if err := s.writeSettingsAudit(tx, currentUser, "tax_rate.deleted", "tax_rate", id, "Tax rate deactivated.", ipAddress, userAgent, audit.RecordMetadata(existing.TaxName, map[string]interface{}{
		"tax_name": existing.TaxName,
		"status":   "inactive",
	}, changes)); err != nil {
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

func (s *Service) writeSettingsAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityType, entityID, summary, ipAddress, userAgent string, metadata ...map[string]interface{}) error {
	auditMetadata := map[string]interface{}(nil)
	if len(metadata) > 0 {
		auditMetadata = metadata[0]
	}
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  entityType,
		EntityID:    entityID,
		Summary:     summary,
		Metadata:    auditMetadata,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

func companySettingsChanges(existing CompanySettings, updates map[string]interface{}) []audit.AuditChange {
	changes := []audit.AuditChange{}
	for field, next := range updates {
		switch field {
		case "business_display_name":
			audit.AddChange(&changes, field, "Business display name", existing.BusinessDisplayName, next)
		case "logo_file_id":
			audit.AddChange(&changes, field, "Logo file", existing.LogoFileID, next)
		case "address":
			audit.AddChange(&changes, field, "Address", existing.Address, next)
		case "phone":
			audit.AddChange(&changes, field, "Phone", existing.Phone, next)
		case "email":
			audit.AddChange(&changes, field, "Email", existing.Email, next)
		case "website":
			audit.AddChange(&changes, field, "Website", existing.Website, next)
		case "vat_number":
			audit.AddChange(&changes, field, "VAT number", existing.VATNumber, next)
		case "currency":
			audit.AddChange(&changes, field, "Currency", existing.Currency, next)
		case "timezone":
			audit.AddChange(&changes, field, "Timezone", existing.Timezone, next)
		case "invoice_footer":
			audit.AddChange(&changes, field, "Invoice footer", existing.InvoiceFooter, next)
		case "receipt_footer":
			audit.AddChange(&changes, field, "Receipt footer", existing.ReceiptFooter, next)
		}
	}
	return changes
}

func taxRateChanges(existing TaxRate, updates map[string]interface{}) []audit.AuditChange {
	changes := []audit.AuditChange{}
	for field, next := range updates {
		switch field {
		case "tax_name":
			audit.AddChange(&changes, field, "Tax name", existing.TaxName, next)
		case "tax_type":
			audit.AddChange(&changes, field, "Tax type", existing.TaxType, next)
		case "rate_percentage":
			audit.AddChange(&changes, field, "Rate percentage", existing.RatePercentage, next)
		case "is_inclusive":
			audit.AddChange(&changes, field, "Inclusive tax", existing.IsInclusive, next)
		case "country":
			audit.AddChange(&changes, field, "Country", existing.Country, next)
		case "region":
			audit.AddChange(&changes, field, "Region", existing.Region, next)
		case "is_default":
			audit.AddChange(&changes, field, "Default", existing.IsDefault, next)
		}
	}
	return changes
}

func paymentMethodChanges(existing PaymentMethod, updates map[string]interface{}) []audit.AuditChange {
	changes := []audit.AuditChange{}
	for field, next := range updates {
		switch field {
		case "method_name":
			audit.AddChange(&changes, field, "Method name", existing.MethodName, next)
		case "method_type":
			audit.AddChange(&changes, field, "Method type", existing.MethodType, next)
		case "is_default":
			audit.AddChange(&changes, field, "Default", existing.IsDefault, next)
		case "allow_split_payment":
			audit.AddChange(&changes, field, "Allow split payment", existing.AllowSplitPayment, next)
		case "requires_reference":
			audit.AddChange(&changes, field, "Requires reference", existing.RequiresReference, next)
		case "show_in_pos":
			audit.AddChange(&changes, field, "Show in POS", existing.ShowInPOS, next)
		case "show_in_bakery_orders":
			audit.AddChange(&changes, field, "Show in bakery orders", existing.ShowInBakeryOrders, next)
		case "show_in_purchasing":
			audit.AddChange(&changes, field, "Show in purchasing", existing.ShowInPurchasing, next)
		case "show_in_expenses":
			audit.AddChange(&changes, field, "Show in expenses", existing.ShowInExpenses, next)
		case "show_in_dashboard_collection":
			audit.AddChange(&changes, field, "Show in dashboard collection", existing.ShowInDashboardCollection, next)
		case "default_payment_account_id":
			audit.AddChange(&changes, field, "Default payment account", existing.DefaultPaymentAccountID, next)
		}
	}
	return changes
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

func defaultShowInPOS(methodType string) bool {
	switch methodType {
	case "cash", "card", "bank_transfer", "online", "wallet", "custom":
		return true
	default:
		return false
	}
}

func defaultShowInPurchasing(methodType string) bool {
	switch methodType {
	case "cash", "bank_transfer":
		return true
	default:
		return false
	}
}

func defaultShowInExpenses(methodType string) bool {
	switch methodType {
	case "cash", "bank_transfer":
		return true
	default:
		return false
	}
}

func defaultBool(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}

func validateSalesChannelType(channelType string) error {
	switch channelType {
	case "walk_in", "phone", "whatsapp", "social", "website", "platform", "partner", "other":
		return nil
	default:
		return apperrors.BadRequest("channel_type must be walk_in, phone, whatsapp, social, website, platform, partner, or other", nil)
	}
}

func validateCommissionRate(rate *float64) error {
	if rate == nil {
		return nil
	}
	if *rate < 0 || *rate > 100 {
		return apperrors.BadRequest("commission_rate must be between 0 and 100", nil)
	}
	return nil
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

func (s *Service) normalizeSalesChannelPaymentMethod(businessID string, methodID *string) (*string, error) {
	normalized := normalizeOptionalStringPtr(methodID)
	if normalized == nil {
		return nil, nil
	}
	if _, err := uuid.Parse(*normalized); err != nil {
		return nil, apperrors.BadRequest("default_payment_method_id must be a valid UUID", nil)
	}
	exists, err := s.repo.PaymentMethodIsActive(businessID, *normalized)
	if err != nil {
		return nil, apperrors.Internal("failed to validate default payment method")
	}
	if !exists {
		return nil, apperrors.BadRequest("default_payment_method_id is invalid or inactive", nil)
	}
	return normalized, nil
}

func (s *Service) normalizePaymentMethodPaymentAccount(businessID string, accountID *string) (*string, error) {
	normalized := normalizeOptionalStringPtr(accountID)
	if normalized == nil {
		return nil, nil
	}
	if _, err := uuid.Parse(*normalized); err != nil {
		return nil, apperrors.BadRequest("default_payment_account_id must be a valid UUID", nil)
	}
	exists, err := s.repo.PaymentAccountIsActive(businessID, *normalized)
	if err != nil {
		return nil, apperrors.Internal("failed to validate default payment account")
	}
	if !exists {
		return nil, apperrors.BadRequest("default_payment_account_id is invalid or inactive", nil)
	}
	return normalized, nil
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

func (s *Service) toPaymentMethodResponse(method PaymentMethod) PaymentMethodResponse {
	return PaymentMethodResponse{
		ID:                        method.ID,
		BusinessID:                method.BusinessID,
		MethodName:                method.MethodName,
		MethodType:                method.MethodType,
		IsDefault:                 method.IsDefault,
		AllowSplitPayment:         method.AllowSplitPayment,
		RequiresReference:         method.RequiresReference,
		ShowInPOS:                 method.ShowInPOS,
		ShowInBakeryOrders:        method.ShowInBakeryOrders,
		ShowInPurchasing:          method.ShowInPurchasing,
		ShowInExpenses:            method.ShowInExpenses,
		ShowInDashboardCollection: method.ShowInDashboardCollection,
		DefaultPaymentAccountID:   method.DefaultPaymentAccountID,
		DefaultPaymentAccountName: s.repo.PaymentAccountName(method.BusinessID, method.DefaultPaymentAccountID),
		Status:                    method.Status,
		CreatedAt:                 method.CreatedAt,
		UpdatedAt:                 method.UpdatedAt,
	}
}

func (s *Service) toSalesChannelResponse(channel SalesChannel) SalesChannelResponse {
	return SalesChannelResponse{
		ID:                          channel.ID,
		BusinessID:                  channel.BusinessID,
		ChannelName:                 channel.ChannelName,
		ChannelType:                 channel.ChannelType,
		RequiresExternalOrderNumber: channel.RequiresExternalOrderNumber,
		DefaultPaymentMethodID:      channel.DefaultPaymentMethodID,
		DefaultPaymentMethodName:    s.repo.PaymentMethodName(channel.BusinessID, channel.DefaultPaymentMethodID),
		CommissionRate:              channel.CommissionRate,
		IsDefault:                   channel.IsDefault,
		Status:                      channel.Status,
		CreatedAt:                   channel.CreatedAt,
		UpdatedAt:                   channel.UpdatedAt,
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
