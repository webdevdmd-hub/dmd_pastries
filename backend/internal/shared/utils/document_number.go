package utils

import (
	"fmt"

	"gorm.io/gorm"
)

// NextSequentialNumber issues the next document number for a prefixed, zero-padded
// sequence (e.g. "SALE-20260810-000042"). It takes MAX(existing suffix)+1 over the
// raw table — including soft-deleted rows — instead of COUNT(*), because a counter
// derived from COUNT regresses as soon as one row is soft-deleted and then collides
// with the unique index on the number column.
//
// query must already be scoped (business/branch filters) via Table(...).Where(...),
// and the caller must hold an advisory lock covering the sequence to serialize
// concurrent issuers.
func NextSequentialNumber(query *gorm.DB, column, prefix string, width int) (string, error) {
	suffixStart := len(prefix) + 1
	var next int64
	err := query.
		Where(column+" LIKE ?", prefix+"%").
		Where("substring("+column+" from ?) ~ '^[0-9]+$'", suffixStart).
		Select("COALESCE(MAX(substring("+column+" from ?)::bigint), 0)", suffixStart).
		Scan(&next).Error
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%0*d", prefix, width, next+1), nil
}
