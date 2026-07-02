package audit

import (
	"strconv"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListActivityLogs(currentUser *utils.AuthContext, entityType, cursor, limitValue string) (*ActivityLogListResponse, error) {
	limit := 50
	if limitValue != "" {
		parsed, err := strconv.Atoi(limitValue)
		if err != nil {
			return nil, apperrors.BadRequest("invalid limit", nil)
		}
		limit = parsed
	}

	logs, nextCursorValue, err := s.repo.ListActivity(currentUser.BusinessID, entityType, "", cursor, limit)
	if err != nil {
		return nil, apperrors.Internal("failed to list activity logs")
	}

	items, err := s.repo.BuildActivityResponses(currentUser.BusinessID, logs)
	if err != nil {
		return nil, apperrors.Internal("failed to enrich activity logs")
	}

	var nextCursor *string
	if nextCursorValue != "" {
		nextCursor = &nextCursorValue
	}

	return &ActivityLogListResponse{Items: items, NextCursor: nextCursor}, nil
}
