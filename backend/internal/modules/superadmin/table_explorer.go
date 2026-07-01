package superadmin

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type tableColumn struct {
	key      string
	label    string
	dataType string
	editable bool
	masked   bool
}

type tableDefinition struct {
	key         string
	tableName   string
	label       string
	description string
	columns     []tableColumn
	searchCols  []string
	businessCol string
}

func (s *Service) ListTables() []TableDefinitionResponse {
	definitions := tableDefinitions()
	response := make([]TableDefinitionResponse, 0, len(definitions))
	for _, definition := range definitions {
		response = append(response, toTableDefinitionResponse(definition))
	}
	return response
}

func (s *Service) ListTableRows(tableKey, businessID, search, pageValue, limitValue string) (*TableRowsResponse, error) {
	definition, ok := tableDefinitionByKey(tableKey)
	if !ok {
		return nil, apperrors.NotFound("table is not allowlisted")
	}

	page := parsePositiveInt(pageValue, 1, 1, 100000)
	limit := parsePositiveInt(limitValue, 25, 1, 100)
	offset := (page - 1) * limit

	query := s.db.Table(definition.tableName)
	if definition.businessCol != "" && strings.TrimSpace(businessID) != "" {
		query = query.Where(quoteIdentifier(definition.businessCol)+" = ?", strings.TrimSpace(businessID))
	}
	if normalized := strings.TrimSpace(search); normalized != "" && len(definition.searchCols) > 0 {
		pattern := "%" + strings.ToLower(normalized) + "%"
		clauses := make([]string, 0, len(definition.searchCols))
		args := make([]interface{}, 0, len(definition.searchCols))
		for _, column := range definition.searchCols {
			clauses = append(clauses, "LOWER(COALESCE("+quoteIdentifier(column)+"::text, '')) LIKE ?")
			args = append(args, pattern)
		}
		query = query.Where(strings.Join(clauses, " OR "), args...)
	}

	var totalRows int64
	if err := query.Count(&totalRows).Error; err != nil {
		return nil, apperrors.Internal("failed to count table rows")
	}

	rows, err := scanTableRows(query, definition, limit, offset)
	if err != nil {
		return nil, err
	}

	totalPages := 0
	if totalRows > 0 {
		totalPages = int(math.Ceil(float64(totalRows) / float64(limit)))
	}
	return &TableRowsResponse{
		Table:      toTableDefinitionResponse(definition),
		Rows:       rows,
		Page:       page,
		Limit:      limit,
		TotalRows:  totalRows,
		TotalPages: totalPages,
	}, nil
}

func (s *Service) UpdateTableRow(currentUser *utils.AuthContext, tableKey, rowID string, req UpdateTableRowRequest, ipAddress, userAgent string) (*TableRowActionResponse, error) {
	definition, ok := tableDefinitionByKey(tableKey)
	if !ok {
		return nil, apperrors.NotFound("table is not allowlisted")
	}
	reason := strings.TrimSpace(req.Reason)
	if len(reason) < 10 {
		return nil, apperrors.BadRequest("reason must be at least 10 characters", nil)
	}
	if strings.TrimSpace(rowID) == "" {
		return nil, apperrors.BadRequest("row id is required", nil)
	}

	updates, err := normalizeTableUpdates(definition, req.Values)
	if err != nil {
		return nil, err
	}
	if len(updates) == 0 {
		return nil, apperrors.BadRequest("no editable fields provided", nil)
	}

	before, err := s.fetchTableRow(definition, rowID)
	if err != nil {
		return nil, err
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, apperrors.Internal("failed to start table row action")
	}
	if err := tx.Table(definition.tableName).Where("id = ?", rowID).Updates(updates).Error; err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to update allowlisted table row")
	}
	after, err := s.fetchTableRowWithDB(tx, definition, rowID)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	targetBusinessID := businessIDFromRow(after)
	if err := s.createPlatformAudit(tx, platformAuditInput{
		ActorAppwriteUserID: currentUser.AppwriteUserID,
		ActorEmail:          currentUser.Email,
		ActionType:          "table." + definition.key + ".updated",
		TargetType:          "table_row",
		TargetID:            rowID,
		TargetBusinessID:    targetBusinessID,
		Reason:              reason,
		BeforeData:          before,
		AfterData:           after,
		IPAddress:           ipAddress,
		UserAgent:           userAgent,
	}); err != nil {
		tx.Rollback()
		return nil, apperrors.Internal("failed to create platform audit log")
	}
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.Internal("failed to commit table row action")
	}

	return &TableRowActionResponse{
		Table:  definition.key,
		RowID:  rowID,
		Row:    after,
		Action: "table." + definition.key + ".updated",
	}, nil
}

func (s *Service) fetchTableRow(definition tableDefinition, rowID string) (map[string]interface{}, error) {
	return s.fetchTableRowWithDB(s.db, definition, rowID)
}

