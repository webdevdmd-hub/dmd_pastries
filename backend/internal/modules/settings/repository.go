package settings

import (
	"gorm.io/gorm"

	"pastries-pos/internal/shared/utils"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) DB() *gorm.DB {
	return r.db
}

func EnsureDefaultCompanySettings(tx *gorm.DB, input DefaultCompanySettingsInput) (*CompanySettings, error) {
	repo := &Repository{}
	return repo.EnsureCompanySettings(tx, input)
}

type DefaultCompanySettingsInput struct {
	BusinessID          string
	BusinessDisplayName string
	Phone               string
	Email               string
	VATNumber           string
	Currency            string
	Timezone            string
}

func (r *Repository) EnsureCompanySettings(tx *gorm.DB, input DefaultCompanySettingsInput) (*CompanySettings, error) {
	var settings CompanySettings
	result := tx.Where("business_id = ?", input.BusinessID).Limit(1).Find(&settings)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected > 0 {
		return &settings, nil
	}

	settings = CompanySettings{
		ID:                  utils.NewUUID(),
		BusinessID:          input.BusinessID,
		BusinessDisplayName: input.BusinessDisplayName,
		Phone:               input.Phone,
		Email:               input.Email,
		VATNumber:           input.VATNumber,
		Currency:            input.Currency,
		Timezone:            input.Timezone,
	}
	if err := tx.Create(&settings).Error; err != nil {
		return nil, err
	}
	return &settings, nil
}

func (r *Repository) FindCompanySettingsByBusinessID(businessID string) (*CompanySettings, error) {
	var settings CompanySettings
	err := r.db.Where("business_id = ?", businessID).First(&settings).Error
	if err != nil {
		return nil, err
	}
	return &settings, nil
}

func (r *Repository) UpdateCompanySettings(tx *gorm.DB, businessID string, updates map[string]interface{}) error {
	return tx.Model(&CompanySettings{}).Where("business_id = ?", businessID).Updates(updates).Error
}

func (r *Repository) CountBranches(businessID string) (int64, error) {
	var count int64
	err := r.db.Table("branches").Where("business_id = ? AND deleted_at IS NULL", businessID).Count(&count).Error
	return count, err
}

func EnsureDefaultTaxRates(tx *gorm.DB, businessID string) error {
	repo := &Repository{}
	return repo.EnsureDefaultTaxRate(tx, businessID)
}

func (r *Repository) EnsureDefaultTaxRate(tx *gorm.DB, businessID string) error {
	var count int64
	if err := tx.Model(&TaxRate{}).
		Where("business_id = ? AND LOWER(tax_name) = LOWER(?) AND deleted_at IS NULL", businessID, "UAE VAT 5%").
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	taxRate := TaxRate{
		ID:             utils.NewUUID(),
		BusinessID:     businessID,
		TaxName:        "UAE VAT 5%",
		TaxType:        "VAT",
		RatePercentage: 5,
		IsInclusive:    false,
		Country:        "UAE",
		IsDefault:      true,
		Status:         "active",
	}
	return tx.Create(&taxRate).Error
}

func (r *Repository) CreateTaxRate(tx *gorm.DB, taxRate *TaxRate) error {
	return tx.Create(taxRate).Error
}

func (r *Repository) ListTaxRates(businessID, status string) ([]TaxRate, error) {
	var taxRates []TaxRate
	query := r.db.Where("business_id = ? AND deleted_at IS NULL", businessID)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("is_default DESC, tax_name ASC").Find(&taxRates).Error
	return taxRates, err
}

func (r *Repository) FindTaxRate(id, businessID string) (*TaxRate, error) {
	var taxRate TaxRate
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&taxRate).Error
	if err != nil {
		return nil, err
	}
	return &taxRate, nil
}

