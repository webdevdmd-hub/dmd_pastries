package systemhealth

import (
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"pastries-pos/internal/shared/response"
)

const (
	probeCategoryAuthenticated     = "authenticated"
	probeCategoryParameterRequired = "parameter_required"
	probeCategoryPublic            = "public"
	probeCategoryUnsupported       = "unsupported"

	probeModeLiveOnly  = "live_only"
	probeModeSafeProbe = "safe_probe"
)

type routeProbeMetadata struct {
	category                   string
	expectedValidationMessages []string
	mode                       string
	path                       string
}

type Handler struct {
	router *gin.Engine
}

func NewHandler(router *gin.Engine) *Handler {
	return &Handler{router: router}
}

func (h *Handler) ListApiRoutes(c *gin.Context) {
	routes := h.router.Routes()
	apiRoutes := make([]ApiRouteResponse, 0, len(routes))
	now := time.Now().UTC()

	for _, route := range routes {
		probe := probeMetadataForRoute(route.Method, route.Path, now)
		apiRoutes = append(apiRoutes, ApiRouteResponse{
			ApiName:                    buildApiName(route.Method, route.Path),
			ExpectedValidationMessages: probe.expectedValidationMessages,
			Handler:                    route.Handler,
			Method:                     route.Method,
			Module:                     moduleForPath(route.Path),
			Path:                       route.Path,
			ProbeCategory:              probe.category,
			ProbeMode:                  probe.mode,
			ProbePath:                  probe.path,
		})
	}

	sort.Slice(apiRoutes, func(left, right int) bool {
		if apiRoutes[left].Module != apiRoutes[right].Module {
			return apiRoutes[left].Module < apiRoutes[right].Module
		}

		if apiRoutes[left].Path != apiRoutes[right].Path {
			return apiRoutes[left].Path < apiRoutes[right].Path
		}

		return apiRoutes[left].Method < apiRoutes[right].Method
	})

	response.Success(c, 200, "api routes fetched successfully", apiRoutes)
}

func probeModeForRoute(method string, path string) string {
	return probeMetadataForRoute(method, path, time.Now().UTC()).mode
}

func probeMetadataForRoute(method string, path string, now time.Time) routeProbeMetadata {
	if path == "/health" && method == "GET" {
		return routeProbeMetadata{category: probeCategoryPublic, mode: probeModeSafeProbe}
	}

	if method != "GET" {
		return routeProbeMetadata{category: probeCategoryUnsupported, mode: probeModeLiveOnly}
	}

	if strings.Contains(path, ":") || strings.Contains(path, "*") {
		return routeProbeMetadata{category: probeCategoryUnsupported, mode: probeModeLiveOnly}
	}

	if strings.Contains(path, "/export/") {
		return routeProbeMetadata{category: probeCategoryUnsupported, mode: probeModeLiveOnly}
	}

	if messages, ok := expectedValidationProbeMessages(path); ok {
		return routeProbeMetadata{
			category:                   probeCategoryParameterRequired,
			expectedValidationMessages: messages,
			mode:                       probeModeSafeProbe,
		}
	}

	if probePath, ok := safeParameterizedProbePath(path, now); ok {
		return routeProbeMetadata{
			category: probeCategoryParameterRequired,
			mode:     probeModeSafeProbe,
			path:     probePath,
		}
	}

	return routeProbeMetadata{category: probeCategoryAuthenticated, mode: probeModeSafeProbe}
}

func expectedValidationProbeMessages(path string) ([]string, bool) {
	switch path {
	case "/api/v1/customers/lookup":
		return []string{"phone, email, or search is required"}, true
	case "/api/v1/products/lookup", "/api/v1/pos/products/lookup":
		return []string{"barcode, sku, or product_code is required"}, true
	default:
		return nil, false
	}
}

func safeParameterizedProbePath(path string, now time.Time) (string, bool) {
	today := now.Format("2006-01-02")
	dateRange := "?date_from=" + today + "&date_to=" + today + "&page=1&limit=1"
	asOfDate := "?as_of_date=" + today + "&page=1&limit=1"

	switch path {
	case "/api/v1/accounting/reports/general-ledger",
		"/api/v1/accounting/reports/trial-balance",
		"/api/v1/accounting/reports/profit-loss":
		return path + dateRange, true
	case "/api/v1/accounting/reports/balance-sheet",
		"/api/v1/accounting/reconciliation/health-check",
		"/api/v1/accounting/reconciliation/inventory/details",
		"/api/v1/accounting/reconciliation/inventory",
		"/api/v1/accounting/reconciliation/ap",
		"/api/v1/accounting/reconciliation/ar",
		"/api/v1/accounting/reconciliation/payment-accounts":
		return path + asOfDate, true
	default:
		return "", false
	}
}

func moduleForPath(path string) string {
	if path == "/health" {
		return "System"
	}

	path = strings.TrimPrefix(path, "/api/v1/")
	segments := strings.Split(path, "/")
	if len(segments) == 0 || segments[0] == "" {
		return "System"
	}

	switch segments[0] {
	case "accounting":
		return "Accounting"
	case "activity-logs":
		return "Audit Logs"
	case "auth":
		return "Auth"
	case "bakery-orders":
		return "Bakery Orders"
	case "branches":
		return "Branches"
	case "business", "settings", "master-data":
		return "Settings"
	case "customers":
		return "Customers"
	case "dashboard":
		return "Dashboard"
	case "expenses":
		return "Expenses"
	case "ingredients":
		return "Ingredients"
	case "inventory", "stock-movements":
		return "Inventory"
	case "manufacturing":
		return "Manufacturing"
	case "packaging":
		return "Packaging"
	case "payments", "sales-returns":
		return "Payments"
	case "permissions", "roles", "users":
		return "User / Role"
	case "pos":
		return "POS"
	case "products":
		return "Products"
	case "purchasing":
		return "Purchase"
	case "recipes":
		return "Recipes"
	case "reports":
		return "Reports"
	case "suppliers":
		return "Suppliers"
	case "system":
		return "System"
	default:
		return toTitle(strings.ReplaceAll(segments[0], "-", " "))
	}
}

func buildApiName(method string, path string) string {
	if path == "/health" {
		return "Backend Health"
	}

	name := strings.TrimPrefix(path, "/api/v1/")
	name = strings.Trim(name, "/")
	name = strings.ReplaceAll(name, ":id", "detail")
	name = strings.ReplaceAll(name, ":saleId", "sale")
	name = strings.ReplaceAll(name, ":supplierId", "supplier")
	name = strings.ReplaceAll(name, ":productId", "product")
	name = strings.ReplaceAll(name, ":inventoryItemId", "inventory item")
	name = strings.ReplaceAll(name, ":variantId", "variant")
	name = strings.ReplaceAll(name, ":itemId", "item")
	name = strings.ReplaceAll(name, ":lineId", "line")
	name = strings.ReplaceAll(name, ":noteId", "note")
	name = strings.ReplaceAll(name, ":tagId", "tag")
	name = strings.ReplaceAll(name, ":paymentId", "payment")
	name = strings.ReplaceAll(name, "/", " ")
	name = strings.ReplaceAll(name, "-", " ")

	if name == "" {
		return method
	}

	return strings.TrimSpace(method + " " + toTitle(name))
}

func toTitle(value string) string {
	words := strings.Fields(value)
	for index, word := range words {
		if word == "" {
			continue
		}

		words[index] = strings.ToUpper(word[:1]) + word[1:]
	}

	return strings.Join(words, " ")
}
