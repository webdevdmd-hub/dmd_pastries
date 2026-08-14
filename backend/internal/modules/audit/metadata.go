package audit

import (
	"reflect"
	"strings"
	"time"

	"pastries-pos/internal/shared/money"
)

type AuditChange struct {
	Field    string      `json:"field"`
	Label    string      `json:"label"`
	OldValue interface{} `json:"old_value"`
	NewValue interface{} `json:"new_value"`
}

func Change(field, label string, oldValue, newValue interface{}) (AuditChange, bool) {
	oldDisplay := auditDisplayValue(oldValue)
	newDisplay := auditDisplayValue(newValue)
	if reflect.DeepEqual(oldDisplay, newDisplay) {
		return AuditChange{}, false
	}
	return AuditChange{Field: field, Label: label, OldValue: oldDisplay, NewValue: newDisplay}, true
}

func AddChange(changes *[]AuditChange, field, label string, oldValue, newValue interface{}) {
	if change, changed := Change(field, label, oldValue, newValue); changed {
		*changes = append(*changes, change)
	}
}

func Metadata(fields map[string]interface{}, changes []AuditChange) map[string]interface{} {
	metadata := map[string]interface{}{}
	for key, value := range fields {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		display := auditDisplayValue(value)
		if isEmptyAuditValue(display) {
			continue
		}
		metadata[key] = display
	}
	if len(changes) > 0 {
		metadata["changes"] = changes
	}
	return metadata
}

func RecordMetadata(recordLabel string, fields map[string]interface{}, changes []AuditChange) map[string]interface{} {
	if fields == nil {
		fields = map[string]interface{}{}
	}
	if strings.TrimSpace(recordLabel) != "" {
		fields["record_label"] = recordLabel
	}
	return Metadata(fields, changes)
}

func ParseChanges(metadata map[string]interface{}) []AuditChange {
	raw, ok := metadata["changes"]
	if !ok {
		return nil
	}
	items, ok := raw.([]interface{})
	if !ok {
		return nil
	}
	changes := make([]AuditChange, 0, len(items))
	for _, item := range items {
		row, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		field, _ := row["field"].(string)
		label, _ := row["label"].(string)
		if strings.TrimSpace(field) == "" && strings.TrimSpace(label) == "" {
			continue
		}
		changes = append(changes, AuditChange{
			Field:    field,
			Label:    firstNonEmpty(label, humanizeAuditWords(field)),
			OldValue: auditDisplayValue(row["old_value"]),
			NewValue: auditDisplayValue(row["new_value"]),
		})
	}
	return changes
}

func auditDisplayValue(value interface{}) interface{} {
	if value == nil {
		return nil
	}
	reflected := reflect.ValueOf(value)
	for reflected.IsValid() && reflected.Kind() == reflect.Ptr {
		if reflected.IsNil() {
			return nil
		}
		reflected = reflected.Elem()
	}
	if !reflected.IsValid() {
		return nil
	}
	value = reflected.Interface()
	switch typed := value.(type) {
	case time.Time:
		if typed.IsZero() {
			return nil
		}
		return typed.UTC().Format(time.RFC3339)
	// Amounts reach audit metadata as bare values through reflection, so this
	// switch is the one place the float64 -> money.Amount change is invisible
	// to the compiler: a converted module would fall through to default and
	// silently stop being normalised. Both forms are handled while the
	// migration is in progress.
	case money.Amount:
		return typed.Round4()
	case float64:
		return money.Round4(typed)
	case float32:
		return money.Round4(float64(typed))
	case string:
		return strings.TrimSpace(typed)
	default:
		return value
	}
}

func isEmptyAuditValue(value interface{}) bool {
	if value == nil {
		return true
	}
	if text, ok := value.(string); ok {
		return strings.TrimSpace(text) == ""
	}
	return false
}