func (r *Repository) TaxRateNameExists(businessID, name, excludedID string) (bool, error) {
	var count int64
	query := r.db.Model(&TaxRate{}).Where("business_id = ? AND LOWER(tax_name) = LOWER(?) AND deleted_at IS NULL", businessID, name)
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) ClearDefaultTaxRates(tx *gorm.DB, businessID, excludedID string) error {
	query := tx.Model(&TaxRate{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	return query.Update("is_default", false).Error
}

func (r *Repository) UpdateTaxRate(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&TaxRate{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) CountActiveTaxRates(businessID string) (int64, error) {
	var count int64
	err := r.db.Model(&TaxRate{}).Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active").Count(&count).Error
	return count, err
}

func EnsureDefaultPaymentMethods(tx *gorm.DB, businessID string) error {
	repo := &Repository{}
	return repo.EnsureDefaultPaymentMethods(tx, businessID)
}

func (r *Repository) EnsureDefaultPaymentMethods(tx *gorm.DB, businessID string) error {
	seeds := []PaymentMethod{
		{ID: utils.NewUUID(), BusinessID: businessID, MethodName: "Cash", MethodType: "cash", IsDefault: true, AllowSplitPayment: true, RequiresReference: false, ShowInPOS: true, ShowInBakeryOrders: true, ShowInPurchasing: true, ShowInExpenses: true, ShowInDashboardCollection: true, Status: "active"},
		{ID: utils.NewUUID(), BusinessID: businessID, MethodName: "Card", MethodType: "card", IsDefault: false, AllowSplitPayment: true, RequiresReference: true, ShowInPOS: true, ShowInBakeryOrders: true, ShowInPurchasing: false, ShowInExpenses: false, ShowInDashboardCollection: true, Status: "active"},
		{ID: utils.NewUUID(), BusinessID: businessID, MethodName: "Bank Transfer", MethodType: "bank_transfer", IsDefault: false, AllowSplitPayment: true, RequiresReference: true, ShowInPOS: true, ShowInBakeryOrders: true, ShowInPurchasing: true, ShowInExpenses: true, ShowInDashboardCollection: true, Status: "active"},
	}
	for _, seed := range seeds {
		var count int64
		if err := tx.Model(&PaymentMethod{}).
			Where("business_id = ? AND LOWER(method_name) = LOWER(?) AND deleted_at IS NULL", businessID, seed.MethodName).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		if seed.IsDefault {
			if err := r.ClearDefaultPaymentMethods(tx, businessID, ""); err != nil {
				return err
			}
		}
		if err := tx.Create(&seed).Error; err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) CreatePaymentMethod(tx *gorm.DB, method *PaymentMethod) error {
	return tx.Create(method).Error
}

func (r *Repository) ListPaymentMethods(businessID string) ([]PaymentMethod, error) {
	var methods []PaymentMethod
	err := r.db.Where("business_id = ? AND deleted_at IS NULL", businessID).
		Order("is_default DESC, method_name ASC").
		Find(&methods).Error
	return methods, err
}

func (r *Repository) FindPaymentMethod(id, businessID string) (*PaymentMethod, error) {
	var method PaymentMethod
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&method).Error
	if err != nil {
		return nil, err
	}
	return &method, nil
}

func (r *Repository) PaymentMethodNameExists(businessID, name, excludedID string) (bool, error) {
	var count int64
	query := r.db.Model(&PaymentMethod{}).Where("business_id = ? AND LOWER(method_name) = LOWER(?) AND deleted_at IS NULL", businessID, name)
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) ClearDefaultPaymentMethods(tx *gorm.DB, businessID, excludedID string) error {
	query := tx.Model(&PaymentMethod{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	return query.Update("is_default", false).Error
}

func (r *Repository) UpdatePaymentMethod(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&PaymentMethod{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) CountActivePaymentMethods(businessID string) (int64, error) {
	var count int64
	err := r.db.Model(&PaymentMethod{}).Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active").Count(&count).Error
	return count, err
}

func EnsureDefaultSalesChannels(tx *gorm.DB, businessID string) error {
	repo := &Repository{}
	return repo.EnsureDefaultSalesChannels(tx, businessID)
}

func (r *Repository) EnsureDefaultSalesChannels(tx *gorm.DB, businessID string) error {
	seeds := []SalesChannel{
		{ID: utils.NewUUID(), BusinessID: businessID, ChannelName: "Walk-in", ChannelType: "walk_in", IsDefault: true, Status: "active"},
		{ID: utils.NewUUID(), BusinessID: businessID, ChannelName: "Phone", ChannelType: "phone", IsDefault: false, Status: "active"},
		{ID: utils.NewUUID(), BusinessID: businessID, ChannelName: "WhatsApp", ChannelType: "whatsapp", IsDefault: false, Status: "active"},
		{ID: utils.NewUUID(), BusinessID: businessID, ChannelName: "Website", ChannelType: "website", IsDefault: false, Status: "active"},
		{ID: utils.NewUUID(), BusinessID: businessID, ChannelName: "Other", ChannelType: "other", IsDefault: false, Status: "active"},
	}
	for _, seed := range seeds {
		var count int64
		if err := tx.Model(&SalesChannel{}).
			Where("business_id = ? AND LOWER(channel_name) = LOWER(?) AND deleted_at IS NULL", businessID, seed.ChannelName).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		if seed.IsDefault {
			if err := r.ClearDefaultSalesChannels(tx, businessID, ""); err != nil {
				return err
			}
		}
		if err := tx.Create(&seed).Error; err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) CreateSalesChannel(tx *gorm.DB, channel *SalesChannel) error {
	return tx.Create(channel).Error
}

func (r *Repository) ListSalesChannels(businessID, channelType, status string) ([]SalesChannel, error) {
	var channels []SalesChannel
	query := r.db.Where("business_id = ? AND deleted_at IS NULL", businessID)
	if channelType != "" {
		query = query.Where("channel_type = ?", channelType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("is_default DESC, channel_name ASC").Find(&channels).Error
	return channels, err
}

func (r *Repository) FindSalesChannel(id, businessID string) (*SalesChannel, error) {
	var channel SalesChannel
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&channel).Error
	if err != nil {
		return nil, err
	}
	return &channel, nil
}

func (r *Repository) SalesChannelNameExists(businessID, name, excludedID string) (bool, error) {
	var count int64
	query := r.db.Model(&SalesChannel{}).Where("business_id = ? AND LOWER(channel_name) = LOWER(?) AND deleted_at IS NULL", businessID, name)
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) ClearDefaultSalesChannels(tx *gorm.DB, businessID, excludedID string) error {
	query := tx.Model(&SalesChannel{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	return query.Update("is_default", false).Error
}

func (r *Repository) UpdateSalesChannel(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&SalesChannel{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) PaymentMethodIsActive(businessID, methodID string) (bool, error) {
	var count int64
	err := r.db.Model(&PaymentMethod{}).
		Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", methodID, businessID, "active").
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) PaymentMethodName(businessID string, methodID *string) string {
	if methodID == nil || *methodID == "" {
		return ""
	}
	var name string
	_ = r.db.Model(&PaymentMethod{}).
		Select("method_name").
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", *methodID, businessID).
		Scan(&name).Error
	return name
}

func (r *Repository) PaymentAccountIsActive(businessID, accountID string) (bool, error) {
	var count int64
	err := r.db.Table("payment_accounts").
		Where("id = ? AND business_id = ? AND status = ? AND deleted_at IS NULL", accountID, businessID, "active").
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) PaymentAccountName(businessID string, accountID *string) string {
	if accountID == nil || *accountID == "" {
		return ""
	}
	var name string
	_ = r.db.Table("payment_accounts").
		Select("account_name").
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", *accountID, businessID).
		Scan(&name).Error
	return name
}

func (r *Repository) PaymentMethodHasPOSAccountCoverage(businessID, methodID string, defaultPaymentAccountID *string) (bool, error) {
	fallback := ""
	if defaultPaymentAccountID != nil && *defaultPaymentAccountID != "" {
		fallback = *defaultPaymentAccountID
	}

	var missingCount int64
	err := r.db.Table("branches b").
		Joins("LEFT JOIN payment_method_account_mappings pmam ON pmam.business_id = b.business_id AND pmam.branch_id = b.id AND pmam.payment_method_id = ? AND pmam.status = ? AND pmam.deleted_at IS NULL", methodID, "active").
		Joins("LEFT JOIN payment_accounts pa ON pa.id = COALESCE(pmam.payment_account_id, NULLIF(?, '')::uuid) AND pa.business_id = b.business_id AND pa.status = ? AND pa.deleted_at IS NULL", fallback, "active").
		Joins("LEFT JOIN chart_of_accounts coa ON coa.id = pa.chart_account_id AND coa.business_id = pa.business_id AND coa.status = ? AND coa.deleted_at IS NULL", "active").
		Where("b.business_id = ? AND b.status = ? AND b.deleted_at IS NULL", businessID, "active").
		Where("pa.id IS NULL OR (pa.branch_id IS NOT NULL AND pa.branch_id <> b.id) OR coa.id IS NULL").
		Count(&missingCount).Error
	if err != nil {
		return false, err
	}
	return missingCount == 0, nil
}

func (r *Repository) CreateReceiptLayout(tx *gorm.DB, layout *ReceiptLayout) error {
	return tx.Create(layout).Error
}

func (r *Repository) ListReceiptLayouts(businessID, branchID, receiptType, status string) ([]ReceiptLayout, error) {
	var layouts []ReceiptLayout
	query := r.db.Where("business_id = ? AND deleted_at IS NULL", businessID)
	if branchID != "" {
		if branchID == "global" {
			query = query.Where("branch_id IS NULL")
		} else {
			query = query.Where("branch_id = ?", branchID)
		}
	}
	if receiptType != "" {
		query = query.Where("receipt_type = ?", receiptType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("is_default DESC, layout_name ASC").Find(&layouts).Error
	return layouts, err
}

func (r *Repository) FindReceiptLayout(id, businessID string) (*ReceiptLayout, error) {
	var layout ReceiptLayout
	err := r.db.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).First(&layout).Error
	if err != nil {
		return nil, err
	}
	return &layout, nil
}

func (r *Repository) ReceiptLayoutNameExists(businessID string, branchID *string, name, excludedID string) (bool, error) {
	var count int64
	query := r.db.Model(&ReceiptLayout{}).
		Where("business_id = ? AND LOWER(layout_name) = LOWER(?) AND deleted_at IS NULL", businessID, name)
	if branchID == nil || *branchID == "" {
		query = query.Where("branch_id IS NULL")
	} else {
		query = query.Where("branch_id = ?", *branchID)
	}
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) ClearDefaultReceiptLayouts(tx *gorm.DB, businessID string, branchID *string, receiptType, printerType, counterID, excludedID string) error {
	query := tx.Model(&ReceiptLayout{}).
		Where("business_id = ? AND receipt_type = ? AND COALESCE(printer_type, '') = ? AND COALESCE(counter_id, '') = ? AND deleted_at IS NULL", businessID, receiptType, printerType, counterID)
	if branchID == nil || *branchID == "" {
		query = query.Where("branch_id IS NULL")
	} else {
		query = query.Where("branch_id = ?", *branchID)
	}
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	return query.Update("is_default", false).Error
}

func (r *Repository) UpdateReceiptLayout(tx *gorm.DB, id, businessID string, updates map[string]interface{}) error {
	result := tx.Model(&ReceiptLayout{}).Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) DeleteReceiptLayout(tx *gorm.DB, id, businessID string) error {
	result := tx.Where("id = ? AND business_id = ? AND deleted_at IS NULL", id, businessID).Delete(&ReceiptLayout{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
