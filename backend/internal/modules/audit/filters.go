package audit

import (
	"strconv"
	"strings"
	"time"

	apperrors "pastries-pos/internal/shared/errors"
)

const defaultActivityLogTimezone = "Asia/Dubai"

type ActivityLogFilter struct {
	BusinessID   string
	EntityType   string
	TargetUserID string
	Cursor       string
	Limit        int
	StartUTC     *time.Time
	EndUTC       *time.Time
	Timezone     string
}

func NormalizeActivityLogLimit(limitValue string) (int, error) {
	limit := 50
	if strings.TrimSpace(limitValue) != "" {
		parsed, err := strconv.Atoi(strings.TrimSpace(limitValue))
		if err != nil {
			return 0, apperrors.BadRequest("invalid limit", nil)
		}
		limit = parsed
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return limit, nil
}

func (r *Repository) ResolveActivityLogFilter(businessID string, query ActivityLogQuery, limit int) (*ActivityLogFilter, error) {
	locationName := strings.TrimSpace(query.Timezone)
	if locationName == "" {
		var err error
		locationName, err = r.BusinessTimezone(businessID)
		if err != nil {
			return nil, err
		}
	}
	if locationName == "" {
		locationName = defaultActivityLogTimezone
	}

	location, err := time.LoadLocation(locationName)
	if err != nil {
		return nil, apperrors.BadRequest("invalid timezone", map[string]string{"timezone": locationName})
	}

	startUTC, endUTC, err := resolveActivityLogDateRange(query.DateFrom, query.DateTo, location)
	if err != nil {
		return nil, err
	}

	return &ActivityLogFilter{
		BusinessID:   businessID,
		EntityType:   strings.TrimSpace(query.EntityType),
		TargetUserID: strings.TrimSpace(query.TargetUserID),
		Cursor:       strings.TrimSpace(query.Cursor),
		Limit:        limit,
		StartUTC:     startUTC,
		EndUTC:       endUTC,
		Timezone:     locationName,
	}, nil
}

func resolveActivityLogDateRange(dateFromValue, dateToValue string, location *time.Location) (*time.Time, *time.Time, error) {
	var startUTC *time.Time
	var endUTC *time.Time
	var fromDate *time.Time
	var toDate *time.Time

	if strings.TrimSpace(dateFromValue) != "" {
		parsed, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(dateFromValue), location)
		if err != nil {
			return nil, nil, apperrors.BadRequest("date_from must use YYYY-MM-DD", nil)
		}
		fromDate = &parsed
		start := time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, location).UTC()
		startUTC = &start
	}

	if strings.TrimSpace(dateToValue) != "" {
		parsed, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(dateToValue), location)
		if err != nil {
			return nil, nil, apperrors.BadRequest("date_to must use YYYY-MM-DD", nil)
		}
		toDate = &parsed
		end := time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, location).AddDate(0, 0, 1).UTC()
		endUTC = &end
	}

	if fromDate != nil && toDate != nil && fromDate.After(*toDate) {
		return nil, nil, apperrors.BadRequest("date_from cannot be after date_to", nil)
	}

	return startUTC, endUTC, nil
}
