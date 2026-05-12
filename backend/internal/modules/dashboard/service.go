package dashboard

import (
	"net/url"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	dashboardcache "pastries-pos/internal/modules/dashboard/cache"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db        *gorm.DB
	repo      *Repository
	auditRepo *audit.Repository
	cache     *dashboardcache.Service
}

func NewService(db *gorm.DB, repo *Repository, auditRepo *audit.Repository, cache *dashboardcache.Service) *Service {
	return &Service{db: db, repo: repo, auditRepo: auditRepo, cache: cache}
}

func (s *Service) AdminDashboard(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*AdminDashboardResponse, error) {
	if !isAdminVisible(currentUser) {
		return nil, apperrors.Forbidden("admin dashboard access denied")
	}
	scope, err := resolveScope(currentUser, values)
	if err != nil {
		return nil, err
	}
	result, err := s.repo.AdminDashboard(scope)
	if err != nil {
		return nil, apperrors.Internal("failed to load admin dashboard")
	}
	_ = s.writeAudit(currentUser, "dashboard.admin_viewed", "admin", scope, ipAddress, userAgent)
	return result, nil
}

func (s *Service) CashierDashboard(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*CashierDashboardResponse, error) {
	if !hasAnyPermission(currentUser, "pos.view", "pos.sell", "pos.checkout") && !isAdminVisible(currentUser) {
		return nil, apperrors.Forbidden("cashier dashboard access denied")
	}
	scope, err := resolveScope(currentUser, values)
	if err != nil {
		return nil, err
	}
	result, err := s.repo.CashierDashboard(scope, currentUser.UserID)
	if err != nil {
		return nil, apperrors.Internal("failed to load cashier dashboard")
	}
	_ = s.writeAudit(currentUser, "dashboard.cashier_viewed", "cashier", scope, ipAddress, userAgent)
	return result, nil
}

func (s *Service) ProductionDashboard(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*ProductionDashboardResponse, error) {
	if !hasAnyPermission(currentUser, "manufacturing.view") && !isAdminVisible(currentUser) {
		return nil, apperrors.Forbidden("production dashboard access denied")
	}
	scope, err := resolveScope(currentUser, values)
	if err != nil {
		return nil, err
	}
	result, err := s.repo.ProductionDashboard(scope)
	if err != nil {
		return nil, apperrors.Internal("failed to load production dashboard")
	}
	_ = s.writeAudit(currentUser, "dashboard.production_viewed", "production", scope, ipAddress, userAgent)
	return result, nil
}

func (s *Service) PurchasingDashboard(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PurchasingDashboardResponse, error) {
	if !hasAnyPermission(currentUser, "purchasing.view", "inventory.view") && !isAdminVisible(currentUser) {
		return nil, apperrors.Forbidden("purchasing dashboard access denied")
	}
	scope, err := resolveScope(currentUser, values)
	if err != nil {
		return nil, err
	}
	result, err := s.repo.PurchasingDashboard(scope)
	if err != nil {
		return nil, apperrors.Internal("failed to load purchasing dashboard")
	}
	_ = s.writeAudit(currentUser, "dashboard.purchasing_viewed", "purchasing", scope, ipAddress, userAgent)
	return result, nil
}

func (s *Service) RecentActivity(currentUser *utils.AuthContext, values url.Values) ([]ActivityFeedItem, error) {
	scope, err := resolveScope(currentUser, values)
	if err != nil {
		return nil, err
	}
	result, err := s.repo.RecentActivity(scope, parseLimit(values.Get("limit"), 20, 100))
	if err != nil {
		return nil, apperrors.Internal("failed to load recent activity")
	}
	return result, nil
}

func (s *Service) Alerts(currentUser *utils.AuthContext, values url.Values) (*AlertsResponse, error) {
	scope, err := resolveScope(currentUser, values)
	if err != nil {
		return nil, err
	}
	result, err := s.repo.Alerts(scope)
	if err != nil {
		return nil, apperrors.Internal("failed to load dashboard alerts")
	}
	return result, nil
}

func (s *Service) KPISummary(currentUser *utils.AuthContext, values url.Values) (*KPISummaryResponse, error) {
	scope, err := resolveScope(currentUser, values)
	if err != nil {
		return nil, err
	}
	result, err := s.repo.KPISummary(scope)
	if err != nil {
		return nil, apperrors.Internal("failed to load KPI summary")
	}
	return result, nil
}

func resolveScope(currentUser *utils.AuthContext, values url.Values) (Scope, error) {
	branchID, allBranches, err := currentUser.ResolveBranchScope(values.Get("branch_id"), values.Get("scope"))
	if err != nil {
		return Scope{}, err
	}

	location := time.UTC
	if timezone := strings.TrimSpace(values.Get("timezone")); timezone != "" {
		loaded, err := time.LoadLocation(timezone)
		if err != nil {
			return Scope{}, apperrors.BadRequest("invalid timezone", map[string]string{"timezone": timezone})
		}
		location = loaded
	}

	now := time.Now().In(location)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	todayEnd := todayStart.AddDate(0, 0, 1)
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, location)
	monthEnd := monthStart.AddDate(0, 1, 0)

	return Scope{
		BusinessID:  currentUser.BusinessID,
		BranchID:    branchID,
		AllBranches: allBranches,
		TodayStart:  todayStart.UTC(),
		TodayEnd:    todayEnd.UTC(),
		MonthStart:  monthStart.UTC(),
		MonthEnd:    monthEnd.UTC(),
		TodayDate:   todayStart.Format("2006-01-02"),
		MonthDate:   monthStart.Format("2006-01-02"),
	}, nil
}

func (s *Service) writeAudit(currentUser *utils.AuthContext, eventType, dashboardType string, scope Scope, ipAddress, userAgent string) error {
	if s.auditRepo == nil || currentUser == nil {
		return nil
	}
	return s.auditRepo.CreateActivity(s.db, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "dashboard",
		EntityID:    dashboardType,
		Summary:     "Dashboard viewed.",
		Metadata: map[string]interface{}{
			"dashboard_type": dashboardType,
			"branch_id":      scope.BranchID,
			"all_branches":   scope.AllBranches,
		},
		IPAddress: ipAddress,
		UserAgent: userAgent,
	})
}

func parseLimit(raw string, fallback, max int) int {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || value <= 0 {
		return fallback
	}
	if value > max {
		return max
	}
	return value
}

func isAdminVisible(currentUser *utils.AuthContext) bool {
	if currentUser == nil {
		return false
	}
	role := strings.ToLower(strings.TrimSpace(currentUser.RoleName))
	return currentUser.CanAccessAllBranches || role == "admin" || role == "owner" || hasAnyPermission(currentUser, "reports.view", "users.view", "settings.view")
}

func hasAnyPermission(currentUser *utils.AuthContext, keys ...string) bool {
	if currentUser == nil {
		return false
	}
	for _, permission := range currentUser.Permissions {
		for _, key := range keys {
			if permission == key {
				return true
			}
		}
	}
	return false
}
