// Package deleteguard words the refusal a delete gives while the record is
// still in use, so every catalogue delete says the same two things: what is
// holding the record, and what to do instead.
//
// The refusal is a 409. The frontend's delete handling (lib/api/delete-conflicts.ts)
// treats 409 as "in use", and the message is written for the person who
// clicked Delete, so a page can show it as it is.
package deleteguard

import (
	"fmt"
	"strings"

	apperrors "pastries-pos/internal/shared/errors"
)

// Conflict refuses a delete.
//
//	Conflict("ingredient_in_use", "Butter", []string{"stock movements", "recipes using it"},
//	    "Deactivate it instead; its records stay.")
//
// reads "Butter cannot be deleted: it has stock movements and recipes using
// it. Deactivate it instead; its records stay." The details carry the reason
// code and the list for callers that want them.
func Conflict(reason, subject string, uses []string, instead string) error {
	subject = strings.TrimSpace(subject)
	if subject == "" {
		subject = "This record"
	}
	message := fmt.Sprintf("%s cannot be deleted: it has %s.", subject, List(uses))
	if instead = strings.TrimSpace(instead); instead != "" {
		message += " " + instead
	}
	return apperrors.Conflict(message, map[string]interface{}{
		"reason": reason,
		"uses":   uses,
	})
}

// List joins phrases the way a sentence would: "a", "a and b", "a, b and c".
func List(items []string) string {
	switch len(items) {
	case 0:
		return "records that depend on it"
	case 1:
		return items[0]
	default:
		return strings.Join(items[:len(items)-1], ", ") + " and " + items[len(items)-1]
	}
}
