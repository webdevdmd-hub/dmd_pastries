package shared

import (
	"net/url"
	"strconv"
	"strings"
	"time"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type ReportBaseFilter struct {
	BranchID          string
	Scope             string
	DateFrom          string
	DateTo            string
	Timezone          string
	GroupBy           string
	Page              int
	Limit             int
	SortBy            string
	SortOrder         string
	CashierUserID     string
	CustomerID        string
	ProductID         string
	RecipeID          string
	CategoryID        string
	BatchStatus       string
	OrderStatus       string
	OrderType         string
	PaymentMethodID   string
	PaymentStatus     string
	SaleStatus        string
	ItemType          string
	Status            string
	MovementType      string
	MovementDirection string
	ReferenceType     string
	Days              int
	UpcomingDays      int
}

type ResolvedFilter struct {
	BusinessID        string
	BranchID          string
	AllBranches       bool
	StartUTC          time.Time
	EndUTC            time.Time
	DateFrom          time.Time
	DateTo            time.Time
	Timezone          string
	GroupBy           string
	Page              int
	Limit             int
	SortBy            string
	SortOrder         string
	CashierUserID     string
	CustomerID        string
	ProductID         string
	RecipeID          string
	CategoryID        string
	BatchStatus       string
	OrderStatus       string
	OrderType         string
	PaymentMethodID   string
	PaymentStatus     string
	SaleStatus        string
	ItemType          string
	Status            string
	MovementType      string
	MovementDirection string
	ReferenceType     string
	Days              int
	UpcomingDays      int
}

type Pagination struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

func ParseQuery(values url.Values) ReportBaseFilter {
	page, _ := strconv.Atoi(values.Get("page"))
	limit, _ := strconv.Atoi(values.Get("limit"))
	days, _ := strconv.Atoi(values.Get("days"))
	upcomingDays, _ := strconv.Atoi(values.Get("upcoming_days"))
	return ReportBaseFilter{
		BranchID:          strings.TrimSpace(values.Get("branch_id")),
		Scope:             strings.TrimSpace(values.Get("scope")),
		DateFrom:          strings.TrimSpace(values.Get("date_from")),
		DateTo:            strings.TrimSpace(values.Get("date_to")),
		Timezone:          strings.TrimSpace(values.Get("timezone")),
		GroupBy:           strings.TrimSpace(values.Get("group_by")),
		Page:              page,
		Limit:             limit,
		SortBy:            strings.TrimSpace(values.Get("sort_by")),
		SortOrder:         strings.TrimSpace(values.Get("sort_order")),
		CashierUserID:     strings.TrimSpace(values.Get("cashier_user_id")),
		CustomerID:        strings.TrimSpace(values.Get("customer_id")),
		ProductID:         strings.TrimSpace(values.Get("product_id")),
		RecipeID:          strings.TrimSpace(values.Get("recipe_id")),
		CategoryID:        strings.TrimSpace(values.Get("category_id")),
		BatchStatus:       strings.TrimSpace(values.Get("batch_status")),
		OrderStatus:       strings.TrimSpace(values.Get("order_status")),
		OrderType:         strings.TrimSpace(values.Get("order_type")),
		PaymentMethodID:   strings.TrimSpace(values.Get("payment_method_id")),
		PaymentStatus:     strings.TrimSpace(values.Get("payment_status")),
		SaleStatus:        strings.TrimSpace(values.Get("sale_status")),
		ItemType:          strings.TrimSpace(values.Get("item_type")),
		Status:            strings.TrimSpace(values.Get("status")),
		MovementType:      strings.TrimSpace(values.Get("movement_type")),
		MovementDirection: strings.TrimSpace(values.Get("movement_direction")),
		ReferenceType:     strings.TrimSpace(values.Get("reference_type")),
		Days:              days,
		UpcomingDays:      upcomingDays,
	}
}

func Resolve(currentUser *utils.AuthContext, filter ReportBaseFilter) (*ResolvedFilter, error) {
	branchID, allBranches, err := currentUser.ResolveBranchScope(filter.BranchID, filter.Scope)
	if err != nil {
		return nil, err
	}
	locationName := filter.Timezone
	if locationName == "" {
		locationName = "UTC"
	}
	location, err := time.LoadLocation(locationName)
	if err != nil {
		return nil, apperrors.BadRequest("invalid timezone", nil)
	}
	now := time.Now().In(location)
	from, to, err := parseDateRange(filter.DateFrom, filter.DateTo, now)
	if err != nil {
		return nil, err
	}
	startLocal := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, location)
	endLocal := time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, location).AddDate(0, 0, 1)
	groupBy := filter.GroupBy
	if groupBy == "" {
		groupBy = "day"
	}
	if groupBy != "day" && groupBy != "week" && groupBy != "month" && groupBy != "payment_method" {
		return nil, apperrors.BadRequest("invalid group_by", nil)
	}
	page, limit := NormalizePagination(filter.Page, filter.Limit)
	sortOrder := strings.ToLower(filter.SortOrder)
	if sortOrder == "" {
		sortOrder = "desc"
	}
	if sortOrder != "asc" && sortOrder != "desc" {
		return nil, apperrors.BadRequest("invalid sort_order", nil)
	}
	if filter.ItemType != "" && filter.ItemType != "product" && filter.ItemType != "ingredient" && filter.ItemType != "packaging" {
		return nil, apperrors.BadRequest("invalid item_type", nil)
	}
	if filter.MovementDirection != "" && filter.MovementDirection != "in" && filter.MovementDirection != "out" && filter.MovementDirection != "neutral" {
		return nil, apperrors.BadRequest("invalid movement_direction", nil)
	}
	if filter.BatchStatus != "" && filter.BatchStatus != "draft" && filter.BatchStatus != "planned" && filter.BatchStatus != "in_progress" && filter.BatchStatus != "completed" && filter.BatchStatus != "cancelled" {
		return nil, apperrors.BadRequest("invalid batch_status", nil)
	}
	if filter.OrderStatus != "" && filter.OrderStatus != "new" && filter.OrderStatus != "confirmed" && filter.OrderStatus != "in_production" && filter.OrderStatus != "ready" && filter.OrderStatus != "delivered" && filter.OrderStatus != "completed" && filter.OrderStatus != "cancelled" {
		return nil, apperrors.BadRequest("invalid order_status", nil)
	}
	if filter.OrderType != "" && filter.OrderType != "pickup" && filter.OrderType != "delivery" {
		return nil, apperrors.BadRequest("invalid order_type", nil)
	}
	if filter.Days < 0 {
		return nil, apperrors.BadRequest("days cannot be negative", nil)
	}
	if filter.UpcomingDays < 0 {
		return nil, apperrors.BadRequest("upcoming_days cannot be negative", nil)
	}
	return &ResolvedFilter{
		BusinessID:        currentUser.BusinessID,
		BranchID:          branchID,
		AllBranches:       allBranches,
		StartUTC:          startLocal.UTC(),
		EndUTC:            endLocal.UTC(),
		DateFrom:          startLocal,
		DateTo:            endLocal.Add(-time.Nanosecond),
		Timezone:          locationName,
		GroupBy:           groupBy,
		Page:              page,
		Limit:             limit,
		SortBy:            filter.SortBy,
		SortOrder:         sortOrder,
		CashierUserID:     filter.CashierUserID,
		CustomerID:        filter.CustomerID,
		ProductID:         filter.ProductID,
		RecipeID:          filter.RecipeID,
		CategoryID:        filter.CategoryID,
		BatchStatus:       filter.BatchStatus,
		OrderStatus:       filter.OrderStatus,
		OrderType:         filter.OrderType,
		PaymentMethodID:   filter.PaymentMethodID,
		PaymentStatus:     filter.PaymentStatus,
		SaleStatus:        filter.SaleStatus,
		ItemType:          filter.ItemType,
		Status:            filter.Status,
		MovementType:      filter.MovementType,
		MovementDirection: filter.MovementDirection,
		ReferenceType:     filter.ReferenceType,
		Days:              filter.Days,
		UpcomingDays:      filter.UpcomingDays,
	}, nil
}

func NormalizePagination(page, limit int) (int, int) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	return page, limit
}

func NewPagination(page, limit int, total int64) Pagination {
	totalPages := 0
	if limit > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}
	return Pagination{Page: page, Limit: limit, Total: total, TotalPages: totalPages}
}

func parseDateRange(fromValue, toValue string, now time.Time) (time.Time, time.Time, error) {
	from := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	to := from
	var err error
	if fromValue != "" {
		from, err = time.ParseInLocation("2006-01-02", fromValue, now.Location())
		if err != nil {
			return time.Time{}, time.Time{}, apperrors.BadRequest("date_from must use YYYY-MM-DD", nil)
		}
	}
	if toValue != "" {
		to, err = time.ParseInLocation("2006-01-02", toValue, now.Location())
		if err != nil {
			return time.Time{}, time.Time{}, apperrors.BadRequest("date_to must use YYYY-MM-DD", nil)
		}
	}
	if from.After(to) {
		return time.Time{}, time.Time{}, apperrors.BadRequest("date_from cannot be after date_to", nil)
	}
	return from, to, nil
}
