package reports

// Phase 4 / W3 — "No-tax documents" report: every POS sale, bakery order,
// and purchase bill created under the no-tax mode, for VAT-filing review.

import (
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"

	"pastries-pos/internal/modules/reports/shared"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/response"
	"pastries-pos/internal/shared/utils"
)

type NoTaxDocumentReportItem struct {
	DocumentType   string  `json:"document_type"` // pos_sale | bakery_order | purchase_invoice
	DocumentID     string  `json:"document_id"`
	DocumentNumber string  `json:"document_number"`
	DocumentDate   string  `json:"document_date"`
	BranchID       string  `json:"branch_id"`
	BranchName     string  `json:"branch_name"`
	TotalAmount    float64 `json:"total_amount"`
	CreatedByName  string  `json:"created_by_name"`
}

func (s *Service) NoTaxDocuments(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PaginatedResponse[NoTaxDocumentReportItem], error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	items, total, err := s.repo.NoTaxDocuments(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate no-tax documents report")
	}
	_ = s.writeAudit(currentUser, "report.no_tax_documents_viewed", "reports", "no_tax_documents", "No-tax documents report viewed.", filter, ipAddress, userAgent)
	return &PaginatedResponse[NoTaxDocumentReportItem]{Items: items, Pagination: shared.NewPagination(filter.Page, filter.Limit, total)}, nil
}

// NoTaxDocuments unions the three no-tax document sources, newest first.
func (r *Repository) NoTaxDocuments(filter *shared.ResolvedFilter) ([]NoTaxDocumentReportItem, int64, error) {
	baseQuery := `
		SELECT * FROM (
			SELECT 'pos_sale' AS document_type, s.id::text AS document_id, s.sale_number AS document_number,
			       s.sold_at AS document_at, s.branch_id::text AS branch_id, COALESCE(b.branch_name, '') AS branch_name,
			       s.total_amount, COALESCE(u.full_name, '') AS created_by_name
			FROM sales s
			LEFT JOIN branches b ON b.id = s.branch_id
			LEFT JOIN users u ON u.id = s.cashier_user_id
			WHERE s.business_id = @business_id AND s.deleted_at IS NULL AND s.tax_mode = 'no_tax'
			  AND s.sold_at >= @start_utc AND s.sold_at < @end_utc
			  AND (@all_branches OR s.branch_id::text = @branch_id)
			UNION ALL
			SELECT 'bakery_order', bo.id::text, bo.order_number,
			       bo.created_at, bo.branch_id::text, COALESCE(b.branch_name, ''),
			       bo.total_amount, COALESCE(u.full_name, '')
			FROM bakery_orders bo
			LEFT JOIN branches b ON b.id = bo.branch_id
			LEFT JOIN users u ON u.id = bo.created_by_user_id
			WHERE bo.business_id = @business_id AND bo.deleted_at IS NULL AND bo.tax_mode = 'no_tax'
			  AND bo.created_at >= @start_utc AND bo.created_at < @end_utc
			  AND (@all_branches OR bo.branch_id::text = @branch_id)
			UNION ALL
			SELECT 'purchase_invoice', pi.id::text, pi.invoice_number,
			       pi.created_at, pi.branch_id::text, COALESCE(b.branch_name, ''),
			       pi.total_amount, COALESCE(u.full_name, '')
			FROM purchase_invoices pi
			LEFT JOIN branches b ON b.id = pi.branch_id
			LEFT JOIN users u ON u.id = pi.created_by_user_id
			WHERE pi.business_id = @business_id AND pi.deleted_at IS NULL AND pi.tax_mode = 'no_tax'
			  AND pi.created_at >= @start_utc AND pi.created_at < @end_utc
			  AND (@all_branches OR pi.branch_id::text = @branch_id)
		) docs`
	params := map[string]interface{}{
		"business_id":  filter.BusinessID,
		"start_utc":    filter.StartUTC,
		"end_utc":      filter.EndUTC,
		"all_branches": filter.AllBranches,
		"branch_id":    filter.BranchID,
	}
	var total int64
	if err := r.db.Raw("SELECT COUNT(*) FROM ("+baseQuery+") counted", params).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	type row struct {
		DocumentType   string
		DocumentID     string
		DocumentNumber string
		DocumentAt     string
		BranchID       string
		BranchName     string
		TotalAmount    float64
		CreatedByName  string
	}
	var rows []row
	params["limit"] = filter.Limit
	params["offset"] = (filter.Page - 1) * filter.Limit
	if err := r.db.Raw(baseQuery+" ORDER BY docs.document_at DESC LIMIT @limit OFFSET @offset", params).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	items := make([]NoTaxDocumentReportItem, 0, len(rows))
	for _, entry := range rows {
		items = append(items, NoTaxDocumentReportItem{
			DocumentType:   entry.DocumentType,
			DocumentID:     entry.DocumentID,
			DocumentNumber: entry.DocumentNumber,
			DocumentDate:   entry.DocumentAt,
			BranchID:       entry.BranchID,
			BranchName:     entry.BranchName,
			TotalAmount:    entry.TotalAmount,
			CreatedByName:  entry.CreatedByName,
		})
	}
	return items, total, nil
}

func (h *Handler) NoTaxDocuments(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.NoTaxDocuments(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "No-tax documents report generated successfully", data)
}
