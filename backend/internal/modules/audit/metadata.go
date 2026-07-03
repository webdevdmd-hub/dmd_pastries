package audit

import (
	"math"
	"reflect"
	"strings"
	"time"
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
	case float64:
		return math.Round(typed*10000) / 10000
	case float32:
		return math.Round(float64(typed)*10000) / 10000
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