func (s *Service) fetchTableRowWithDB(db *gorm.DB, definition tableDefinition, rowID string) (map[string]interface{}, error) {
	rows, err := scanTableRows(db.Table(definition.tableName).Where("id = ?", rowID), definition, 1, 0)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, apperrors.NotFound("table row not found")
	}
	return rows[0], nil
}

func scanTableRows(query *gorm.DB, definition tableDefinition, limit, offset int) ([]map[string]interface{}, error) {
	selectColumns := make([]string, 0, len(definition.columns))
	for _, column := range definition.columns {
		selectColumns = append(selectColumns, quoteIdentifier(column.key))
	}

	var rawRows []map[string]interface{}
	err := query.
		Select(strings.Join(selectColumns, ", ")).
		Order("created_at DESC, id DESC").
		Limit(limit).
		Offset(offset).
		Find(&rawRows).Error
	if err != nil {
		return nil, apperrors.Internal("failed to load table rows")
	}

	rows := make([]map[string]interface{}, 0, len(rawRows))
	for _, row := range rawRows {
		rows = append(rows, normalizeRow(row, definition))
	}
	return rows, nil
}

func normalizeRow(row map[string]interface{}, definition tableDefinition) map[string]interface{} {
	normalized := map[string]interface{}{}
	for _, column := range definition.columns {
		value := row[column.key]
		if value == nil {
			normalized[column.key] = nil
			continue
		}
		if column.masked {
			normalized[column.key] = maskValue(value)
			continue
		}
		switch typed := value.(type) {
		case time.Time:
			normalized[column.key] = typed.UTC().Format(time.RFC3339)
		case []byte:
			normalized[column.key] = string(typed)
		default:
			normalized[column.key] = typed
		}
	}
	return normalized
}

func normalizeTableUpdates(definition tableDefinition, values map[string]interface{}) (map[string]interface{}, error) {
	editable := map[string]tableColumn{}
	for _, column := range definition.columns {
		if column.editable {
			editable[column.key] = column
		}
	}
	updates := map[string]interface{}{}
	for key, value := range values {
		column, ok := editable[key]
		if !ok {
			return nil, apperrors.BadRequest("field is not editable", map[string]interface{}{"field": key})
		}
		normalized, err := normalizeEditableValue(column, value)
		if err != nil {
			return nil, err
		}
		updates[key] = normalized
	}
	if _, ok := editable["updated_at"]; !ok {
		if tableHasColumn(definition, "updated_at") {
			updates["updated_at"] = time.Now().UTC()
		}
	}
	return updates, nil
}

func normalizeEditableValue(column tableColumn, value interface{}) (interface{}, error) {
	switch column.dataType {
	case "string":
		if value == nil {
			return "", nil
		}
		text, ok := value.(string)
		if !ok {
			return nil, apperrors.BadRequest("field must be a string", map[string]interface{}{"field": column.key})
		}
		text = strings.TrimSpace(text)
		if column.key == "currency" {
			text = strings.ToUpper(text)
		}
		return text, nil
	case "status":
		text, ok := value.(string)
		if !ok {
			return nil, apperrors.BadRequest("status must be a string", map[string]interface{}{"field": column.key})
		}
		text = strings.ToLower(strings.TrimSpace(text))
		if text == "" {
			return nil, apperrors.BadRequest("status cannot be empty", map[string]interface{}{"field": column.key})
		}
		return text, nil
	case "int":
		switch typed := value.(type) {
		case float64:
			return int(typed), nil
		case int:
			return typed, nil
		default:
			return nil, apperrors.BadRequest("field must be a number", map[string]interface{}{"field": column.key})
		}
	default:
		return nil, apperrors.BadRequest("field type is not editable", map[string]interface{}{"field": column.key})
	}
}

