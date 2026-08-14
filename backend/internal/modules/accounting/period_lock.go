package accounting

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"gorm.io/gorm"

	apperrors "pastries-pos/internal/shared/errors"
)

// Period locking (Phase 5 / W1): a single business-wide inclusive lock date
// (company_settings.books_closed_through). Journals dated on or before it can
// no longer be created, posted, edited, deleted, or reversed. The fix path
// for locked history is unlock (audited) → correct → re-lock; there is no
// per-user override.
//
// The guards are package-level (not Service methods) so modules that write
// journal rows themselves (expenses, purchasing) can call them without a
// service dependency. period_lock_guard_test.go enforces that every journal
// writer/soft-deleter calls one of them.

const periodLockedReason = "period_locked"

// FindBooksClosedThrough returns the business's lock date, or nil when the
// books are not locked (including businesses without a settings row yet).
func FindBooksClosedThrough(tx *gorm.DB, businessID string) (*time.Time, error) {
	var row struct {
		BooksClosedThrough *time.Time
	}
	err := tx.Table("company_settings").
		Select("books_closed_through").
		Where("business_id = ? AND deleted_at IS NULL", businessID).
		Take(&row).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return row.BooksClosedThrough, nil
}

// EnsurePeriodOpen fails with 422 when entryDate falls in the locked period.
// The comparison is on calendar dates in UTC because journal_entries.
// entry_date is a DATE column.
func EnsurePeriodOpen(tx *gorm.DB, businessID string, entryDate time.Time) error {
	closedThrough, err := FindBooksClosedThrough(tx, businessID)
	if err != nil {
		return apperrors.Internal("failed to check accounting period lock")
	}
	if periodLockedBy(closedThrough, entryDate) {
		return periodLockedError(*closedThrough, entryDate)
	}
	return nil
}

// EnsurePeriodOpenForJournals checks the entry dates of existing journals
// (edit/delete/reverse paths, where the binding date is the original
// entry's). Soft-deleted journals are ignored — they are already off the
// books.
func EnsurePeriodOpenForJournals(tx *gorm.DB, businessID string, journalEntryIDs ...string) error {
	ids := make([]string, 0, len(journalEntryIDs))
	for _, id := range journalEntryIDs {
		if trimmed := strings.TrimSpace(id); trimmed != "" {
			ids = append(ids, trimmed)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	return ensurePeriodOpenForEarliest(tx, businessID, func(query *gorm.DB) *gorm.DB {
		return query.Where("id IN ?", ids)
	})
}

// EnsurePeriodOpenForSource checks every live journal posted for a source
// document (paths that soft-delete by source, e.g. supplier-payment
// rollback).
func EnsurePeriodOpenForSource(tx *gorm.DB, businessID, sourceType, sourceID string) error {
	if strings.TrimSpace(sourceType) == "" || strings.TrimSpace(sourceID) == "" {
		return nil
	}
	return ensurePeriodOpenForEarliest(tx, businessID, func(query *gorm.DB) *gorm.DB {
		return query.Where("source_type = ? AND source_id = ?", strings.TrimSpace(sourceType), strings.TrimSpace(sourceID))
	})
}

func ensurePeriodOpenForEarliest(tx *gorm.DB, businessID string, scope func(*gorm.DB) *gorm.DB) error {
	closedThrough, err := FindBooksClosedThrough(tx, businessID)
	if err != nil {
		return apperrors.Internal("failed to check accounting period lock")
	}
	if closedThrough == nil {
		return nil
	}
	// The earliest entry date is the binding one under an inclusive
	// closed-through lock.
	var row struct {
		EarliestEntryDate *time.Time
	}
	query := tx.Table("journal_entries").
		Select("MIN(entry_date) AS earliest_entry_date").
		Where("business_id = ? AND deleted_at IS NULL", businessID)
	if err := scope(query).Take(&row).Error; err != nil {
		return apperrors.Internal("failed to check accounting period lock")
	}
	if row.EarliestEntryDate == nil {
		return nil
	}
	if periodLockedBy(closedThrough, *row.EarliestEntryDate) {
		return periodLockedError(*closedThrough, *row.EarliestEntryDate)
	}
	return nil
}

func periodLockedBy(closedThrough *time.Time, entryDate time.Time) bool {
	if closedThrough == nil {
		return false
	}
	lock := dateOnlyUTC(*closedThrough)
	entry := dateOnlyUTC(entryDate)
	return !entry.After(lock)
}

func periodLockedError(closedThrough, entryDate time.Time) error {
	lockDate := dateOnlyUTC(closedThrough).Format("2006-01-02")
	return apperrors.New(
		http.StatusUnprocessableEntity,
		fmt.Sprintf("accounting period is locked through %s", lockDate),
		map[string]interface{}{
			"reason":               periodLockedReason,
			"books_closed_through": lockDate,
			"entry_date":           dateOnlyUTC(entryDate).Format("2006-01-02"),
		},
	)
}

// IsPeriodLockedError reports whether err is the period-lock 422, so callers
// like the backfill runner can count locked documents as skipped rather than
// failed.
func IsPeriodLockedError(err error) bool {
	appErr, ok := err.(*apperrors.AppError)
	if !ok || appErr == nil {
		return false
	}
	details, ok := appErr.Details.(map[string]interface{})
	if !ok {
		return false
	}
	return details["reason"] == periodLockedReason
}

func dateOnlyUTC(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}
