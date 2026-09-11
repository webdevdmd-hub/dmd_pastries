// Package lookups serves the reference lists every form needs to be filled
// in -- categories, units, statuses, channels, payment methods, tax rates,
// branches -- to any signed-in member of the business.
//
// Why a separate route: "may pick a category from a list" and "may open the
// Master Data module" are different powers, and the permission matrix used
// to conflate them. Under strict permissions a role built to add products
// therefore got empty category and unit dropdowns, because those lists lived
// behind master_data.view. Reference data carries no prices, costs, balances
// or personal details; it is the vocabulary of the business, and every staff
// member needs the vocabulary. So it sits behind the auth guard alone.
//
// Sensitive lists (products, customers, suppliers, ...) are not here. They
// keep per-module /lookup routes unlocked by the permissions whose forms need
// them; see the allow-list in cmd/api/permit_aliases_test.go.
//
// The handler delegates to the owning modules' list services, so a client
// receives exactly the shape it already parses from the module endpoints.
package lookups

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"pastries-pos/internal/modules/branches"
	"pastries-pos/internal/modules/masterdata"
	"pastries-pos/internal/modules/settings"
	"pastries-pos/internal/shared/response"
	"pastries-pos/internal/shared/utils"
)

// Kinds a client may ask for. The response carries one key per kind
// requested, in this spelling.
var kinds = map[string]struct{}{
	"product_categories": {},
	"units":              {},
	"order_statuses":     {},
	"payment_statuses":   {},
	"sales_channels":     {},
	"payment_methods":    {},
	"tax_rates":          {},
	"branches":           {},
}

type Handler struct {
	masterData *masterdata.Service
	settings   *settings.Service
	branches   *branches.Service
}

func NewHandler(masterData *masterdata.Service, settingsSvc *settings.Service, branchSvc *branches.Service) *Handler {
	return &Handler{masterData: masterData, settings: settingsSvc, branches: branchSvc}
}

func RegisterRoutes(router *gin.Engine, handler *Handler, authGuard gin.HandlerFunc) {
	group := router.Group("/api/v1/lookups")
	group.Use(authGuard)
	group.GET("", handler.Lookups)
}

// Lookups returns the requested reference lists.
//
//	GET /api/v1/lookups?kinds=product_categories,units
//
// An unknown kind is a 400, so a typo in a form is loud rather than an empty
// dropdown. Each list is the active records the owning module would return.
func (h *Handler) Lookups(c *gin.Context) {
	requested := strings.Split(c.Query("kinds"), ",")
	current := utils.MustAuthContext(c)
	out := gin.H{}

	for _, raw := range requested {
		kind := strings.TrimSpace(raw)
		if kind == "" {
			continue
		}
		if _, ok := kinds[kind]; !ok {
			response.Error(c, http.StatusBadRequest, "unknown lookup kind: "+kind, nil)
			return
		}
		var (
			data any
			err  error
		)
		switch kind {
		case "product_categories":
			data, err = h.masterData.ListProductCategories(current, c.Query("product_type"))
		case "units":
			data, err = h.masterData.ListUnits(current)
		case "order_statuses":
			data, err = h.masterData.ListOrderStatuses(current)
		case "payment_statuses":
			data, err = h.masterData.ListPaymentStatuses(current)
		case "sales_channels":
			data, err = h.settings.ListSalesChannels(current, "", "active")
		case "payment_methods":
			data, err = h.settings.ListPaymentMethods(current)
		case "tax_rates":
			data, err = h.settings.ListTaxRates(current, "active")
		case "branches":
			data, err = h.branches.ListBranches(current)
		}
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "failed to load "+kind, nil)
			return
		}
		out[kind] = data
	}

	if len(out) == 0 {
		response.Error(c, http.StatusBadRequest, "kinds is required", nil)
		return
	}
	response.Success(c, http.StatusOK, "lookups fetched successfully", out)
}