func tableDefinitions() []tableDefinition {
	return []tableDefinition{
		{
			key:         "businesses",
			tableName:   "businesses",
			label:       "Businesses",
			description: "Tenant records. Editable fields mirror Business Admin Actions.",
			businessCol: "id",
			searchCols:  []string{"business_name", "vat_number", "status"},
			columns: []tableColumn{
				{key: "id", label: "ID", dataType: "uuid"},
				{key: "business_name", label: "Business", dataType: "string", editable: true},
				{key: "currency", label: "Currency", dataType: "string", editable: true},
				{key: "timezone", label: "Timezone", dataType: "string", editable: true},
				{key: "vat_number", label: "VAT", dataType: "string", editable: true},
				{key: "status", label: "Status", dataType: "status", editable: true},
				{key: "created_at", label: "Created", dataType: "datetime"},
				{key: "updated_at", label: "Updated", dataType: "datetime"},
			},
		},
		{
			key:         "users",
			tableName:   "users",
			label:       "Users",
			description: "Identity and access rows. Use User 360 for controlled user mutations.",
			businessCol: "business_id",
			searchCols:  []string{"full_name", "email", "status", "appwrite_user_id"},
			columns: []tableColumn{
				{key: "id", label: "ID", dataType: "uuid"},
				{key: "business_id", label: "Business ID", dataType: "uuid"},
				{key: "full_name", label: "Name", dataType: "string"},
				{key: "email", label: "Email", dataType: "string", masked: true},
				{key: "phone", label: "Phone", dataType: "string", masked: true},
				{key: "status", label: "Status", dataType: "status"},
				{key: "role_id", label: "Role ID", dataType: "uuid"},
				{key: "branch_id", label: "Branch ID", dataType: "uuid"},
				{key: "created_at", label: "Created", dataType: "datetime"},
			},
		},
		{
			key:         "branches",
			tableName:   "branches",
			label:       "Branches",
			description: "Branch setup records. Editable fields are non-relational branch profile fields.",
			businessCol: "business_id",
			searchCols:  []string{"branch_name", "code", "status", "city", "country"},
			columns: []tableColumn{
				{key: "id", label: "ID", dataType: "uuid"},
				{key: "business_id", label: "Business ID", dataType: "uuid"},
				{key: "branch_name", label: "Branch", dataType: "string", editable: true},
				{key: "code", label: "Code", dataType: "string", editable: true},
				{key: "phone", label: "Phone", dataType: "string", editable: true},
				{key: "email", label: "Email", dataType: "string", editable: true},
				{key: "city", label: "City", dataType: "string", editable: true},
				{key: "country", label: "Country", dataType: "string", editable: true},
				{key: "timezone", label: "Timezone", dataType: "string", editable: true},
				{key: "status", label: "Status", dataType: "status", editable: true},
				{key: "created_at", label: "Created", dataType: "datetime"},
				{key: "updated_at", label: "Updated", dataType: "datetime"},
			},
		},
		{
			key:         "roles",
			tableName:   "roles",
			label:       "Roles",
			description: "Role metadata. Permission membership remains managed by role-specific APIs.",
			businessCol: "business_id",
			searchCols:  []string{"role_name", "description"},
			columns: []tableColumn{
				{key: "id", label: "ID", dataType: "uuid"},
				{key: "business_id", label: "Business ID", dataType: "uuid"},
				{key: "role_name", label: "Role", dataType: "string", editable: true},
				{key: "description", label: "Description", dataType: "string", editable: true},
				{key: "is_system_default", label: "System", dataType: "boolean"},
				{key: "created_at", label: "Created", dataType: "datetime"},
				{key: "updated_at", label: "Updated", dataType: "datetime"},
			},
		},
		{
			key:         "subscriptions",
			tableName:   "subscriptions",
			label:       "Subscriptions",
			description: "Subscription limits and lifecycle fields.",
			businessCol: "business_id",
			searchCols:  []string{"plan_type", "status"},
			columns: []tableColumn{
				{key: "id", label: "ID", dataType: "uuid"},
				{key: "business_id", label: "Business ID", dataType: "uuid"},
				{key: "plan_type", label: "Plan", dataType: "string", editable: true},
				{key: "status", label: "Status", dataType: "status", editable: true},
				{key: "user_limit", label: "Users", dataType: "int", editable: true},
				{key: "branch_limit", label: "Branches", dataType: "int", editable: true},
				{key: "created_at", label: "Created", dataType: "datetime"},
				{key: "updated_at", label: "Updated", dataType: "datetime"},
			},
		},
	}
}

func tableDefinitionByKey(key string) (tableDefinition, bool) {
	for _, definition := range tableDefinitions() {
		if definition.key == key {
			return definition, true
		}
	}
	return tableDefinition{}, false
}

func toTableDefinitionResponse(definition tableDefinition) TableDefinitionResponse {
	columns := make([]TableColumnResponse, 0, len(definition.columns))
	canUpdate := false
	for _, column := range definition.columns {
		if column.editable {
			canUpdate = true
		}
		columns = append(columns, TableColumnResponse{
			Key:      column.key,
			Label:    column.label,
			Type:     column.dataType,
			Editable: column.editable,
			Masked:   column.masked,
		})
	}
	return TableDefinitionResponse{
		Key:         definition.key,
		Label:       definition.label,
		Description: definition.description,
		Columns:     columns,
		CanUpdate:   canUpdate,
	}
}

func parsePositiveInt(value string, fallback, minValue, maxValue int) int {
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < minValue {
		return fallback
	}
	if parsed > maxValue {
		return maxValue
	}
	return parsed
}

func quoteIdentifier(value string) string {
	return `"` + strings.ReplaceAll(value, `"`, `""`) + `"`
}

func maskValue(value interface{}) string {
	text := fmt.Sprint(value)
	if len(text) <= 4 {
		return "****"
	}
	return text[:2] + "****" + text[len(text)-2:]
}

func tableHasColumn(definition tableDefinition, key string) bool {
	for _, column := range definition.columns {
		if column.key == key {
			return true
		}
	}
	return false
}

func businessIDFromRow(row map[string]interface{}) string {
	if value, ok := row["business_id"].(string); ok {
		return value
	}
	if value, ok := row["id"].(string); ok {
		return value
	}
	return ""
}
